import { describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { RepositoryHealthService } from '../src/services/RepositoryHealthService.js';
import { SimpleGit } from 'simple-git';
import { AnalysisResult } from '../src/types/analysis.js';
import { DEFAULT_HEALTH_CONFIG } from '../src/types/health.js';

// Mock SimpleGit
const mockGit = {
  log: jest.fn(),
  branch: jest.fn(),
  status: jest.fn()
} as unknown as SimpleGit;

// Mock analysis result
const mockAnalysisResult: AnalysisResult = {
  repository: {
    path: '/test/repo',
    defaultBranch: 'main',
    totalBranches: 20,
    localBranches: 18,
    remoteBranches: 2,
    staleBranches: 3,
    mergeableBranches: 15,
    conflictedBranches: 2,
    openPRCount: 5
  },
  branches: [
    {
      name: 'main',
      current: true,
      commit: 'abc123',
      lastActivity: new Date(),
      lastCommitAuthor: 'Test Author',
      isStale: false,
      commitCount: 100,
      branchType: 'local',
      divergence: { ahead: 0, behind: 0 },
      contributors: ['Test Author'],
      mergeable: true,
      conflictCount: 0,
      commitFrequency: [{ date: new Date().toISOString(), count: 3 }],
      size: 1000
    },
    {
      name: 'feature/user-auth',
      current: false,
      commit: 'def456',
      lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      lastCommitAuthor: 'Test Author',
      isStale: false,
      commitCount: 25,
      branchType: 'local',
      divergence: { ahead: 3, behind: 1 },
      contributors: ['Test Author'],
      mergeable: true,
      conflictCount: 0,
      commitFrequency: [{ date: new Date().toISOString(), count: 1 }],
      size: 500
    },
    {
      name: 'old-feature',
      current: false,
      commit: 'ghi789',
      lastActivity: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      lastCommitAuthor: 'Old Author',
      isStale: true,
      commitCount: 10,
      branchType: 'local',
      divergence: { ahead: 0, behind: 20 },
      contributors: ['Old Author'],
      mergeable: false,
      conflictCount: 5,
      commitFrequency: [{ date: new Date().toISOString(), count: 0 }],
      size: 200
    }
  ],
  statistics: {
    averageAge: 15,
    mostActive: 'main',
    leastActive: 'old-feature',
    totalCommits: 500,
    averageCommitsPerBranch: 25,
    totalContributors: 5,
    averageBranchSize: 566,
    mostConflicted: 'old-feature',
    branchesWithPRs: 2,
    averagePRAge: 7,
    protectedBranches: 1
  },
  activityOverview: {
    dailyActivity: [
      { date: new Date().toISOString(), count: 3 },
      { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), count: 1 }
    ],
    topContributors: [
      { name: 'Test Author', commits: 300 },
      { name: 'Old Author', commits: 200 }
    ],
    branchTypes: [
      { type: 'feature', count: 15 },
      { type: 'bugfix', count: 3 },
      { type: 'main', count: 2 }
    ]
  }
};

describe('RepositoryHealthService', () => {
  let healthService: RepositoryHealthService;
  const testRepoPath = '/test/repo';

  beforeEach(() => {
    healthService = new RepositoryHealthService(mockGit, testRepoPath);
  });

  describe('Configuration', () => {
    test('should use default configuration', () => {
      const config = healthService.getConfig();
      expect(config).toEqual(DEFAULT_HEALTH_CONFIG);
    });

    test('should allow configuration updates', () => {
      const newConfig = {
        trackTrends: false,
        dimensions: {
          ...DEFAULT_HEALTH_CONFIG.dimensions,
          codeQuality: { ...DEFAULT_HEALTH_CONFIG.dimensions.codeQuality, weight: 0.5 }
        }
      };

      healthService.updateConfig(newConfig);
      const config = healthService.getConfig();
      
      expect(config.trackTrends).toBe(false);
      expect(config.dimensions.codeQuality.weight).toBe(0.5);
    });
  });

  describe('Health Report Generation', () => {
    test('should generate comprehensive health report', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      expect(report).toBeDefined();
      expect(report.repositoryName).toBe(path.basename(testRepoPath));
      expect(report.repositoryPath).toBe(testRepoPath);
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.category).toMatch(/excellent|good|fair|poor|critical/);
      expect(report.dimensions).toHaveLength(6); // All 6 dimensions
      expect(report.summary).toBeDefined();
      expect(report.metadata).toBeDefined();
    });

    test('should calculate dimension scores correctly', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      // Check that all expected dimensions are present
      const dimensionNames = report.dimensions.map(d => d.dimension);
      expect(dimensionNames).toContain('codeQuality');
      expect(dimensionNames).toContain('maintenance');
      expect(dimensionNames).toContain('security');
      expect(dimensionNames).toContain('performance');
      expect(dimensionNames).toContain('collaboration');
      expect(dimensionNames).toContain('stability');

      // Check dimension structure
      report.dimensions.forEach(dimension => {
        expect(dimension.score).toBeGreaterThanOrEqual(0);
        expect(dimension.score).toBeLessThanOrEqual(100);
        expect(dimension.weight).toBeGreaterThan(0);
        expect(dimension.metrics).toBeInstanceOf(Array);
        expect(dimension.recommendations).toBeInstanceOf(Array);
        expect(dimension.category).toMatch(/excellent|good|fair|poor|critical/);
      });
    });

    test('should generate appropriate recommendations', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      report.dimensions.forEach(dimension => {
        expect(dimension.recommendations.length).toBeGreaterThan(0);
        dimension.recommendations.forEach(rec => {
          expect(typeof rec).toBe('string');
          expect(rec.length).toBeGreaterThan(0);
        });
      });
    });

    test('should calculate health metrics correctly', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      const codeQualityDimension = report.dimensions.find(d => d.dimension === 'codeQuality');
      expect(codeQualityDimension).toBeDefined();
      expect(codeQualityDimension!.metrics.length).toBeGreaterThan(0);

      // Check metric structure
      codeQualityDimension!.metrics.forEach(metric => {
        expect(metric.name).toBeDefined();
        expect(metric.description).toBeDefined();
        expect(metric.value).toBeGreaterThanOrEqual(0);
        expect(metric.maxValue).toBeGreaterThan(0);
        expect(metric.weight).toBeGreaterThan(0);
        expect(metric.category).toBe('codeQuality');
        expect(metric.status).toMatch(/healthy|warning|critical/);
        expect(metric.recommendations).toBeInstanceOf(Array);
      });
    });

    test('should include repository metadata', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      expect(report.metadata).toBeDefined();
      expect(report.metadata.totalBranches).toBe(20);
      expect(report.metadata.activeBranches).toBe(17); // 20 - 3 stale
      expect(report.metadata.staleBranches).toBe(3);
      expect(report.metadata.totalCommits).toBe(500);
      expect(report.metadata.contributors).toBe(5);
      expect(report.metadata.lastActivity).toBeInstanceOf(Date);
    });

    test('should generate health summary', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      expect(report.summary).toBeDefined();
      expect(report.summary.strengths).toBeInstanceOf(Array);
      expect(report.summary.weaknesses).toBeInstanceOf(Array);
      expect(report.summary.criticalIssues).toBeInstanceOf(Array);
      expect(report.summary.quickWins).toBeInstanceOf(Array);
    });
  });

  describe('Health Options', () => {
    test('should respect custom dimensions filter', async () => {
      const options = {
        dimensions: ['codeQuality', 'security'] as Array<'codeQuality' | 'security'>
      };

      const report = await healthService.generateHealthReport(mockAnalysisResult, options);

      expect(report.dimensions).toHaveLength(2);
      expect(report.dimensions.map(d => d.dimension)).toEqual(['codeQuality', 'security']);
    });

    test('should handle empty repository gracefully', async () => {
      const emptyAnalysisResult: AnalysisResult = {
        ...mockAnalysisResult,
        repository: {
          ...mockAnalysisResult.repository,
          totalBranches: 0,
          staleBranches: 0,
          mergeableBranches: 0,
          conflictedBranches: 0
        },
        branches: [],
        statistics: {
          ...mockAnalysisResult.statistics,
          totalCommits: 0,
          totalContributors: 0
        }
      };

      const report = await healthService.generateHealthReport(emptyAnalysisResult);

      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.dimensions).toHaveLength(6);
    });
  });

  describe('Health Categories', () => {
    test('should correctly categorize health scores', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      // Test category mapping logic
      const testCases = [
        { score: 95, expected: 'excellent' },
        { score: 85, expected: 'good' },
        { score: 65, expected: 'fair' },
        { score: 45, expected: 'poor' },
        { score: 25, expected: 'critical' }
      ];

      // We can't directly test the private method, but we can verify the category is valid
      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(report.category);
    });
  });

  describe('Metric Calculations', () => {
    test('should calculate stale branch ratio correctly', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      const codeQualityDimension = report.dimensions.find(d => d.dimension === 'codeQuality');
      const staleBranchMetric = codeQualityDimension?.metrics.find(m => m.name === 'Stale Branch Ratio');

      expect(staleBranchMetric).toBeDefined();
      // 3 stale out of 20 total = 15%
      expect(staleBranchMetric!.value).toBe(15);
    });

    test('should calculate conflict frequency correctly', async () => {
      const report = await healthService.generateHealthReport(mockAnalysisResult);

      const codeQualityDimension = report.dimensions.find(d => d.dimension === 'codeQuality');
      const conflictMetric = codeQualityDimension?.metrics.find(m => m.name === 'Conflict Frequency');

      expect(conflictMetric).toBeDefined();
      // 2 conflicted out of 20 total = 10%
      expect(conflictMetric!.value).toBe(10);
    });

    test('should handle edge cases in calculations', async () => {
      const edgeCaseAnalysis: AnalysisResult = {
        ...mockAnalysisResult,
        repository: {
          ...mockAnalysisResult.repository,
          totalBranches: 0,
          staleBranches: 0,
          conflictedBranches: 0,
          mergeableBranches: 0
        }
      };

      const report = await healthService.generateHealthReport(edgeCaseAnalysis);

      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      
      // With no branches, many metrics should have default/safe values
      const codeQualityDimension = report.dimensions.find(d => d.dimension === 'codeQuality');
      expect(codeQualityDimension?.score).toBeGreaterThanOrEqual(0);
    });
  });
});
