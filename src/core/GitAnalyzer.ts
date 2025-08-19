import simpleGit, { SimpleGit, BranchSummary, LogResult } from 'simple-git';

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
}

export interface AnalysisResult {
  repository: {
    path: string;
    defaultBranch: string;
    totalBranches: number;
    staleBranches: number;
  };
  branches: BranchInfo[];
  statistics: {
    averageAge: number;
    mostActive: string;
    leastActive: string;
    totalCommits: number;
  };
}

export class GitAnalyzer {
  private git: SimpleGit;

  constructor(private repositoryPath: string) {
    this.git = simpleGit(repositoryPath);
  }

  public async analyze(): Promise<AnalysisResult> {
    try {
      // Get branch information
      const branches = await this.git.branch();
      const branchInfos = await this.analyzeBranches(branches);
      
      // Calculate statistics
      const statistics = this.calculateStatistics(branchInfos);
      
      // Get repository info
      const defaultBranch = await this.getDefaultBranch();
      
      return {
        repository: {
          path: this.repositoryPath,
          defaultBranch,
          totalBranches: branchInfos.length,
          staleBranches: branchInfos.filter(b => b.isStale).length
        },
        branches: branchInfos,
        statistics
      };
    } catch (error) {
      throw new Error(`Failed to analyze repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeBranches(branches: BranchSummary): Promise<BranchInfo[]> {
    const branchInfos: BranchInfo[] = [];
    
    for (const branchName of Object.keys(branches.branches)) {
      const branch = branches.branches[branchName];
      if (!branch) continue;

      try {
        const log = await this.git.log({ from: branch.commit, maxCount: 1 });
        const commitCount = await this.getCommitCount(branchName);
        const contributors = await this.getContributors(branchName);
        const divergence = await this.getDivergence(branchName);
        
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
          contributors
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

  private async getDivergence(branchName: string): Promise<{ ahead: number; behind: number }> {
    try {
      // This is a simplified implementation
      // In a real implementation, you'd compare with the default branch
      return { ahead: 0, behind: 0 };
    } catch {
      return { ahead: 0, behind: 0 };
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
        totalCommits: 0
      };
    }

    const now = new Date();
    const totalAge = branches.reduce((sum, branch) => {
      return sum + (now.getTime() - branch.lastActivity.getTime());
    }, 0);

    const averageAge = totalAge / branches.length / (1000 * 60 * 60 * 24); // Convert to days

    const sortedByActivity = [...branches].sort((a, b) => b.commitCount - a.commitCount);
    const totalCommits = branches.reduce((sum, branch) => sum + branch.commitCount, 0);

    return {
      averageAge,
      mostActive: sortedByActivity[0]?.name || '',
      leastActive: sortedByActivity[sortedByActivity.length - 1]?.name || '',
      totalCommits
    };
  }
}
