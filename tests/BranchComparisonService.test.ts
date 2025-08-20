import { BranchComparisonService } from '../src/services/BranchComparisonService.js';
import { SimpleGit } from 'simple-git';
import { BranchComparison, ComparisonOptions } from '../src/types/comparison.js';

// Mock simple-git
const mockGit = {
  raw: jest.fn(),
  branch: jest.fn(),
  checkoutBranch: jest.fn(),
  reset: jest.fn(),
  checkout: jest.fn(),
  deleteLocalBranch: jest.fn(),
  status: jest.fn(),
  show: jest.fn()
} as unknown as jest.Mocked<SimpleGit>;

describe('BranchComparisonService', () => {
  let service: BranchComparisonService;
  const mockRepoPath = '/test/repo';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BranchComparisonService(mockGit, mockRepoPath);
  });

  describe('compareBranches', () => {
    it('should compare two branches successfully', async () => {
      // Mock git operations
      mockGit.raw
        .mockResolvedValueOnce('1\t2') // rev-list for ahead/behind
        .mockResolvedValueOnce('abc123') // merge-base for common ancestor
        .mockResolvedValueOnce('M\tfile1.js\nA\tfile2.js') // name-status for files
        .mockResolvedValueOnce('') // diff for file1.js (no changes in detail)
        .mockResolvedValueOnce('') // diff for file2.js (no changes in detail)
        .mockResolvedValueOnce('') // binary check file1.js
        .mockResolvedValueOnce('') // binary check file2.js
        .mockResolvedValueOnce('2023-01-01 10:00:00 +0000') // ancestor date
        .mockResolvedValueOnce('2023-01-02 10:00:00 +0000') // source date
        .mockResolvedValueOnce('2023-01-03 10:00:00 +0000') // target date
        .mockResolvedValueOnce('5') // source commits
        .mockResolvedValueOnce('3') // target commits
        .mockResolvedValueOnce('1641027600') // source timestamp
        .mockResolvedValueOnce('1641114000') // target timestamp
        .mockResolvedValueOnce('author1\nauthor2'); // authors

      const result = await service.compareBranches('feature', 'main');

      expect(result).toMatchObject({
        sourceBranch: 'feature',
        targetBranch: 'main',
        commonAncestor: 'abc123',
        ahead: 2,
        behind: 1,
        diverged: true,
        files: expect.arrayContaining([
          expect.objectContaining({
            path: 'file1.js',
            status: 'modified'
          }),
          expect.objectContaining({
            path: 'file2.js',
            status: 'added'
          })
        ])
      });

      expect(result.complexity.category).toBeDefined();
      expect(result.summary.totalFiles).toBe(2);
    });

    it('should handle merge conflicts analysis', async () => {
      // Mock git operations for conflict detection
      mockGit.raw
        .mockResolvedValueOnce('0\t1') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce('M\tconflicted.js'); // files with changes

      mockGit.branch.mockResolvedValue({ current: 'main' } as any);
      mockGit.checkoutBranch.mockResolvedValue(undefined as any);
      mockGit.status.mockResolvedValue({ conflicted: ['conflicted.js'] } as any);
      mockGit.reset.mockResolvedValue(undefined as any);
      mockGit.checkout.mockResolvedValue(undefined as any);
      mockGit.deleteLocalBranch.mockResolvedValue(undefined as any);

      // Mock merge command to throw (simulating conflicts)
      mockGit.raw.mockRejectedValueOnce(new Error('Merge conflict'));

      const options: ComparisonOptions = {
        conflictAnalysis: true,
        complexityAnalysis: false
      };

      const result = await service.compareBranches('feature', 'main', options);

      expect(result.conflicts.hasConflicts).toBe(true);
      expect(result.conflicts.conflictingFiles).toContain('conflicted.js');
      expect(result.conflicts.severity).toBeDefined();
    });

    it('should calculate merge complexity correctly', async () => {
      // Mock for a complex merge scenario
      mockGit.raw
        .mockResolvedValueOnce('5\t3') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce(`M\tfile1.js
M\tfile2.js
M\tfile3.js
A\tfile4.js
D\tfile5.js`); // many files changed

      // Mock timestamp calls for time span calculation
      mockGit.show
        .mockResolvedValueOnce('1641027600') // source timestamp
        .mockResolvedValueOnce('1641027600'); // target timestamp

      // Mock author diversity
      mockGit.raw.mockResolvedValueOnce('author1\nauthor2\nauthor3\nauthor4');

      const result = await service.compareBranches('feature', 'main');

      expect(result.complexity.score).toBeGreaterThan(0);
      expect(result.complexity.factors.filesChanged).toBe(5);
      expect(result.complexity.factors.authorDiversity).toBe(4);
      expect(result.complexity.category).toBe('moderate');
      expect(result.complexity.recommendations).toContain(
        expect.stringContaining('file')
      );
    });

    it('should handle binary files correctly', async () => {
      mockGit.raw
        .mockResolvedValueOnce('1\t0') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce('M\timage.png'); // binary file

      // Mock binary file detection
      mockGit.raw.mockResolvedValueOnce('-\t-\timage.png'); // binary indicator

      const result = await service.compareBranches('feature', 'main');

      expect(result.files[0]?.isBinary).toBe(true);
      expect(result.complexity.factors.binaryFiles).toBe(1);
    });

    it('should handle renamed files correctly', async () => {
      mockGit.raw
        .mockResolvedValueOnce('1\t0') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce('R95\told-name.js\tnew-name.js'); // renamed file

      const result = await service.compareBranches('feature', 'main');

      expect(result.files[0]).toMatchObject({
        path: 'old-name.js',
        oldPath: 'new-name.js',
        status: 'renamed',
        similarityIndex: 95
      });
    });

    it('should handle errors gracefully', async () => {
      mockGit.raw.mockRejectedValue(new Error('Git operation failed'));

      await expect(
        service.compareBranches('invalid-branch', 'main')
      ).rejects.toThrow('Git operation failed');
    });
  });

  describe('diff parsing', () => {
    it('should parse diff hunks correctly', async () => {
      const diffOutput = `@@ -1,3 +1,4 @@ function test
 line1
-old line
+new line
+added line
 line3`;

      mockGit.raw
        .mockResolvedValueOnce('1\t0') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce('M\ttest.js') // file status
        .mockResolvedValueOnce(diffOutput) // detailed diff
        .mockResolvedValueOnce(''); // binary check

      const result = await service.compareBranches('feature', 'main');

      const file = result.files[0];
      expect(file?.hunks).toHaveLength(1);
      expect(file?.hunks[0]?.lines).toHaveLength(4);
      expect(file?.hunks[0]?.lines[1]?.type).toBe('deletion');
      expect(file?.hunks[0]?.lines[2]?.type).toBe('addition');
      expect(file?.additions).toBe(2);
      expect(file?.deletions).toBe(1);
    });
  });

  describe('complexity categorization', () => {
    it('should categorize trivial merges correctly', async () => {
      mockGit.raw
        .mockResolvedValueOnce('1\t0') // ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce('M\tsmall-change.js'); // minimal changes

      const result = await service.compareBranches('feature', 'main');

      expect(result.complexity.category).toBe('trivial');
      expect(result.complexity.score).toBeLessThan(20);
    });

    it('should provide appropriate recommendations', async () => {
      mockGit.raw
        .mockResolvedValueOnce('10\t5') // many commits ahead/behind
        .mockResolvedValueOnce('abc123') // common ancestor
        .mockResolvedValueOnce(Array(60).fill('M\tfile.js').join('\n')); // many files

      const result = await service.compareBranches('feature', 'main');

      expect(result.complexity.category).toBe('high-risk');
      expect(result.complexity.recommendations).toContain(
        expect.stringContaining('High-risk')
      );
    });
  });
});
