import { SimpleGit } from 'simple-git';
import { 
  BranchComparison, 
  FileDiff, 
  ConflictAnalysis, 
  MergeComplexity, 
  ComparisonOptions,
  DiffHunk,
  DiffLine
} from '../types/comparison.js';
import path from 'path';

export class BranchComparisonService {
  constructor(private git: SimpleGit, private repositoryPath: string) {}

  /**
   * Compare two branches and return detailed analysis
   */
  async compareBranches(
    sourceBranch: string, 
    targetBranch: string, 
    options: ComparisonOptions = {}
  ): Promise<BranchComparison> {
    try {
      console.log(`🔍 Comparing ${sourceBranch} → ${targetBranch}`);

      // Get basic branch relationship
      const [aheadBehind, commonAncestor] = await Promise.all([
        this.getAheadBehind(sourceBranch, targetBranch),
        this.getCommonAncestor(sourceBranch, targetBranch)
      ]);

      // Get detailed file differences
      const files = await this.getFileDiffs(sourceBranch, targetBranch, options);

      // Analyze conflicts if requested
      const conflicts = options.conflictAnalysis !== false 
        ? await this.analyzeConflicts(sourceBranch, targetBranch)
        : this.getEmptyConflictAnalysis();

      // Calculate merge complexity if requested
      const complexity = options.complexityAnalysis !== false
        ? await this.calculateMergeComplexity(sourceBranch, targetBranch, files)
        : this.getEmptyComplexity();

      // Generate summary
      const summary = this.generateSummary(files);
      const timeline = await this.getTimeline(sourceBranch, targetBranch);

      return {
        sourceBranch,
        targetBranch,
        commonAncestor,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        diverged: aheadBehind.ahead > 0 && aheadBehind.behind > 0,
        files,
        conflicts,
        complexity,
        summary,
        timeline
      };

    } catch (error) {
      console.error(`Failed to compare branches ${sourceBranch} and ${targetBranch}:`, error);
      throw error;
    }
  }

  /**
   * Get ahead/behind counts between branches
   */
  private async getAheadBehind(source: string, target: string): Promise<{ ahead: number; behind: number }> {
    try {
      const result = await this.git.raw(['rev-list', '--left-right', '--count', `${target}...${source}`]);
      const [behind, ahead] = result.trim().split('\t').map(Number);
      return { ahead: ahead || 0, behind: behind || 0 };
    } catch (error) {
      console.warn('Failed to get ahead/behind counts:', error);
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Get common ancestor of two branches
   */
  private async getCommonAncestor(source: string, target: string): Promise<string> {
    try {
      const result = await this.git.raw(['merge-base', source, target]);
      return result.trim();
    } catch (error) {
      console.warn('Failed to find common ancestor:', error);
      return '';
    }
  }

  /**
   * Get detailed file differences between branches
   */
  private async getFileDiffs(
    source: string, 
    target: string, 
    options: ComparisonOptions
  ): Promise<FileDiff[]> {
    try {
      const gitOptions = [
        'diff', 
        '--name-status',
        '--find-renames'
      ];

      if (options.ignoreWhitespace) {
        gitOptions.push('--ignore-all-space');
      }

      gitOptions.push(`${target}...${source}`);

      // Get file status changes
      const statusResult = await this.git.raw(gitOptions);
      const statusLines = statusResult.trim().split('\n').filter(line => line);

      const files: FileDiff[] = [];
      const maxFiles = options.maxFiles || 100;

      for (const statusLine of statusLines) {
        if (files.length >= maxFiles) break;
        
        if (statusLine?.trim()) {
          const fileDiff = await this.parseFileStatus(statusLine, source, target, options);
          if (fileDiff) {
            files.push(fileDiff);
          }
        }
      }

      return files;
    } catch (error) {
      console.warn('Failed to get file diffs:', error);
      return [];
    }
  }

  /**
   * Parse git diff status line and get detailed file diff
   */
  private async parseFileStatus(
    statusLine: string, 
    source: string, 
    target: string,
    options: ComparisonOptions
  ): Promise<FileDiff | null> {
    try {
      const parts = statusLine.split('\t');
      if (parts.length < 2) {
        return null;
      }

      const status = parts[0];
      const filePath = parts[1];
      
      if (!status || !filePath) {
        return null;
      }

      let oldPath: string | undefined;

      // Parse status
      let diffStatus: FileDiff['status'];
      let similarityIndex: number | undefined;

      if (status.startsWith('A')) {
        diffStatus = 'added';
      } else if (status.startsWith('D')) {
        diffStatus = 'deleted';
      } else if (status.startsWith('M')) {
        diffStatus = 'modified';
      } else if (status.startsWith('R')) {
        diffStatus = 'renamed';
        oldPath = parts[2];
        similarityIndex = parseInt(status.substring(1));
      } else if (status.startsWith('C')) {
        diffStatus = 'copied';
        oldPath = parts[2];
        similarityIndex = parseInt(status.substring(1));
      } else {
        diffStatus = 'modified';
      }

      // Get detailed diff for the file
      const hunks = await this.getFileHunks(filePath, source, target, options);
      
      // Calculate additions/deletions
      let additions = 0;
      let deletions = 0;
      hunks.forEach(hunk => {
        hunk.lines.forEach(line => {
          if (line.type === 'addition') additions++;
          if (line.type === 'deletion') deletions++;
        });
      });

      // Check if binary
      const isBinary = await this.isBinaryFile(filePath, source);

      return {
        path: filePath,
        ...(oldPath && { oldPath }),
        status: diffStatus,
        additions,
        deletions,
        hunks,
        isBinary,
        ...(similarityIndex !== undefined && { similarityIndex })
      };

    } catch (error) {
      console.warn(`Failed to parse file status for ${statusLine}:`, error);
      return null;
    }
  }

  /**
   * Get diff hunks for a specific file
   */
  private async getFileHunks(
    filePath: string, 
    source: string, 
    target: string,
    options: ComparisonOptions
  ): Promise<DiffHunk[]> {
    try {
      const contextLines = options.includeContext || 3;
      const diffArgs = [
        'diff',
        `--unified=${contextLines}`,
        '--no-prefix'
      ];

      if (options.ignoreWhitespace) {
        diffArgs.push('--ignore-all-space');
      }

      diffArgs.push(`${target}...${source}`, '--', filePath);

      const diffResult = await this.git.raw(diffArgs);
      
      if (!diffResult.trim()) {
        return [];
      }

      return this.parseDiffHunks(diffResult);
    } catch (error) {
      console.warn(`Failed to get hunks for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Parse diff output into structured hunks
   */
  private parseDiffHunks(diffOutput: string): DiffHunk[] {
    const lines = diffOutput.split('\n');
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      if (line.startsWith('@@')) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (match) {
          currentHunk = {
            oldStart: parseInt(match[1] || '1'),
            oldLines: parseInt(match[2] || '1'),
            newStart: parseInt(match[3] || '1'),
            newLines: parseInt(match[4] || '1'),
            header: match[5]?.trim() || '',
            lines: []
          };
        }
      } else if (currentHunk && (line.startsWith(' ') || line.startsWith('+') || line.startsWith('-'))) {
        // Diff line
        let type: DiffLine['type'] = 'context';
        if (line.startsWith('+')) type = 'addition';
        if (line.startsWith('-')) type = 'deletion';

        const oldLinesCount = currentHunk.lines.filter(l => l.type !== 'addition').length;
        const newLinesCount = currentHunk.lines.filter(l => l.type !== 'deletion').length;

        const diffLine: DiffLine = {
          type,
          content: line.substring(1)
        };

        if (type !== 'addition') {
          diffLine.oldLineNumber = currentHunk.oldStart + oldLinesCount;
        }

        if (type !== 'deletion') {
          diffLine.newLineNumber = currentHunk.newStart + newLinesCount;
        }

        currentHunk.lines.push(diffLine);
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Analyze potential merge conflicts
   */
  private async analyzeConflicts(source: string, target: string): Promise<ConflictAnalysis> {
    try {
      // Simulate merge to detect conflicts
      const currentBranch = await this.git.branch(['-v']);
      const tempBranch = `bramble-temp-${Date.now()}`;

      try {
        // Create temporary branch from target
        await this.git.checkoutBranch(tempBranch, target);
        
        // Try to merge source (dry run)
        const mergeResult = await this.git.raw(['merge', '--no-commit', '--no-ff', source]);
        
        // If we get here, no conflicts
        await this.git.reset(['--hard', 'HEAD']);
        return {
          hasConflicts: false,
          conflictingFiles: [],
          conflictTypes: {
            contentConflicts: 0,
            renameConflicts: 0,
            deleteModifyConflicts: 0,
            addAddConflicts: 0
          },
          severity: 'low',
          resolutionSuggestions: []
        };

      } catch (error) {
        // Conflicts detected
        const conflictFiles = await this.getConflictingFiles();
        const severity = this.assessConflictSeverity(conflictFiles.length);
        
        // Reset state
        await this.git.reset(['--hard', 'HEAD']);
        
        return {
          hasConflicts: true,
          conflictingFiles: conflictFiles,
          conflictTypes: await this.analyzeConflictTypes(conflictFiles),
          severity,
          resolutionSuggestions: this.generateResolutionSuggestions(conflictFiles, severity)
        };
      } finally {
        // Cleanup: return to original branch and delete temp branch
        await this.git.checkout(currentBranch.current || 'main');
        await this.git.deleteLocalBranch(tempBranch, true);
      }

    } catch (error) {
      console.warn('Failed to analyze conflicts:', error);
      return this.getEmptyConflictAnalysis();
    }
  }

  /**
   * Get list of files with conflicts
   */
  private async getConflictingFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.conflicted || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Analyze types of conflicts
   */
  private async analyzeConflictTypes(conflictFiles: string[]) {
    // This is a simplified analysis - in practice you'd need more sophisticated conflict detection
    return {
      contentConflicts: conflictFiles.length,
      renameConflicts: 0,
      deleteModifyConflicts: 0,
      addAddConflicts: 0
    };
  }

  /**
   * Assess conflict severity based on number and type
   */
  private assessConflictSeverity(conflictCount: number): ConflictAnalysis['severity'] {
    if (conflictCount === 0) return 'low';
    if (conflictCount <= 3) return 'medium';
    if (conflictCount <= 10) return 'high';
    return 'critical';
  }

  /**
   * Generate resolution suggestions
   */
  private generateResolutionSuggestions(conflictFiles: string[], severity: ConflictAnalysis['severity']): string[] {
    const suggestions: string[] = [];
    
    if (severity === 'critical') {
      suggestions.push('Consider breaking this merge into smaller, incremental merges');
      suggestions.push('Review conflicts with team members before proceeding');
    }
    
    if (conflictFiles.length > 5) {
      suggestions.push('Use a visual merge tool for easier conflict resolution');
    }
    
    suggestions.push('Test thoroughly after resolving conflicts');
    suggestions.push('Consider creating a backup branch before merging');
    
    return suggestions;
  }

  /**
   * Calculate merge complexity score
   */
  private async calculateMergeComplexity(
    source: string, 
    target: string, 
    files: FileDiff[]
  ): Promise<MergeComplexity> {
    try {
      const filesChanged = files.length;
      const linesChanged = files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
      const binaryFiles = files.filter(file => file.isBinary).length;
      
      // Get time span between branches
      const timeSpan = await this.getTimeSpanBetweenBranches(source, target);
      
      // Get author diversity
      const authorDiversity = await this.getAuthorDiversity(source, target);
      
      // Calculate conflict potential (0-100)
      const conflictPotential = Math.min(100, (filesChanged * 5) + (linesChanged / 10) + (binaryFiles * 20));
      
      // Calculate overall complexity score (0-100)
      const score = Math.min(100, 
        (filesChanged * 2) + 
        (linesChanged / 20) + 
        (conflictPotential * 0.3) + 
        (authorDiversity * 10) + 
        (timeSpan * 0.1) + 
        (binaryFiles * 5)
      );

      const category = this.categorizeComplexity(score);
      const recommendations = this.generateComplexityRecommendations(score, {
        filesChanged,
        linesChanged,
        conflictPotential,
        authorDiversity,
        timeSpan,
        binaryFiles
      });

      return {
        score: Math.round(score),
        factors: {
          filesChanged,
          linesChanged,
          conflictPotential: Math.round(conflictPotential),
          authorDiversity,
          timeSpan,
          binaryFiles
        },
        category,
        recommendations
      };

    } catch (error) {
      console.warn('Failed to calculate merge complexity:', error);
      return this.getEmptyComplexity();
    }
  }

  /**
   * Get time span between branches in days
   */
  private async getTimeSpanBetweenBranches(source: string, target: string): Promise<number> {
    try {
      const sourceCommit = await this.git.show(['-s', '--format=%ct', source]);
      const targetCommit = await this.git.show(['-s', '--format=%ct', target]);
      
      const sourceDateSecs = parseInt(sourceCommit.trim());
      const targetDateSecs = parseInt(targetCommit.trim());
      
      const diffMs = Math.abs(sourceDateSecs - targetDateSecs) * 1000;
      return Math.round(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get author diversity between branches
   */
  private async getAuthorDiversity(source: string, target: string): Promise<number> {
    try {
      const authors = await this.git.raw(['log', '--format=%an', `${target}..${source}`]);
      const uniqueAuthors = new Set(authors.trim().split('\n').filter(author => author));
      return uniqueAuthors.size;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Categorize complexity score
   */
  private categorizeComplexity(score: number): MergeComplexity['category'] {
    if (score <= 20) return 'trivial';
    if (score <= 40) return 'simple';
    if (score <= 60) return 'moderate';
    if (score <= 80) return 'complex';
    return 'high-risk';
  }

  /**
   * Generate complexity-based recommendations
   */
  private generateComplexityRecommendations(score: number, factors: MergeComplexity['factors']): string[] {
    const recommendations: string[] = [];

    if (score > 80) {
      recommendations.push('High-risk merge - consider breaking into smaller merges');
      recommendations.push('Extensive testing required before production deployment');
    }

    if (factors.filesChanged > 50) {
      recommendations.push('Large number of files changed - review impact carefully');
    }

    if (factors.authorDiversity > 5) {
      recommendations.push('Multiple authors involved - coordinate with team');
    }

    if (factors.binaryFiles > 0) {
      recommendations.push('Binary files detected - verify compatibility');
    }

    if (factors.timeSpan > 30) {
      recommendations.push('Long-lived branches - check for stale dependencies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Merge appears straightforward - proceed with normal testing');
    }

    return recommendations;
  }

  /**
   * Check if file is binary
   */
  private async isBinaryFile(filePath: string, ref: string): Promise<boolean> {
    try {
      const result = await this.git.raw(['diff', '--numstat', `${ref}^`, ref, '--', filePath]);
      return result.includes('-\t-\t'); // Binary files show as "- -"
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(files: FileDiff[]) {
    const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
    const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
    
    const directories = new Set<string>();
    const languages: { [key: string]: number } = {};

    files.forEach(file => {
      // Extract directory
      const dir = path.dirname(file.path);
      if (dir !== '.') {
        directories.add(dir);
      }

      // Extract language from extension
      const ext = path.extname(file.path).substring(1).toLowerCase();
      if (ext) {
        languages[ext] = (languages[ext] || 0) + 1;
      }
    });

    return {
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
      netChange: totalAdditions - totalDeletions,
      affectedDirectories: Array.from(directories),
      languageBreakdown: languages
    };
  }

  /**
   * Get timeline information
   */
  private async getTimeline(source: string, target: string) {
    try {
      // Get first divergence point
      const commonAncestor = await this.getCommonAncestor(source, target);
      const ancestorDate = await this.git.show(['-s', '--format=%ci', commonAncestor]);
      
      // Get last activity on each branch
      const sourceDate = await this.git.show(['-s', '--format=%ci', source]);
      const targetDate = await this.git.show(['-s', '--format=%ci', target]);
      
      // Get commit counts
      const sourceCommits = await this.git.raw(['rev-list', '--count', `${commonAncestor}..${source}`]);
      const targetCommits = await this.git.raw(['rev-list', '--count', `${commonAncestor}..${target}`]);

      return {
        firstDivergence: new Date(ancestorDate.trim()),
        lastActivity: new Date(Math.max(
          new Date(sourceDate.trim()).getTime(),
          new Date(targetDate.trim()).getTime()
        )),
        commits: {
          source: parseInt(sourceCommits.trim()) || 0,
          target: parseInt(targetCommits.trim()) || 0
        }
      };
    } catch (error) {
      return {
        firstDivergence: new Date(),
        lastActivity: new Date(),
        commits: { source: 0, target: 0 }
      };
    }
  }

  /**
   * Get empty conflict analysis for error cases
   */
  private getEmptyConflictAnalysis(): ConflictAnalysis {
    return {
      hasConflicts: false,
      conflictingFiles: [],
      conflictTypes: {
        contentConflicts: 0,
        renameConflicts: 0,
        deleteModifyConflicts: 0,
        addAddConflicts: 0
      },
      severity: 'low',
      resolutionSuggestions: []
    };
  }

  /**
   * Get empty complexity analysis for error cases
   */
  private getEmptyComplexity(): MergeComplexity {
    return {
      score: 0,
      factors: {
        filesChanged: 0,
        linesChanged: 0,
        conflictPotential: 0,
        authorDiversity: 0,
        timeSpan: 0,
        binaryFiles: 0
      },
      category: 'trivial',
      recommendations: []
    };
  }
}
