import { SimpleGit } from 'simple-git';
import * as path from 'path';
import { promises as fs } from 'fs';
import {
  StaleBranchConfig,
  StaleBranchInfo,
  StaleBranchReport,
  CleanupOperation,
  CleanupResult,
  CleanupPlan,
  SafetyCheck,
  StaleCleanupOptions,
  BranchDeletionRisk,
  CleanupRecommendation,
  ArchiveOptions
} from '../types/staleBranches.js';

/**
 * Service for detecting and cleaning up stale branches
 */
export class StaleBranchService {
  private git: SimpleGit;
  private repositoryPath: string;

  constructor(git: SimpleGit, repositoryPath: string) {
    this.git = git;
    this.repositoryPath = repositoryPath;
  }

  /**
   * Analyze repository for stale branches
   */
  async analyzeStaleBranches(config: StaleBranchConfig): Promise<StaleBranchReport> {
    const scanDate = new Date();
    const branches = await this.getAllBranches();
    const staleBranches: StaleBranchInfo[] = [];

    for (const branch of branches) {
      if (this.shouldSkipBranch(branch, config)) {
        continue;
      }

      const branchInfo = await this.analyzeBranch(branch, config);
      if (branchInfo && this.isStale(branchInfo, config)) {
        staleBranches.push(branchInfo);
      }
    }

    const riskSummary = this.calculateRiskSummary(staleBranches);
    const estimatedSavings = await this.calculateEstimatedSavings(staleBranches);

    return {
      scanDate,
      repositoryPath: this.repositoryPath,
      totalBranches: branches.length,
      staleBranches,
      riskSummary,
      estimatedSavings,
      config
    };
  }

  /**
   * Create a cleanup plan for stale branches
   */
  async createCleanupPlan(
    staleBranches: StaleBranchInfo[],
    options: StaleCleanupOptions
  ): Promise<CleanupPlan> {
    const operations: CleanupOperation[] = [];

    for (const branch of staleBranches) {
      if (!branch.recommendation.shouldCleanup && !options.force) {
        continue;
      }

      const operation: CleanupOperation = {
        type: this.determineOperationType(branch, options),
        branchName: branch.name,
        dryRun: options.dryRun,
        timestamp: new Date()
      };

      operations.push(operation);
    }

    const overallRisk = this.calculateOverallRisk(operations, staleBranches);
    const estimatedDuration = this.estimateCleanupDuration(operations);
    const safetyChecks = await this.performSafetyChecks(operations, staleBranches);

    return {
      operations,
      totalBranches: operations.length,
      overallRisk,
      estimatedDuration,
      safetyChecks
    };
  }

  /**
   * Execute cleanup plan
   */
  async executeCleanupPlan(
    plan: CleanupPlan,
    options: StaleCleanupOptions
  ): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    // Check safety conditions
    const criticalFailures = plan.safetyChecks.filter(check => check.critical && !check.passed);
    if (criticalFailures.length > 0 && !options.force) {
      throw new Error(`Critical safety checks failed: ${criticalFailures.map(c => c.name).join(', ')}`);
    }

    // Process operations in batches
    const batches = this.createBatches(plan.operations, options.batchSize);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(operation => this.executeOperation(operation, options))
      );
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming the system
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get all branches in the repository
   */
  private async getAllBranches(): Promise<string[]> {
    try {
      const branchSummary = await this.git.branch(['-a']);
      return branchSummary.all.filter(branch => 
        !branch.startsWith('remotes/origin/HEAD') && 
        branch !== branchSummary.current
      );
    } catch (error) {
      console.warn('Failed to get branches:', error);
      return [];
    }
  }

  /**
   * Check if a branch should be skipped from analysis
   */
  private shouldSkipBranch(branch: string, config: StaleBranchConfig): boolean {
    // Skip excluded branches
    if (config.excludedBranches.includes(branch)) {
      return true;
    }

    // Skip based on patterns
    for (const pattern of config.excludePatterns) {
      const regex = new RegExp(pattern);
      if (regex.test(branch)) {
        return true;
      }
    }

    // Skip remote tracking branches for local analysis
    if (branch.startsWith('remotes/')) {
      return true;
    }

    return false;
  }

  /**
   * Analyze a specific branch for staleness
   */
  private async analyzeBranch(
    branchName: string,
    config: StaleBranchConfig
  ): Promise<StaleBranchInfo | null> {
    try {
      // Get last commit info
      const log = await this.git.log(['-1', branchName]);
      if (!log.latest) {
        return null;
      }

      const lastCommit = log.latest;
      const lastCommitDate = new Date(lastCommit.date);
      const daysSinceActivity = Math.floor(
        (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get commit count
      const commitCount = await this.getCommitCount(branchName);

      // Get tracking information
      const tracking = await this.getBranchTracking(branchName);

      // Check for pull requests (if integration is available)
      const hasActivePullRequest = config.checkPullRequests 
        ? await this.checkActivePullRequest(branchName)
        : false;

      // Check if protected
      const isProtected = config.checkProtectedBranches
        ? await this.checkBranchProtection(branchName)
        : false;

      const branchInfo: StaleBranchInfo = {
        name: branchName,
        lastCommitDate,
        lastCommitHash: lastCommit.hash,
        lastCommitAuthor: lastCommit.author_name || 'Unknown',
        daysSinceActivity,
        commitCount,
        hasActivePullRequest,
        isProtected,
        tracking,
        risk: 'low', // Will be calculated
        recommendation: { shouldCleanup: false, reason: '', precautions: [], priority: 0 }
      };

      // Calculate risk and recommendation
      branchInfo.risk = this.calculateBranchRisk(branchInfo, config);
      branchInfo.recommendation = this.generateRecommendation(branchInfo, config);

      return branchInfo;
    } catch (error) {
      console.warn(`Failed to analyze branch ${branchName}:`, error);
      return null;
    }
  }

  /**
   * Check if a branch is considered stale
   */
  private isStale(branch: StaleBranchInfo, config: StaleBranchConfig): boolean {
    return branch.daysSinceActivity >= config.staleDaysThreshold;
  }

  /**
   * Get commit count for a branch
   */
  private async getCommitCount(branchName: string): Promise<number> {
    try {
      const log = await this.git.log([branchName]);
      return log.all.length;
    } catch (error) {
      console.warn(`Failed to get commit count for ${branchName}:`, error);
      return 0;
    }
  }

  /**
   * Get branch tracking information
   */
  private async getBranchTracking(branchName: string) {
    try {
      const status = await this.git.status();
      const remoteBranches = await this.git.branch(['-r']);
      
      const hasRemote = remoteBranches.all.some(remote => 
        remote.includes(`origin/${branchName}`)
      );

      let ahead = 0;
      let behind = 0;

      if (hasRemote) {
        try {
          const revList = await this.git.raw([
            'rev-list', '--count', '--left-right',
            `${branchName}...origin/${branchName}`
          ]);
          const [aheadStr, behindStr] = revList.trim().split('\t');
          ahead = parseInt(aheadStr || '0') || 0;
          behind = parseInt(behindStr || '0') || 0;
        } catch (error) {
          // Ignore errors in rev-list
        }
      }

      const tracking = {
        hasRemote,
        ahead,
        behind,
        ...(hasRemote && { remoteName: 'origin' })
      };

      return tracking;
    } catch (error) {
      return {
        hasRemote: false,
        ahead: 0,
        behind: 0
      };
    }
  }

  /**
   * Check if branch has an active pull request
   */
  private async checkActivePullRequest(branchName: string): Promise<boolean> {
    // This would integrate with GitHub/GitLab API
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Check if branch is protected
   */
  private async checkBranchProtection(branchName: string): Promise<boolean> {
    // This would integrate with GitHub/GitLab API
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Calculate branch deletion risk
   */
  private calculateBranchRisk(
    branch: StaleBranchInfo,
    config: StaleBranchConfig
  ): BranchDeletionRisk {
    if (branch.isProtected || branch.hasActivePullRequest) {
      return 'critical';
    }

    if (branch.tracking.hasRemote && branch.tracking.ahead > 0) {
      return 'high';
    }

    if (branch.commitCount >= config.minimumCommits * 2) {
      return 'medium';
    }

    if (branch.daysSinceActivity >= config.veryStaleThreshold) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Generate cleanup recommendation
   */
  private generateRecommendation(
    branch: StaleBranchInfo,
    config: StaleBranchConfig
  ): CleanupRecommendation {
    const precautions: string[] = [];
    let shouldCleanup = false;
    let reason = '';
    let priority = 0;

    if (branch.isProtected) {
      reason = 'Branch is protected - should not be deleted';
      precautions.push('Remove branch protection before cleanup');
    } else if (branch.hasActivePullRequest) {
      reason = 'Branch has an active pull request';
      precautions.push('Close or merge pull request before cleanup');
    } else if (branch.tracking.hasRemote && branch.tracking.ahead > 0) {
      reason = 'Branch has unpushed commits';
      precautions.push('Push commits to remote or create backup');
      shouldCleanup = false;
    } else if (branch.commitCount < config.minimumCommits) {
      reason = 'Branch has too few commits - likely experimental';
      shouldCleanup = true;
      priority = 8;
    } else if (branch.daysSinceActivity >= config.veryStaleThreshold) {
      reason = 'Branch is very stale with no recent activity';
      shouldCleanup = true;
      priority = 7;
      precautions.push('Verify no important work will be lost');
    } else if (branch.daysSinceActivity >= config.staleDaysThreshold) {
      reason = 'Branch is stale but may contain important work';
      shouldCleanup = false;
      priority = 3;
      precautions.push('Review commits before cleanup');
    }

    if (branch.tracking.hasRemote) {
      precautions.push('Consider deleting remote branch as well');
    }

    return {
      shouldCleanup,
      reason,
      precautions,
      priority
    };
  }

  /**
   * Calculate risk summary
   */
  private calculateRiskSummary(staleBranches: StaleBranchInfo[]) {
    return {
      low: staleBranches.filter(b => b.risk === 'low').length,
      medium: staleBranches.filter(b => b.risk === 'medium').length,
      high: staleBranches.filter(b => b.risk === 'high').length,
      critical: staleBranches.filter(b => b.risk === 'critical').length
    };
  }

  /**
   * Calculate estimated savings from cleanup
   */
  private async calculateEstimatedSavings(staleBranches: StaleBranchInfo[]) {
    const cleanupCandidates = staleBranches.filter(b => b.recommendation.shouldCleanup);
    
    // Rough estimate: each branch takes about 1KB of metadata
    const estimatedDiskSpace = cleanupCandidates.length * 1024;

    return {
      branchCount: cleanupCandidates.length,
      diskSpace: estimatedDiskSpace
    };
  }

  /**
   * Determine operation type based on branch and options
   */
  private determineOperationType(
    branch: StaleBranchInfo,
    options: StaleCleanupOptions
  ): CleanupOperation['type'] {
    if (options.archive) {
      return 'archive';
    }

    if (branch.tracking.hasRemote) {
      return options.deleteRemote ? 'delete-both' : 'delete-local';
    }

    return 'delete-local';
  }

  /**
   * Calculate overall risk of cleanup plan
   */
  private calculateOverallRisk(
    operations: CleanupOperation[],
    staleBranches: StaleBranchInfo[]
  ): BranchDeletionRisk {
    const branchesMap = new Map(staleBranches.map(b => [b.name, b]));
    const risks = operations
      .map(op => branchesMap.get(op.branchName)?.risk)
      .filter(Boolean) as BranchDeletionRisk[];

    if (risks.includes('critical')) return 'critical';
    if (risks.includes('high')) return 'high';
    if (risks.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Estimate cleanup duration
   */
  private estimateCleanupDuration(operations: CleanupOperation[]): number {
    // Rough estimate: 2 seconds per operation
    return operations.length * 2;
  }

  /**
   * Perform safety checks before cleanup
   */
  private async performSafetyChecks(
    operations: CleanupOperation[],
    staleBranches: StaleBranchInfo[]
  ): Promise<SafetyCheck[]> {
    const checks: SafetyCheck[] = [];

    // Check for unsaved work
    checks.push({
      name: 'Working Directory Clean',
      description: 'Ensure working directory has no uncommitted changes',
      passed: await this.isWorkingDirectoryClean(),
      critical: false
    });

    // Check for protected branches
    const protectedBranches = staleBranches.filter(b => b.isProtected);
    const protectedCheck: SafetyCheck = {
      name: 'No Protected Branches',
      description: 'Ensure no protected branches are being deleted',
      passed: protectedBranches.length === 0,
      critical: true
    };
    if (protectedBranches.length > 0) {
      protectedCheck.warning = `Protected branches: ${protectedBranches.map(b => b.name).join(', ')}`;
    }
    checks.push(protectedCheck);

    // Check for unpushed commits
    const unpushedBranches = staleBranches.filter(b => b.tracking.ahead > 0);
    const unpushedCheck: SafetyCheck = {
      name: 'No Unpushed Commits',
      description: 'Ensure no branches have unpushed commits',
      passed: unpushedBranches.length === 0,
      critical: false
    };
    if (unpushedBranches.length > 0) {
      unpushedCheck.warning = `Branches with unpushed commits: ${unpushedBranches.map(b => b.name).join(', ')}`;
    }
    checks.push(unpushedCheck);

    // Check git repository state
    checks.push({
      name: 'Git Repository Accessible',
      description: 'Ensure git repository is accessible and healthy',
      passed: await this.isGitRepositoryHealthy(),
      critical: true
    });

    return checks;
  }

  /**
   * Check if working directory is clean
   */
  private async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.files.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if git repository is healthy
   */
  private async isGitRepositoryHealthy(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create batches from operations
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Execute a single cleanup operation
   */
  private async executeOperation(
    operation: CleanupOperation,
    options: StaleCleanupOptions
  ): Promise<CleanupResult> {
    const actionsTaken: string[] = [];

    try {
      // Create backup if requested
      let backupPath: string | undefined;
      if (options.createBackups && !operation.dryRun) {
        backupPath = await this.createBranchBackup(operation.branchName, options.archiveOptions);
        operation.backupCreated = backupPath;
        actionsTaken.push(`Created backup at ${backupPath}`);
      }

      if (operation.dryRun) {
        actionsTaken.push(`[DRY RUN] Would ${operation.type} branch ${operation.branchName}`);
        const result: CleanupResult = {
          success: true,
          actionsTaken
        };
        if (backupPath) {
          result.backupPath = backupPath;
        }
        return result;
      }

      // Execute the actual operation
      switch (operation.type) {
        case 'delete-local':
          await this.git.deleteLocalBranch(operation.branchName);
          actionsTaken.push(`Deleted local branch ${operation.branchName}`);
          break;

        case 'delete-remote':
          await this.git.push('origin', operation.branchName, ['--delete']);
          actionsTaken.push(`Deleted remote branch ${operation.branchName}`);
          break;

        case 'delete-both':
          await this.git.deleteLocalBranch(operation.branchName);
          await this.git.push('origin', operation.branchName, ['--delete']);
          actionsTaken.push(`Deleted local and remote branch ${operation.branchName}`);
          break;

        case 'archive':
          if (!backupPath) {
            backupPath = await this.createBranchBackup(operation.branchName, options.archiveOptions);
          }
          await this.git.deleteLocalBranch(operation.branchName);
          actionsTaken.push(`Archived and deleted branch ${operation.branchName}`);
          break;
      }

      const result: CleanupResult = {
        success: true,
        actionsTaken
      };
      if (backupPath) {
        result.backupPath = backupPath;
      }

      operation.result = result;
      return result;
    } catch (error) {
      const result: CleanupResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        actionsTaken
      };

      operation.result = result;
      return result;
    }
  }

  /**
   * Create a backup of a branch
   */
  private async createBranchBackup(
    branchName: string,
    archiveOptions?: ArchiveOptions
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.repositoryPath, '.bramble-backups');
    
    // Ensure backup directory exists
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const backupFile = path.join(backupDir, `${branchName}-${timestamp}.bundle`);
    
    // Create git bundle
    await this.git.raw(['bundle', 'create', backupFile, branchName]);
    
    return backupFile;
  }

  /**
   * Get default stale branch configuration
   */
  static getDefaultConfig(): StaleBranchConfig {
    return {
      staleDaysThreshold: 30,
      veryStaleThreshold: 90,
      excludedBranches: ['main', 'master', 'develop', 'development', 'staging', 'production'],
      excludePatterns: ['^release/.*', '^hotfix/.*'],
      checkPullRequests: true,
      checkProtectedBranches: true,
      minimumCommits: 3
    };
  }

  /**
   * Get default cleanup options
   */
  static getDefaultCleanupOptions(): StaleCleanupOptions {
    return {
      dryRun: true,
      createBackups: true,
      deleteRemote: false,
      archive: false,
      force: false,
      interactive: true,
      batchSize: 10
    };
  }
}
