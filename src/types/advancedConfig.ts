/**
 * Advanced Configuration System Types
 * 
 * Supports profiles, environments, templates, and dynamic configuration management
 */

import { BrambleConfig } from './config.js';
import { VisualizationConfig } from './visualization.js';
import { HealthAnalysisOptions } from './health.js';

// Configuration Profile Types
export type ConfigProfileType = 'enterprise' | 'opensource' | 'personal' | 'team' | 'custom';
export type EnvironmentType = 'development' | 'staging' | 'production' | 'testing' | 'local';
export type ProjectSize = 'small' | 'medium' | 'large' | 'enterprise';

// Configuration Profile
export interface ConfigProfile {
  id: string;
  name: string;
  description: string;
  type: ConfigProfileType;
  version: string;
  author?: string;
  tags: string[];
  
  // Core configuration
  config: BrambleConfig;
  
  // Feature-specific configurations
  visualization?: Partial<VisualizationConfig>;
  health?: Partial<HealthAnalysisOptions>;
  
  // Profile metadata
  metadata: {
    projectSize: ProjectSize;
    teamSize: number;
    primaryLanguages: string[];
    gitWorkflow: string;
    createdAt: Date;
    updatedAt: Date;
  };
  
  // Environment overrides
  environments?: Record<EnvironmentType, Partial<ConfigProfile>>;
  
  // Conditional configuration
  conditions?: ConfigCondition[];
}

// Configuration Condition
export interface ConfigCondition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Condition criteria
  criteria: {
    branchCount?: { min?: number; max?: number };
    commitCount?: { min?: number; max?: number };
    contributorCount?: { min?: number; max?: number };
    repositoryAge?: { minDays?: number; maxDays?: number };
    branchPatterns?: string[];
    filePatterns?: string[];
    gitRemotes?: string[];
  };
  
  // Configuration overrides when condition matches
  overrides: Partial<BrambleConfig>;
}

// Configuration Template
export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  
  // Template metadata
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedSetupTime: number; // minutes
    requiredTools: string[];
    supportedPlatforms: string[];
    tags: string[];
  };
  
  // Template content
  profile: Omit<ConfigProfile, 'id' | 'version' | 'metadata'>;
  
  // Setup instructions
  setup: {
    steps: ConfigSetupStep[];
    validation: ConfigValidation[];
  };
  
  // Template dependencies
  dependencies?: string[]; // Other template IDs
  conflicts?: string[]; // Conflicting template IDs
}

// Configuration Setup Step
export interface ConfigSetupStep {
  id: string;
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'conditional';
  
  // Automation details
  automation?: {
    command?: string;
    script?: string;
    fileChanges?: FileChange[];
  };
  
  // Conditional execution
  condition?: string; // Expression to evaluate
  
  // Dependencies
  dependsOn?: string[]; // Other step IDs
  
  // Validation
  validation?: ConfigValidation;
}

// File Change for automation
export interface FileChange {
  path: string;
  operation: 'create' | 'update' | 'delete';
  content?: string;
  backup?: boolean;
}

// Configuration Validation
export interface ConfigValidation {
  id: string;
  name: string;
  description: string;
  type: 'file-exists' | 'command-succeeds' | 'git-config' | 'custom';
  
  // Validation details
  details: {
    filePath?: string;
    command?: string;
    gitConfigKey?: string;
    customScript?: string;
    expectedResult?: any;
  };
  
  // Error handling
  onFailure: 'warn' | 'error' | 'skip';
  helpText?: string;
}

// Advanced Configuration Manager Options
export interface AdvancedConfigOptions {
  profilesDirectory?: string;
  templatesDirectory?: string;
  environmentsDirectory?: string;
  autoBackup?: boolean;
  validateOnLoad?: boolean;
  enableConditionalConfig?: boolean;
  enableEnvironmentOverrides?: boolean;
}

// Configuration Change Event
export interface ConfigChangeEvent {
  type: 'profile-changed' | 'environment-changed' | 'template-applied' | 'condition-triggered';
  timestamp: Date;
  profileId?: string;
  environment?: EnvironmentType;
  templateId?: string;
  conditionId?: string;
  changes: ConfigChange[];
}

// Configuration Change
export interface ConfigChange {
  path: string; // dot notation path (e.g., 'visualization.theme')
  oldValue: any;
  newValue: any;
  source: 'profile' | 'environment' | 'template' | 'condition' | 'manual';
}

// Built-in Profile Definitions
export const BUILT_IN_PROFILES: Record<ConfigProfileType, Partial<ConfigProfile>> = {
  enterprise: {
    name: 'Enterprise',
    description: 'Configuration optimized for large enterprise repositories',
    type: 'enterprise',
    tags: ['enterprise', 'large-team', 'compliance'],
    config: {
      staleDays: 14,
      maxBranches: 500,
      includeRemoteBranches: true,
      defaultExportFormat: 'json',
      theme: 'dark',
      defaultBranchCandidates: ['main', 'master', 'develop']
    }
  },
  
  opensource: {
    name: 'Open Source',
    description: 'Configuration optimized for open source projects',
    type: 'opensource',
    tags: ['opensource', 'community', 'collaboration'],
    config: {
      staleDays: 30,
      maxBranches: 100,
      includeRemoteBranches: true,
      defaultExportFormat: 'markdown',
      theme: 'light',
      defaultBranchCandidates: ['main', 'master']
    }
  },
  
  personal: {
    name: 'Personal',
    description: 'Configuration optimized for personal projects',
    type: 'personal',
    tags: ['personal', 'simple', 'lightweight'],
    config: {
      staleDays: 60,
      maxBranches: 20,
      includeRemoteBranches: false,
      defaultExportFormat: 'json',
      theme: 'dark',
      defaultBranchCandidates: ['main', 'master']
    }
  },
  
  team: {
    name: 'Team',
    description: 'Configuration optimized for small to medium teams',
    type: 'team',
    tags: ['team', 'agile', 'collaboration'],
    config: {
      staleDays: 21,
      maxBranches: 50,
      includeRemoteBranches: true,
      defaultExportFormat: 'html',
      theme: 'dark',
      defaultBranchCandidates: ['main', 'develop', 'master']
    }
  },
  
  custom: {
    name: 'Custom',
    description: 'Base template for custom configurations',
    type: 'custom',
    tags: ['custom', 'flexible'],
    config: {
      staleDays: 30,
      maxBranches: 100,
      includeRemoteBranches: true,
      defaultExportFormat: 'json',
      theme: 'dark',
      defaultBranchCandidates: ['main', 'master']
    }
  }
};

// Environment-specific overrides
export const ENVIRONMENT_OVERRIDES: Record<EnvironmentType, Partial<BrambleConfig>> = {
  development: {
    staleDays: 7,
    maxBranches: 20,
    includeRemoteBranches: false
  },
  
  testing: {
    staleDays: 14,
    maxBranches: 50,
    includeRemoteBranches: true
  },
  
  staging: {
    staleDays: 21,
    maxBranches: 100,
    includeRemoteBranches: true
  },
  
  production: {
    staleDays: 30,
    maxBranches: 200,
    includeRemoteBranches: true
  },
  
  local: {
    staleDays: 3,
    maxBranches: 10,
    includeRemoteBranches: false
  }
};

// Configuration Template Categories
export const TEMPLATE_CATEGORIES = {
  WORKFLOW: 'Git Workflows',
  TEAM: 'Team Configurations',
  PROJECT: 'Project Types',
  INTEGRATION: 'Tool Integrations',
  SECURITY: 'Security Focused',
  PERFORMANCE: 'Performance Optimized'
} as const;

// Default advanced configuration
export const DEFAULT_ADVANCED_CONFIG: AdvancedConfigOptions = {
  profilesDirectory: '.bramble/profiles',
  templatesDirectory: '.bramble/templates',
  environmentsDirectory: '.bramble/environments',
  autoBackup: true,
  validateOnLoad: true,
  enableConditionalConfig: true,
  enableEnvironmentOverrides: true
};
