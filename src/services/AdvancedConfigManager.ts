/**
 * Advanced Configuration Manager
 * 
 * Manages profiles, environments, templates, and dynamic configuration
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { BrambleConfig } from '../types/config.js';
import {
  ConfigProfile,
  ConfigTemplate,
  AdvancedConfigOptions,
  ConfigChangeEvent,
  ConfigCondition,
  EnvironmentType,
  ConfigProfileType,
  BUILT_IN_PROFILES,
  ENVIRONMENT_OVERRIDES,
  DEFAULT_ADVANCED_CONFIG
} from '../types/advancedConfig.js';

export class AdvancedConfigManager {
  private options: AdvancedConfigOptions;
  private currentProfile?: ConfigProfile;
  private currentEnvironment: EnvironmentType | undefined;
  private profiles: Map<string, ConfigProfile> = new Map();
  private templates: Map<string, ConfigTemplate> = new Map();
  private changeHistory: ConfigChangeEvent[] = [];

  constructor(options: Partial<AdvancedConfigOptions> = {}) {
    this.options = { ...DEFAULT_ADVANCED_CONFIG, ...options };
    this.initializeBuiltInProfiles();
  }

  /**
   * Initialize built-in profiles
   */
  private initializeBuiltInProfiles(): void {
    for (const [type, profile] of Object.entries(BUILT_IN_PROFILES)) {
      if (profile.name) {
        const fullProfile: ConfigProfile = {
          id: `builtin-${type}`,
          version: '1.0.0',
          metadata: {
            projectSize: 'medium',
            teamSize: 5,
            primaryLanguages: ['TypeScript'],
            gitWorkflow: 'GitFlow',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          ...profile,
          config: profile.config!
        } as ConfigProfile;
        
        this.profiles.set(fullProfile.id, fullProfile);
      }
    }
  }

  /**
   * Load configuration from files
   */
  public async loadConfiguration(): Promise<void> {
    try {
      await this.loadProfiles();
      await this.loadTemplates();
      await this.detectEnvironment();
    } catch (error) {
      console.warn('Could not load advanced configuration:', error);
    }
  }

  /**
   * Get available profiles
   */
  public getProfiles(): ConfigProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile by ID
   */
  public getProfile(id: string): ConfigProfile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get profiles by type
   */
  public getProfilesByType(type: ConfigProfileType): ConfigProfile[] {
    return this.getProfiles().filter(profile => profile.type === type);
  }

  /**
   * Set active profile
   */
  public async setActiveProfile(profileId: string, environment?: EnvironmentType): Promise<BrambleConfig> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile '${profileId}' not found`);
    }

    this.currentProfile = profile;
    this.currentEnvironment = environment;

    // Apply environment overrides if specified
    const config = await this.buildActiveConfiguration();

    // Record change event
    const changeEvent: ConfigChangeEvent = {
      type: 'profile-changed',
      timestamp: new Date(),
      profileId,
      changes: []
    };
    
    if (environment) {
      changeEvent.environment = environment;
    }
    
    this.recordChangeEvent(changeEvent);

    return config;
  }

  /**
   * Build the active configuration with all overrides applied
   */
  public async buildActiveConfiguration(): Promise<BrambleConfig> {
    if (!this.currentProfile) {
      throw new Error('No active profile set');
    }

    let config = { ...this.currentProfile.config };

    // Apply environment overrides
    if (this.currentEnvironment && this.currentProfile.environments?.[this.currentEnvironment]) {
      const envOverrides = this.currentProfile.environments[this.currentEnvironment];
      if (envOverrides.config) {
        config = this.mergeConfigurations(config, envOverrides.config);
      }
    }

    // Apply global environment overrides
    if (this.currentEnvironment && ENVIRONMENT_OVERRIDES[this.currentEnvironment]) {
      config = this.mergeConfigurations(config, ENVIRONMENT_OVERRIDES[this.currentEnvironment]);
    }

    // Apply conditional configurations
    if (this.options.enableConditionalConfig && this.currentProfile.conditions) {
      for (const condition of this.currentProfile.conditions) {
        if (condition.enabled && await this.evaluateCondition(condition)) {
          config = this.mergeConfigurations(config, condition.overrides);
        }
      }
    }

    return config;
  }

  /**
   * Create a new profile
   */
  public async createProfile(profile: Omit<ConfigProfile, 'id' | 'metadata'>): Promise<ConfigProfile> {
    const newProfile: ConfigProfile = {
      ...profile,
      id: this.generateProfileId(profile.name),
      metadata: {
        projectSize: 'medium',
        teamSize: 5,
        primaryLanguages: ['TypeScript'],
        gitWorkflow: 'GitFlow',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    this.profiles.set(newProfile.id, newProfile);
    await this.saveProfile(newProfile);

    return newProfile;
  }

  /**
   * Update an existing profile
   */
  public async updateProfile(profileId: string, updates: Partial<ConfigProfile>): Promise<ConfigProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile '${profileId}' not found`);
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      metadata: {
        ...profile.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    this.profiles.set(profileId, updatedProfile);
    await this.saveProfile(updatedProfile);

    return updatedProfile;
  }

  /**
   * Delete a profile
   */
  public async deleteProfile(profileId: string): Promise<void> {
    if (profileId.startsWith('builtin-')) {
      throw new Error('Cannot delete built-in profiles');
    }

    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile '${profileId}' not found`);
    }

    this.profiles.delete(profileId);
    
    try {
      const profilePath = join(this.options.profilesDirectory!, `${profileId}.json`);
      await fs.unlink(profilePath);
    } catch (error) {
      // Profile file might not exist, which is okay
    }
  }

  /**
   * Get available templates
   */
  public getTemplates(): ConfigTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Apply a template to create a new profile
   */
  public async applyTemplate(templateId: string, customizations?: Partial<ConfigProfile>): Promise<ConfigProfile> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const profile: Omit<ConfigProfile, 'id' | 'metadata'> = {
      ...template.profile,
      ...customizations,
      name: customizations?.name || `${template.name} Profile`,
      description: customizations?.description || `Profile created from ${template.name} template`,
      version: template.version || '1.0.0'
    };

    return await this.createProfile(profile);
  }

  /**
   * Export current configuration
   */
  public async exportConfiguration(filePath: string): Promise<void> {
    const exportData = {
      currentProfile: this.currentProfile,
      currentEnvironment: this.currentEnvironment,
      activeConfiguration: this.currentProfile ? await this.buildActiveConfiguration() : null,
      profiles: Array.from(this.profiles.values()).filter(p => !p.id.startsWith('builtin-')),
      templates: Array.from(this.templates.values()),
      changeHistory: this.changeHistory.slice(-50), // Last 50 changes
      exportedAt: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  /**
   * Import configuration
   */
  public async importConfiguration(filePath: string): Promise<void> {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    
    // Import profiles
    if (data.profiles) {
      for (const profile of data.profiles) {
        this.profiles.set(profile.id, profile);
      }
    }

    // Import templates
    if (data.templates) {
      for (const template of data.templates) {
        this.templates.set(template.id, template);
      }
    }

    // Set active profile if specified
    if (data.currentProfile) {
      await this.setActiveProfile(data.currentProfile.id, data.currentEnvironment);
    }
  }

  /**
   * Get configuration suggestions based on repository analysis
   */
  public async getConfigurationSuggestions(repositoryStats: any): Promise<{ profile: ConfigProfile; reasons: string[] }[]> {
    const suggestions: { profile: ConfigProfile; reasons: string[] }[] = [];

    for (const profile of this.getProfiles()) {
      const reasons: string[] = [];
      let score = 0;

      // Analyze based on team size
      if (repositoryStats.contributors) {
        const teamSize = repositoryStats.contributors;
        if (profile.metadata?.teamSize) {
          const sizeDiff = Math.abs(teamSize - profile.metadata.teamSize);
          if (sizeDiff <= 2) {
            reasons.push(`Team size (${teamSize}) matches profile target`);
            score += 10;
          }
        }
      }

      // Analyze based on branch count
      if (repositoryStats.totalBranches) {
        const branchCount = repositoryStats.totalBranches;
        if (branchCount > 100 && profile.type === 'enterprise') {
          reasons.push(`Large repository (${branchCount} branches) suits enterprise profile`);
          score += 15;
        } else if (branchCount < 20 && profile.type === 'personal') {
          reasons.push(`Small repository (${branchCount} branches) suits personal profile`);
          score += 15;
        } else if (branchCount >= 20 && branchCount <= 100 && (profile.type === 'team' || profile.type === 'opensource')) {
          reasons.push(`Medium repository (${branchCount} branches) suits team/opensource profile`);
          score += 10;
        }
      }

      // Analyze based on activity
      if (repositoryStats.totalCommits) {
        const commitCount = repositoryStats.totalCommits;
        if (commitCount > 1000 && (profile.type === 'enterprise' || profile.type === 'opensource')) {
          reasons.push(`High activity (${commitCount} commits) suggests enterprise/opensource workflow`);
          score += 8;
        }
      }

      if (score >= 10 && reasons.length > 0) {
        suggestions.push({ profile, reasons });
      }
    }

    return suggestions.sort((a, b) => b.reasons.length - a.reasons.length);
  }

  // Private helper methods

  private async loadProfiles(): Promise<void> {
    if (!this.options.profilesDirectory) return;

    try {
      const profilesDir = this.options.profilesDirectory;
      const files = await fs.readdir(profilesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const profilePath = join(profilesDir, file);
            const profileData = JSON.parse(await fs.readFile(profilePath, 'utf-8'));
            this.profiles.set(profileData.id, profileData);
          } catch (error) {
            console.warn(`Could not load profile ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or other error, which is okay
    }
  }

  private async loadTemplates(): Promise<void> {
    if (!this.options.templatesDirectory) return;

    try {
      const templatesDir = this.options.templatesDirectory;
      const files = await fs.readdir(templatesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const templatePath = join(templatesDir, file);
            const templateData = JSON.parse(await fs.readFile(templatePath, 'utf-8'));
            this.templates.set(templateData.id, templateData);
          } catch (error) {
            console.warn(`Could not load template ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or other error, which is okay
    }
  }

  private async detectEnvironment(): Promise<void> {
    // Simple environment detection based on common patterns
    const env = process.env.NODE_ENV || process.env.ENVIRONMENT;
    
    if (env) {
      const envMap: Record<string, EnvironmentType> = {
        'development': 'development',
        'dev': 'development',
        'staging': 'staging',
        'stage': 'staging',
        'production': 'production',
        'prod': 'production',
        'test': 'testing',
        'testing': 'testing',
        'local': 'local'
      };
      
      const envType = envMap[env.toLowerCase()];
      if (envType) {
        this.currentEnvironment = envType;
      }
    }
  }

  private async saveProfile(profile: ConfigProfile): Promise<void> {
    if (!this.options.profilesDirectory) return;

    const profilesDir = this.options.profilesDirectory;
    await fs.mkdir(profilesDir, { recursive: true });
    
    const profilePath = join(profilesDir, `${profile.id}.json`);
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  private mergeConfigurations(base: Partial<BrambleConfig>, override: Partial<BrambleConfig>): BrambleConfig {
    return { ...base, ...override } as BrambleConfig;
  }

  private async evaluateCondition(condition: ConfigCondition): Promise<boolean> {
    // Simple condition evaluation - in a real implementation, this would be more sophisticated
    // For now, just return true for enabled conditions
    return condition.enabled;
  }

  private generateProfileId(name: string): string {
    const timestamp = Date.now();
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitized}-${timestamp}`;
  }

  private recordChangeEvent(event: ConfigChangeEvent): void {
    this.changeHistory.push(event);
    
    // Keep only the last 100 events
    if (this.changeHistory.length > 100) {
      this.changeHistory = this.changeHistory.slice(-100);
    }
  }
}
