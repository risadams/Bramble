/**
 * Types for performance monitoring and optimization
 */

export interface PerformanceMetrics {
  /** Timestamp of the measurement */
  timestamp: Date;
  /** Memory usage in bytes */
  memoryUsage: {
    /** Heap used */
    heapUsed: number;
    /** Heap total */
    heapTotal: number;
    /** External memory */
    external: number;
    /** RSS (Resident Set Size) */
    rss: number;
  };
  /** CPU usage percentage */
  cpuUsage: {
    /** User CPU time */
    user: number;
    /** System CPU time */
    system: number;
  };
  /** Git operation timings */
  gitOperations: {
    /** Operation name */
    operation: string;
    /** Duration in milliseconds */
    duration: number;
    /** Success status */
    success: boolean;
  }[];
  /** Analysis performance */
  analysisMetrics: {
    /** Total analysis duration */
    totalDuration: number;
    /** Number of branches analyzed */
    branchesAnalyzed: number;
    /** Number of commits processed */
    commitsProcessed: number;
    /** Average time per branch */
    avgTimePerBranch: number;
  };
}

export interface PerformanceThresholds {
  /** Memory usage warning threshold (bytes) */
  memoryWarning: number;
  /** Memory usage critical threshold (bytes) */
  memoryCritical: number;
  /** Git operation timeout (milliseconds) */
  gitOperationTimeout: number;
  /** Analysis duration warning (milliseconds) */
  analysisDurationWarning: number;
  /** Maximum branches to analyze in parallel */
  maxParallelBranches: number;
}

export interface PerformanceReport {
  /** Report generation time */
  generatedAt: Date;
  /** Repository path */
  repositoryPath: string;
  /** Overall performance score (0-100) */
  overallScore: number;
  /** Performance category */
  category: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  /** Current metrics */
  currentMetrics: PerformanceMetrics;
  /** Historical metrics (last 10 measurements) */
  historicalMetrics: PerformanceMetrics[];
  /** Performance issues detected */
  issues: PerformanceIssue[];
  /** Optimization recommendations */
  recommendations: OptimizationRecommendation[];
  /** System information */
  systemInfo: SystemInfo;
}

export interface PerformanceIssue {
  /** Issue type */
  type: 'memory' | 'cpu' | 'git' | 'analysis' | 'disk';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Issue description */
  description: string;
  /** Detected value */
  detectedValue: number;
  /** Threshold value */
  thresholdValue: number;
  /** When the issue was first detected */
  firstDetected: Date;
  /** How many times this issue occurred */
  occurrenceCount: number;
}

export interface OptimizationRecommendation {
  /** Recommendation category */
  category: 'memory' | 'performance' | 'configuration' | 'workflow';
  /** Priority level (1-10, 10 being highest) */
  priority: number;
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected impact */
  expectedImpact: 'low' | 'medium' | 'high';
  /** Implementation difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Specific actions to take */
  actions: string[];
  /** Estimated time savings (milliseconds) */
  estimatedTimeSavings?: number;
  /** Estimated memory savings (bytes) */
  estimatedMemorySavings?: number;
}

export interface SystemInfo {
  /** Operating system */
  platform: string;
  /** Architecture */
  arch: string;
  /** CPU count */
  cpuCount: number;
  /** Total memory (bytes) */
  totalMemory: number;
  /** Free memory (bytes) */
  freeMemory: number;
  /** Node.js version */
  nodeVersion: string;
  /** Git version */
  gitVersion?: string | undefined;
}

export interface OptimizationConfig {
  /** Whether to enable performance monitoring */
  enabled: boolean;
  /** Monitoring interval (milliseconds) */
  monitoringInterval: number;
  /** Number of historical measurements to keep */
  historySize: number;
  /** Performance thresholds */
  thresholds: PerformanceThresholds;
  /** Whether to auto-optimize based on recommendations */
  autoOptimize: boolean;
  /** Maximum memory usage before forcing cleanup */
  maxMemoryUsage: number;
}

export interface PerformanceOptimizer {
  /** Enable garbage collection suggestions */
  enableGCHints: boolean;
  /** Batch size for processing operations */
  batchSize: number;
  /** Use streaming for large operations */
  useStreaming: boolean;
  /** Cache frequently accessed data */
  enableCaching: boolean;
  /** Parallel processing settings */
  parallelism: {
    /** Maximum concurrent operations */
    maxConcurrent: number;
    /** Use worker threads for heavy operations */
    useWorkers: boolean;
  };
}

export interface CacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Cache timestamp */
  timestamp: Date;
  /** Time to live (milliseconds) */
  ttl: number;
  /** Number of times accessed */
  accessCount: number;
  /** Size of cached data (bytes) */
  size: number;
}

export interface CacheStats {
  /** Total entries in cache */
  totalEntries: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Total memory used by cache (bytes) */
  memoryUsage: number;
  /** Cache entries by type */
  entriesByType: Record<string, number>;
  /** Average access time (milliseconds) */
  averageAccessTime: number;
}

export interface OperationTiming {
  /** Operation identifier */
  operationId: string;
  /** Operation name */
  name: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date | undefined;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** Operation parameters */
  parameters?: Record<string, any> | undefined;
  /** Memory usage before operation */
  memoryBefore?: number | undefined;
  /** Memory usage after operation */
  memoryAfter?: number | undefined;
  /** Success status */
  success?: boolean | undefined;
  /** Error details if failed */
  error?: string | undefined;
}

export interface MemorySnapshot {
  /** Snapshot timestamp */
  timestamp: Date;
  /** Heap statistics */
  heap: {
    used: number;
    total: number;
    limit: number;
  };
  /** External memory */
  external: number;
  /** Buffer usage */
  buffers: number;
  /** Large object space */
  largeObjects: number;
  /** Active handles */
  activeHandles: number;
  /** Active requests */
  activeRequests: number;
}
