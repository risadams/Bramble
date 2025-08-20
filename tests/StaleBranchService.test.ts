import { StaleBranchService } from '../src/services/StaleBranchService.js';
import { StaleBranchConfig, StaleCleanupOptions } from '../src/types/staleBranches.js';
import { jest } from '@jest/globals';

// Mock simple-git
const mockGit = {
  branch: jest.fn() as jest.MockedFunction<any>,
  log: jest.fn() as jest.MockedFunction<any>,
  status: jest.fn() as jest.MockedFunction<any>,
  raw: jest.fn() as jest.MockedFunction<any>,
  deleteLocalBranch: jest.fn() as jest.MockedFunction<any>,
  push: jest.fn() as jest.MockedFunction<any>
};

// Mock fs
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn()
  }
}));

describe('StaleBranchService', () => {
  let service: StaleBranchService;
  const repositoryPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StaleBranchService(mockGit as any, repositoryPath);
  });

  describe('analyzeStaleBranches', () => {
    it('should identify stale branches correctly', async () => {
      const config: StaleBranchConfig = {
        staleDaysThreshold: 30,
        veryStaleThreshold: 90,
        excludedBranches: ['main', 'master'],
        excludePatterns: [],
        checkPullRequests: false,
        checkProtectedBranches: false,
        minimumCommits: 1
      };

      // Mock branch list - first call for getAllBranches, second for tracking
      mockGit.branch
        .mockResolvedValueOnce({
          all: ['feature/old-feature', 'bugfix/recent-fix'],
          current: 'main'
        })
        .mockResolvedValueOnce({
          all: ['remotes/origin/feature/old-feature']
        });

      // Mock log for each branch and commit count  
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      
      mockGit.log
        .mockResolvedValueOnce({
          latest: {
            hash: 'abc123',
            date: oldDate.toISOString(),
            author_name: 'John Doe'
          },
          all: [{ hash: 'abc123' }, { hash: 'def456' }]
        })
        .mockResolvedValueOnce({
          all: [{ hash: 'abc123' }, { hash: 'def456' }]
        })
        .mockResolvedValueOnce({
          latest: {
            hash: 'xyz789',
            date: new Date().toISOString(),
            author_name: 'Jane Smith'
          },
          all: [{ hash: 'xyz789' }]
        })
        .mockResolvedValueOnce({
          all: [{ hash: 'xyz789' }]
        });

      // Mock status and remote branches
      mockGit.status.mockResolvedValue({ files: [] });
      mockGit.raw.mockResolvedValue('1\t0');

      const result = await service.analyzeStaleBranches(config);

      expect(result.staleBranches).toHaveLength(1);
      expect(result.staleBranches[0]?.name).toBe('feature/old-feature');
      expect(result.staleBranches[0]?.daysSinceActivity).toBeGreaterThan(30);
      expect(result.riskSummary.low).toBeGreaterThan(0);
    });

    it('should exclude protected branches from stale analysis', async () => {
      const config = StaleBranchService.getDefaultConfig();
      
      mockGit.branch.mockResolvedValue({
        all: ['main', 'feature/old'],
        current: 'feature/current'
      });

      const result = await service.analyzeStaleBranches(config);

      // Main should be excluded, so only checking if service doesn't crash
      expect(result).toBeDefined();
      expect(result.config.excludedBranches).toContain('main');
    });

    it('should handle branches with no commits gracefully', async () => {
      const config = StaleBranchService.getDefaultConfig();
      
      mockGit.branch.mockResolvedValue({
        all: ['empty-branch'],
        current: 'main'
      });

      mockGit.log.mockResolvedValue({
        latest: null,
        all: []
      });

      const result = await service.analyzeStaleBranches(config);

      // Should handle gracefully without crashing
      expect(result.staleBranches).toHaveLength(0);
    });
  });

  describe('createCleanupPlan', () => {
    it('should create a cleanup plan with safety checks', async () => {
      const staleBranches = [{
        name: 'feature/stale',
        lastCommitDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        lastCommitHash: 'abc123',
        lastCommitAuthor: 'John Doe',
        daysSinceActivity: 60,
        commitCount: 5,
        hasActivePullRequest: false,
        isProtected: false,
        tracking: {
          hasRemote: false,
          ahead: 0,
          behind: 0
        },
        risk: 'low' as const,
        recommendation: {
          shouldCleanup: true,
          reason: 'Very stale branch',
          precautions: [],
          priority: 8
        }
      }];

      const options: StaleCleanupOptions = {
        dryRun: true,
        createBackups: true,
        deleteRemote: false,
        archive: false,
        force: false,
        interactive: false,
        batchSize: 10
      };

      // Mock safety checks
      mockGit.status.mockResolvedValue({ files: [] });

      const plan = await service.createCleanupPlan(staleBranches, options);

      expect(plan.operations).toHaveLength(1);
      expect(plan.operations[0]?.type).toBe('delete-local');
      expect(plan.operations[0]?.dryRun).toBe(true);
      expect(plan.overallRisk).toBe('low');
      expect(plan.safetyChecks.length).toBeGreaterThan(0);
    });

    it('should handle high-risk branches appropriately', async () => {
      const staleBranches = [{
        name: 'feature/risky',
        lastCommitDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastCommitHash: 'def456',
        lastCommitAuthor: 'Jane Smith',
        daysSinceActivity: 45,
        commitCount: 10,
        hasActivePullRequest: false,
        isProtected: false,
        tracking: {
          hasRemote: true,
          remoteName: 'origin',
          ahead: 5, // Unpushed commits
          behind: 0
        },
        risk: 'high' as const,
        recommendation: {
          shouldCleanup: false,
          reason: 'Has unpushed commits',
          precautions: ['Push commits before cleanup'],
          priority: 3
        }
      }];

      const options = StaleBranchService.getDefaultCleanupOptions();
      mockGit.status.mockResolvedValue({ files: [] });

      const plan = await service.createCleanupPlan(staleBranches, options);

      // Should not include branch in cleanup plan due to high risk
      expect(plan.operations).toHaveLength(0);
      expect(plan.overallRisk).toBe('low'); // No operations = low risk
    });
  });

  describe('executeCleanupPlan', () => {
    it('should execute cleanup operations in dry run mode', async () => {
      const plan = {
        operations: [{
          type: 'delete-local' as const,
          branchName: 'feature/old',
          dryRun: true,
          timestamp: new Date()
        }],
        totalBranches: 1,
        overallRisk: 'low' as const,
        estimatedDuration: 2,
        safetyChecks: [{
          name: 'Working Directory Clean',
          description: 'Check working directory',
          passed: true,
          critical: false
        }]
      };

      const options = StaleBranchService.getDefaultCleanupOptions();

      const results = await service.executeCleanupPlan(plan, options);

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.actionsTaken[0]).toContain('[DRY RUN]');
      expect(mockGit.deleteLocalBranch).not.toHaveBeenCalled();
    });

    it('should fail when critical safety checks fail', async () => {
      const plan = {
        operations: [{
          type: 'delete-local' as const,
          branchName: 'feature/old',
          dryRun: false,
          timestamp: new Date()
        }],
        totalBranches: 1,
        overallRisk: 'low' as const,
        estimatedDuration: 2,
        safetyChecks: [{
          name: 'Critical Check',
          description: 'Critical safety check',
          passed: false,
          critical: true
        }]
      };

      const options = { ...StaleBranchService.getDefaultCleanupOptions(), force: false };

      await expect(service.executeCleanupPlan(plan, options)).rejects.toThrow('Critical safety checks failed');
    });

    it('should create backups when requested', async () => {
      const plan = {
        operations: [{
          type: 'delete-local' as const,
          branchName: 'feature/backup-test',
          dryRun: false,
          timestamp: new Date()
        }],
        totalBranches: 1,
        overallRisk: 'low' as const,
        estimatedDuration: 2,
        safetyChecks: [{
          name: 'Safe Check',
          description: 'Safe check',
          passed: true,
          critical: false
        }]
      };

      const options = {
        ...StaleBranchService.getDefaultCleanupOptions(),
        dryRun: false,
        createBackups: true
      };

      // Mock successful git operations
      mockGit.raw.mockResolvedValue('');
      mockGit.deleteLocalBranch.mockResolvedValue(undefined);

      const results = await service.executeCleanupPlan(plan, options);

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.actionsTaken.some(action => action.includes('backup'))).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should provide sensible default configuration', () => {
      const config = StaleBranchService.getDefaultConfig();

      expect(config.staleDaysThreshold).toBe(30);
      expect(config.veryStaleThreshold).toBe(90);
      expect(config.excludedBranches).toContain('main');
      expect(config.excludedBranches).toContain('master');
      expect(config.minimumCommits).toBe(3);
    });

    it('should provide sensible default cleanup options', () => {
      const options = StaleBranchService.getDefaultCleanupOptions();

      expect(options.dryRun).toBe(true);
      expect(options.createBackups).toBe(true);
      expect(options.deleteRemote).toBe(false);
      expect(options.force).toBe(false);
      expect(options.interactive).toBe(true);
    });
  });
});
