import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GitAnalyzer } from '../src/core/GitAnalyzer.js';
import { createMockGitAnalyzer, mockBranchData } from './fixtures.js';

// Mock simple-git with proper typing
const mockGit = {
  branch: jest.fn() as jest.MockedFunction<any>,
  log: jest.fn() as jest.MockedFunction<any>,
  raw: jest.fn() as jest.MockedFunction<any>,
  status: jest.fn() as jest.MockedFunction<any>,
  revparse: jest.fn() as jest.MockedFunction<any>,
  diffSummary: jest.fn() as jest.MockedFunction<any>,
};

jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn(() => mockGit),
}));

describe('GitAnalyzer', () => {
  let analyzer: GitAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = createMockGitAnalyzer();
  });

  describe('constructor', () => {
    test('should create GitAnalyzer instance with repository path', () => {
      const testPath = '/test/repo';
      const testAnalyzer = new GitAnalyzer(testPath);
      expect(testAnalyzer).toBeInstanceOf(GitAnalyzer);
    });
  });

  describe('analyze', () => {
    beforeEach(() => {
      // Mock git.branch response
      (mockGit.branch as jest.MockedFunction<any>).mockResolvedValue({
        current: 'main',
        branches: {
          'main': { commit: 'abc123', current: true },
          'feature/test': { commit: 'def456', current: false },
          'stale-branch': { commit: 'ghi789', current: false }
        }
      });

      // Mock git.raw for refs - need to support git for-each-ref and other commands  
      (mockGit.raw as jest.MockedFunction<any>).mockImplementation((args: string[]) => {
        if (args[0] === 'for-each-ref') {
          return Promise.resolve(`main|abc123|2025-08-20T10:00:00Z|Test Author
feature/test|def456|2025-08-19T15:30:00Z|Developer
stale-branch|ghi789|2025-06-01T08:00:00Z|Old Developer`);
        }
        if (args[0] === 'rev-list' && args[1] === '--count') {
          // Return commit counts based on branch
          if (args.includes('main')) return Promise.resolve('50');
          if (args.includes('feature/test')) return Promise.resolve('5');
          if (args.includes('stale-branch')) return Promise.resolve('2');
          return Promise.resolve('0');
        }
        if (args[0] === 'branch' && args[1] === '--merged') {
          return Promise.resolve('stale-branch\n');
        }
        if (args[0] === 'symbolic-ref') {
          return Promise.resolve('refs/heads/main');
        }
        return Promise.resolve('');
      });

      // Mock log responses
      (mockGit.log as jest.MockedFunction<any>).mockResolvedValue({
        all: [],
        total: 0
      });

      // Mock status
      (mockGit.status as jest.MockedFunction<any>).mockResolvedValue({
        isClean: () => true
      });
    });

    test('should analyze repository and return results', async () => {
      const progressCallback = jest.fn();
      
      const result = await analyzer.analyze(progressCallback, {
        analysisDepth: 'fast',
        maxConcurrency: 2
      });

      expect(result).toBeDefined();
      expect(result.repository).toBeDefined();
      expect(result.repository.path).toBe('/test/repo');
      expect(result.branches).toBeDefined();
      expect(Array.isArray(result.branches)).toBe(true);
      expect(progressCallback).toHaveBeenCalled();
    });

    test('should handle fast analysis mode', async () => {
      const result = await analyzer.analyze(undefined, {
        analysisDepth: 'fast'
      });

      expect(result.repository.defaultBranch).toBeDefined();
      expect(result.branches.length).toBeGreaterThan(0);
    });

    test('should filter branches based on maxBranches option', async () => {
      const result = await analyzer.analyze(undefined, {
        maxBranches: 1
      });

      expect(result.branches.length).toBeLessThanOrEqual(1);
    });

    test('should call progress callback with correct parameters', async () => {
      const progressCallback = jest.fn();
      
      await analyzer.analyze(progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      );
    });

    test('should handle errors gracefully', async () => {
      (mockGit.branch as jest.MockedFunction<any>).mockRejectedValue(new Error('Git error'));

      await expect(analyzer.analyze()).rejects.toThrow('Failed to analyze repository');
      
      // Restore the mock for subsequent tests
      (mockGit.branch as jest.MockedFunction<any>).mockResolvedValue({
        current: 'main',
        branches: {
          'main': { commit: 'abc123', current: true },
          'feature/test': { commit: 'def456', current: false },
          'stale-branch': { commit: 'ghi789', current: false }
        }
      });
    });
  });

  describe('performance options', () => {
    test('should respect maxConcurrency option', async () => {
      const result = await analyzer.analyze(undefined, {
        maxConcurrency: 1
      });

      expect(result).toBeDefined();
    });

    test('should handle skipStalerThan option', async () => {
      const result = await analyzer.analyze(undefined, {
        skipStalerThan: 30 // Skip branches older than 30 days
      });

      expect(result).toBeDefined();
    });
  });
});
