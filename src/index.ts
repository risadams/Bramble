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
}

const program = new Command();

program
  .name('bramble')
  .description('Terminal-based tool for advanced git branch analysis and visualization')
  .version('1.0.0');

// Main analysis command
program
  .command('analyze [path]')
  .description('Analyze git repository branches')
  .option('-b, --batch', 'Enable batch mode for multiple repositories')
  .option('-o, --output <format>', 'Export format (json|html|csv|markdown)')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--ascii', 'Force ASCII character mode for better terminal compatibility')
  .option('--export <filename>', 'Export results to file')
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
  }

  // Validate repository
  const isValid = await validateRepository(path);
  if (!isValid) {
    console.error(chalk.red('❌ Not a valid git repository'));
    process.exit(1);
  }

  // Load configuration
  const config = ConfigManager.loadConfig();
  
  // Initialize and run the application
  const app = new BrambleApp(path, { ...options, config });
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
