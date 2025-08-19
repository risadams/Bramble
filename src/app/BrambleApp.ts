import chalk from 'chalk';
import { GitAnalyzer } from '../core/GitAnalyzer.js';
import { TerminalUI } from '../ui/TerminalUI.js';
import { ExportService } from '../services/ExportService.js';
import { BrambleConfig } from '../types/config.js';

interface BrambleOptions {
  batch?: boolean;
  output?: string;
  verbose?: boolean;
  export?: string;
  config?: BrambleConfig;
}

export class BrambleApp {
  private gitAnalyzer: GitAnalyzer;
  private ui: TerminalUI;
  private exportService: ExportService;
  private options: BrambleOptions;

  constructor(private repositoryPath: string, options: BrambleOptions = {}) {
    this.options = options;
    this.gitAnalyzer = new GitAnalyzer(repositoryPath);
    this.ui = new TerminalUI();
    this.exportService = new ExportService();
  }

  public async run(): Promise<void> {
    try {
      if (this.options.verbose) {
        console.log(chalk.cyan('🔍 Starting repository analysis...'));
      }

      // Perform initial analysis
      const analysisResult = await this.gitAnalyzer.analyze();
      
      if (this.options.verbose) {
        console.log(chalk.green('✅ Analysis complete'));
      }

      // Export if requested
      if (this.options.export) {
        await this.exportResults(analysisResult);
      }

      // Start interactive UI
      await this.ui.start(analysisResult);

    } catch (error) {
      console.error(chalk.red('❌ Application error:'), error);
      throw error;
    }
  }

  private async exportResults(analysisResult: any): Promise<void> {
    if (!this.options.export) return;

    const format = this.options.output || this.options.config?.defaultExportFormat || 'json';
    const exportData = await this.exportService.export(analysisResult, { 
      format: format as any,
      outputPath: this.options.export
    });

    console.log(chalk.green(`📄 Results exported to: ${this.options.export}`));
  }
}
