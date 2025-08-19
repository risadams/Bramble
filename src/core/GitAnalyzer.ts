import simpleGit, { SimpleGit, BranchSummary, LogResult, StatusResult } from 'simple-git';

export interface CommitActivity {
  date: string;
  count: number;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  lastActivity: Date;
  isStale: boolean;
  commitCount: number;
  divergence: {
    ahead: number;
    behind: number;
  };
  contributors: string[];
  mergeable: boolean;
  conflictCount: number;
  commitFrequency: CommitActivity[];
  size: number; // lines of code changed
}

export interface AnalysisResult {
  repository: {
    path: string;
    defaultBranch: string;
    totalBranches: number;
    staleBranches: number;
    mergeableBranches: number;
    conflictedBranches: number;
  };
  branches: BranchInfo[];
  statistics: {
    averageAge: number;
    mostActive: string;
    leastActive: string;
    totalCommits: number;
    averageCommitsPerBranch: number;
    totalContributors: number;
    averageBranchSize: number;
    mostConflicted: string;
  };
  activityOverview: {
    dailyActivity: CommitActivity[];
    topContributors: Array<{ name: string; commits: number }>;
    branchTypes: Array<{ type: string; count: number }>;
  };
}

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(private repositoryPath: string) {
    this.git = simpleGit(repositoryPath);
  }

  public async analyze(progressCallback?: ProgressCallback): Promise<AnalysisResult> {
    try {
      progressCallback?.(0, 4, 'Getting branch information...');
      
      // Get branch information
      const branches = await this.git.branch();
      progressCallback?.(1, 4, 'Analyzing branches...');
      
      const branchInfos = await this.analyzeBranches(branches, progressCallback);
      progressCallback?.(2, 4, 'Calculating statistics...');
      
      // Calculate statistics
      const statistics = this.calculateStatistics(branchInfos);
      progressCallback?.(3, 4, 'Generating activity overview...');
      
      // Generate activity overview
      const activityOverview = this.generateActivityOverview(branchInfos);
      
      // Get repository info
      const defaultBranch = await this.getDefaultBranch();
      progressCallback?.(4, 4, 'Analysis complete!');
      
      return {
        repository: {
          path: this.repositoryPath,
          defaultBranch,
          totalBranches: branchInfos.length,
          staleBranches: branchInfos.filter(b => b.isStale).length,
          mergeableBranches: branchInfos.filter(b => b.mergeable).length,
          conflictedBranches: branchInfos.filter(b => b.conflictCount > 0).length
        },
        branches: branchInfos,
        statistics,
        activityOverview
      };
    } catch (error) {
      throw new Error(`Failed to analyze repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeBranches(branches: BranchSummary, progressCallback?: ProgressCallback): Promise<BranchInfo[]> {
    const branchInfos: BranchInfo[] = [];
    const defaultBranch = await this.getDefaultBranch();
    const branchNames = Object.keys(branches.branches);
    const totalBranches = branchNames.length;
    
    for (let i = 0; i < branchNames.length; i++) {
      const branchName = branchNames[i];
      if (!branchName) continue;
      
      const branch = branches.branches[branchName];
      if (!branch) continue;

      // Report progress for branch analysis
      progressCallback?.(i + 1, totalBranches, `Analyzing branch: ${branchName}`);

      try {
        const log = await this.git.log({ from: branch.commit, maxCount: 1 });
        const commitCount = await this.getCommitCount(branchName);
        const contributors = await this.getContributors(branchName);
        const divergence = await this.getDivergence(branchName, defaultBranch);
        const commitFrequency = await this.getCommitFrequency(branchName);
        const mergeable = await this.checkMergeable(branchName, defaultBranch);
        const conflictCount = await this.getConflictCount(branchName, defaultBranch);
        const size = await this.getBranchSize(branchName);
        
        const lastActivity = log.latest?.date ? new Date(log.latest.date) : new Date();
        const isStale = this.isStale(lastActivity);

        branchInfos.push({
          name: branchName,
          current: branchName === branches.current,
          commit: branch.commit,
          lastActivity,
          isStale,
          commitCount,
          divergence,
          contributors,
          mergeable,
          conflictCount,
          commitFrequency,
          size
        });
      } catch (error) {
        // Skip branches that can't be analyzed
        continue;
      }
    }
    
    return branchInfos;
  }

  private async getDefaultBranch(): Promise<string> {
    try {
      const branches = await this.git.branch();
      return branches.current || 'main';
    } catch {
      return 'main';
    }
  }

  private async getCommitCount(branchName: string): Promise<number> {
    try {
      const log = await this.git.log({ from: branchName });
      return log.total;
    } catch {
      return 0;
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

  private async getDivergence(branchName: string, defaultBranch: string): Promise<{ ahead: number; behind: number }> {
    try {
      if (branchName === defaultBranch) {
        return { ahead: 0, behind: 0 };
      }

      // Get commits ahead of default branch
      const aheadLog = await this.git.log({ from: defaultBranch, to: branchName });
      const ahead = aheadLog.total;

      // Get commits behind default branch
      const behindLog = await this.git.log({ from: branchName, to: defaultBranch });
      const behind = behindLog.total;

      return { ahead, behind };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private async getCommitFrequency(branchName: string): Promise<CommitActivity[]> {
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

      return Array.from(activityMap.entries()).map(([date, count]) => ({
        date,
        count
      }));
    } catch {
      return [];
    }
  }

  private async checkMergeable(branchName: string, defaultBranch: string): Promise<boolean> {
    try {
      if (branchName === defaultBranch) {
        return true;
      }

      // Simulate merge to check for conflicts
      const status = await this.git.status();
      if (!status.isClean()) {
        return false; // Working directory not clean
      }

      // This is a simplified check - in reality you'd need more sophisticated conflict detection
      const mergeBase = await this.git.raw(['merge-base', branchName, defaultBranch]);
      const branchCommit = await this.git.revparse([branchName]);
      const defaultCommit = await this.git.revparse([defaultBranch]);
      
      // If merge base equals one of the branches, it's a fast-forward merge
      return mergeBase.trim() === branchCommit.trim() || mergeBase.trim() === defaultCommit.trim();
    } catch {
      return false;
    }
  }

  private async getConflictCount(branchName: string, defaultBranch: string): Promise<number> {
    try {
      if (branchName === defaultBranch) {
        return 0;
      }

      // Get files that differ between branches
      const diffSummary = await this.git.diffSummary([defaultBranch, branchName]);
      
      // This is a simplified metric - count changed files as potential conflicts
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

    const averageAge = totalAge / branches.length / (1000 * 60 * 60 * 24); // Convert to days

    const sortedByActivity = [...branches].sort((a, b) => b.commitCount - a.commitCount);
    const sortedByConflicts = [...branches].sort((a, b) => b.conflictCount - a.conflictCount);
    
    const totalCommits = branches.reduce((sum, branch) => sum + branch.commitCount, 0);
    const averageCommitsPerBranch = totalCommits / branches.length;
    
    // Get unique contributors
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
    // Combine daily activity from all branches
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

    // Classify branch types
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
