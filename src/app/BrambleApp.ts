import chalk from 'chalk';
import { GitAnalyzer } from '../core/GitAnalyzer.js';
import { TerminalUI } from '../ui/TerminalUI.js';
import { ExportService } from '../services/ExportService.js';

interface BrambleOptions {
  batch?: boolean;
  output?: string;
  verbose?: boolean;
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

      // Start interactive UI
      await this.ui.start(analysisResult);

    } catch (error) {
      console.error(chalk.red('❌ Application error:'), error);
      throw error;
    }
  }
}
