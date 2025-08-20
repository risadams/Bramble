/**
 * Types for stale branch detection and cleanup
 */

export interface StaleBranchConfig {
  /** Days since last activity to consider a branch stale */
  staleDaysThreshold: number;
  /** Days since last activity to consider a branch very stale */
  veryStaleThreshold: number;
  /** Branches to exclude from stale detection */
  excludedBranches: string[];
  /** Patterns to exclude from stale detection */
  excludePatterns: string[];
  /** Whether to check for associated pull requests */
  checkPullRequests: boolean;
  /** Whether to check for branch protection rules */
  checkProtectedBranches: boolean;
  /** Minimum commits to consider a branch for cleanup */
  minimumCommits: number;
}

export interface StaleBranchInfo {
  /** Branch name */
  name: string;
  /** Last commit date */
  lastCommitDate: Date;
  /** Last commit hash */
  lastCommitHash: string;
  /** Last commit author */
  lastCommitAuthor: string;
  /** Days since last activity */
  daysSinceActivity: number;
  /** Number of commits in this branch */
  commitCount: number;
  /** Whether this branch has an associated pull request */
  hasActivePullRequest: boolean;
  /** Whether this branch is protected */
  isProtected: boolean;
  /** Branch tracking information */
  tracking: {
    /** Remote branch exists */
    hasRemote: boolean;
    /** Remote name */
    remoteName?: string | undefined;
    /** Ahead/behind information */
    ahead: number;
    behind: number;
  };
  /** Risk assessment for deletion */
  risk: BranchDeletionRisk;
  /** Cleanup recommendation */
  recommendation: CleanupRecommendation;
}

export type BranchDeletionRisk = 'low' | 'medium' | 'high' | 'critical';

export interface CleanupRecommendation {
  /** Whether this branch should be cleaned up */
  shouldCleanup: boolean;
  /** Reason for the recommendation */
  reason: string;
  /** Actions to take before cleanup */
  precautions: string[];
  /** Cleanup priority (1-10, 10 being highest) */
  priority: number;
}

export interface StaleBranchReport {
  /** Scan date and time */
  scanDate: Date;
  /** Repository path scanned */
  repositoryPath: string;
  /** Total branches analyzed */
  totalBranches: number;
  /** Stale branches found */
  staleBranches: StaleBranchInfo[];
  /** Summary by risk level */
  riskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Estimated space savings from cleanup */
  estimatedSavings: {
    /** Number of branches recommended for cleanup */
    branchCount: number;
    /** Estimated disk space savings (in bytes) */
    diskSpace: number;
  };
  /** Configuration used for analysis */
  config: StaleBranchConfig;
}

export interface CleanupOperation {
  /** Operation type */
  type: 'delete-local' | 'delete-remote' | 'delete-both' | 'archive';
  /** Branch to operate on */
  branchName: string;
  /** Whether this is a dry run */
  dryRun: boolean;
  /** Backup created before deletion */
  backupCreated?: string;
  /** Operation timestamp */
  timestamp: Date;
  /** Operation result */
  result?: CleanupResult;
}

export interface CleanupResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string | undefined;
  /** Actions taken */
  actionsTaken: string[];
  /** Whether a backup was created */
  backupPath?: string | undefined;
}

export interface CleanupPlan {
  /** Planned operations */
  operations: CleanupOperation[];
  /** Total branches to be cleaned */
  totalBranches: number;
  /** Risk assessment of the cleanup plan */
  overallRisk: BranchDeletionRisk;
  /** Estimated time for cleanup */
  estimatedDuration: number;
  /** Safety checks to perform */
  safetyChecks: SafetyCheck[];
}

export interface SafetyCheck {
  /** Check name */
  name: string;
  /** Check description */
  description: string;
  /** Whether the check passed */
  passed: boolean;
  /** Warning message if check failed */
  warning?: string | undefined;
  /** Whether this check is critical (blocks cleanup) */
  critical: boolean;
}

export interface ArchiveOptions {
  /** Archive format */
  format: 'zip' | 'tar' | 'bundle';
  /** Archive destination */
  destination: string;
  /** Whether to include commit history */
  includeHistory: boolean;
  /** Compression level */
  compressionLevel: number;
}

export interface StaleCleanupOptions {
  /** Whether to perform a dry run */
  dryRun: boolean;
  /** Whether to create backups before deletion */
  createBackups: boolean;
  /** Whether to delete remote branches */
  deleteRemote: boolean;
  /** Whether to archive branches instead of deleting */
  archive: boolean;
  /** Archive options if archiving */
  archiveOptions?: ArchiveOptions;
  /** Force cleanup even for high-risk branches */
  force: boolean;
  /** Interactive mode for confirmation */
  interactive: boolean;
  /** Maximum number of branches to process in one operation */
  batchSize: number;
}
