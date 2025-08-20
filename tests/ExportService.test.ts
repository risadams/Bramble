import { describe, test, expect, beforeEach } from '@jest/globals';
import { ExportService } from '../src/services/ExportService.js';
import { mockAnalysisResult } from './fixtures.js';

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  describe('export', () => {
    test('should export to JSON format', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'json'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      
      // Verify it's valid JSON
      const parsed = JSON.parse(result);
      expect(parsed.repository).toBeDefined();
      expect(parsed.branches).toBeDefined();
      expect(parsed.statistics).toBeDefined();
    });

    test('should export to HTML format', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'html'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('Bramble Analysis Report');
      expect(result).toContain(mockAnalysisResult.repository.path);
    });

    test('should export to CSV format', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'csv'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Name,Current,Last Activity');
    });

    test('should export to Markdown format', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'markdown'
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('# 🌿 Bramble Analysis Report');
      expect(result).toContain('## Overview');
    });

    test('should throw error for unsupported format', async () => {
      await expect(
        exportService.export(mockAnalysisResult, {
          format: 'unsupported' as any
        })
      ).rejects.toThrow('Unsupported export format: unsupported');
    });
  });

  describe('specific format tests', () => {
    test('JSON export should include all data', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'json'
      });

      const parsed = JSON.parse(result);
      expect(parsed.repository).toEqual(mockAnalysisResult.repository);
      expect(parsed.statistics).toEqual(mockAnalysisResult.statistics);
      expect(parsed.branches).toHaveLength(mockAnalysisResult.branches.length);
    });

    test('HTML export should include statistics', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'html'
      });

      expect(result).toContain('Total Branches');
      expect(result).toContain('Stale Branches');
      expect(result).toContain('Branch Details');
    });

    test('CSV export should have proper headers', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'csv'
      });

      const lines = result.split('\n');
      const headers = lines[0];
      expect(headers).toContain('Name');
      expect(headers).toContain('Current');
      expect(headers).toContain('Commit');
    });

    test('Markdown export should be properly formatted', async () => {
      const result = await exportService.export(mockAnalysisResult, {
        format: 'markdown'
      });

      expect(result).toContain('# 🌿 Bramble Analysis Report');
      expect(result).toContain('## Overview');
      expect(result).toContain('## Branch Details');
      expect(result).toContain('| Branch |');
    });
  });
});
