export interface CommitActivity {
  date: string;
  count: number;
}

export type BranchType = 'local' | 'remote' | 'both';

export interface BranchInfo {
  name: string;
  current: boolean;
  commit: string;
  lastActivity: Date;
  lastCommitAuthor: string;
  isStale: boolean;
  commitCount: number;
  branchType: BranchType;
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
    localBranches: number;
    remoteBranches: number;
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
