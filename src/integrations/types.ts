export interface PullRequest {
  id: number;
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
  author: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
  url: string;
  reviewStatus?: 'approved' | 'changes_requested' | 'pending' | 'commented';
  mergeable?: boolean;
  conflicts?: boolean;
  labels: string[];
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  author: string;
  state: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  url: string;
  labels: string[];
  linkedBranches?: string[];
}

export interface RepositoryMetadata {
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
  description?: string;
  isPrivate: boolean;
  language?: string;
  stars?: number;
  forks?: number;
  lastActivity: Date;
  topics: string[];
}

export interface BranchEnrichment {
  pullRequests: PullRequest[];
  issues: Issue[];
  hasOpenPR: boolean;
  lastPRActivity?: Date;
  linkedIssues?: Issue[];
  deploymentStatus?: 'deployed' | 'pending' | 'failed' | 'none';
  protection?: {
    enforced: boolean;
    requiredReviews: number;
    dismissStaleReviews: boolean;
    requireCodeOwnerReviews: boolean;
  };
}

export interface GitHostingProvider {
  name: string;
  detectRepository(repositoryPath: string): Promise<RepositoryMetadata | null>;
  enrichBranch(branch: string, repository: RepositoryMetadata): Promise<BranchEnrichment>;
  listPullRequests(repository: RepositoryMetadata): Promise<PullRequest[]>;
  listIssues(repository: RepositoryMetadata): Promise<Issue[]>;
  isConfigured(): boolean;
}
