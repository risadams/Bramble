import { parentPort, isMainThread } from 'worker_threads';
import simpleGit, { SimpleGit } from 'simple-git';

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
  data?: {
    divergence?: { ahead: number; behind: number };
    contributors?: string[];
    mergeable?: boolean;
    conflictCount?: number;
    commitFrequency?: Array<{ date: string; count: number }>;
    size?: number;
  };
  error?: string;
}

class BranchWorker {
  private git: SimpleGit | null = null;
  private repositoryPath: string = '';

  async processBranch(task: BranchAnalysisTask): Promise<BranchAnalysisResult> {
    try {
      // Initialize git instance if needed
      if (!this.git || this.repositoryPath !== task.repositoryPath) {
        this.repositoryPath = task.repositoryPath;
        this.git = simpleGit(task.repositoryPath);
      }

      const data: BranchAnalysisResult['data'] = {};

      // Fast mode: minimal analysis
      if (task.analysisDepth === 'fast') {
        data.mergeable = await this.checkMergeableFast(task.branchName, task.defaultBranch);
        data.divergence = { ahead: 0, behind: 0 }; // Skip expensive divergence calculation
        data.contributors = [];
        data.conflictCount = 0;
        data.commitFrequency = [];
        data.size = 0;
      }
      
      // Normal mode: balanced analysis
      else if (task.analysisDepth === 'normal') {
        const [divergence, contributors, mergeable, size] = await Promise.all([
          this.getDivergenceFast(task.branchName, task.defaultBranch),
          this.getContributorsFast(task.branchName),
          this.checkMergeableFast(task.branchName, task.defaultBranch),
          this.getBranchSizeFast(task.branchName)
        ]);

        data.divergence = divergence;
        data.contributors = contributors;
        data.mergeable = mergeable;
        data.conflictCount = 0; // Skip expensive conflict detection in normal mode
        data.commitFrequency = await this.getCommitFrequencyFast(task.branchName);
        data.size = size;
      }
      
      // Deep mode: comprehensive analysis
      else {
        const [divergence, contributors, mergeable, conflictCount, commitFrequency, size] = await Promise.all([
          this.getDivergence(task.branchName, task.defaultBranch),
          this.getContributors(task.branchName),
          this.checkMergeable(task.branchName, task.defaultBranch),
          this.getConflictCount(task.branchName, task.defaultBranch),
          this.getCommitFrequency(task.branchName),
          this.getBranchSize(task.branchName)
        ]);

        data.divergence = divergence;
        data.contributors = contributors;
        data.mergeable = mergeable;
        data.conflictCount = conflictCount;
        data.commitFrequency = commitFrequency;
        data.size = size;
      }

      return {
        branchName: task.branchName,
        success: true,
        data
      };

    } catch (error) {
      return {
        branchName: task.branchName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Fast implementations using optimized git commands
  private async getDivergenceFast(branchName: string, defaultBranch: string): Promise<{ ahead: number; behind: number }> {
    if (!this.git || branchName === defaultBranch) {
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
    if (!this.git) return [];

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

  private async checkMergeableFast(branchName: string, defaultBranch: string): Promise<boolean> {
    if (!this.git || branchName === defaultBranch) {
      return true;
    }

    try {
      // Quick check using merge-base
      const mergeBase = await this.git.raw(['merge-base', branchName, defaultBranch]);
      const branchCommit = await this.git.raw(['rev-parse', branchName]);
      
      // If merge-base equals branch commit, it's already merged (fast-forward)
      return mergeBase.trim() === branchCommit.trim();
    } catch {
      return false;
    }
  }

  private async getBranchSizeFast(branchName: string): Promise<number> {
    if (!this.git) return 0;

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
    if (!this.git) return [];

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

  // Original comprehensive implementations for deep mode
  private async getDivergence(branchName: string, defaultBranch: string): Promise<{ ahead: number; behind: number }> {
    if (!this.git || branchName === defaultBranch) {
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
    if (!this.git) return [];

    try {
      const log = await this.git.log({ from: branchName });
      const authors = new Set(log.all.map(commit => commit.author_name));
      return Array.from(authors);
    } catch {
      return [];
    }
  }

  private async checkMergeable(branchName: string, defaultBranch: string): Promise<boolean> {
    if (!this.git || branchName === defaultBranch) {
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
    if (!this.git || branchName === defaultBranch) {
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
    if (!this.git) return 0;

    try {
      const diffSummary = await this.git.diffSummary([branchName]);
      return diffSummary.insertions + diffSummary.deletions;
    } catch {
      return 0;
    }
  }

  private async getCommitFrequency(branchName: string): Promise<Array<{ date: string; count: number }>> {
    if (!this.git) return [];

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
}

// Worker thread handling
if (!isMainThread && parentPort) {
  const worker = new BranchWorker();

  parentPort.on('message', async (task: BranchAnalysisTask) => {
    try {
      const result = await worker.processBranch(task);
      parentPort?.postMessage(result);
    } catch (error) {
      parentPort?.postMessage({
        branchName: task.branchName,
        success: false,
        error: error instanceof Error ? error.message : 'Worker error'
      });
    }
  });
}
