import * as os from 'os';
import * as process from 'process';
import { SimpleGit } from 'simple-git';
import {
  PerformanceMetrics,
  PerformanceReport,
  PerformanceIssue,
  OptimizationRecommendation,
  SystemInfo,
  OptimizationConfig,
  PerformanceThresholds,
  OperationTiming,
  MemorySnapshot,
  CacheEntry,
  CacheStats
} from '../types/performance.js';

/**
 * Service for monitoring and optimizing performance
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private operationTimings: OperationTiming[] = [];
  private cache = new Map<string, CacheEntry>();
  private config: OptimizationConfig;
  private monitoringInterval?: NodeJS.Timeout | undefined;
  private git?: SimpleGit | undefined;

  constructor(config?: Partial<OptimizationConfig>, git?: SimpleGit) {
    this.config = {
      ...this.getDefaultConfig(),
      ...config
    };
    this.git = git;

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    console.log(`📊 Performance monitoring started (interval: ${this.config.monitoringInterval}ms)`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('📊 Performance monitoring stopped');
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(repositoryPath: string): Promise<PerformanceReport> {
    const currentMetrics = await this.getCurrentMetrics();
    const systemInfo = await this.getSystemInfo();
    const issues = this.detectPerformanceIssues(currentMetrics);
    const recommendations = this.generateRecommendations(issues, currentMetrics);
    const overallScore = this.calculateOverallScore(currentMetrics, issues);

    return {
      generatedAt: new Date(),
      repositoryPath,
      overallScore,
      category: this.categorizePerformance(overallScore),
      currentMetrics,
      historicalMetrics: this.metrics.slice(-10),
      issues,
      recommendations,
      systemInfo
    };
  }

  /**
   * Start timing an operation
   */
  startOperation(name: string, parameters?: Record<string, any>): string {
    const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const memoryBefore = process.memoryUsage().heapUsed;

    const timing: OperationTiming = {
      operationId,
      name,
      startTime: new Date(),
      memoryBefore
    };
    
    if (parameters) {
      timing.parameters = parameters;
    }

    this.operationTimings.push(timing);
    return operationId;
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string, success: boolean = true, error?: string): void {
    const timing = this.operationTimings.find(t => t.operationId === operationId);
    if (!timing) {
      return;
    }

    const endTime = new Date();
    const memoryAfter = process.memoryUsage().heapUsed;

    timing.endTime = endTime;
    timing.duration = endTime.getTime() - timing.startTime.getTime();
    timing.memoryAfter = memoryAfter;
    timing.success = success;
    if (error) {
      timing.error = error;
    }

    // Keep only recent timings
    if (this.operationTimings.length > 1000) {
      this.operationTimings.splice(0, this.operationTimings.length - 1000);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let totalMemory = 0;
    let totalAccess = 0;
    const entriesByType: Record<string, number> = {};

    for (const [key, entry] of this.cache) {
      totalMemory += entry.size;
      totalAccess += entry.accessCount;
      
      const type = key.split(':')[0] || 'unknown';
      entriesByType[type] = (entriesByType[type] || 0) + 1;
    }

    const hitRate = this.getCacheHitRate();

    return {
      totalEntries: this.cache.size,
      hitRate,
      memoryUsage: totalMemory,
      entriesByType,
      averageAccessTime: this.getAverageAccessTime()
    };
  }

  /**
   * Clear performance cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Performance cache cleared');
  }

  /**
   * Set cache entry
   */
  setCache<T>(key: string, data: T, ttl: number = 300000): void { // 5 min default TTL
    const size = this.estimateObjectSize(data);
    
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
      accessCount: 0,
      size
    });

    this.cleanupExpiredCache();
  }

  /**
   * Get cache entry
   */
  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    return entry.data as T;
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    
    return {
      timestamp: new Date(),
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: this.getHeapLimit()
      },
      external: memUsage.external,
      buffers: (memUsage as any).buffers || 0,
      largeObjects: this.estimateLargeObjectSize(),
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0
    };
  }

  /**
   * Optimize performance based on current state
   */
  async optimizePerformance(): Promise<string[]> {
    const report = await this.generateReport('');
    const actions: string[] = [];

    // Memory optimization
    if (report.currentMetrics.memoryUsage.heapUsed > this.config.maxMemoryUsage) {
      this.forceGarbageCollection();
      actions.push('Forced garbage collection');
    }

    // Cache optimization
    const cacheStats = this.getCacheStats();
    if (cacheStats.memoryUsage > 50 * 1024 * 1024) { // 50MB
      this.optimizeCache();
      actions.push('Optimized cache');
    }

    // Clear old operation timings
    this.cleanupOldTimings();
    actions.push('Cleaned up old operation timings');

    return actions;
  }

  /**
   * Get current performance metrics
   */
  private async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get recent git operations
    const recentGitOps = this.operationTimings
      .filter(t => t.name.startsWith('git') && t.endTime)
      .slice(-10)
      .map(t => ({
        operation: t.name,
        duration: t.duration || 0,
        success: t.success || false
      }));

    // Calculate analysis metrics
    const analysisOps = this.operationTimings
      .filter(t => t.name === 'analyze' && t.endTime);
    
    const totalDuration = analysisOps.reduce((sum, op) => sum + (op.duration || 0), 0);
    const branchesAnalyzed = analysisOps.length;
    const commitsProcessed = this.estimateCommitsProcessed();

    return {
      timestamp: new Date(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user / 1000, // Convert to milliseconds
        system: cpuUsage.system / 1000
      },
      gitOperations: recentGitOps,
      analysisMetrics: {
        totalDuration,
        branchesAnalyzed,
        commitsProcessed,
        avgTimePerBranch: branchesAnalyzed > 0 ? totalDuration / branchesAnalyzed : 0
      }
    };
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();
      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.config.historySize) {
        this.metrics.splice(0, this.metrics.length - this.config.historySize);
      }

      // Check for critical issues
      const issues = this.detectPerformanceIssues(metrics);
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      
      if (criticalIssues.length > 0) {
        console.warn('🚨 Critical performance issues detected:', criticalIssues.map(i => i.description));
        
        if (this.config.autoOptimize) {
          await this.optimizePerformance();
        }
      }
    } catch (error) {
      console.warn('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Detect performance issues
   */
  private detectPerformanceIssues(metrics: PerformanceMetrics): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const thresholds = this.config.thresholds;

    // Memory issues
    if (metrics.memoryUsage.heapUsed > thresholds.memoryCritical) {
      issues.push({
        type: 'memory',
        severity: 'critical',
        description: 'Memory usage is critically high',
        detectedValue: metrics.memoryUsage.heapUsed,
        thresholdValue: thresholds.memoryCritical,
        firstDetected: new Date(),
        occurrenceCount: 1
      });
    } else if (metrics.memoryUsage.heapUsed > thresholds.memoryWarning) {
      issues.push({
        type: 'memory',
        severity: 'medium',
        description: 'Memory usage is above warning threshold',
        detectedValue: metrics.memoryUsage.heapUsed,
        thresholdValue: thresholds.memoryWarning,
        firstDetected: new Date(),
        occurrenceCount: 1
      });
    }

    // Git operation issues
    const slowGitOps = metrics.gitOperations.filter(
      op => op.duration > thresholds.gitOperationTimeout
    );
    if (slowGitOps.length > 0) {
      issues.push({
        type: 'git',
        severity: 'medium',
        description: `${slowGitOps.length} git operations exceeded timeout`,
        detectedValue: Math.max(...slowGitOps.map(op => op.duration)),
        thresholdValue: thresholds.gitOperationTimeout,
        firstDetected: new Date(),
        occurrenceCount: slowGitOps.length
      });
    }

    // Analysis performance issues
    if (metrics.analysisMetrics.totalDuration > thresholds.analysisDurationWarning) {
      issues.push({
        type: 'analysis',
        severity: 'medium',
        description: 'Analysis duration is longer than expected',
        detectedValue: metrics.analysisMetrics.totalDuration,
        thresholdValue: thresholds.analysisDurationWarning,
        firstDetected: new Date(),
        occurrenceCount: 1
      });
    }

    return issues;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    issues: PerformanceIssue[],
    metrics: PerformanceMetrics
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Memory recommendations
    const memoryIssues = issues.filter(i => i.type === 'memory');
    if (memoryIssues.length > 0) {
      recommendations.push({
        category: 'memory',
        priority: 9,
        title: 'Reduce Memory Usage',
        description: 'Memory usage is high and may impact performance',
        expectedImpact: 'high',
        difficulty: 'medium',
        actions: [
          'Clear performance cache',
          'Reduce batch sizes for large operations',
          'Enable streaming for large data processing',
          'Force garbage collection'
        ],
        estimatedMemorySavings: Math.floor(metrics.memoryUsage.heapUsed * 0.3)
      });
    }

    // Git performance recommendations
    const gitIssues = issues.filter(i => i.type === 'git');
    if (gitIssues.length > 0) {
      recommendations.push({
        category: 'performance',
        priority: 7,
        title: 'Optimize Git Operations',
        description: 'Git operations are taking longer than expected',
        expectedImpact: 'medium',
        difficulty: 'easy',
        actions: [
          'Use shallow clones for analysis',
          'Reduce parallel git operations',
          'Enable git operation caching',
          'Use git worktrees for parallel processing'
        ],
        estimatedTimeSavings: 5000
      });
    }

    // General performance recommendations
    if (metrics.analysisMetrics.branchesAnalyzed > 50) {
      recommendations.push({
        category: 'workflow',
        priority: 6,
        title: 'Optimize Branch Analysis',
        description: 'Large number of branches may benefit from optimization',
        expectedImpact: 'medium',
        difficulty: 'easy',
        actions: [
          'Filter branches before analysis',
          'Use parallel processing for branch analysis',
          'Enable result caching',
          'Implement progressive analysis'
        ],
        estimatedTimeSavings: metrics.analysisMetrics.totalDuration * 0.4
      });
    }

    // Cache optimization
    const cacheStats = this.getCacheStats();
    if (cacheStats.hitRate < 0.5) {
      recommendations.push({
        category: 'configuration',
        priority: 5,
        title: 'Improve Cache Efficiency',
        description: 'Cache hit rate is low, consider adjusting cache strategy',
        expectedImpact: 'medium',
        difficulty: 'medium',
        actions: [
          'Increase cache TTL for stable data',
          'Implement cache warming strategies',
          'Optimize cache key structure',
          'Monitor cache usage patterns'
        ]
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(
    metrics: PerformanceMetrics,
    issues: PerformanceIssue[]
  ): number {
    let score = 100;

    // Deduct points for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Memory score
    const memoryUsageRatio = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
    if (memoryUsageRatio > 0.8) score -= 15;
    else if (memoryUsageRatio > 0.6) score -= 10;

    // Analysis efficiency score
    if (metrics.analysisMetrics.avgTimePerBranch > 1000) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Categorize performance based on score
   */
  private categorizePerformance(score: number): PerformanceReport['category'] {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<SystemInfo> {
    let gitVersion: string | undefined;
    
    try {
      if (this.git) {
        gitVersion = await this.git.raw(['--version']);
        gitVersion = gitVersion.trim();
      }
    } catch (error) {
      // Git version not available
    }

    const systemInfo: SystemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      nodeVersion: process.version
    };

    if (gitVersion) {
      systemInfo.gitVersion = gitVersion;
    }

    return systemInfo;
  }

  /**
   * Utility methods
   */
  private getDefaultConfig(): OptimizationConfig {
    return {
      enabled: true,
      monitoringInterval: 5000, // 5 seconds
      historySize: 100,
      autoOptimize: false,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      thresholds: {
        memoryWarning: 256 * 1024 * 1024, // 256MB
        memoryCritical: 512 * 1024 * 1024, // 512MB
        gitOperationTimeout: 10000, // 10 seconds
        analysisDurationWarning: 30000, // 30 seconds
        maxParallelBranches: 5
      }
    };
  }

  private forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Forced garbage collection');
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private optimizeCache(): void {
    // Remove least accessed entries if cache is too large
    const entries = Array.from(this.cache.entries());
    entries.sort(([,a], [,b]) => a.accessCount - b.accessCount);
    
    const toRemove = Math.floor(entries.length * 0.3); // Remove 30%
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const key = entries[i]?.[0];
      if (key) {
        this.cache.delete(key);
      }
    }
  }

  private cleanupOldTimings(): void {
    const cutoff = Date.now() - 300000; // 5 minutes
    this.operationTimings = this.operationTimings.filter(
      t => t.startTime.getTime() > cutoff
    );
  }

  private getCacheHitRate(): number {
    // Simplified hit rate calculation
    const totalAccess = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.accessCount, 0
    );
    return totalAccess > 0 ? this.cache.size / totalAccess : 0;
  }

  private getAverageAccessTime(): number {
    // Placeholder - would need more sophisticated timing
    return 1.5; // milliseconds
  }

  private estimateObjectSize(obj: any): number {
    return JSON.stringify(obj).length * 2; // Rough estimate
  }

  private getHeapLimit(): number {
    return (process as any).memoryUsage?.().heapLimit || 1024 * 1024 * 1024; // 1GB default
  }

  private estimateLargeObjectSize(): number {
    // Placeholder - would need V8 heap inspection
    return 0;
  }

  private estimateCommitsProcessed(): number {
    return this.operationTimings
      .filter(t => t.name.includes('commit'))
      .reduce((sum, t) => sum + (t.parameters?.count || 1), 0);
  }
}
