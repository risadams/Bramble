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
  // Integration data
  pullRequests?: Array<{
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    url: string;
  }>;
  hasOpenPR?: boolean;
  lastPRActivity?: Date;
  protection?: {
    enforced: boolean;
    requiredReviews: number;
  };
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
    // Integration metadata
    hostingProvider?: string;
    repositoryUrl?: string;
    isPrivate?: boolean;
    language?: string;
    stars?: number;
    openPRCount?: number;
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
    // Integration statistics
    branchesWithPRs?: number;
    averagePRAge?: number;
    protectedBranches?: number;
  };
  activityOverview: {
    dailyActivity: CommitActivity[];
    topContributors: Array<{ name: string; commits: number }>;
    branchTypes: Array<{ type: string; count: number }>;
  };
  // Integration data
  integrations?: {
    provider: string;
    configured: boolean;
    pullRequests?: Array<{
      number: number;
      title: string;
      branch: string;
      state: string;
      author: string;
    }>;
    totalPRs?: number;
    openPRs?: number;
  };
}

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}
