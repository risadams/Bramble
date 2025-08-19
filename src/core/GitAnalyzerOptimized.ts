import simpleGit, { SimpleGit, BranchSummary } from 'simple-git';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Re-export existing interfaces
export * from './GitAnalyzer.js';
import { 
  BranchInfo, 
  AnalysisResult, 
  ProgressCallback, 
  CommitActivity 
} from './GitAnalyzer.js';

interface BatchBranchData {
  name: string;
  commit: string;
  current: boolean;
  lastCommitDate?: string;
  commitCount?: number;
  mergedIntoDefault?: boolean;
}

interface BranchAnalysisTask {
  branchName: string;
  branchCommit: string;
  repositoryPath: string;
  defaultBranch: string;
  analysisDepth: 'fast' | 'normal' | 'deep';
}

interface BranchAnalysisResult {
  branchName: string;
  success: boolean;
  data?: Partial<BranchInfo>;
  error?: string;
}

export interface OptimizedAnalysisOptions {
  maxConcurrency?: number;
  analysisDepth?: 'fast' | 'normal' | 'deep';
  maxBranches?: number;
  skipStalerThan?: number; // days
  enableCaching?: boolean;
  streamResults?: boolean;
}

export class GitAnalyzerOptimized {
  private git: SimpleGit;
  private cache = new Map<string, any>();
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      const filteredBranches = this.filterBranches(bulkBranchData, maxBranches, skipStalerThan);
      
      if (filteredBranches.length === 0) {
        throw new Error('No branches found or all branches filtered out');
      }

      // Phase 3: Parallel detailed analysis
      progressCallback?.(3, 5, `Analyzing ${filteredBranches.length} branches in parallel...`);
      const detailedBranches = await this.analyzebranchesInParallel(
        filteredBranches,
        analysisDepth,
        maxConcurrency,
        progressCallback,
        streamResults
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
      // Get all branch information in one call
      const branches = await this.git.branch();
      const branchNames = Object.keys(branches.branches);
      
      // Get bulk commit information using git for-each-ref
      const forEachRefOutput = await this.git.raw([
        'for-each-ref',
        '--format=%(refname:short)|%(objectname)|%(committerdate:iso8601)|%(authorname)',
        'refs/heads/'
      ]);

      // Parse the bulk output
      const refData = new Map<string, { commit: string; date: string; author: string }>();
      forEachRefOutput.split('\n').forEach(line => {
        if (line.trim()) {
          const [name, commit, date, author] = line.split('|');
          if (name && commit && date && author) {
            refData.set(name, { commit, date, author });
          }
        }
      });

      // Get commit counts in bulk using git rev-list
      const commitCounts = await this.getBulkCommitCounts(branchNames);
      
      // Get merged status in bulk
      const mergedBranches = await this.getBulkMergedStatus();

      return branchNames.map(branchName => {
        const branch = branches.branches[branchName];
        const refInfo = refData.get(branchName);
        
        if (!branch || !refInfo) return null;

        return {
          name: branchName,
          commit: branch.commit,
          current: branchName === branches.current,
          lastCommitDate: refInfo.date,
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
        
        for (const branchName of batch) {
          try {
            const output = await this.git.raw(['rev-list', '--count', branchName]);
            commitCounts.set(branchName, parseInt(output.trim()) || 0);
          } catch {
            commitCounts.set(branchName, 0);
          }
        }
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
  private filterBranches(
    branches: BatchBranchData[],
    maxBranches: number,
    skipStalerThan: number
  ): BatchBranchData[] {
    let filtered = [...branches];

    // Filter by staleness
    if (skipStalerThan < Infinity) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - skipStalerThan);
      
      filtered = filtered.filter(branch => {
        if (!branch.lastCommitDate) return true;
        return new Date(branch.lastCommitDate) > cutoffDate;
      });
    }

    // Sort by activity (most recent first) and limit
    filtered.sort((a, b) => {
      const dateA = a.lastCommitDate ? new Date(a.lastCommitDate) : new Date(0);
      const dateB = b.lastCommitDate ? new Date(b.lastCommitDate) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return filtered.slice(0, maxBranches);
  }

  /**
   * Analyze branches in parallel using worker threads
   */
  private async analyzebranchesInParallel(
    branches: BatchBranchData[],
    analysisDepth: 'fast' | 'normal' | 'deep',
    maxConcurrency: number,
    progressCallback?: ProgressCallback,
    streamResults?: boolean
  ): Promise<BranchInfo[]> {
    return new Promise((resolve, reject) => {
      const results: BranchInfo[] = [];
      const tasks: BranchAnalysisTask[] = branches.map(branch => ({
        branchName: branch.name,
        branchCommit: branch.commit,
        repositoryPath: this.repositoryPath,
        defaultBranch: 'main', // This should come from cache
        analysisDepth
      }));

      let completedTasks = 0;
      let workers: Worker[] = [];
      let taskIndex = 0;

      const createWorker = () => {
        // In production, the worker file will be in the dist directory
        const isProduction = process.env.NODE_ENV === 'production' || !this.__dirname.includes('src');
        const workerPath = isProduction 
          ? path.join(this.__dirname, 'branchWorker.js')
          : path.join(this.__dirname, '../dist/core/branchWorker.js');
        
        const worker = new Worker(workerPath);
        
        worker.on('message', (result: BranchAnalysisResult) => {
          completedTasks++;
          
          if (result.success && result.data) {
            // Convert partial data to full BranchInfo
            const branch = branches.find(b => b.name === result.branchName);
            if (branch) {
              const branchInfo: BranchInfo = {
                name: branch.name,
                current: branch.current,
                commit: branch.commit,
                lastActivity: new Date(branch.lastCommitDate || Date.now()),
                isStale: false, // Will be calculated
                commitCount: branch.commitCount || 0,
                divergence: { ahead: 0, behind: 0 },
                contributors: [],
                mergeable: branch.mergedIntoDefault || false,
                conflictCount: 0,
                commitFrequency: [],
                size: 0,
                ...result.data
              };
              
              // Calculate staleness
              branchInfo.isStale = this.isStale(branchInfo.lastActivity);
              
              results.push(branchInfo);
              
              if (streamResults && progressCallback) {
                // Stream result immediately (would need UI changes)
              }
            }
          }
          
          // Update progress
          if (progressCallback) {
            progressCallback(
              completedTasks, 
              tasks.length, 
              `Analyzed: ${result.branchName} (${completedTasks}/${tasks.length})`
            );
          }
          
          // Assign next task or complete
          if (taskIndex < tasks.length) {
            worker.postMessage(tasks[taskIndex++]);
          } else {
            worker.terminate();
            
            if (completedTasks === tasks.length) {
              // Sort results to match original order
              const sortedResults = results.sort((a, b) => {
                const indexA = branches.findIndex(branch => branch.name === a.name);
                const indexB = branches.findIndex(branch => branch.name === b.name);
                return indexA - indexB;
              });
              resolve(sortedResults);
            }
          }
        });

        worker.on('error', reject);
        return worker;
      };

      // Create workers and start processing
      const numWorkers = Math.min(maxConcurrency, tasks.length);
      for (let i = 0; i < numWorkers; i++) {
        const worker = createWorker();
        workers.push(worker);
        
        if (taskIndex < tasks.length) {
          worker.postMessage(tasks[taskIndex++]);
        }
      }

      // Handle empty task list
      if (tasks.length === 0) {
        resolve([]);
      }
    });
  }

  private async getDefaultBranch(): Promise<string> {
    if (this.cache.has('defaultBranch')) {
      return this.cache.get('defaultBranch');
    }
    
    try {
      const result = await this.git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const defaultBranch = result.replace('refs/remotes/origin/', '').trim();
      this.cache.set('defaultBranch', defaultBranch);
      return defaultBranch;
    } catch {
      const fallback = 'main';
      this.cache.set('defaultBranch', fallback);
      return fallback;
    }
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
      
      branch.contributors.forEach(contributor => {
        contributorMap.set(contributor, (contributorMap.get(contributor) || 0) + branch.commitCount);
      });
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
