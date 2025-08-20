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
  // Enhanced visualization options
  viz?: string;
  vizTheme?: string;
  vizConfig?: string;
}

const program = new Command();

program
  .name('bramble')
  .description('Terminal-based tool for advanced git branch analysis and visualization')
  .version('1.3.0')
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

Enhanced Visualizations:
  $ bramble analyze --viz tree                        # Enhanced ASCII branch tree
  $ bramble analyze --viz heatmap                     # Enhanced activity heatmap
  $ bramble analyze --viz timeline                    # Repository timeline view
  $ bramble analyze --viz dashboard                   # Comprehensive dashboard
  $ bramble analyze --viz-theme dark                  # Use dark theme
  $ bramble viz --type network                        # Standalone visualization command

Advanced Configuration:
  $ bramble config profiles list                      # List available profiles
  $ bramble config profiles use enterprise            # Use enterprise profile
  $ bramble config profiles create myteam             # Create custom profile
  $ bramble config environments set development       # Set environment
  $ bramble config templates list                     # List configuration templates
  $ bramble config export config.json                 # Export configuration

Features:
  • Interactive branch visualization and statistics
  • Progress indicators for repositories with many branches
  • Optimized parallel processing for repositories with 100+ branches
  • Export support (JSON, HTML, CSV, Markdown)
  • Terminal compatibility mode for various environments
  • Enhanced ASCII visualizations with themes and configuration
  • Advanced configuration profiles and environment management
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
  // Enhanced visualization options
  .option('--viz <type>', 'Enhanced visualization type (tree|heatmap|timeline|network|dashboard|charts|calendar|flow)')
  .option('--viz-theme <theme>', 'Visualization theme (dark|light|colorful)')
  .option('--viz-config <options>', 'Visualization configuration as JSON string')
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
  .option('--export <filename>', 'Export configuration to file')
  .option('--import <filename>', 'Import configuration from file')
  .addHelpText('after', `
Advanced Configuration Commands:
  $ bramble config profiles list                    # List available profiles
  $ bramble config profiles show <id>               # Show profile details
  $ bramble config profiles use <id> [environment]  # Use profile with optional environment
  $ bramble config profiles create <name>           # Create new profile
  $ bramble config profiles delete <id>             # Delete profile
  
  $ bramble config environments list                # List available environments
  $ bramble config environments set <env>           # Set active environment
  
  $ bramble config templates list                   # List available templates
  $ bramble config templates apply <id>             # Apply template to create profile
  
  $ bramble config suggestions                       # Get configuration suggestions
`)
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
      } else if (options.export) {
        await exportAdvancedConfig(options.export);
      } else if (options.import) {
        await importAdvancedConfig(options.import);
      } else {
        console.log(chalk.yellow('Use --show, --reset, --create, --set, --export, or --import'));
        console.log(chalk.gray('For advanced configuration, use: bramble config profiles|environments|templates'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Config error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Advanced configuration subcommands
program
  .command('config-profiles')
  .alias('profiles')
  .description('Manage configuration profiles')
  .argument('[action]', 'Action to perform (list|show|use|create|delete)')
  .argument('[value]', 'Profile ID or name')
  .argument('[environment]', 'Environment (development|staging|production|testing|local)')
  .action(async (action, value, environment) => {
    const { AdvancedConfigManager } = await import('./services/AdvancedConfigManager.js');
    const configManager = new AdvancedConfigManager();
    await configManager.loadConfiguration();
    
    try {
      await handleProfileCommand(configManager, action, value, environment);
    } catch (error) {
      console.error(chalk.red('❌ Profile error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Configuration environments command
program
  .command('config-environments')
  .alias('environments')
  .description('Manage configuration environments')
  .argument('[action]', 'Action to perform (list|set|show)')
  .argument('[environment]', 'Environment name')
  .action(async (action, environment) => {
    try {
      await handleEnvironmentCommand(action, environment);
    } catch (error) {
      console.error(chalk.red('❌ Environment error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Configuration templates command
program
  .command('config-templates')
  .alias('templates')
  .description('Manage configuration templates')
  .argument('[action]', 'Action to perform (list|show|apply)')
  .argument('[templateId]', 'Template ID')
  .action(async (action, templateId) => {
    const { AdvancedConfigManager } = await import('./services/AdvancedConfigManager.js');
    const configManager = new AdvancedConfigManager();
    await configManager.loadConfiguration();
    
    try {
      await handleTemplateCommand(configManager, action, templateId);
    } catch (error) {
      console.error(chalk.red('❌ Template error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Enhanced visualization command
program
  .command('viz [path]')
  .description('Generate enhanced visualizations for git repository')
  .option('-t, --type <type>', 'Visualization type', 'dashboard')
  .option('--theme <theme>', 'Visualization theme (dark|light|colorful)', 'dark')
  .option('--config <options>', 'Visualization configuration as JSON string')
  .option('--export <filename>', 'Export visualization to file')
  .option('--ascii', 'Force ASCII character mode')
  .addHelpText('after', `
Visualization Types:
  tree      - Enhanced ASCII branch tree with metadata
  heatmap   - Activity heatmap with calendar layout
  timeline  - Repository timeline of events
  network   - Branch relationship network graph
  dashboard - Comprehensive metrics dashboard
  charts    - Statistical charts and graphs
  calendar  - Calendar view of commit activity
  flow      - Git flow diagram
  
Examples:
  $ bramble viz --type tree                    # Enhanced branch tree
  $ bramble viz --type heatmap --theme light   # Light theme heatmap
  $ bramble viz --type dashboard --export dashboard.txt
`)
  .action(async (path: string = '.', options) => {
    try {
      console.log(chalk.blue.bold('🎨 Bramble Enhanced Visualizations'));
      
      if (options.ascii) {
        TerminalCompat.setAsciiMode();
        console.log(chalk.yellow('📟 ASCII mode enabled'));
      }
      
      // Validate repository
      const isValid = await validateRepository(path);
      if (!isValid) {
        console.error(chalk.red('❌ Not a valid git repository'));
        process.exit(1);
      }
      
      // Run visualization
      const vizOptions: any = {
        viz: options.type,
        vizTheme: options.theme,
        export: options.export,
        batch: true, // Force batch mode for standalone viz
        quiet: true  // Disable progress for clean output
      };
      
      if (options.config) {
        try {
          vizOptions.vizConfig = JSON.parse(options.config);
        } catch (error) {
          console.error(chalk.red('❌ Invalid configuration JSON'));
          process.exit(1);
        }
      }
      
      await runSingleAnalysis(path, vizOptions);
      
    } catch (error) {
      console.error(chalk.red('❌ Visualization error:'), error instanceof Error ? error.message : 'Unknown error');
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
    
    if (options.viz) {
      console.log(chalk.gray(`   → Enhanced visualization: ${options.viz}`));
      if (options.vizTheme) {
        console.log(chalk.gray(`   → Visualization theme: ${options.vizTheme}`));
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
  
  // Add enhanced visualization options
  if (options.viz !== undefined) brambleOptions.viz = options.viz;
  if (options.vizTheme !== undefined) brambleOptions.vizTheme = options.vizTheme;
  if (options.vizConfig !== undefined) {
    try {
      brambleOptions.vizConfig = JSON.parse(options.vizConfig);
    } catch (error) {
      console.error(chalk.red('❌ Invalid visualization configuration JSON'));
      process.exit(1);
    }
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

// Advanced configuration handlers
async function exportAdvancedConfig(filename: string): Promise<void> {
  const { AdvancedConfigManager } = await import('./services/AdvancedConfigManager.js');
  const configManager = new AdvancedConfigManager();
  await configManager.loadConfiguration();
  await configManager.exportConfiguration(filename);
  console.log(chalk.green(`✅ Configuration exported to ${filename}`));
}

async function importAdvancedConfig(filename: string): Promise<void> {
  const { AdvancedConfigManager } = await import('./services/AdvancedConfigManager.js');
  const configManager = new AdvancedConfigManager();
  await configManager.importConfiguration(filename);
  console.log(chalk.green(`✅ Configuration imported from ${filename}`));
}

async function handleProfileCommand(configManager: any, action: string, value?: string, environment?: string): Promise<void> {
  switch (action) {
    case 'list':
      const profiles = configManager.getProfiles();
      console.log(chalk.blue.bold('\n📋 Available Profiles\n'));
      for (const profile of profiles) {
        const isBuiltIn = profile.id.startsWith('builtin-');
        const badge = isBuiltIn ? chalk.gray('[Built-in]') : chalk.green('[Custom]');
        console.log(`${badge} ${chalk.cyan(profile.id)} - ${profile.name}`);
        console.log(`   ${chalk.gray(profile.description)}`);
        console.log(`   ${chalk.yellow(`Type: ${profile.type}`)} | ${chalk.magenta(`Tags: ${profile.tags?.join(', ') || 'none'}`)}`);
        console.log();
      }
      break;

    case 'show':
      if (!value) {
        console.error(chalk.red('❌ Profile ID required'));
        return;
      }
      const profile = configManager.getProfile(value);
      if (!profile) {
        console.error(chalk.red(`❌ Profile '${value}' not found`));
        return;
      }
      console.log(chalk.blue.bold(`\n📄 Profile: ${profile.name}\n`));
      console.log(`ID: ${chalk.cyan(profile.id)}`);
      console.log(`Type: ${chalk.yellow(profile.type)}`);
      console.log(`Description: ${profile.description}`);
      console.log(`Version: ${profile.version}`);
      console.log(`Tags: ${profile.tags?.join(', ') || 'none'}`);
      console.log('\nConfiguration:');
      console.log(JSON.stringify(profile.config, null, 2));
      break;

    case 'use':
      if (!value) {
        console.error(chalk.red('❌ Profile ID required'));
        return;
      }
      const config = await configManager.setActiveProfile(value, environment);
      console.log(chalk.green(`✅ Activated profile '${value}'`));
      if (environment) {
        console.log(chalk.blue(`🌍 Environment: ${environment}`));
      }
      console.log(chalk.gray('Configuration applied successfully'));
      break;

    case 'create':
      if (!value) {
        console.error(chalk.red('❌ Profile name required'));
        return;
      }
      const newProfile = await configManager.createProfile({
        name: value,
        description: `Custom profile: ${value}`,
        type: 'custom',
        version: '1.0.0',
        tags: ['custom'],
        config: ConfigManager.loadConfig()
      });
      console.log(chalk.green(`✅ Created profile '${newProfile.id}'`));
      break;

    case 'delete':
      if (!value) {
        console.error(chalk.red('❌ Profile ID required'));
        return;
      }
      await configManager.deleteProfile(value);
      console.log(chalk.green(`✅ Deleted profile '${value}'`));
      break;

    default:
      console.log(chalk.yellow('Available actions: list, show, use, create, delete'));
  }
}

async function handleEnvironmentCommand(action: string, environment?: string): Promise<void> {
  const environments = ['development', 'staging', 'production', 'testing', 'local'];
  
  switch (action) {
    case 'list':
      console.log(chalk.blue.bold('\n🌍 Available Environments\n'));
      for (const env of environments) {
        const current = process.env.BRAMBLE_ENVIRONMENT === env ? chalk.green(' (current)') : '';
        console.log(`• ${chalk.cyan(env)}${current}`);
      }
      console.log(`\nCurrent: ${chalk.yellow(process.env.BRAMBLE_ENVIRONMENT || 'not set')}`);
      break;

    case 'set':
      if (!environment) {
        console.error(chalk.red('❌ Environment name required'));
        return;
      }
      if (!environments.includes(environment)) {
        console.error(chalk.red(`❌ Invalid environment. Choose from: ${environments.join(', ')}`));
        return;
      }
      process.env.BRAMBLE_ENVIRONMENT = environment;
      console.log(chalk.green(`✅ Environment set to '${environment}'`));
      console.log(chalk.gray('Note: This setting applies to the current session only'));
      break;

    case 'show':
      console.log(chalk.blue.bold('\n🌍 Current Environment\n'));
      console.log(`Environment: ${chalk.yellow(process.env.BRAMBLE_ENVIRONMENT || 'not set')}`);
      console.log(`NODE_ENV: ${chalk.gray(process.env.NODE_ENV || 'not set')}`);
      break;

    default:
      console.log(chalk.yellow('Available actions: list, set, show'));
  }
}

async function handleTemplateCommand(configManager: any, action: string, templateId?: string): Promise<void> {
  switch (action) {
    case 'list':
      const templates = configManager.getTemplates();
      console.log(chalk.blue.bold('\n📚 Available Templates\n'));
      if (templates.length === 0) {
        console.log(chalk.gray('No templates available. Templates can be created or imported.'));
        return;
      }
      for (const template of templates) {
        console.log(`${chalk.cyan(template.id)} - ${template.name}`);
        console.log(`   ${chalk.gray(template.description)}`);
        console.log(`   ${chalk.yellow(`Category: ${template.category}`)} | ${chalk.magenta(`Difficulty: ${template.metadata?.difficulty}`)}`);
        console.log();
      }
      break;

    case 'show':
      if (!templateId) {
        console.error(chalk.red('❌ Template ID required'));
        return;
      }
      const template = configManager.getTemplates().find((t: any) => t.id === templateId);
      if (!template) {
        console.error(chalk.red(`❌ Template '${templateId}' not found`));
        return;
      }
      console.log(chalk.blue.bold(`\n📄 Template: ${template.name}\n`));
      console.log(`ID: ${chalk.cyan(template.id)}`);
      console.log(`Category: ${chalk.yellow(template.category)}`);
      console.log(`Description: ${template.description}`);
      console.log(`Difficulty: ${template.metadata?.difficulty || 'unknown'}`);
      console.log(`Setup Time: ${template.metadata?.estimatedSetupTime || 'unknown'} minutes`);
      break;

    case 'apply':
      if (!templateId) {
        console.error(chalk.red('❌ Template ID required'));
        return;
      }
      const appliedProfile = await configManager.applyTemplate(templateId);
      console.log(chalk.green(`✅ Applied template '${templateId}'`));
      console.log(chalk.blue(`📋 Created profile: ${appliedProfile.id}`));
      break;

    default:
      console.log(chalk.yellow('Available actions: list, show, apply'));
  }
}

program.parse();
