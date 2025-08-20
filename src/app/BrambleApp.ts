import chalk from 'chalk';
import { ProgressCallback } from '../types/analysis.js';
import { GitAnalyzer, OptimizedAnalysisOptions } from '../core/GitAnalyzer.js';
import { TerminalUI } from '../ui/TerminalUI.js';
import { ExportService } from '../services/ExportService.js';
import { RepositoryHealthService } from '../services/RepositoryHealthService.js';
import { EnhancedVisualizationEngine } from '../services/EnhancedVisualizationEngine.js';
import { BrambleConfig } from '../types/config.js';
import { HealthAnalysisOptions } from '../types/health.js';
import { VisualizationRequest, DARK_THEME, LIGHT_THEME } from '../types/visualization.js';
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
  // Health monitoring options
  health?: boolean;
  healthExport?: string;
  healthDimensions?: string[];
  // Enhanced visualization options
  viz?: string;
  vizTheme?: string;
  vizConfig?: any;
}

export class BrambleApp {
  private gitAnalyzer: GitAnalyzer;
  private ui: TerminalUI;
  private exportService: ExportService;
  private healthService: RepositoryHealthService;
  private visualizationEngine: EnhancedVisualizationEngine;
  private options: BrambleOptions;

  constructor(private repositoryPath: string, options: BrambleOptions = {}) {
    this.options = options;
    this.gitAnalyzer = new GitAnalyzer(repositoryPath);
    this.ui = new TerminalUI();
    this.exportService = new ExportService();
    this.healthService = new RepositoryHealthService(
      this.gitAnalyzer.getGit(), 
      repositoryPath,
      options.config?.health
    );
    this.visualizationEngine = new EnhancedVisualizationEngine(
      options.vizConfig,
      this.getVisualizationTheme(options.vizTheme)
    );
  }

  public async run(): Promise<void> {
    try {
      // Show progress indicators only if not in quiet mode
      const showProgress = !this.options.quiet;
      
      // Get analysis options
      const analysisOptions = this.getAnalysisOptions();
      
      if (this.options.verbose) {
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

      // Perform analysis with optimized analyzer
      const analysisResult = await this.gitAnalyzer.analyze(
        showProgress ? progressCallback : undefined, 
        analysisOptions
      );
      
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

      // Generate health report if requested
      if (this.options.health) {
        await this.generateHealthReport(analysisResult);
      }

      // Generate enhanced visualization if requested
      if (this.options.viz) {
        await this.runEnhancedVisualization(analysisResult);
      }

      // Export if requested
      if (this.options.export) {
        await this.exportResults(analysisResult);
      }

      // Start interactive UI only if not in batch mode and no visualization was requested
      if (!this.options.batch && !this.options.viz) {
        await this.ui.start(analysisResult);
      } else if (!this.options.viz) {
        console.log(chalk.green('✅ Analysis complete. Use --export to save results.'));
      }

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

  private async generateHealthReport(analysisResult: any): Promise<void> {
    try {
      console.log(chalk.blue('🏥 Generating repository health report...'));

      const healthOptions: HealthAnalysisOptions = {
        includeTrends: true,
        dimensions: this.options.healthDimensions as any
      };

      const healthReport = await this.healthService.generateHealthReport(analysisResult, healthOptions);

      // Display health summary
      console.log();
      console.log(chalk.bold(`📊 Repository Health Score: ${healthReport.overallScore}/100 (${healthReport.category.toUpperCase()})`));
      
      // Display dimension scores
      healthReport.dimensions.forEach(dim => {
        const color = dim.category === 'excellent' ? 'green' : 
                     dim.category === 'good' ? 'blue' :
                     dim.category === 'fair' ? 'yellow' :
                     dim.category === 'poor' ? 'magenta' : 'red';
        
        console.log(chalk[color](`   ${dim.dimension}: ${Math.round(dim.score)}/100`));
      });

      // Show critical issues if any
      if (healthReport.summary.criticalIssues.length > 0) {
        console.log();
        console.log(chalk.red('⚠️  Critical Issues:'));
        healthReport.summary.criticalIssues.forEach(issue => {
          console.log(chalk.red(`   • ${issue}`));
        });
      }

      // Show quick wins if any
      if (healthReport.summary.quickWins.length > 0) {
        console.log();
        console.log(chalk.yellow('💡 Quick Wins:'));
        healthReport.summary.quickWins.slice(0, 3).forEach(win => {
          console.log(chalk.yellow(`   • ${win}`));
        });
      }

      // Export health report if requested
      if (this.options.healthExport) {
        await this.exportHealthReport(healthReport);
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to generate health report:'), error);
    }
  }

  private async exportHealthReport(healthReport: any): Promise<void> {
    try {
      const exportPath = this.options.healthExport!;
      const format = exportPath.split('.').pop()?.toLowerCase() || 'json';
      
      let content: string;
      switch (format) {
        case 'json':
          content = JSON.stringify(healthReport, null, 2);
          break;
        case 'md':
        case 'markdown':
          content = this.generateHealthMarkdown(healthReport);
          break;
        default:
          content = JSON.stringify(healthReport, null, 2);
      }

      await import('fs/promises').then(fs => fs.writeFile(exportPath, content));
      console.log(chalk.green(`📄 Health report exported to: ${exportPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to export health report:'), error);
    }
  }

  private generateHealthMarkdown(healthReport: any): string {
    return `# Repository Health Report

**Repository:** ${healthReport.repositoryName}  
**Generated:** ${new Date(healthReport.generatedAt).toLocaleString()}  
**Overall Score:** ${healthReport.overallScore}/100 (${healthReport.category.toUpperCase()})

## Health Dimensions

${healthReport.dimensions.map((dim: any) => `
### ${dim.dimension.charAt(0).toUpperCase() + dim.dimension.slice(1)}
- **Score:** ${Math.round(dim.score)}/100
- **Category:** ${dim.category.toUpperCase()}
- **Recommendations:**
${dim.recommendations.map((rec: string) => `  - ${rec}`).join('\n')}
`).join('\n')}

## Summary

### Strengths
${healthReport.summary.strengths.map((s: string) => `- ${s}`).join('\n')}

### Areas for Improvement
${healthReport.summary.weaknesses.map((w: string) => `- ${w}`).join('\n')}

${healthReport.summary.criticalIssues.length > 0 ? `
### Critical Issues
${healthReport.summary.criticalIssues.map((issue: string) => `- ${issue}`).join('\n')}
` : ''}

${healthReport.summary.quickWins.length > 0 ? `
### Quick Wins
${healthReport.summary.quickWins.map((win: string) => `- ${win}`).join('\n')}
` : ''}

## Repository Metadata
- **Total Branches:** ${healthReport.metadata.totalBranches}
- **Active Branches:** ${healthReport.metadata.activeBranches}
- **Stale Branches:** ${healthReport.metadata.staleBranches}
- **Total Commits:** ${healthReport.metadata.totalCommits}
- **Contributors:** ${healthReport.metadata.contributors}
- **Last Activity:** ${new Date(healthReport.metadata.lastActivity).toLocaleDateString()}
`;
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

  private getVisualizationTheme(themeName?: string) {
    switch (themeName?.toLowerCase()) {
      case 'light':
        return LIGHT_THEME;
      case 'dark':
      default:
        return DARK_THEME;
    }
  }

  private async runEnhancedVisualization(analysisResult: any): Promise<void> {
    if (!this.options.viz) return;

    console.log(chalk.blue.bold('\n🎨 Enhanced Visualization\n'));

    const request: VisualizationRequest = {
      type: this.options.viz as any,
      data: analysisResult,
      config: this.options.vizConfig,
      theme: this.getVisualizationTheme(this.options.vizTheme)
    };

    try {
      const visualization = this.visualizationEngine.generate(request);
      console.log(visualization);

      // Export if requested
      if (this.options.export && this.options.viz) {
        await this.exportVisualization(visualization, this.options.export);
      }
    } catch (error) {
      console.error(chalk.red('❌ Visualization error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async exportVisualization(visualization: string, filename: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(filename, visualization, 'utf-8');
      console.log(chalk.green(`✅ Visualization exported to ${filename}`));
    } catch (error) {
      console.error(chalk.red('❌ Export error:'), error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
