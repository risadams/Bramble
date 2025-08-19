import chalk from 'chalk';
import { GitAnalyzer, ProgressCallback } from '../core/GitAnalyzer.js';
import { GitAnalyzerOptimizedV2, OptimizedAnalysisOptions } from '../core/GitAnalyzerOptimizedV2.js';
import { TerminalUI } from '../ui/TerminalUI.js';
import { ExportService } from '../services/ExportService.js';
import { BrambleConfig } from '../types/config.js';
import { ProgressIndicator, SpinnerIndicator } from '../utils/progressIndicator.js';

interface BrambleOptions {
  batch?: boolean;
  output?: string;
  verbose?: boolean;
  export?: string;
  config?: BrambleConfig;
  quiet?: boolean;
  // Performance options
  fast?: boolean;
  deep?: boolean;
  maxBranches?: number;
  maxConcurrency?: number;
  skipStale?: number; // days
}

export class BrambleApp {
  private gitAnalyzer: GitAnalyzer;
  private gitAnalyzerOptimized: GitAnalyzerOptimizedV2;
  private ui: TerminalUI;
  private exportService: ExportService;
  private options: BrambleOptions;

  constructor(private repositoryPath: string, options: BrambleOptions = {}) {
    this.options = options;
    this.gitAnalyzer = new GitAnalyzer(repositoryPath);
    this.gitAnalyzerOptimized = new GitAnalyzerOptimizedV2(repositoryPath);
    this.ui = new TerminalUI();
    this.exportService = new ExportService();
  }

  public async run(): Promise<void> {
    try {
      // Show progress indicators only if not in quiet mode
      const showProgress = !this.options.quiet;
      
      // Determine analysis mode and options
      const useOptimized = this.shouldUseOptimizedAnalyzer();
      const analysisOptions = this.getAnalysisOptions();
      
      if (this.options.verbose && useOptimized) {
        console.log(chalk.blue(`🚀 Using optimized analysis mode: ${analysisOptions.analysisDepth}`));
        if (analysisOptions.maxBranches && analysisOptions.maxBranches < Infinity) {
          console.log(chalk.gray(`   → Limited to ${analysisOptions.maxBranches} most recent branches`));
        }
        if (analysisOptions.skipStalerThan && analysisOptions.skipStalerThan < Infinity) {
          console.log(chalk.gray(`   → Skipping branches older than ${analysisOptions.skipStalerThan} days`));
        }
        console.log(chalk.gray(`   → Using ${analysisOptions.maxConcurrency} concurrent workers`));
      }
      
      // Show spinner for initial setup
      let setupSpinner: SpinnerIndicator | null = null;
      if (showProgress) {
        setupSpinner = new SpinnerIndicator('Initializing repository analysis...');
        setupSpinner.start();
      }

      let progressIndicator: ProgressIndicator | null = null;
      let branchProgressIndicator: ProgressIndicator | null = null;
      let spinnerStopped = false;

      // Create progress callback
      const progressCallback: ProgressCallback = (current: number, total: number, message?: string) => {
        if (!showProgress) return;

        // Stop spinner on first progress update
        if (!spinnerStopped && setupSpinner) {
          setupSpinner.stop();
          spinnerStopped = true;
        }

        if (message?.includes('Analyzing branch:') || message?.includes('Analyzed:')) {
          // This is branch-level progress
          if (!branchProgressIndicator) {
            if (progressIndicator) {
              progressIndicator.complete('Repository metadata collected');
              progressIndicator = null;
            }
            console.log(); // Add space before branch progress
            branchProgressIndicator = new ProgressIndicator({
              total,
              label: `Analyzing ${total} branches`,
              showEta: total > 10 // Only show ETA for repos with many branches
            });
          }
          
          let displayName = message;
          if (message.includes('Analyzing branch:')) {
            const branchName = message.replace('Analyzing branch: ', '');
            displayName = branchName.length > 25 ? branchName.substring(0, 22) + '...' : branchName;
          } else if (message.includes('Analyzed:')) {
            displayName = (message?.split('(')[0] || '').replace('Analyzed: ', '').trim();
          }
          
          branchProgressIndicator.update(current, displayName);
        } else {
          // This is high-level progress
          if (!progressIndicator && !branchProgressIndicator) {
            progressIndicator = new ProgressIndicator({
              total,
              label: 'Repository analysis',
              showEta: false,
              showPercentage: false
            });
          }
          progressIndicator?.update(current, message);
        }
      };

      // Perform analysis with appropriate analyzer
      const analysisResult = useOptimized 
        ? await this.gitAnalyzerOptimized.analyze(showProgress ? progressCallback : undefined, analysisOptions)
        : await this.gitAnalyzer.analyze(showProgress ? progressCallback : undefined);
      
      // Complete progress indicators
      if (showProgress) {
        if (branchProgressIndicator) {
          (branchProgressIndicator as ProgressIndicator).complete(`✓ Analyzed ${analysisResult.branches.length} branches`);
        }
        if (progressIndicator) {
          (progressIndicator as ProgressIndicator).complete('✓ Repository analysis complete');
        }

        // Stop spinner if it's still running
        if (!spinnerStopped && setupSpinner) {
          setupSpinner.stop();
        }
      }

      if (this.options.verbose) {
        console.log(chalk.green(`✅ Analysis complete - Found ${analysisResult.repository.totalBranches} branches`));
        console.log(chalk.gray(`   → ${analysisResult.repository.staleBranches} stale, ${analysisResult.repository.mergeableBranches} mergeable, ${analysisResult.repository.conflictedBranches} conflicted`));
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

  private shouldUseOptimizedAnalyzer(): boolean {
    // Use optimized analyzer for:
    // 1. When explicitly requested via fast/deep modes
    // 2. When performance options are set
    // 3. Always use it for better performance unless legacy mode is forced
    return this.options.fast || 
           this.options.deep || 
           this.options.maxBranches !== undefined ||
           this.options.maxConcurrency !== undefined ||
           this.options.skipStale !== undefined ||
           true; // Default to optimized
  }

  private getAnalysisOptions(): OptimizedAnalysisOptions {
    let analysisDepth: 'fast' | 'normal' | 'deep' = 'normal';
    
    if (this.options.fast) {
      analysisDepth = 'fast';
    } else if (this.options.deep) {
      analysisDepth = 'deep';
    }

    const options: OptimizedAnalysisOptions = {
      analysisDepth,
      enableCaching: true,
      streamResults: false // Could be tied to a future --stream option
    };

    if (this.options.maxConcurrency !== undefined) {
      options.maxConcurrency = this.options.maxConcurrency;
    }

    if (this.options.maxBranches !== undefined) {
      options.maxBranches = this.options.maxBranches;
    }

    if (this.options.skipStale !== undefined) {
      options.skipStalerThan = this.options.skipStale;
    }

    return options;
  }
}
