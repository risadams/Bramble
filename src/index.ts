#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { BrambleApp } from './app/BrambleApp.js';
import { validateRepository } from './utils/validation.js';
import { ConfigManager } from './utils/ConfigManager.js';
import { TerminalCompat } from './utils/terminalCompat.js';

interface CliOptions {
  batch?: boolean;
  output?: string;
  verbose?: boolean;
  config?: boolean;
  export?: string;
  ascii?: boolean;
  quiet?: boolean;
  // Performance options
  fast?: boolean;
  deep?: boolean;
  maxBranches?: number;
  maxConcurrency?: number;
  skipStale?: number;
  // Health monitoring options
  health?: boolean;
  healthExport?: string;
  healthDimensions?: string;
}

const program = new Command();

program
  .name('bramble')
  .description('Terminal-based tool for advanced git branch analysis and visualization')
  .version('1.1.0')
  .addHelpText('after', `
Examples:
  $ bramble analyze                       # Analyze current directory with progress indicators
  $ bramble analyze /path/to/repo         # Analyze specific repository
  $ bramble analyze --quiet               # Run without progress indicators (for scripts)
  $ bramble analyze --verbose             # Show detailed progress and statistics
  $ bramble analyze --export report.json # Export results to file
  
Performance Options (for large repositories):
  $ bramble analyze --fast                     # Fast analysis (skip expensive operations)
  $ bramble analyze --deep                     # Deep analysis (comprehensive)
  $ bramble analyze --max-branches 100        # Limit to 100 most recent branches
  $ bramble analyze --skip-stale 90           # Skip branches older than 90 days
  $ bramble analyze --max-concurrency 4       # Use 4 parallel workers

Health Monitoring:
  $ bramble analyze --health                          # Generate repository health report
  $ bramble analyze --health --health-export health.md  # Export health report to file
  $ bramble analyze --health-dimensions codeQuality,security  # Analyze specific dimensions

Features:
  • Interactive branch visualization and statistics
  • Progress indicators for repositories with many branches
  • Optimized parallel processing for repositories with 100+ branches
  • Export support (JSON, HTML, CSV, Markdown)
  • Terminal compatibility mode for various environments
`);

// Main analysis command
program
  .command('analyze [path]')
  .description('Analyze git repository branches')
  .option('-b, --batch', 'Enable batch mode for multiple repositories')
  .option('-o, --output <format>', 'Export format (json|html|csv|markdown)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Disable progress indicators (useful for automated scripts)')
  .option('--ascii', 'Force ASCII character mode for better terminal compatibility')
  .option('--export <filename>', 'Export results to file')
  .option('--fast', 'Fast analysis mode (skip expensive operations like conflict detection)')
  .option('--deep', 'Deep analysis mode (comprehensive analysis including all conflict checks)')
  .option('--max-branches <number>', 'Limit analysis to N most recent branches', (value) => parseInt(value))
  .option('--max-concurrency <number>', 'Number of parallel workers (default: CPU cores)', (value) => parseInt(value))
  .option('--skip-stale <days>', 'Skip branches older than N days', (value) => parseInt(value))
  .option('--health', 'Generate repository health report')
  .option('--health-export <filename>', 'Export health report to file (supports .json, .md)')
  .option('--health-dimensions <dimensions>', 'Comma-separated list of health dimensions to analyze')
  .action(async (path: string = '.', options: CliOptions) => {
    try {
      console.log(chalk.blue.bold('🌿 Bramble - Git Branch Analysis Tool'));
      
      // Set terminal compatibility mode
      if (options.ascii) {
        TerminalCompat.setAsciiMode();
        console.log(chalk.yellow('📟 ASCII mode enabled for terminal compatibility'));
      }
      
      if (options.batch) {
        await runBatchMode(path, options);
      } else {
        await runSingleAnalysis(path, options);
      }

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Configuration commands
program
  .command('config')
  .description('Manage Bramble configuration')
  .option('--show', 'Show current configuration')
  .option('--reset', 'Reset to default configuration')
  .option('--create', 'Create default configuration file')
  .option('--set <key=value>', 'Set configuration value')
  .action(async (options) => {
    try {
      if (options.show) {
        showConfig();
      } else if (options.reset) {
        ConfigManager.resetConfig();
        console.log(chalk.green('✅ Configuration reset to defaults'));
      } else if (options.create) {
        ConfigManager.createDefaultConfig();
      } else if (options.set) {
        setConfigValue(options.set);
      } else {
        console.log(chalk.yellow('Use --show, --reset, --create, or --set <key=value>'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Config error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Default command (for backward compatibility)
program
  .argument('[path]', 'Path to git repository', '.')
  .option('-b, --batch', 'Enable batch mode for multiple repositories')
  .option('-o, --output <format>', 'Export format (json|html|csv|markdown)', 'json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (path: string, options: CliOptions) => {
    // Redirect to analyze command
    await runSingleAnalysis(path, options);
  });

async function runSingleAnalysis(path: string, options: CliOptions): Promise<void> {
  if (options.verbose) {
    console.log(chalk.cyan(`🔍 Analyzing repository at: ${path}`));
    
    // Show performance options if set
    if (options.fast) {
      console.log(chalk.gray('   → Fast analysis mode enabled'));
    } else if (options.deep) {
      console.log(chalk.gray('   → Deep analysis mode enabled'));
    }
    
    if (options.maxBranches) {
      console.log(chalk.gray(`   → Limited to ${options.maxBranches} branches`));
    }
    
    if (options.skipStale) {
      console.log(chalk.gray(`   → Skipping branches older than ${options.skipStale} days`));
    }
    
    if (options.maxConcurrency) {
      console.log(chalk.gray(`   → Using ${options.maxConcurrency} concurrent workers`));
    }
    
    if (options.health) {
      console.log(chalk.gray('   → Repository health analysis enabled'));
      if (options.healthDimensions) {
        console.log(chalk.gray(`   → Health dimensions: ${options.healthDimensions}`));
      }
      if (options.healthExport) {
        console.log(chalk.gray(`   → Health report export: ${options.healthExport}`));
      }
    }
  }

  // Validate repository
  const isValid = await validateRepository(path);
  if (!isValid) {
    console.error(chalk.red('❌ Not a valid git repository'));
    process.exit(1);
  }

  // Load configuration
  const config = ConfigManager.loadConfig();
  
  // Initialize and run the application with all options
  const brambleOptions: any = { 
    ...options, 
    config
  };
  
  // Add performance options if they are defined
  if (options.fast !== undefined) brambleOptions.fast = options.fast;
  if (options.deep !== undefined) brambleOptions.deep = options.deep;
  if (options.maxBranches !== undefined) brambleOptions.maxBranches = options.maxBranches;
  if (options.maxConcurrency !== undefined) brambleOptions.maxConcurrency = options.maxConcurrency;
  if (options.skipStale !== undefined) brambleOptions.skipStale = options.skipStale;
  
  // Add batch mode option
  if (options.batch !== undefined) brambleOptions.batch = options.batch;
  
  // Add health monitoring options
  if (options.health !== undefined) brambleOptions.health = options.health;
  if (options.healthExport !== undefined) brambleOptions.healthExport = options.healthExport;
  if (options.healthDimensions !== undefined) {
    brambleOptions.healthDimensions = options.healthDimensions.split(',').map(d => d.trim());
  }
  
  const app = new BrambleApp(path, brambleOptions);
  await app.run();
}

async function runBatchMode(basePath: string, options: CliOptions): Promise<void> {
  console.log(chalk.cyan('🔄 Running in batch mode...'));
  // TODO: Implement batch processing of multiple repositories
  console.log(chalk.yellow('⚠️ Batch mode not yet implemented'));
}

function showConfig(): void {
  const { path, exists, config } = ConfigManager.getConfigInfo();
  
  console.log(chalk.blue.bold('🔧 Bramble Configuration'));
  console.log(chalk.gray(`Config file: ${path}`));
  console.log(chalk.gray(`Exists: ${exists ? 'Yes' : 'No'}`));
  console.log();
  
  console.log('Current settings:');
  console.log(`  Stale Days: ${config.staleDays}`);
  console.log(`  Default Export Format: ${config.defaultExportFormat}`);
  console.log(`  Theme: ${config.theme}`);
  console.log(`  Max Branches: ${config.maxBranches}`);
  console.log(`  Include Remote Branches: ${config.includeRemoteBranches}`);
}

function setConfigValue(keyValue: string): void {
  const [key, value] = keyValue.split('=');
  if (!key || !value) {
    console.error(chalk.red('❌ Invalid format. Use: key=value'));
    return;
  }

  const config = ConfigManager.loadConfig();
  const updates: any = {};

  // Parse value based on key
  switch (key) {
    case 'staleDays':
    case 'maxBranches':
      updates[key] = parseInt(value, 10);
      break;
    case 'includeRemoteBranches':
      updates[key] = value.toLowerCase() === 'true';
      break;
    case 'defaultExportFormat':
    case 'theme':
      updates[key] = value;
      break;
    default:
      console.error(chalk.red(`❌ Unknown configuration key: ${key}`));
      return;
  }

  // Validate the update
  const errors = ConfigManager.validateConfig(updates);
  if (errors.length > 0) {
    console.error(chalk.red('❌ Configuration errors:'));
    errors.forEach(error => console.error(`  - ${error}`));
    return;
  }

  ConfigManager.updateConfig(updates);
  console.log(chalk.green(`✅ Updated ${key} = ${value}`));
}

program.parse();
