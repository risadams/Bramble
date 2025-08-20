import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { BrambleConfig, DEFAULT_CONFIG } from '../types/config.js';

/**
 * Legacy ConfigManager - maintains backward compatibility
 */
export class ConfigManager {
  private static readonly CONFIG_FILE_NAME = '.bramblerc';
  private static config: BrambleConfig | null = null;

  /**
   * Load configuration from file or return defaults
   */
  public static loadConfig(): BrambleConfig {
    if (this.config) {
      return this.config;
    }

    const configPath = this.getConfigPath();
    
    if (existsSync(configPath)) {
      try {
        const configData = readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configData) as Partial<BrambleConfig>;
        
        // Merge with defaults
        this.config = { ...DEFAULT_CONFIG, ...userConfig };
      } catch (error) {
        console.warn(`Warning: Invalid config file at ${configPath}, using defaults`);
        this.config = DEFAULT_CONFIG;
      }
    } else {
      this.config = DEFAULT_CONFIG;
    }

    return this.config;
  }

  /**
   * Save configuration to file
   */
  public static saveConfig(config: BrambleConfig): void {
    const configPath = this.getConfigPath();
    
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save config to ${configPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update specific configuration values
   */
  public static updateConfig(updates: Partial<BrambleConfig>): void {
    const currentConfig = this.loadConfig();
    const newConfig = { ...currentConfig, ...updates };
    this.saveConfig(newConfig);
  }

  /**
   * Reset configuration to defaults
   */
  public static resetConfig(): void {
    this.saveConfig(DEFAULT_CONFIG);
  }

  /**
   * Get the full path to the configuration file
   */
  private static getConfigPath(): string {
    return join(homedir(), this.CONFIG_FILE_NAME);
  }

  /**
   * Create a default configuration file if it doesn't exist
   */
  public static createDefaultConfig(): void {
    const configPath = this.getConfigPath();
    
    if (!existsSync(configPath)) {
      this.saveConfig(DEFAULT_CONFIG);
      console.log(`Created default configuration at ${configPath}`);
    }
  }

  /**
   * Get configuration file path for display
   */
  public static getConfigInfo(): { path: string; exists: boolean; config: BrambleConfig } {
    const path = this.getConfigPath();
    const exists = existsSync(path);
    const config = this.loadConfig();
    
    return { path, exists, config };
  }

  /**
   * Validate configuration object
   */
  public static validateConfig(config: Partial<BrambleConfig>): string[] {
    const errors: string[] = [];

    if (config.staleDays !== undefined && (config.staleDays < 1 || config.staleDays > 365)) {
      errors.push('staleDays must be between 1 and 365');
    }

    if (config.maxBranches !== undefined && (config.maxBranches < 1 || config.maxBranches > 1000)) {
      errors.push('maxBranches must be between 1 and 1000');
    }

    if (config.defaultExportFormat !== undefined && 
        !['json', 'html', 'csv', 'markdown'].includes(config.defaultExportFormat)) {
      errors.push('defaultExportFormat must be one of: json, html, csv, markdown');
    }

    if (config.theme !== undefined && !['dark', 'light'].includes(config.theme)) {
      errors.push('theme must be either dark or light');
    }

    return errors;
  }
}
