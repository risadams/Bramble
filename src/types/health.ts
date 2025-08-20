/**
 * Repository Health Monitoring Types
 * 
 * Comprehensive health scoring and monitoring for Git repositories
 */

// Health Score Categories
export type HealthCategory = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

// Health Dimension Types
export type HealthDimension = 
  | 'codeQuality' 
  | 'maintenance' 
  | 'security' 
  | 'performance' 
  | 'collaboration' 
  | 'stability';

// Health Score (0-100)
export type HealthScore = number;

// Individual Health Metric
export interface HealthMetric {
  readonly name: string;
  readonly description: string;
  readonly value: number;
  readonly maxValue: number;
  readonly weight: number;
  readonly category: HealthDimension;
  readonly status: 'healthy' | 'warning' | 'critical';
  readonly trend?: 'improving' | 'stable' | 'declining';
  readonly recommendations: string[];
}

// Health Assessment for a Dimension
export interface HealthDimensionScore {
  readonly dimension: HealthDimension;
  readonly score: HealthScore;
  readonly category: HealthCategory;
  readonly weight: number;
  readonly metrics: HealthMetric[];
  readonly recommendations: string[];
  readonly trends: {
    readonly previous?: HealthScore;
    readonly change?: number;
    readonly direction?: 'up' | 'down' | 'stable';
  };
}

// Repository Health Report
export interface RepositoryHealthReport {
  readonly repositoryPath: string;
  readonly repositoryName: string;
  readonly generatedAt: Date;
  readonly overallScore: HealthScore;
  readonly category: HealthCategory;
  readonly dimensions: HealthDimensionScore[];
  readonly summary: {
    readonly strengths: string[];
    readonly weaknesses: string[];
    readonly criticalIssues: string[];
    readonly quickWins: string[];
  };
  readonly trends: {
    readonly lastAssessment?: Date;
    readonly scoreChange?: number;
    readonly improving: HealthDimension[];
    readonly declining: HealthDimension[];
  };
  readonly metadata: {
    readonly totalBranches: number;
    readonly activeBranches: number;
    readonly staleBranches: number;
    readonly totalCommits: number;
    readonly contributors: number;
    readonly repositorySize: string;
    readonly lastActivity: Date;
  };
}

// Health Configuration
export interface HealthConfig {
  readonly enabled: boolean;
  readonly trackTrends: boolean;
  readonly assessmentFrequency: 'daily' | 'weekly' | 'monthly';
  readonly dimensions: {
    readonly [K in HealthDimension]: {
      readonly enabled: boolean;
      readonly weight: number;
      readonly thresholds: {
        readonly excellent: number;
        readonly good: number;
        readonly fair: number;
        readonly poor: number;
      };
    };
  };
  readonly customMetrics?: HealthMetric[];
  readonly excludePatterns?: string[];
  readonly alerts: {
    readonly enabled: boolean;
    readonly scoreThreshold: number;
    readonly criticalIssues: boolean;
  };
}

// Health Analysis Options
export interface HealthAnalysisOptions {
  readonly includeTrends?: boolean;
  readonly includeRecommendations?: boolean;
  readonly maxHistoryDays?: number;
  readonly dimensions?: HealthDimension[];
  readonly customWeights?: Partial<Record<HealthDimension, number>>;
}

// Historical Health Data
export interface HealthHistoryEntry {
  readonly timestamp: Date;
  readonly overallScore: HealthScore;
  readonly dimensionScores: Record<HealthDimension, HealthScore>;
  readonly metrics: Record<string, number>;
  readonly events?: HealthEvent[];
}

// Health Events
export interface HealthEvent {
  readonly timestamp: Date;
  readonly type: 'improvement' | 'degradation' | 'alert' | 'milestone';
  readonly dimension: HealthDimension;
  readonly description: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly metadata?: Record<string, any>;
}

// Health Trends
export interface HealthTrend {
  readonly dimension: HealthDimension;
  readonly period: 'week' | 'month' | 'quarter' | 'year';
  readonly direction: 'improving' | 'stable' | 'declining';
  readonly changeRate: number;
  readonly dataPoints: Array<{
    readonly date: Date;
    readonly score: HealthScore;
  }>;
  readonly confidence: number; // 0-1
}

// Health Benchmark
export interface HealthBenchmark {
  readonly repositoryType: 'library' | 'application' | 'tool' | 'framework';
  readonly teamSize: 'small' | 'medium' | 'large' | 'enterprise';
  readonly benchmarkScores: Record<HealthDimension, HealthScore>;
  readonly percentile: number; // Where this repo ranks (0-100)
}

// Health Export Data
export interface HealthExportData {
  readonly report: RepositoryHealthReport;
  readonly history?: HealthHistoryEntry[];
  readonly trends?: HealthTrend[];
  readonly benchmark?: HealthBenchmark;
  readonly config: HealthConfig;
}

// Default Health Configuration
export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  enabled: true,
  trackTrends: true,
  assessmentFrequency: 'weekly',
  dimensions: {
    codeQuality: {
      enabled: true,
      weight: 0.25,
      thresholds: { excellent: 90, good: 75, fair: 60, poor: 40 }
    },
    maintenance: {
      enabled: true,
      weight: 0.20,
      thresholds: { excellent: 85, good: 70, fair: 55, poor: 35 }
    },
    security: {
      enabled: true,
      weight: 0.20,
      thresholds: { excellent: 95, good: 80, fair: 65, poor: 45 }
    },
    performance: {
      enabled: true,
      weight: 0.15,
      thresholds: { excellent: 88, good: 72, fair: 58, poor: 38 }
    },
    collaboration: {
      enabled: true,
      weight: 0.12,
      thresholds: { excellent: 85, good: 68, fair: 52, poor: 32 }
    },
    stability: {
      enabled: true,
      weight: 0.08,
      thresholds: { excellent: 92, good: 78, fair: 62, poor: 42 }
    }
  },
  alerts: {
    enabled: true,
    scoreThreshold: 60,
    criticalIssues: true
  }
};

// Health Metric Definitions
export const HEALTH_METRICS = {
  // Code Quality Metrics
  BRANCH_COVERAGE: 'branch-coverage',
  STALE_BRANCH_RATIO: 'stale-branch-ratio',
  CONFLICT_FREQUENCY: 'conflict-frequency',
  CODE_DUPLICATION: 'code-duplication',
  
  // Maintenance Metrics
  OUTDATED_DEPENDENCIES: 'outdated-dependencies',
  DOCUMENTATION_COVERAGE: 'documentation-coverage',
  TECHNICAL_DEBT: 'technical-debt',
  UPDATE_FREQUENCY: 'update-frequency',
  
  // Security Metrics
  VULNERABILITY_COUNT: 'vulnerability-count',
  SECURITY_ALERTS: 'security-alerts',
  BRANCH_PROTECTION: 'branch-protection',
  ACCESS_CONTROL: 'access-control',
  
  // Performance Metrics
  BUILD_TIME: 'build-time',
  TEST_DURATION: 'test-duration',
  REPOSITORY_SIZE: 'repository-size',
  OPERATION_SPEED: 'operation-speed',
  
  // Collaboration Metrics
  CONTRIBUTOR_ACTIVITY: 'contributor-activity',
  REVIEW_COVERAGE: 'review-coverage',
  MERGE_FREQUENCY: 'merge-frequency',
  ISSUE_RESOLUTION_TIME: 'issue-resolution-time',
  
  // Stability Metrics
  BUILD_SUCCESS_RATE: 'build-success-rate',
  HOTFIX_FREQUENCY: 'hotfix-frequency',
  ROLLBACK_RATE: 'rollback-rate',
  UPTIME: 'uptime'
} as const;

export type HealthMetricType = typeof HEALTH_METRICS[keyof typeof HEALTH_METRICS];
