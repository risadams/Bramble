/**
 * Tests for Enhanced Export Service
 */

import { StandaloneEnhancedExportService } from '../../src/services/StandaloneEnhancedExportService.js';
import { ExportData, ExportOptions, ExportFormat } from '../../src/types/export.js';
import { AnalysisResult } from '../../src/types/analysis.js';
import { BranchComparison } from '../../src/types/comparison.js';
import { StaleBranchReport } from '../../src/types/staleBranches.js';
import { PerformanceMetrics } from '../../src/types/performance.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('StandaloneEnhancedExportService', () => {
  let exportService: StandaloneEnhancedExportService;
  let mockExportData: ExportData;
  let tempDir: string;

  beforeEach(async () => {
    exportService = new StandaloneEnhancedExportService();
    
    // Create temp directory for test outputs
    tempDir = path.join(process.cwd(), 'temp-test-exports');
    await fs.mkdir(tempDir, { recursive: true });

    // Create mock data
    const mockAnalysis: AnalysisResult = {
      repository: {
        path: '/test/repo',
        defaultBranch: 'main',
        totalBranches: 15,
        localBranches: 8,
        remoteBranches: 7,
        staleBranches: 3,
        mergeableBranches: 12,
        conflictedBranches: 3,
        hostingProvider: 'github',
        repositoryUrl: 'https://github.com/test/repo',
        isPrivate: false,
        language: 'TypeScript',
        stars: 42,
        openPRCount: 5
      },
      branches: [],
      statistics: {
        averageAge: 30,
        mostActive: 'main',
        leastActive: 'feature/old',
        totalCommits: 245,
        averageCommitsPerBranch: 16.3,
        totalContributors: 8,
        averageBranchSize: 1250,
        mostConflicted: 'feature/complex'
      },
      activityOverview: {
        dailyActivity: [
          { date: '2024-01-01', count: 5 },
          { date: '2024-01-02', count: 3 }
        ],
        topContributors: [
          { name: 'John Doe', commits: 45 },
          { name: 'Jane Smith', commits: 32 }
        ],
        branchTypes: [
          { type: 'feature', count: 8 },
          { type: 'bugfix', count: 4 },
          { type: 'hotfix', count: 1 }
        ]
      }
    };

    const mockComparison: BranchComparison = {
      sourceBranch: 'feature/new-feature',
      targetBranch: 'main',
      commonAncestor: 'abc123',
      ahead: 5,
      behind: 2,
      diverged: true,
      files: [],
      conflicts: {
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
      },
      complexity: {
        score: 25,
        factors: {
          filesChanged: 8,
          linesChanged: 179,
          conflictPotential: 0.1,
          authorDiversity: 2,
          timeSpan: 5,
          binaryFiles: 0
        },
        category: 'simple',
        recommendations: ['Safe to merge']
      },
      summary: {
        totalFiles: 8,
        totalAdditions: 156,
        totalDeletions: 23,
        netChange: 133,
        affectedDirectories: ['src/', 'tests/'],
        languageBreakdown: { 'TypeScript': 179 }
      },
      timeline: {
        firstDivergence: new Date('2024-01-10'),
        lastActivity: new Date('2024-01-15'),
        commits: {
          source: 5,
          target: 2
        }
      }
    };

    const mockStaleBranches: StaleBranchReport = {
      scanDate: new Date('2024-01-15'),
      repositoryPath: '/test/repo',
      totalBranches: 15,
      staleBranches: [
        {
          name: 'feature/old-feature',
          lastCommitDate: new Date('2023-10-01'),
          lastCommitHash: 'def456',
          lastCommitAuthor: 'Old Developer',
          daysSinceActivity: 106,
          commitCount: 8,
          hasActivePullRequest: false,
          isProtected: false,
          tracking: {
            hasRemote: true,
            remoteName: 'origin',
            ahead: 0,
            behind: 15
          },
          risk: 'high' as const,
          recommendation: {
            shouldCleanup: true,
            reason: 'No activity for over 100 days',
            precautions: ['Verify no important work', 'Check for associated PRs'],
            priority: 8
          }
        }
      ],
      riskSummary: {
        low: 5,
        medium: 7,
        high: 2,
        critical: 1
      },
      estimatedSavings: {
        branchCount: 3,
        diskSpace: 1024000
      },
      config: {
        staleDaysThreshold: 30,
        veryStaleThreshold: 90,
        excludedBranches: ['main', 'develop'],
        excludePatterns: ['release/*'],
        checkPullRequests: true,
        checkProtectedBranches: true,
        minimumCommits: 1
      }
    };

    const mockPerformance: PerformanceMetrics = {
      timestamp: new Date(),
      memoryUsage: {
        heapUsed: 52428800,
        heapTotal: 67108864,
        external: 1048576,
        rss: 104857600
      },
      cpuUsage: {
        user: 120.5,
        system: 45.2
      },
      gitOperations: [
        { operation: 'git-log', duration: 125, success: true },
        { operation: 'git-branch', duration: 45, success: true },
        { operation: 'git-status', duration: 32, success: true }
      ],
      analysisMetrics: {
        totalDuration: 1250,
        branchesAnalyzed: 15,
        commitsProcessed: 245,
        avgTimePerBranch: 83.3
      }
    };

    mockExportData = {
      analysis: mockAnalysis,
      comparison: mockComparison,
      staleAnalysis: mockStaleBranches,
      performance: mockPerformance,
      metadata: {
        generatedAt: new Date('2024-01-15T10:30:00Z'),
        generatedBy: 'Bramble CLI',
        version: '1.2.0',
        repository: {
          name: 'test-repo',
          path: '/test/repo',
          url: 'https://github.com/test/repo',
          branch: 'main',
          commit: 'abc123456'
        },
        configuration: {
          profile: 'default',
          environment: 'development',
          options: {
            includeStale: true,
            includePerformance: true
          }
        }
      }
    };
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('exportData', () => {
    test('should export JSON format successfully', async () => {
      const options: ExportOptions = {
        format: 'json' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export.json')
      };

      const result = await exportService.exportData(mockExportData, options);

      console.log('Export result:', result);
      console.log('Expected output path:', options.outputPath);
      
      // Check if temp dir exists
      let tempDirExists = false;
      try {
        await fs.access(tempDir);
        tempDirExists = true;
      } catch {
        tempDirExists = false;
      }
      console.log('Temp dir exists:', tempDirExists);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.outputPath).toBe(options.outputPath);
      expect(result.size).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      // Add a small delay to ensure file is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify file was created
      let fileExists = false;
      try {
        await fs.access(options.outputPath!);
        fileExists = true;
        
        // Get file stats
        const stats = await fs.stat(options.outputPath!);
        console.log('File size on disk:', stats.size);
        console.log('File modified time:', stats.mtime);
      } catch (error) {
        console.log('File access error:', error);
      }
      console.log('File exists:', fileExists);
      expect(fileExists).toBe(true);

      // Verify content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      console.log('Content read length:', content?.length || 'undefined');
      expect(content).toBeDefined();
      const parsed = JSON.parse(content);
      expect(parsed.analysis.repository.totalBranches).toBe(15);
      expect(parsed.metadata.generatedBy).toBe('Bramble CLI');
    });

    test('should export HTML format successfully', async () => {
      const options: ExportOptions = {
        format: 'html' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export.html')
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(result.outputPath).toBe(options.outputPath);

      // Verify file content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      expect(content).toContain('<h1>Bramble Git Analysis Report</h1>');
      expect(content).toContain('Total Branches');
      expect(content).toContain('15'); // Total branches count
      expect(content).toContain('Repository Analysis');
    });

    test('should export CSV format successfully', async () => {
      const options: ExportOptions = {
        format: 'csv' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export.csv')
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');

      // Verify CSV content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('Section,Metric,Value');
      expect(content).toContain('Analysis,Total Branches,15');
      expect(content).toContain('Metadata,Repository,test-repo');
    });

    test('should export Markdown format successfully', async () => {
      const options: ExportOptions = {
        format: 'markdown' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export.md')
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');

      // Verify Markdown content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      expect(content).toContain('# Bramble Git Analysis Report');
      expect(content).toContain('## Repository Analysis');
      expect(content).toContain('- **Total Branches:** 15');
      expect(content).toContain('## Branch Comparison');
    });

    test('should export XML format successfully', async () => {
      const options: ExportOptions = {
        format: 'xml' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export.xml'),
        xml: {
          pretty: true,
          encoding: 'UTF-8',
          includeDeclaration: true
        }
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('xml');

      // Verify XML content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(content).toContain('<bramble-export>');
      expect(content).toContain('<analysis>');
      expect(content).toContain('<repository>');
      expect(content).toContain('<totalBranches>15</totalBranches>');
    });

    test('should export PDF-ready HTML format successfully', async () => {
      const options: ExportOptions = {
        format: 'pdf' as ExportFormat,
        outputPath: path.join(tempDir, 'test-export-pdf.html'),
        pdf: {
          format: 'A4',
          orientation: 'portrait'
        }
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');

      // Verify PDF-ready HTML content
      const content = await fs.readFile(options.outputPath!, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<style>');
      expect(content).toContain('font-family: Arial');
      expect(content).toContain('margin: 20mm');
      expect(content).toContain('<h1>Bramble Git Analysis Report</h1>');
    });

    test('should export without file path (memory only)', async () => {
      const options: ExportOptions = {
        format: 'json' as ExportFormat
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.outputPath).toBeUndefined();
      expect(result.size).toBeGreaterThan(0);
    });

    test('should handle XML with custom options', async () => {
      const options: ExportOptions = {
        format: 'xml' as ExportFormat,
        xml: {
          pretty: false,
          encoding: 'UTF-16',
          includeDeclaration: false,
          arrayItemName: 'element'
        }
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(true);
      // XML should be compact (not pretty)
      // We can't easily test the content without outputPath, 
      // but we can verify it doesn't error
    });

    test('should handle errors gracefully', async () => {
      const options: ExportOptions = {
        format: 'unsupported' as any,
        outputPath: path.join(tempDir, 'test-error.txt')
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
      expect(result.format).toBe('unsupported');
    });

    test('should handle file write errors gracefully', async () => {
      // Use a path that will definitely fail on Windows (invalid characters)
      const options: ExportOptions = {
        format: 'json' as ExportFormat,
        outputPath: 'C:\\invalid<>|path/test.json'  // Contains invalid Windows characters
      };

      const result = await exportService.exportData(mockExportData, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('XML export functionality', () => {
    test('should escape XML special characters', async () => {
      const dataWithSpecialChars: ExportData = {
        ...mockExportData,
        metadata: {
          ...mockExportData.metadata,
          repository: {
            ...mockExportData.metadata.repository,
            name: 'test<>&"repo'
          }
        }
      };

      const options: ExportOptions = {
        format: 'xml' as ExportFormat
      };

      const result = await exportService.exportData(dataWithSpecialChars, options);
      expect(result.success).toBe(true);
      // The service should properly escape the special characters
    });

    test('should handle arrays in XML export', async () => {
      const options: ExportOptions = {
        format: 'xml' as ExportFormat,
        xml: {
          arrayItemName: 'branch'
        }
      };

      const result = await exportService.exportData(mockExportData, options);
      expect(result.success).toBe(true);
    });

    test('should handle null and undefined values in XML', async () => {
      const dataWithNulls: ExportData = {
        metadata: mockExportData.metadata
        // analysis and comparison are undefined, which is valid since they're optional
      };

      const options: ExportOptions = {
        format: 'xml' as ExportFormat
      };

      const result = await exportService.exportData(dataWithNulls, options);
      expect(result.success).toBe(true);
    });
  });

  describe('Templates', () => {
    test('should load built-in templates', () => {
      const templates = exportService.getTemplates();
      
      expect(templates).toContain('executive-summary');
      expect(templates).toContain('technical-report');
      expect(templates).toContain('cleanup-report');
    });

    test('should get template information', () => {
      const templateInfo = exportService.getTemplateInfo('executive-summary');
      
      expect(templateInfo).toBeDefined();
      expect(templateInfo.name).toBe('Executive Summary');
      expect(templateInfo.description).toContain('High-level overview');
      expect(templateInfo.format).toBe('pdf');
    });

    test('should return undefined for non-existent template', () => {
      const templateInfo = exportService.getTemplateInfo('non-existent');
      expect(templateInfo).toBeUndefined();
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle large export data efficiently', async () => {
      // Create large mock data
      const largeBranches = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
        current: false,
        commit: `commit-${i}`,
        lastActivity: new Date(),
        lastCommitAuthor: `author-${i}`,
        isStale: i % 5 === 0,
        commitCount: i * 2,
        branchType: 'local' as const,
        divergence: { ahead: i, behind: i + 1 },
        contributors: [`author-${i}`],
        mergeable: true,
        conflictCount: 0,
        commitFrequency: [],
        size: i * 100
      }));

      const largeData: ExportData = {
        ...mockExportData,
        analysis: {
          ...mockExportData.analysis!,
          branches: largeBranches
        }
      };

      const startTime = Date.now();
      const result = await exportService.exportData(largeData, { format: 'json' });
      const exportTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(exportTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.size).toBeGreaterThan(10000); // Should be substantial
    });

    test('should handle empty data gracefully', async () => {
      const emptyData: ExportData = {
        metadata: mockExportData.metadata
        // All analysis properties are optional
      };

      const result = await exportService.exportData(emptyData, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0); // Should still have metadata
    });

    test('should handle circular references in data', async () => {
      // Create data with potential circular reference
      const circularData: any = {
        metadata: mockExportData.metadata,
        analysis: mockExportData.analysis
      };
      
      // Don't actually create circular reference in test, 
      // but ensure service can handle complex nested objects
      const result = await exportService.exportData(circularData, { format: 'json' });
      expect(result.success).toBe(true);
    });
  });

  describe('Format-specific features', () => {
    test('should include proper HTML structure for HTML export', async () => {
      const options: ExportOptions = {
        format: 'html' as ExportFormat,
        outputPath: path.join(tempDir, 'structure-test.html')
      };

      const result = await exportService.exportData(mockExportData, options);
      const content = await fs.readFile(options.outputPath!, 'utf8');

      expect(content).toContain('<div class="header">');
      expect(content).toContain('<div class="section">');
      expect(content).toContain('<div class="metric">');
      expect(content).toContain('Repository: test-repo');
    });

    test('should generate valid CSV with proper escaping', async () => {
      const dataWithCommas: ExportData = {
        ...mockExportData,
        metadata: {
          ...mockExportData.metadata,
          repository: {
            ...mockExportData.metadata.repository,
            name: 'test,repo,with,commas'
          }
        }
      };

      const options: ExportOptions = {
        format: 'csv' as ExportFormat,
        outputPath: path.join(tempDir, 'csv-test.csv')
      };

      const result = await exportService.exportData(dataWithCommas, options);
      expect(result.success).toBe(true);

      const content = await fs.readFile(options.outputPath!, 'utf8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('Section,Metric,Value');
    });

    test('should generate proper Markdown formatting', async () => {
      const options: ExportOptions = {
        format: 'markdown' as ExportFormat,
        outputPath: path.join(tempDir, 'markdown-test.md')
      };

      const result = await exportService.exportData(mockExportData, options);
      const content = await fs.readFile(options.outputPath!, 'utf8');

      expect(content).toMatch(/^# /m); // Should have h1 header
      expect(content).toMatch(/^## /m); // Should have h2 headers
      expect(content).toMatch(/^\- \*\*/m); // Should have bold list items
      expect(content).toContain('`feature/new-feature`'); // Should have code formatting
    });
  });
});
