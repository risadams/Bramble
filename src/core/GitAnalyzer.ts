import simpleGit, { SimpleGit, BranchSummary } from 'simple-git';
import { cpus } from 'os';
import { ConfigManager } from '../utils/ConfigManager.js';

// Import types from centralized location
import { 
  BranchInfo, 
  BranchType,
  AnalysisResult, 
  ProgressCallback, 
  CommitActivity 
} from '../types/analysis.js';

interface BatchBranchData {
  name: string;
  commit: string;
  current: boolean;
  lastCommitDate?: string;
  lastCommitAuthor?: string;
  commitCount?: number;
  mergedIntoDefault?: boolean;
}

export interface OptimizedAnalysisOptions {
  maxConcurrency?: number;
  analysisDepth?: 'fast' | 'normal' | 'deep';
  maxBranches?: number;
  skipStalerThan?: number; // days
  enableCaching?: boolean;
  streamResults?: boolean;
}

export class GitAnalyzer {
  private git: SimpleGit;
  private cache = new Map<string, any>();

  constructor(private repositoryPath: string) {
    this.git = simpleGit(repositoryPath);
  }

  public async analyze(
    progressCallback?: ProgressCallback,
    options: OptimizedAnalysisOptions = {}
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    // Set defaults
    const {
      maxConcurrency = Math.min(cpus().length, 8),
      analysisDepth = 'normal',
      maxBranches = Infinity,
      skipStalerThan = Infinity,
      enableCaching = true,
      streamResults = false
    } = options;

    try {
      progressCallback?.(0, 5, 'Initializing optimized analysis...');
      
      // Phase 1: Bulk branch information gathering
      progressCallback?.(1, 5, 'Gathering branch metadata in bulk...');
      const bulkBranchData = await this.getBulkBranchData();
      
      // Phase 2: Filter and prioritize branches
      progressCallback?.(2, 5, 'Filtering and prioritizing branches...');
      const filteredBranches = await this.filterBranches(bulkBranchData, maxBranches, skipStalerThan);
      
      if (filteredBranches.length === 0) {
        throw new Error('No branches found or all branches filtered out');
      }

      // Phase 3: Parallel detailed analysis using Promise batching
      progressCallback?.(3, 5, `Analyzing ${filteredBranches.length} branches in parallel...`);
      const detailedBranches = await this.analyzeBranchesInBatches(
        filteredBranches,
        analysisDepth,
        maxConcurrency,
        progressCallback
      );

      // Phase 4: Calculate statistics
      progressCallback?.(4, 5, 'Calculating statistics...');
      const statistics = this.calculateStatistics(detailedBranches);
      
      // Phase 5: Generate activity overview
      progressCallback?.(5, 5, 'Generating activity overview...');
      const activityOverview = this.generateActivityOverview(detailedBranches);
      
      const defaultBranch = await this.getDefaultBranch();
      const endTime = Date.now();
      
      if (progressCallback) {
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        progressCallback(5, 5, `Analysis complete in ${duration}s!`);
      }

      return {
        repository: {
          path: this.repositoryPath,
          defaultBranch,
          totalBranches: detailedBranches.length,
          localBranches: detailedBranches.filter(b => b.branchType === 'local').length,
          remoteBranches: detailedBranches.filter(b => b.branchType === 'remote').length,
          staleBranches: detailedBranches.filter(b => b.isStale).length,
          mergeableBranches: detailedBranches.filter(b => b.mergeable).length,
          conflictedBranches: detailedBranches.filter(b => b.conflictCount > 0).length
        },
        branches: detailedBranches,
        statistics,
        activityOverview
      };
    } catch (error) {
      throw new Error(`Failed to analyze repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Use bulk git operations to gather basic branch information efficiently
   */
  private async getBulkBranchData(): Promise<BatchBranchData[]> {
    try {
      const config = ConfigManager.loadConfig();
      
      // Get all branch information in one call
      const branches = await this.git.branch(['-a']); // Always get all branches
      let branchNames = Object.keys(branches.branches);
      
      // Filter out remote branches if not wanted in the configuration
      if (!config.includeRemoteBranches) {
        branchNames = branchNames.filter(name => !name.startsWith('remotes/'));
      }
      
      // Ensure the current branch is included (sometimes it's missing from branches.branches)
      if (branches.current && !branchNames.includes(branches.current)) {
        branchNames.push(branches.current);
      }
      
      // Ensure the default branch is included
      const defaultBranch = await this.getDefaultBranch();
      if (!branchNames.includes(defaultBranch)) {
        branchNames.push(defaultBranch);
      }
      
      // Get bulk commit information using git for-each-ref
      const forEachRefOutput = await this.git.raw([
        'for-each-ref',
        '--format=%(refname:short)|%(objectname)|%(committerdate:iso8601)|%(authorname)',
        'refs/heads/',
        'refs/remotes/'
      ]);

      // Parse the bulk output
      const refData = new Map<string, { commit: string; date: string; author: string }>();
      forEachRefOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const [name, commit, date, author] = line.split('|');
          if (name && commit && date && author) {
            refData.set(name, { commit, date, author });
            
            // For remote branches, also map the remotes/ prefix format
            if (name.startsWith('origin/') && !name.startsWith('remotes/')) {
              refData.set(`remotes/${name}`, { commit, date, author });
            }
          }
        }
      });

      // Get commit counts in bulk using git rev-list
      const commitCounts = await this.getBulkCommitCounts(branchNames);
      
      // Get merged status in bulk
      const mergedBranches = await this.getBulkMergedStatus();

      return branchNames.map(branchName => {
        const branch = branches.branches[branchName];
        let refInfo = refData.get(branchName);
        
        // Try alternative mapping for remote branches
        if (!refInfo && branchName.startsWith('remotes/')) {
          const altName = branchName.replace('remotes/', '');
          refInfo = refData.get(altName);
        }
        
        // For branches not in branches.branches (like current branch), create minimal info
        if (!branch && refInfo) {
          return {
            name: branchName,
            commit: refInfo.commit,
            current: branchName === branches.current,
            lastCommitDate: refInfo.date,
            lastCommitAuthor: refInfo.author,
            commitCount: commitCounts.get(branchName) || 0,
            mergedIntoDefault: mergedBranches.has(branchName)
          } as BatchBranchData;
        }
        
        if (!branch || !refInfo) return null;

        return {
          name: branchName,
          commit: branch.commit,
          current: branchName === branches.current,
          lastCommitDate: refInfo.date,
          lastCommitAuthor: refInfo.author,
          commitCount: commitCounts.get(branchName) || 0,
          mergedIntoDefault: mergedBranches.has(branchName)
        } as BatchBranchData;
      }).filter((branch): branch is BatchBranchData => branch !== null);
    } catch (error) {
      throw new Error(`Failed to get bulk branch data: ${error}`);
    }
  }

  /**
   * Get commit counts for multiple branches efficiently
   */
  private async getBulkCommitCounts(branchNames: string[]): Promise<Map<string, number>> {
    const commitCounts = new Map<string, number>();
    
    try {
      // Process branches in batches to avoid command line length limits
      const batchSize = 50;
      for (let i = 0; i < branchNames.length; i += batchSize) {
        const batch = branchNames.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (branchName) => {
          try {
            const output = await this.git.raw(['rev-list', '--count', branchName]);
            return { name: branchName, count: parseInt(output.trim()) || 0 };
          } catch {
            return { name: branchName, count: 0 };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ name, count }) => {
          commitCounts.set(name, count);
        });
      }
    } catch (error) {
      // Fallback: set all to 0
      branchNames.forEach(name => commitCounts.set(name, 0));
    }
    
    return commitCounts;
  }

  /**
   * Get list of branches merged into default branch
   */
  private async getBulkMergedStatus(): Promise<Set<string>> {
    try {
      const defaultBranch = await this.getDefaultBranch();
      const mergedOutput = await this.git.raw(['branch', '--merged', defaultBranch]);
      
      const mergedBranches = new Set<string>();
      mergedOutput.split('\n').forEach(line => {
        const branch = line.trim().replace(/^\*\s*/, '');
        if (branch && branch !== defaultBranch) {
          mergedBranches.add(branch);
        }
      });
      
      return mergedBranches;
    } catch {
      return new Set();
    }
  }

  /**
   * Filter branches based on criteria to reduce analysis load
   */
  private async filterBranches(
    branches: BatchBranchData[],
    maxBranches: number,
    skipStalerThan: number
  ): Promise<BatchBranchData[]> {
    let filtered = [...branches];
    const defaultBranch = await this.getDefaultBranch();

    // Filter by staleness, but never filter out the default branch or current branch
    if (skipStalerThan < Infinity) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - skipStalerThan);
      
      filtered = filtered.filter(branch => {
        // Always include default branch and current branch
        if (branch.name === defaultBranch || branch.current) {
          return true;
        }
        
        if (!branch.lastCommitDate) return true;
        return new Date(branch.lastCommitDate) > cutoffDate;
      });
    }

    // Sort by activity (most recent first), but keep default branch at top if it exists
    filtered.sort((a, b) => {
      // Always prioritize default branch and current branch
      if (a.name === defaultBranch) return -1;
      if (b.name === defaultBranch) return 1;
      if (a.current) return -1;
      if (b.current) return 1;
      
      const dateA = a.lastCommitDate ? new Date(a.lastCommitDate) : new Date(0);
      const dateB = b.lastCommitDate ? new Date(b.lastCommitDate) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return filtered.slice(0, maxBranches);
  }

  /**
   * Analyze branches in batches using Promise.all for parallelization
   */
  private async analyzeBranchesInBatches(
    branches: BatchBranchData[],
    analysisDepth: 'fast' | 'normal' | 'deep',
    maxConcurrency: number,
    progressCallback?: ProgressCallback
  ): Promise<BranchInfo[]> {
    const results: BranchInfo[] = [];
    let completedCount = 0;
    
    // Process branches in batches to control concurrency
    for (let i = 0; i < branches.length; i += maxConcurrency) {
      const batch = branches.slice(i, i + maxConcurrency);
      
      // Process each batch in parallel
      const batchPromises = batch.map(async (branch) => {
        try {
          const branchInfo = await this.analyzeSingleBranch(branch, analysisDepth);
          completedCount++;
          
          if (progressCallback) {
            progressCallback(
              completedCount,
              branches.length,
              `Analyzed: ${branch.name} (${completedCount}/${branches.length})`
            );
          }
          
          return branchInfo;
        } catch (error) {
          // Return basic branch info if detailed analysis fails
          return this.createBasicBranchInfo(branch);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Analyze a single branch with configurable depth
   */
  private async analyzeSingleBranch(
    branch: BatchBranchData,
    analysisDepth: 'fast' | 'normal' | 'deep'
  ): Promise<BranchInfo> {
    const defaultBranch = await this.getDefaultBranch();
    
    // Base branch info
    const branchInfo: BranchInfo = {
      name: branch.name,
      current: branch.current,
      commit: branch.commit,
      lastActivity: new Date(branch.lastCommitDate || Date.now()),
      lastCommitAuthor: branch.lastCommitAuthor || 'Unknown',
      isStale: false, // Will be calculated below
      commitCount: branch.commitCount || 0,
      branchType: this.determineBranchType(branch.name),
      divergence: { ahead: 0, behind: 0 },
      contributors: [],
      mergeable: branch.mergedIntoDefault || false,
      conflictCount: 0,
      commitFrequency: [],
      size: 0
    };

    // Calculate staleness
    branchInfo.isStale = this.isStale(branchInfo.lastActivity);

    if (analysisDepth === 'fast') {
      // Fast mode: minimal additional analysis
      branchInfo.divergence = await this.getDivergenceFast(branch.name, defaultBranch);
    } else if (analysisDepth === 'normal') {
      // Normal mode: balanced analysis
      const [divergence, contributors, size] = await Promise.all([
        this.getDivergenceFast(branch.name, defaultBranch),
        this.getContributorsFast(branch.name),
        this.getBranchSizeFast(branch.name)
      ]);

      branchInfo.divergence = divergence;
      branchInfo.contributors = contributors;
      branchInfo.size = size;
      branchInfo.commitFrequency = await this.getCommitFrequencyFast(branch.name);
    } else {
      // Deep mode: comprehensive analysis
      const [divergence, contributors, conflictCount, commitFrequency, size] = await Promise.all([
        this.getDivergence(branch.name, defaultBranch),
        this.getContributors(branch.name),
        this.getConflictCount(branch.name, defaultBranch),
        this.getCommitFrequency(branch.name),
        this.getBranchSize(branch.name)
      ]);

      branchInfo.divergence = divergence;
      branchInfo.contributors = contributors;
      branchInfo.conflictCount = conflictCount;
      branchInfo.commitFrequency = commitFrequency;
      branchInfo.size = size;
      branchInfo.mergeable = await this.checkMergeable(branch.name, defaultBranch);
    }

    return branchInfo;
  }

  /**
   * Determine if a branch is local, remote, or both
   */
  private determineBranchType(branchName: string): BranchType {
    if (branchName.startsWith('remotes/')) {
      return 'remote';
    }
    return 'local';
  }

  /**
   * Create basic branch info when detailed analysis fails
   */
  private createBasicBranchInfo(branch: BatchBranchData): BranchInfo {
    return {
      name: branch.name,
      current: branch.current,
      commit: branch.commit,
      lastActivity: new Date(branch.lastCommitDate || Date.now()),
      lastCommitAuthor: branch.lastCommitAuthor || 'Unknown',
      isStale: this.isStale(new Date(branch.lastCommitDate || Date.now())),
      commitCount: branch.commitCount || 0,
      branchType: this.determineBranchType(branch.name),
      divergence: { ahead: 0, behind: 0 },
      contributors: [],
      mergeable: branch.mergedIntoDefault || false,
      conflictCount: 0,
      commitFrequency: [],
      size: 0
    };
  }

  // Fast implementations using optimized git commands
  private async getDivergenceFast(branchName: string, defaultBranch: string): Promise<{ ahead: number; behind: number }> {
    if (branchName === defaultBranch) {
      return { ahead: 0, behind: 0 };
    }

    try {
      // Use git rev-list --count for faster divergence calculation
      const [aheadResult, behindResult] = await Promise.all([
        this.git.raw(['rev-list', '--count', `${defaultBranch}..${branchName}`]),
        this.git.raw(['rev-list', '--count', `${branchName}..${defaultBranch}`])
      ]);

      return {
        ahead: parseInt(aheadResult.trim()) || 0,
        behind: parseInt(behindResult.trim()) || 0
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private async getContributorsFast(branchName: string): Promise<string[]> {
    try {
      // Get unique authors more efficiently
      const output = await this.git.raw([
        'log', 
        '--format=%an', 
        '--no-merges',
        branchName,
        '--max-count=50' // Limit to recent commits for performance
      ]);

      const authors = new Set(
        output.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
      );

      return Array.from(authors);
    } catch {
      return [];
    }
  }

  private async getBranchSizeFast(branchName: string): Promise<number> {
    try {
      // Get diff stats more efficiently
      const output = await this.git.raw([
        'diff', 
        '--shortstat', 
        `${branchName}~1..${branchName}`
      ]);

      // Parse "X files changed, Y insertions(+), Z deletions(-)"
      const match = output.match(/(\d+) insertions?\(\+\)[^,]*(?:, (\d+) deletions?\(-\))?/);
      if (match) {
        const insertions = parseInt(match[1] || '0') || 0;
        const deletions = parseInt(match[2] || '0') || 0;
        return insertions + deletions;
      }

      return 0;
    } catch {
      return 0;
    }
  }

  private async getCommitFrequencyFast(branchName: string): Promise<Array<{ date: string; count: number }>> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const output = await this.git.raw([
        'log',
        '--format=%cd',
        '--date=short',
        '--since=' + thirtyDaysAgo.toISOString().split('T')[0],
        branchName,
        '--max-count=100' // Limit for performance
      ]);

      const activityMap = new Map<string, number>();
      output.split('\n').forEach(line => {
        const date = line.trim();
        if (date) {
          activityMap.set(date, (activityMap.get(date) || 0) + 1);
        }
      });

      return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
    } catch {
      return [];
    }
  }

  // Original comprehensive implementations for deep mode (from GitAnalyzer)
  private async getDivergence(branchName: string, defaultBranch: string): Promise<{ ahead: number; behind: number }> {
    if (branchName === defaultBranch) {
      return { ahead: 0, behind: 0 };
    }

    try {
      const aheadLog = await this.git.log({ from: defaultBranch, to: branchName });
      const behindLog = await this.git.log({ from: branchName, to: defaultBranch });

      return {
        ahead: aheadLog.total,
        behind: behindLog.total
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private async getContributors(branchName: string): Promise<string[]> {
    try {
      const log = await this.git.log({ from: branchName });
      const authors = new Set(log.all.map(commit => commit.author_name));
      return Array.from(authors);
    } catch {
      return [];
    }
  }

  private async checkMergeable(branchName: string, defaultBranch: string): Promise<boolean> {
    if (branchName === defaultBranch) {
      return true;
    }

    try {
      const status = await this.git.status();
      if (!status.isClean()) {
        return false;
      }

      const mergeBase = await this.git.raw(['merge-base', branchName, defaultBranch]);
      const branchCommit = await this.git.revparse([branchName]);
      const defaultCommit = await this.git.revparse([defaultBranch]);
      
      return mergeBase.trim() === branchCommit.trim() || mergeBase.trim() === defaultCommit.trim();
    } catch {
      return false;
    }
  }

  private async getConflictCount(branchName: string, defaultBranch: string): Promise<number> {
    if (branchName === defaultBranch) {
      return 0;
    }

    try {
      const diffSummary = await this.git.diffSummary([defaultBranch, branchName]);
      return diffSummary.files.length;
    } catch {
      return 0;
    }
  }

  private async getBranchSize(branchName: string): Promise<number> {
    try {
      const diffSummary = await this.git.diffSummary([branchName]);
      return diffSummary.insertions + diffSummary.deletions;
    } catch {
      return 0;
    }
  }

  private async getCommitFrequency(branchName: string): Promise<Array<{ date: string; count: number }>> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const log = await this.git.log({ 
        from: branchName,
        since: thirtyDaysAgo.toISOString()
      });

      const activityMap = new Map<string, number>();
      
      for (const commit of log.all) {
        if (commit.date) {
          const date = new Date(commit.date).toISOString().split('T')[0];
          if (date) {
            activityMap.set(date, (activityMap.get(date) || 0) + 1);
          }
        }
      }

      return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
    } catch {
      return [];
    }
  }

  private async getDefaultBranch(): Promise<string> {
    if (this.cache.has('defaultBranch')) {
      return this.cache.get('defaultBranch');
    }
    
    const config = ConfigManager.loadConfig();
    
    try {
      // First, try to get the default branch from git remote
      const result = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const remoteBranch = result.replace('refs/remotes/origin/', '').trim();
      
      if (remoteBranch) {
        this.cache.set('defaultBranch', remoteBranch);
        return remoteBranch;
      }
    } catch {
      // Remote HEAD not set, continue to local detection
    }
    
    try {
      // Get all local branches
      const branches = await this.git.branch();
      const localBranches = Object.keys(branches.branches);
      
      // Check configured candidates in order
      for (const candidate of config.defaultBranchCandidates) {
        if (localBranches.includes(candidate)) {
          this.cache.set('defaultBranch', candidate);
          return candidate;
        }
      }
      
      // If no configured candidates exist, use the current branch if available
      if (branches.current) {
        this.cache.set('defaultBranch', branches.current);
        return branches.current;
      }
      
      // If current branch is not available, use the first local branch
      if (localBranches.length > 0) {
        const firstBranch = localBranches[0];
        if (firstBranch) {
          this.cache.set('defaultBranch', firstBranch);
          return firstBranch;
        }
      }
    } catch {
      // Fall through to final fallback
    }
    
    // Final fallback: use the first configured candidate
    const fallback = config.defaultBranchCandidates[0] || 'main';
    this.cache.set('defaultBranch', fallback);
    return fallback;
  }

  private isStale(lastActivity: Date): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastActivity < thirtyDaysAgo;
  }

  private calculateStatistics(branches: BranchInfo[]): AnalysisResult['statistics'] {
    if (branches.length === 0) {
      return {
        averageAge: 0,
        mostActive: '',
        leastActive: '',
        totalCommits: 0,
        averageCommitsPerBranch: 0,
        totalContributors: 0,
        averageBranchSize: 0,
        mostConflicted: ''
      };
    }

    const now = new Date();
    const totalAge = branches.reduce((sum, branch) => {
      return sum + (now.getTime() - branch.lastActivity.getTime());
    }, 0);

    const averageAge = totalAge / branches.length / (1000 * 60 * 60 * 24);
    const sortedByActivity = [...branches].sort((a, b) => b.commitCount - a.commitCount);
    const sortedByConflicts = [...branches].sort((a, b) => b.conflictCount - a.conflictCount);
    
    const totalCommits = branches.reduce((sum, branch) => sum + branch.commitCount, 0);
    const averageCommitsPerBranch = totalCommits / branches.length;
    
    const allContributors = new Set<string>();
    branches.forEach(branch => {
      branch.contributors.forEach(contributor => allContributors.add(contributor));
    });
    
    const totalSize = branches.reduce((sum, branch) => sum + branch.size, 0);
    const averageBranchSize = totalSize / branches.length;

    return {
      averageAge,
      mostActive: sortedByActivity[0]?.name || '',
      leastActive: sortedByActivity[sortedByActivity.length - 1]?.name || '',
      totalCommits,
      averageCommitsPerBranch,
      totalContributors: allContributors.size,
      averageBranchSize,
      mostConflicted: sortedByConflicts[0]?.name || ''
    };
  }

  private generateActivityOverview(branches: BranchInfo[]): AnalysisResult['activityOverview'] {
    const dailyActivityMap = new Map<string, number>();
    const contributorMap = new Map<string, number>();
    
    branches.forEach(branch => {
      branch.commitFrequency.forEach(activity => {
        dailyActivityMap.set(activity.date, (dailyActivityMap.get(activity.date) || 0) + activity.count);
      });
      
      // Fix: Distribute branch commits proportionally among contributors
      const contributorCount = branch.contributors.length;
      if (contributorCount > 0) {
        const commitsPerContributor = Math.ceil(branch.commitCount / contributorCount);
        branch.contributors.forEach(contributor => {
          contributorMap.set(contributor, (contributorMap.get(contributor) || 0) + commitsPerContributor);
        });
      }
    });

    const dailyActivity = Array.from(dailyActivityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topContributors = Array.from(contributorMap.entries())
      .map(([name, commits]) => ({ name, commits }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);

    const branchTypes = [
      { type: 'Active', count: branches.filter(b => !b.isStale).length },
      { type: 'Stale', count: branches.filter(b => b.isStale).length },
      { type: 'Mergeable', count: branches.filter(b => b.mergeable).length },
      { type: 'Conflicted', count: branches.filter(b => b.conflictCount > 0).length }
    ];

    return {
      dailyActivity,
      topContributors,
      branchTypes
    };
  }
}
