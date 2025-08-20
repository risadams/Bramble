import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BrambleApp } from '../src/app/BrambleApp.js';
import { mockAnalysisResult } from './fixtures.js';

// Mock dependencies
jest.mock('../src/core/GitAnalyzer.js');
jest.mock('../src/ui/TerminalUI.js');
jest.mock('../src/services/ExportService.js');
jest.mock('../src/services/RepositoryHealthService.js');
jest.mock('../src/services/EnhancedVisualizationEngine.js');

const mockGitAnalyzer = {
  analyze: jest.fn() as jest.MockedFunction<any>,
  getGit: jest.fn() as jest.MockedFunction<any>
};

const mockTerminalUI = {
  start: jest.fn() as jest.MockedFunction<any>
};

const mockExportService = {
  export: jest.fn() as jest.MockedFunction<any>
};

const mockRepositoryHealthService = {
  generateHealthReport: jest.fn() as jest.MockedFunction<any>
};

const mockEnhancedVisualizationEngine = {
  render: jest.fn() as jest.MockedFunction<any>,
  generateVisualization: jest.fn() as jest.MockedFunction<any>
};

// Mock the constructor imports
jest.mock('../src/core/GitAnalyzer.js', () => ({
  GitAnalyzer: jest.fn().mockImplementation(() => mockGitAnalyzer)
}));

jest.mock('../src/ui/TerminalUI.js', () => ({
  TerminalUI: jest.fn().mockImplementation(() => mockTerminalUI)
}));

jest.mock('../src/services/ExportService.js', () => ({
  ExportService: jest.fn().mockImplementation(() => mockExportService)
}));

jest.mock('../src/services/RepositoryHealthService.js', () => ({
  RepositoryHealthService: jest.fn().mockImplementation(() => mockRepositoryHealthService)
}));

jest.mock('../src/services/EnhancedVisualizationEngine.js', () => ({
  EnhancedVisualizationEngine: jest.fn().mockImplementation(() => mockEnhancedVisualizationEngine)
}));

describe('BrambleApp', () => {
  let app: BrambleApp;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock returns
    (mockGitAnalyzer.analyze as jest.MockedFunction<any>).mockResolvedValue(mockAnalysisResult);
    (mockGitAnalyzer.getGit as jest.MockedFunction<any>).mockReturnValue({
      // Mock simple-git instance
      raw: jest.fn(),
      status: jest.fn(),
      branch: jest.fn(),
      log: jest.fn()
    });
    (mockTerminalUI.start as jest.MockedFunction<any>).mockResolvedValue(undefined);
    (mockExportService.export as jest.MockedFunction<any>).mockResolvedValue('export-content');
    
    app = new BrambleApp('/test/repo');
  });

  describe('constructor', () => {
    test('should create BrambleApp instance', () => {
      expect(app).toBeInstanceOf(BrambleApp);
    });

    test('should accept options', () => {
      const appWithOptions = new BrambleApp('/test/repo', {
        verbose: true,
        output: 'json'
      });
      expect(appWithOptions).toBeInstanceOf(BrambleApp);
    });
  });

  describe('run', () => {
    test('should execute analysis and start UI', async () => {
      await app.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalled();
      expect(mockTerminalUI.start).toHaveBeenCalledWith(mockAnalysisResult);
    });

    test('should show progress indicators when not in quiet mode', async () => {
      const progressApp = new BrambleApp('/test/repo', { quiet: false });
      await progressApp.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object)
      );
    });

    test('should skip progress indicators in quiet mode', async () => {
      const quietApp = new BrambleApp('/test/repo', { quiet: true });
      await quietApp.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalledWith(
        undefined,
        expect.any(Object)
      );
    });

    test('should use fast analysis mode when specified', async () => {
      const fastApp = new BrambleApp('/test/repo', { fast: true });
      await fastApp.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          analysisDepth: 'fast'
        })
      );
    });

    test('should use deep analysis mode when specified', async () => {
      const deepApp = new BrambleApp('/test/repo', { deep: true });
      await deepApp.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          analysisDepth: 'deep'
        })
      );
    });

    test('should respect maxBranches option', async () => {
      const limitedApp = new BrambleApp('/test/repo', { maxBranches: 50 });
      await limitedApp.run();

      expect(mockGitAnalyzer.analyze).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxBranches: 50
        })
      );
    });

    test('should handle export option', async () => {
      const exportApp = new BrambleApp('/test/repo', { export: 'report.json' });
      await exportApp.run();

      expect(mockExportService.export).toHaveBeenCalledWith(
        mockAnalysisResult,
        expect.objectContaining({
          format: 'json',
          outputPath: 'report.json'
        })
      );
    });

    test('should handle errors gracefully', async () => {
      (mockGitAnalyzer.analyze as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Analysis failed')
      );

      await expect(app.run()).rejects.toThrow('Analysis failed');
    });
  });
});
