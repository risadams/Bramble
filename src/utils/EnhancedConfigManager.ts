import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  BrambleConfig,
  BrambleConfigSchema,
  ConfigProfile,
  EnvironmentConfig,
  ConfigValidationResult,
  ConfigValidationError,
  ConfigValidationWarning,
  ConfigSource,
  ConfigManagerOptions,
  ConfigChangeEvent,
  DEFAULT_CONFIG,
  BUILTIN_PROFILES,
  ENV_VAR_MAPPINGS,
  CLI_OPTION_MAPPINGS,
} from '../types/configEnhanced';

/**
 * Enhanced configuration manager with validation, profiles, and environment support
 */
export class EnhancedConfigManager extends EventEmitter {
  private currentConfig: BrambleConfig;
  private configSources: ConfigSource[] = [];
  private profilesCache: Map<string, ConfigProfile> = new Map();
  private environmentsCache: Map<string, EnvironmentConfig> = new Map();
  private options: Required<ConfigManagerOptions>;
  private watchFilesPaths: Set<string> = new Set();

  constructor(options: ConfigManagerOptions = {}) {
    super();

    this.options = {
      configFile: options.configFile || this.getDefaultConfigPath(),
      environment: options.environment || 'default',
      profile: options.profile || 'default',
      validateOnLoad: options.validateOnLoad ?? true,
      autoSave: options.autoSave ?? false,
      watchForChanges: options.watchForChanges ?? false,
      mergeStrategy: options.mergeStrategy || 'deep-merge',
    };

    this.currentConfig = DEFAULT_CONFIG;
    this.loadBuiltinProfiles();
  }

  /**
   * Initialize the configuration manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      if (this.options.watchForChanges) {
        this.setupFileWatching();
      }
      this.emit('initialized', this.currentConfig);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Load configuration from all sources
   */
  async loadConfiguration(): Promise<ConfigValidationResult> {
    const configSources: Array<{ config: Partial<BrambleConfig>; source: ConfigSource }> = [];

    // 1. Load default configuration
    configSources.push({
      config: DEFAULT_CONFIG,
      source: { type: 'default', priority: 0, timestamp: new Date() },
    });

    // 2. Load profile configuration
    if (this.options.profile && this.options.profile !== 'default') {
      const profileConfig = await this.loadProfile(this.options.profile);
      if (profileConfig) {
        configSources.push({
          config: profileConfig.config as any,
          source: { type: 'file', priority: 1, timestamp: new Date() },
        });
      }
    }

    // 3. Load file-based configuration
    const fileConfig = await this.loadConfigFromFile();
    if (fileConfig) {
      configSources.push({
        config: fileConfig,
        source: { 
          type: 'file', 
          path: this.options.configFile, 
          priority: 2, 
          timestamp: new Date() 
        },
      });
    }

    // 4. Load environment-specific configuration
    if (this.options.environment && this.options.environment !== 'default') {
      const envConfig = await this.loadEnvironment(this.options.environment);
      if (envConfig) {
        configSources.push({
          config: envConfig.config as any,
          source: { type: 'environment', priority: 3, timestamp: new Date() },
        });
      }
    }

    // 5. Load environment variables
    const envVarConfig = this.loadFromEnvironmentVariables();
    if (Object.keys(envVarConfig).length > 0) {
      configSources.push({
        config: envVarConfig,
        source: { type: 'environment', priority: 4, timestamp: new Date() },
      });
    }

    // 6. Load CLI arguments
    const cliConfig = this.loadFromCLIArguments();
    if (Object.keys(cliConfig).length > 0) {
      configSources.push({
        config: cliConfig,
        source: { type: 'cli', priority: 5, timestamp: new Date() },
      });
    }

    // Merge all configurations
    const mergedConfig = this.mergeConfigurations(configSources.map(s => s.config));
    this.configSources = configSources.map(s => s.source);

    // Validate the merged configuration
    const validationResult = this.validateConfiguration(mergedConfig);

    if (validationResult.valid && validationResult.parsed) {
      const previousConfig = this.currentConfig;
      this.currentConfig = validationResult.parsed;

        const event: ConfigChangeEvent = {
          type: 'loaded',
          config: this.currentConfig,
          changes: this.getConfigChanges(previousConfig, this.currentConfig),
          source: configSources[configSources.length - 1]?.source || { type: 'default', priority: 0, timestamp: new Date() },
          timestamp: new Date(),
        };      this.emit('configChanged', event);
    }

    return validationResult;
  }

  /**
   * Validate configuration using Zod schema
   */
  validateConfiguration(config: any): ConfigValidationResult {
    try {
      const parsed = BrambleConfigSchema.parse(config);
      const warnings = this.generateConfigWarnings(parsed);

      return {
        valid: true,
        errors: [],
        warnings,
        parsed,
      };
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        const zodError = error as any;
        const errors: ConfigValidationError[] = zodError.issues.map((issue: any) => ({
          path: issue.path.join('.'),
          message: issue.message,
          value: issue.received,
          code: issue.code,
        }));

        return {
          valid: false,
          errors,
          warnings: [],
        };
      }

      return {
        valid: false,
        errors: [{ path: 'root', message: (error as Error).message || 'Unknown error' }],
        warnings: [],
      };
    }
  }

  /**
   * Generate configuration warnings
   */
  private generateConfigWarnings(config: BrambleConfig): ConfigValidationWarning[] {
    const warnings: ConfigValidationWarning[] = [];

    // Check for potential performance issues
    if (config.analysis.maxBranches > 1000) {
      warnings.push({
        path: 'analysis.maxBranches',
        message: 'High branch limit may impact performance',
        value: config.analysis.maxBranches,
        suggestion: 'Consider reducing to under 1000 for better performance',
      });
    }

    if (config.analysis.maxConcurrency > 20) {
      warnings.push({
        path: 'analysis.maxConcurrency',
        message: 'High concurrency may overwhelm the system',
        value: config.analysis.maxConcurrency,
        suggestion: 'Consider reducing to 10 or less',
      });
    }

    // Check for security concerns
    if (config.integrations.github.enabled && !config.integrations.github.token) {
      warnings.push({
        path: 'integrations.github.token',
        message: 'GitHub integration enabled but no token provided',
        suggestion: 'Set BRAMBLE_GITHUB_TOKEN environment variable',
      });
    }

    if (config.integrations.gitlab.enabled && !config.integrations.gitlab.token) {
      warnings.push({
        path: 'integrations.gitlab.token',
        message: 'GitLab integration enabled but no token provided',
        suggestion: 'Set BRAMBLE_GITLAB_TOKEN environment variable',
      });
    }

    // Check for cleanup safety
    if (config.staleCleanup.enabled && !config.staleCleanup.dryRun && !config.staleCleanup.createBackups) {
      warnings.push({
        path: 'staleCleanup',
        message: 'Cleanup enabled without backups in non-dry-run mode',
        suggestion: 'Enable createBackups or use dryRun mode for safety',
      });
    }

    return warnings;
  }

  /**
   * Save current configuration to file
   */
  async saveConfiguration(config?: any): Promise<void> {
    try {
      const configToSave = config ? this.mergeConfigurations([this.currentConfig, config]) : this.currentConfig;
      
      // Validate before saving
      const validationResult = this.validateConfiguration(configToSave);
      if (!validationResult.valid) {
        throw new Error(`Invalid configuration: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      const configDir = path.dirname(this.options.configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.options.configFile, JSON.stringify(configToSave, null, 2));

      if (config) {
        this.currentConfig = validationResult.parsed!;
        
        const event: ConfigChangeEvent = {
          type: 'saved',
          config: this.currentConfig,
          changes: config,
          source: { type: 'file', path: this.options.configFile, priority: 2, timestamp: new Date() },
          timestamp: new Date(),
        };

        this.emit('configChanged', event);
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update configuration with partial values
   */
  async updateConfiguration(updates: any): Promise<void> {
    const newConfig = this.mergeConfigurations([this.currentConfig, updates]);
    const validationResult = this.validateConfiguration(newConfig);

    if (!validationResult.valid) {
      throw new Error(`Invalid configuration update: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    this.currentConfig = validationResult.parsed!;

    if (this.options.autoSave) {
      await this.saveConfiguration();
    }

    const event: ConfigChangeEvent = {
      type: 'updated',
      config: this.currentConfig,
      changes: updates,
      source: { type: 'cli', priority: 5, timestamp: new Date() },
      timestamp: new Date(),
    };

    this.emit('configChanged', event);
  }

  /**
   * Switch to a different profile
   */
  async switchProfile(profileName: string): Promise<void> {
    const profile = await this.loadProfile(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    this.options.profile = profileName;
    await this.loadConfiguration();

    const event: ConfigChangeEvent = {
      type: 'profile-changed',
      config: this.currentConfig,
      source: { type: 'file', priority: 1, timestamp: new Date() },
      timestamp: new Date(),
    };

    this.emit('configChanged', event);
  }

  /**
   * Switch to a different environment
   */
  async switchEnvironment(environmentName: string): Promise<void> {
    this.options.environment = environmentName;
    await this.loadConfiguration();
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfiguration(): Promise<void> {
    this.currentConfig = DEFAULT_CONFIG;

    if (this.options.autoSave) {
      await this.saveConfiguration();
    }

    const event: ConfigChangeEvent = {
      type: 'reset',
      config: this.currentConfig,
      source: { type: 'default', priority: 0, timestamp: new Date() },
      timestamp: new Date(),
    };

    this.emit('configChanged', event);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): BrambleConfig {
    return { ...this.currentConfig };
  }

  /**
   * Get configuration sources information
   */
  getConfigurationSources(): ConfigSource[] {
    return [...this.configSources];
  }

  /**
   * Load profile from file or built-in profiles
   */
  private async loadProfile(profileName: string): Promise<ConfigProfile | null> {
    // Check cache first
    if (this.profilesCache.has(profileName)) {
      return this.profilesCache.get(profileName)!;
    }

    // Check built-in profiles
    if (BUILTIN_PROFILES[profileName]) {
      const profile = BUILTIN_PROFILES[profileName];
      this.profilesCache.set(profileName, profile);
      return profile;
    }

    // Try to load from file
    const profilePath = path.join(path.dirname(this.options.configFile), 'profiles', `${profileName}.json`);
    if (fs.existsSync(profilePath)) {
      try {
        const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
        this.profilesCache.set(profileName, profileData);
        return profileData;
      } catch (error) {
        console.warn(`Failed to load profile '${profileName}':`, error);
      }
    }

    return null;
  }

  /**
   * Load environment configuration
   */
  private async loadEnvironment(environmentName: string): Promise<EnvironmentConfig | null> {
    // Check cache first
    if (this.environmentsCache.has(environmentName)) {
      return this.environmentsCache.get(environmentName)!;
    }

    // Try to load from file
    const envPath = path.join(path.dirname(this.options.configFile), 'environments', `${environmentName}.json`);
    if (fs.existsSync(envPath)) {
      try {
        const envData = JSON.parse(fs.readFileSync(envPath, 'utf8'));
        this.environmentsCache.set(environmentName, envData);
        return envData;
      } catch (error) {
        console.warn(`Failed to load environment '${environmentName}':`, error);
      }
    }

    return null;
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(): Promise<any | null> {
    if (!fs.existsSync(this.options.configFile)) {
      return null;
    }

    try {
      const configData = fs.readFileSync(this.options.configFile, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(`Failed to load config file '${this.options.configFile}':`, error);
      return null;
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironmentVariables(): any {
    const config: any = {};

    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        if (configPath.startsWith('__')) {
          // Special handling for profile/environment selection
          continue;
        }
        this.setNestedValue(config, configPath, this.parseEnvironmentValue(value));
      }
    }

    return config;
  }

  /**
   * Load configuration from CLI arguments
   */
  private loadFromCLIArguments(): any {
    const config: any = {};
    const args = process.argv.slice(2);

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (!arg) continue;
      
      const mapping = CLI_OPTION_MAPPINGS[arg];

      if (mapping && !mapping.startsWith('__')) {
        const value = args[i + 1];
        if (value && !value.startsWith('-')) {
          this.setNestedValue(config, mapping, this.parseCLIValue(arg, value));
          i++; // Skip the value argument
        } else if (arg === '--verbose') {
          this.setNestedValue(config, mapping, 'verbose');
        } else if (arg === '--quiet') {
          this.setNestedValue(config, mapping, 'silent');
        } else if (arg === '--performance') {
          this.setNestedValue(config, mapping, true);
        } else if (arg === '--no-cache') {
          this.setNestedValue(config, mapping, false);
        }
      }
    }

    return config;
  }

  /**
   * Parse environment variable value
   */
  private parseEnvironmentValue(value: string): any {
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as number
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;

    // Return as string
    return value;
  }

  /**
   * Parse CLI argument value
   */
  private parseCLIValue(option: string, value: string): any {
    // Handle specific option types
    if (option.includes('days') || option.includes('max') || option.includes('timeout')) {
      const numValue = Number(value);
      if (!isNaN(numValue)) return numValue;
    }

    if (option.includes('enable') || option.includes('disable')) {
      return value.toLowerCase() === 'true';
    }

    return value;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!key) continue;
      
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * Merge multiple configuration objects
   */
  private mergeConfigurations(configs: any[]): any {
    if (this.options.mergeStrategy === 'replace') {
      return configs[configs.length - 1] || {};
    }

    if (this.options.mergeStrategy === 'merge') {
      return Object.assign({}, ...configs);
    }

    // Deep merge strategy
    return this.deepMerge({}, ...configs);
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get configuration changes between two configs
   */
  private getConfigChanges(oldConfig: BrambleConfig, newConfig: BrambleConfig): Partial<BrambleConfig> {
    const changes: any = {};

    const findChanges = (old: any, current: any, path: string[] = []) => {
      for (const key in current) {
        const newPath = [...path, key];
        if (old[key] !== current[key]) {
          if (this.isObject(current[key]) && this.isObject(old[key])) {
            findChanges(old[key], current[key], newPath);
          } else {
            this.setNestedValue(changes, newPath.join('.'), current[key]);
          }
        }
      }
    };

    findChanges(oldConfig, newConfig);
    return changes;
  }

  /**
   * Load built-in profiles
   */
  private loadBuiltinProfiles(): void {
    for (const [name, profile] of Object.entries(BUILTIN_PROFILES)) {
      this.profilesCache.set(name, profile);
    }
  }

  /**
   * Get default configuration file path
   */
  private getDefaultConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || process.cwd();
    return path.join(homeDir, '.config', 'bramble', 'config.json');
  }

  /**
   * Setup file watching for configuration changes
   */
  private setupFileWatching(): void {
    if (fs.existsSync(this.options.configFile)) {
      this.watchFilesPaths.add(this.options.configFile);
      fs.watchFile(this.options.configFile, { interval: 1000 }, () => {
        this.loadConfiguration().catch(error => this.emit('error', error));
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop watching files
    for (const filePath of this.watchFilesPaths) {
      fs.unwatchFile(filePath);
    }
    this.watchFilesPaths.clear();

    // Clear caches
    this.profilesCache.clear();
    this.environmentsCache.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}
