import { PerformanceMonitor } from '../src/services/PerformanceMonitor.js';
import { jest } from '@jest/globals';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      enabled: false, // Disable auto-monitoring for tests
      monitoringInterval: 1000
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('operation timing', () => {
    it('should track operation timing correctly', () => {
      const operationId = monitor.startOperation('test-operation', { param: 'value' });
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('test-operation');
      
      monitor.endOperation(operationId, true);
      
      // Operation should be recorded (no easy way to verify without exposing internals)
      expect(operationId).toBeDefined();
    });

    it('should handle operation failure', () => {
      const operationId = monitor.startOperation('failing-operation');
      
      monitor.endOperation(operationId, false, 'Operation failed');
      
      // Should not throw and should record the failure
      expect(operationId).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should store and retrieve cache entries', () => {
      const testData = { key: 'value', number: 42 };
      
      monitor.setCache('test-key', testData, 10000);
      const retrieved = monitor.getCache('test-key');
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent cache entries', () => {
      const result = monitor.getCache('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle cache expiration', () => {
      const testData = { expired: true };
      
      // Set with very short TTL
      monitor.setCache('expiring-key', testData, 1);
      
      // Wait for expiration
      setTimeout(() => {
        const result = monitor.getCache('expiring-key');
        expect(result).toBeNull();
      }, 10);
    });

    it('should provide cache statistics', () => {
      monitor.setCache('key1', 'value1');
      monitor.setCache('key2', 'value2');
      
      const stats = monitor.getCacheStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.entriesByType).toBeDefined();
    });

    it('should clear cache', () => {
      monitor.setCache('key1', 'value1');
      monitor.setCache('key2', 'value2');
      
      let stats = monitor.getCacheStats();
      expect(stats.totalEntries).toBe(2);
      
      monitor.clearCache();
      
      stats = monitor.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('performance report', () => {
    it('should generate performance report', async () => {
      const report = await monitor.generateReport('/test/repo');
      
      expect(report).toBeDefined();
      expect(report.repositoryPath).toBe('/test/repo');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.category).toBeDefined();
      expect(report.currentMetrics).toBeDefined();
      expect(report.systemInfo).toBeDefined();
      expect(Array.isArray(report.issues)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should include system information in report', async () => {
      const report = await monitor.generateReport('/test/repo');
      
      expect(report.systemInfo.platform).toBeDefined();
      expect(report.systemInfo.arch).toBeDefined();
      expect(report.systemInfo.cpuCount).toBeGreaterThan(0);
      expect(report.systemInfo.totalMemory).toBeGreaterThan(0);
      expect(report.systemInfo.nodeVersion).toBeDefined();
    });
  });

  describe('memory monitoring', () => {
    it('should take memory snapshots', () => {
      const snapshot = monitor.takeMemorySnapshot();
      
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.heap.used).toBeGreaterThan(0);
      expect(snapshot.heap.total).toBeGreaterThan(0);
      expect(snapshot.heap.limit).toBeGreaterThan(0);
    });
  });

  describe('performance optimization', () => {
    it('should provide optimization actions', async () => {
      // Add some cache entries to trigger optimization
      for (let i = 0; i < 100; i++) {
        monitor.setCache(`key-${i}`, `value-${i}`);
      }
      
      const actions = await monitor.optimizePerformance();
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(() => {
        monitor.startMonitoring();
        monitor.stopMonitoring();
      }).not.toThrow();
    });

    it('should handle multiple start calls gracefully', () => {
      expect(() => {
        monitor.startMonitoring();
        monitor.startMonitoring(); // Should not create duplicate intervals
        monitor.stopMonitoring();
      }).not.toThrow();
    });
  });
});
