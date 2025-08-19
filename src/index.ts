#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { BrambleApp } from './app/BrambleApp.js';
import { validateRepository } from './utils/validation.js';

interface CliOptions {
  batch?: boolean;
  output?: string;
  verbose?: boolean;
}

const program = new Command();

program
  .name('bramble')
  .description('Terminal-based tool for advanced git branch analysis and visualization')
  .version('1.0.0')
  .argument('[path]', 'Path to git repository', '.')
  .option('-b, --batch', 'Enable batch mode for multiple repositories')
  .option('-o, --output <format>', 'Export format (json|html|csv|markdown)', 'json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (path: string, options: CliOptions) => {
    try {
      console.log(chalk.blue.bold('🌿 Bramble - Git Branch Analysis Tool'));
      console.log(chalk.gray(`Analyzing repository at: ${path}\n`));

      // Validate repository
      const isValid = await validateRepository(path);
      if (!isValid) {
        console.error(chalk.red('❌ Not a valid git repository'));
        process.exit(1);
      }

      // Initialize and run the application
      const app = new BrambleApp(path, options);
      await app.run();

    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();
