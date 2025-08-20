import { z } from 'zod';

/**
 * Enhanced configuration system with validation, profiles, and environment support
 */

// Core configuration schema using Zod for validation
export const BrambleConfigSchema = z.object({
  // Analysis settings
  analysis: z.object({
    staleDays: z.number().min(1).max(365).default(30),
    maxBranches: z.number().min(1).max(10000).default(100),
    includeRemoteBranches: z.boolean().default(true),
    defaultBranchCandidates: z.array(z.string()).default(['main', 'master']),
    analysisDepth: z.enum(['quick', 'normal', 'detailed']).default('normal'),
    maxConcurrency: z.number().min(1).max(50).default(5),
    enableCaching: z.boolean().default(true),
    cacheTimeout: z.number().min(60).max(3600).default(300), // seconds
  }).default({
    staleDays: 30,
    maxBranches: 100,
    includeRemoteBranches: true,
    defaultBranchCandidates: ['main', 'master'],
    analysisDepth: 'normal' as const,
    maxConcurrency: 5,
    enableCaching: true,
    cacheTimeout: 300,
  }),

  // Export settings
  export: z.object({
    defaultFormat: z.enum(['json', 'html', 'csv', 'markdown', 'pdf', 'xml']).default('json'),
    outputDirectory: z.string().default('./bramble-reports'),
    includeTimestamp: z.boolean().default(true),
    compression: z.enum(['none', 'gzip', 'zip']).default('none'),
    templates: z.object({
      html: z.string().optional(),
      markdown: z.string().optional(),
      pdf: z.string().optional(),
    }).default({}),
  }).default({
    defaultFormat: 'json' as const,
    outputDirectory: './bramble-reports',
    includeTimestamp: true,
    compression: 'none' as const,
    templates: {},
  }),

  // UI settings
  ui: z.object({
    theme: z.enum(['dark', 'light', 'auto']).default('dark'),
    colorMode: z.enum(['enabled', 'disabled', 'auto']).default('auto'),
    progressIndicator: z.enum(['spinner', 'bar', 'dots']).default('spinner'),
    verbosity: z.enum(['silent', 'normal', 'verbose', 'debug']).default('normal'),
    pageSize: z.number().min(5).max(100).default(20),
    sortBy: z.enum(['name', 'date', 'commits', 'activity']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }).default({
    theme: 'dark' as const,
    colorMode: 'auto' as const,
    progressIndicator: 'spinner' as const,
    verbosity: 'normal' as const,
    pageSize: 20,
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  }),

  // Performance settings
  performance: z.object({
    enabled: z.boolean().default(true),
    monitoringInterval: z.number().min(1000).max(60000).default(5000),
    maxMemoryUsage: z.number().min(100 * 1024 * 1024).default(512 * 1024 * 1024), // bytes
    autoOptimize: z.boolean().default(false),
    enableGC: z.boolean().default(false),
    profileOperations: z.boolean().default(false),
  }).default({
    enabled: true,
    monitoringInterval: 5000,
    maxMemoryUsage: 512 * 1024 * 1024,
    autoOptimize: false,
    enableGC: false,
    profileOperations: false,
  }),

  // Integration settings
  integrations: z.object({
    github: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      apiUrl: z.string().url().default('https://api.github.com'),
      timeout: z.number().min(1000).max(60000).default(10000),
      rateLimit: z.boolean().default(true),
    }).default({
      enabled: false,
      apiUrl: 'https://api.github.com',
      timeout: 10000,
      rateLimit: true,
    }),
    gitlab: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      apiUrl: z.string().url().default('https://gitlab.com/api/v4'),
      timeout: z.number().min(1000).max(60000).default(10000),
    }).default({
      enabled: false,
      apiUrl: 'https://gitlab.com/api/v4',
      timeout: 10000,
    }),
  }).default({
    github: {
      enabled: false,
      apiUrl: 'https://api.github.com',
      timeout: 10000,
      rateLimit: true,
    },
    gitlab: {
      enabled: false,
      apiUrl: 'https://gitlab.com/api/v4',
      timeout: 10000,
    },
  }),

  // Stale branch cleanup settings
  staleCleanup: z.object({
    enabled: z.boolean().default(false),
    dryRun: z.boolean().default(true),
    createBackups: z.boolean().default(true),
    deleteRemote: z.boolean().default(false),
    excludedBranches: z.array(z.string()).default(['main', 'master', 'develop', 'staging']),
    excludePatterns: z.array(z.string()).default(['^release/.*', '^hotfix/.*']),
    minimumCommits: z.number().min(1).default(3),
    confirmBeforeDelete: z.boolean().default(true),
  }).default({
    enabled: false,
    dryRun: true,
    createBackups: true,
    deleteRemote: false,
    excludedBranches: ['main', 'master', 'develop', 'staging'],
    excludePatterns: ['^release/.*', '^hotfix/.*'],
    minimumCommits: 3,
    confirmBeforeDelete: true,
  }),

  // Notification settings
  notifications: z.object({
    enabled: z.boolean().default(true),
    types: z.object({
      success: z.boolean().default(true),
      warning: z.boolean().default(true),
      error: z.boolean().default(true),
      info: z.boolean().default(false),
    }).default({
      success: true,
      warning: true,
      error: true,
      info: false,
    }),
    sound: z.boolean().default(false),
  }).default({
    enabled: true,
    types: {
      success: true,
      warning: true,
      error: true,
      info: false,
    },
    sound: false,
  }),
});

// Infer TypeScript type from schema
export type BrambleConfig = z.infer<typeof BrambleConfigSchema>;

// Configuration profile with deep partial support
export interface ConfigProfile {
  name: string;
  description?: string;
  config: DeepPartial<BrambleConfig>;
  environments?: Record<string, EnvironmentConfig>;
  metadata?: {
    author?: string;
    version?: string;
    created?: Date;
    modified?: Date;
  };
}

// Deep partial type helper
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Environment-specific configuration
export interface EnvironmentConfig {
  name: string;
  description?: string;
  config: DeepPartial<BrambleConfig>;
  extends?: string; // Base environment to extend from
}

// Configuration validation result
export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
  parsed?: BrambleConfig;
}

export interface ConfigValidationError {
  path: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ConfigValidationWarning {
  path: string;
  message: string;
  value?: any;
  suggestion?: string;
}

// Configuration source information
export interface ConfigSource {
  type: 'file' | 'environment' | 'cli' | 'default';
  path?: string;
  priority: number;
  timestamp?: Date;
}

// Configuration manager options
export interface ConfigManagerOptions {
  configFile?: string;
  environment?: string;
  profile?: string;
  validateOnLoad?: boolean;
  autoSave?: boolean;
  watchForChanges?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'deep-merge';
}

// Configuration change event
export interface ConfigChangeEvent {
  type: 'loaded' | 'saved' | 'updated' | 'reset' | 'profile-changed';
  config: BrambleConfig;
  changes?: Partial<BrambleConfig>;
  source: ConfigSource;
  timestamp: Date;
}

// Schema definitions for different config sections
export const AnalysisConfigSchema = BrambleConfigSchema.shape.analysis;
export const ExportConfigSchema = BrambleConfigSchema.shape.export;
export const UIConfigSchema = BrambleConfigSchema.shape.ui;
export const PerformanceConfigSchema = BrambleConfigSchema.shape.performance;
export const IntegrationsConfigSchema = BrambleConfigSchema.shape.integrations;
export const StaleCleanupConfigSchema = BrambleConfigSchema.shape.staleCleanup;
export const NotificationsConfigSchema = BrambleConfigSchema.shape.notifications;

// Type exports for individual config sections
export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;
export type ExportConfig = z.infer<typeof ExportConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type IntegrationsConfig = z.infer<typeof IntegrationsConfigSchema>;
export type StaleCleanupConfig = z.infer<typeof StaleCleanupConfigSchema>;
export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>;

// Default configuration values
export const DEFAULT_CONFIG: BrambleConfig = BrambleConfigSchema.parse({});

// Built-in configuration profiles
export const BUILTIN_PROFILES: Record<string, ConfigProfile> = {
  minimal: {
    name: 'minimal',
    description: 'Minimal configuration for quick analysis',
    config: {
      analysis: {
        analysisDepth: 'quick',
        maxBranches: 50,
        enableCaching: false,
      },
      ui: {
        verbosity: 'silent',
        progressIndicator: 'dots',
      },
      performance: {
        enabled: false,
      },
    },
  },
  
  development: {
    name: 'development',
    description: 'Configuration optimized for development workflows',
    config: {
      analysis: {
        analysisDepth: 'detailed',
        maxConcurrency: 10,
        enableCaching: true,
      },
      ui: {
        verbosity: 'verbose',
        theme: 'dark',
      },
      performance: {
        enabled: true,
        profileOperations: true,
      },
      staleCleanup: {
        enabled: true,
        dryRun: true,
      },
    },
  },

  production: {
    name: 'production',
    description: 'Configuration optimized for production environments',
    config: {
      analysis: {
        analysisDepth: 'normal',
        maxConcurrency: 5,
        enableCaching: true,
      },
      ui: {
        verbosity: 'normal',
        progressIndicator: 'bar',
      },
      performance: {
        enabled: true,
        autoOptimize: true,
      },
      notifications: {
        enabled: true,
        types: {
          error: true,
          warning: true,
          success: false,
          info: false,
        },
      },
    },
  },

  ci: {
    name: 'ci',
    description: 'Configuration for CI/CD environments',
    config: {
      analysis: {
        analysisDepth: 'normal',
        maxBranches: 200,
        maxConcurrency: 3,
      },
      ui: {
        verbosity: 'normal',
        progressIndicator: 'dots',
        colorMode: 'disabled',
      },
      export: {
        defaultFormat: 'json',
        includeTimestamp: true,
      },
      performance: {
        enabled: false,
      },
      notifications: {
        enabled: false,
      },
    },
  },
};

// Environment variable mappings
export const ENV_VAR_MAPPINGS: Record<string, string> = {
  'BRAMBLE_STALE_DAYS': 'analysis.staleDays',
  'BRAMBLE_MAX_BRANCHES': 'analysis.maxBranches',
  'BRAMBLE_THEME': 'ui.theme',
  'BRAMBLE_EXPORT_FORMAT': 'export.defaultFormat',
  'BRAMBLE_OUTPUT_DIR': 'export.outputDirectory',
  'BRAMBLE_GITHUB_TOKEN': 'integrations.github.token',
  'BRAMBLE_GITLAB_TOKEN': 'integrations.gitlab.token',
  'BRAMBLE_VERBOSITY': 'ui.verbosity',
  'BRAMBLE_PERFORMANCE_ENABLED': 'performance.enabled',
  'BRAMBLE_AUTO_OPTIMIZE': 'performance.autoOptimize',
  'BRAMBLE_PROFILE': '__profile',
  'BRAMBLE_ENVIRONMENT': '__environment',
};

// CLI option mappings
export const CLI_OPTION_MAPPINGS: Record<string, string> = {
  '--stale-days': 'analysis.staleDays',
  '--max-branches': 'analysis.maxBranches',
  '--theme': 'ui.theme',
  '--format': 'export.defaultFormat',
  '--output-dir': 'export.outputDirectory',
  '--verbose': 'ui.verbosity',
  '--quiet': 'ui.verbosity',
  '--performance': 'performance.enabled',
  '--no-cache': 'analysis.enableCaching',
  '--profile': '__profile',
  '--env': '__environment',
};
