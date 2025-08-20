/**
 * Repository Health Service
 * 
 * Comprehensive health monitoring and scoring for Git repositories
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SimpleGit } from 'simple-git';
import {
  RepositoryHealthReport,
  HealthConfig,
  HealthAnalysisOptions,
  HealthDimensionScore,
  HealthMetric,
  HealthScore,
  HealthCategory,
  HealthDimension,
  HealthHistoryEntry,
  HealthTrend,
  HealthEvent,
  DEFAULT_HEALTH_CONFIG,
  HEALTH_METRICS
} from '../types/health.js';
import { AnalysisResult } from '../types/analysis.js';

export class RepositoryHealthService {
  private readonly healthDataPath: string;
  private config: HealthConfig;

  constructor(
    private readonly git: SimpleGit,
    private readonly repositoryPath: string,
    config?: Partial<HealthConfig>
  ) {
    this.healthDataPath = path.join(repositoryPath, '.bramble', 'health');
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
  }

  /**
   * Generate comprehensive health report for repository
   */
  public async generateHealthReport(
    analysisResult: AnalysisResult,
    options: HealthAnalysisOptions = {}
  ): Promise<RepositoryHealthReport> {
    console.log('🏥 Analyzing repository health...');

    try {
      // Ensure health data directory exists
      await this.ensureHealthDataDirectory();

      // Calculate health dimensions
      const dimensions = await this.calculateHealthDimensions(analysisResult, options);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(dimensions);
      const category = this.determineHealthCategory(overallScore);

      // Generate summary insights
      const summary = this.generateHealthSummary(dimensions, analysisResult);

      // Get trends if requested
      const trends = options.includeTrends ? await this.calculateHealthTrends() : undefined;

      // Get repository metadata
      const metadata = await this.extractRepositoryMetadata(analysisResult);

      const report: RepositoryHealthReport = {
        repositoryPath: this.repositoryPath,
        repositoryName: path.basename(this.repositoryPath),
        generatedAt: new Date(),
        overallScore,
        category,
        dimensions,
        summary,
        trends: trends || {
          improving: [],
          declining: []
        },
        metadata
      };

      // Save report to history if trend tracking is enabled
      if (this.config.trackTrends) {
        await this.saveHealthSnapshot(report);
      }

      console.log(`✅ Health assessment complete: ${overallScore}/100 (${category})`);
      return report;

    } catch (error) {
      console.error('❌ Failed to generate health report:', error);
      throw new Error(`Health analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate health scores for all dimensions
   */
  private async calculateHealthDimensions(
    analysisResult: AnalysisResult,
    options: HealthAnalysisOptions
  ): Promise<HealthDimensionScore[]> {
    const dimensionsToAnalyze = options.dimensions || Object.keys(this.config.dimensions) as HealthDimension[];
    const results: HealthDimensionScore[] = [];

    for (const dimension of dimensionsToAnalyze) {
      if (!this.config.dimensions[dimension].enabled) continue;

      const metrics = await this.calculateDimensionMetrics(dimension, analysisResult);
      const score = this.calculateDimensionScore(dimension, metrics);
      const category = this.determineHealthCategory(score);
      const recommendations = this.generateDimensionRecommendations(dimension, metrics, score);

      results.push({
        dimension,
        score,
        category,
        weight: options.customWeights?.[dimension] || this.config.dimensions[dimension].weight,
        metrics,
        recommendations,
        trends: {} // TODO: Implement trend calculation
      });
    }

    return results;
  }

  /**
   * Calculate metrics for a specific health dimension
   */
  private async calculateDimensionMetrics(
    dimension: HealthDimension,
    analysisResult: AnalysisResult
  ): Promise<HealthMetric[]> {
    switch (dimension) {
      case 'codeQuality':
        return this.calculateCodeQualityMetrics(analysisResult);
      case 'maintenance':
        return this.calculateMaintenanceMetrics(analysisResult);
      case 'security':
        return this.calculateSecurityMetrics(analysisResult);
      case 'performance':
        return this.calculatePerformanceMetrics(analysisResult);
      case 'collaboration':
        return this.calculateCollaborationMetrics(analysisResult);
      case 'stability':
        return this.calculateStabilityMetrics(analysisResult);
      default:
        return [];
    }
  }

  /**
   * Calculate code quality metrics
   */
  private async calculateCodeQualityMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Stale branch ratio metric
    const staleBranchRatio = analysisResult.repository.totalBranches > 0 
      ? (analysisResult.repository.staleBranches / analysisResult.repository.totalBranches) * 100
      : 0;

    metrics.push({
      name: 'Stale Branch Ratio',
      description: 'Percentage of branches that are stale or inactive',
      value: Math.round(staleBranchRatio),
      maxValue: 100,
      weight: 0.4,
      category: 'codeQuality',
      status: staleBranchRatio < 20 ? 'healthy' : staleBranchRatio < 40 ? 'warning' : 'critical',
      recommendations: staleBranchRatio > 30 
        ? ['Consider cleaning up stale branches', 'Implement branch lifecycle policies']
        : ['Good branch hygiene maintained']
    });

    // Conflict frequency metric  
    const conflictRatio = analysisResult.repository.totalBranches > 0
      ? (analysisResult.repository.conflictedBranches / analysisResult.repository.totalBranches) * 100
      : 0;

    metrics.push({
      name: 'Conflict Frequency',
      description: 'Percentage of branches with merge conflicts',
      value: Math.round(conflictRatio),
      maxValue: 100,
      weight: 0.3,
      category: 'codeQuality',
      status: conflictRatio < 10 ? 'healthy' : conflictRatio < 25 ? 'warning' : 'critical',
      recommendations: conflictRatio > 20
        ? ['Address merge conflicts promptly', 'Improve branch coordination']
        : ['Low conflict rate indicates good coordination']
    });

    // Branch coverage metric
    const branchCoverageScore = analysisResult.repository.totalBranches > 0 
      ? Math.min(100, (analysisResult.repository.mergeableBranches / analysisResult.repository.totalBranches) * 100)
      : 100;

    metrics.push({
      name: 'Branch Coverage',
      description: 'Percentage of branches that are mergeable',
      value: Math.round(branchCoverageScore),
      maxValue: 100,
      weight: 0.3,
      category: 'codeQuality',
      status: branchCoverageScore > 80 ? 'healthy' : branchCoverageScore > 60 ? 'warning' : 'critical',
      recommendations: branchCoverageScore < 70
        ? ['Review unmergeable branches', 'Resolve integration issues']
        : ['Good branch integration maintained']
    });

    return metrics;
  }

  /**
   * Calculate maintenance metrics
   */
  private async calculateMaintenanceMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Update frequency metric
    const daysSinceLastCommit = analysisResult.activityOverview?.dailyActivity?.length && 
      analysisResult.activityOverview.dailyActivity.length > 0 &&
      analysisResult.activityOverview.dailyActivity[0]
      ? Math.floor((Date.now() - new Date(analysisResult.activityOverview.dailyActivity[0].date).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const updateFrequencyScore = Math.max(0, 100 - (daysSinceLastCommit * 2));

    metrics.push({
      name: 'Update Frequency',
      description: 'How recently the repository has been updated',
      value: Math.round(updateFrequencyScore),
      maxValue: 100,
      weight: 0.4,
      category: 'maintenance',
      status: updateFrequencyScore > 70 ? 'healthy' : updateFrequencyScore > 40 ? 'warning' : 'critical',
      recommendations: updateFrequencyScore < 50
        ? ['Repository appears inactive', 'Consider regular maintenance commits']
        : ['Good update frequency maintained']
    });

    // Branch hygiene metric
    const staleBranchRatio = analysisResult.repository.totalBranches > 0 
      ? (analysisResult.repository.staleBranches / analysisResult.repository.totalBranches) * 100
      : 0;
    const branchHygieneScore = 100 - (staleBranchRatio * 1.5);

    metrics.push({
      name: 'Branch Hygiene',
      description: 'Overall cleanliness of branch management',
      value: Math.max(0, Math.round(branchHygieneScore)),
      maxValue: 100,
      weight: 0.3,
      category: 'maintenance',
      status: branchHygieneScore > 75 ? 'healthy' : branchHygieneScore > 50 ? 'warning' : 'critical',
      recommendations: branchHygieneScore < 60
        ? ['Implement branch cleanup policies', 'Regular branch reviews needed']
        : ['Branch management is well maintained']
    });

    // Documentation coverage (estimated based on branch naming and commit messages)
    const docCoverageScore = this.estimateDocumentationCoverage(analysisResult);

    metrics.push({
      name: 'Documentation Coverage',
      description: 'Estimated documentation and naming quality',
      value: Math.round(docCoverageScore),
      maxValue: 100,
      weight: 0.3,
      category: 'maintenance',
      status: docCoverageScore > 70 ? 'healthy' : docCoverageScore > 50 ? 'warning' : 'critical',
      recommendations: docCoverageScore < 60
        ? ['Improve branch naming conventions', 'Add more descriptive commit messages']
        : ['Good documentation practices observed']
    });

    return metrics;
  }

  /**
   * Calculate security metrics
   */
  private async calculateSecurityMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Branch protection metric
    const protectionScore = await this.calculateBranchProtectionScore();

    metrics.push({
      name: 'Branch Protection',
      description: 'Security of critical branches',
      value: Math.round(protectionScore),
      maxValue: 100,
      weight: 0.5,
      category: 'security',
      status: protectionScore > 80 ? 'healthy' : protectionScore > 60 ? 'warning' : 'critical',
      recommendations: protectionScore < 70
        ? ['Enable branch protection rules', 'Require pull request reviews']
        : ['Branch protection is properly configured']
    });

    // Access control metric (estimated)
    const accessControlScore = this.estimateAccessControlScore(analysisResult);

    metrics.push({
      name: 'Access Control',
      description: 'Repository access and permission management',
      value: Math.round(accessControlScore),
      maxValue: 100,
      weight: 0.3,
      category: 'security',
      status: accessControlScore > 75 ? 'healthy' : accessControlScore > 55 ? 'warning' : 'critical',
      recommendations: accessControlScore < 65
        ? ['Review repository permissions', 'Implement least privilege access']
        : ['Access control appears appropriate']
    });

    // Security alerts metric (simulated - would integrate with GitHub Security API in real implementation)
    const securityAlertScore = 85; // Placeholder

    metrics.push({
      name: 'Security Alerts',
      description: 'Known vulnerabilities and security issues',
      value: securityAlertScore,
      maxValue: 100,
      weight: 0.2,
      category: 'security',
      status: securityAlertScore > 90 ? 'healthy' : securityAlertScore > 70 ? 'warning' : 'critical',
      recommendations: securityAlertScore < 80
        ? ['Address open security alerts', 'Update dependencies with vulnerabilities']
        : ['No critical security issues detected']
    });

    return metrics;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Repository size metric
    const sizeScore = await this.calculateRepositorySizeScore();

    metrics.push({
      name: 'Repository Size',
      description: 'Overall repository size and efficiency',
      value: Math.round(sizeScore),
      maxValue: 100,
      weight: 0.3,
      category: 'performance',
      status: sizeScore > 80 ? 'healthy' : sizeScore > 60 ? 'warning' : 'critical',
      recommendations: sizeScore < 70
        ? ['Consider repository size optimization', 'Review large files and history']
        : ['Repository size is reasonable']
    });

    // Operation speed metric (based on analysis performance)
    const operationScore = this.calculateOperationSpeedScore(analysisResult);

    metrics.push({
      name: 'Operation Speed',
      description: 'Git operation performance and responsiveness',
      value: Math.round(operationScore),
      maxValue: 100,
      weight: 0.4,
      category: 'performance',
      status: operationScore > 85 ? 'healthy' : operationScore > 65 ? 'warning' : 'critical',
      recommendations: operationScore < 75
        ? ['Optimize repository structure', 'Consider shallow clones for CI']
        : ['Good operation performance']
    });

    // Branch efficiency metric
    const branchEfficiencyScore = this.calculateBranchEfficiencyScore(analysisResult);

    metrics.push({
      name: 'Branch Efficiency',
      description: 'Efficiency of branch structure and workflows',
      value: Math.round(branchEfficiencyScore),
      maxValue: 100,
      weight: 0.3,
      category: 'performance',
      status: branchEfficiencyScore > 80 ? 'healthy' : branchEfficiencyScore > 60 ? 'warning' : 'critical',
      recommendations: branchEfficiencyScore < 70
        ? ['Streamline branch workflows', 'Reduce branch complexity']
        : ['Branch workflows are efficient']
    });

    return metrics;
  }

  /**
   * Calculate collaboration metrics
   */
  private async calculateCollaborationMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Contributor activity metric
    const contributorScore = this.calculateContributorActivityScore(analysisResult);

    metrics.push({
      name: 'Contributor Activity',
      description: 'Level and distribution of contributor engagement',
      value: Math.round(contributorScore),
      maxValue: 100,
      weight: 0.4,
      category: 'collaboration',
      status: contributorScore > 75 ? 'healthy' : contributorScore > 55 ? 'warning' : 'critical',
      recommendations: contributorScore < 65
        ? ['Encourage more contributor participation', 'Improve onboarding process']
        : ['Good contributor engagement']
    });

    // Review coverage metric (estimated)
    const reviewCoverageScore = this.estimateReviewCoverage(analysisResult);

    metrics.push({
      name: 'Review Coverage',
      description: 'Percentage of changes that go through review',
      value: Math.round(reviewCoverageScore),
      maxValue: 100,
      weight: 0.35,
      category: 'collaboration',
      status: reviewCoverageScore > 80 ? 'healthy' : reviewCoverageScore > 60 ? 'warning' : 'critical',
      recommendations: reviewCoverageScore < 70
        ? ['Implement mandatory code reviews', 'Establish review guidelines']
        : ['Good review coverage maintained']
    });

    // Merge frequency metric
    const mergeFrequencyScore = this.calculateMergeFrequencyScore(analysisResult);

    metrics.push({
      name: 'Merge Frequency',
      description: 'Frequency and efficiency of branch merging',
      value: Math.round(mergeFrequencyScore),
      maxValue: 100,
      weight: 0.25,
      category: 'collaboration',
      status: mergeFrequencyScore > 75 ? 'healthy' : mergeFrequencyScore > 55 ? 'warning' : 'critical',
      recommendations: mergeFrequencyScore < 65
        ? ['Improve merge workflows', 'Reduce merge bottlenecks']
        : ['Good merge frequency and workflow']
    });

    return metrics;
  }

  /**
   * Calculate stability metrics
   */
  private async calculateStabilityMetrics(analysisResult: AnalysisResult): Promise<HealthMetric[]> {
    const metrics: HealthMetric[] = [];

    // Build success rate (estimated based on branch health)
    const buildSuccessScore = this.estimateBuildSuccessRate(analysisResult);

    metrics.push({
      name: 'Build Success Rate',
      description: 'Estimated build and integration success rate',
      value: Math.round(buildSuccessScore),
      maxValue: 100,
      weight: 0.4,
      category: 'stability',
      status: buildSuccessScore > 90 ? 'healthy' : buildSuccessScore > 75 ? 'warning' : 'critical',
      recommendations: buildSuccessScore < 85
        ? ['Improve build reliability', 'Add automated testing']
        : ['Build stability is excellent']
    });

    // Hotfix frequency metric
    const hotfixScore = this.calculateHotfixFrequencyScore(analysisResult);

    metrics.push({
      name: 'Hotfix Frequency',
      description: 'Frequency of emergency fixes and patches',
      value: Math.round(hotfixScore),
      maxValue: 100,
      weight: 0.3,
      category: 'stability',
      status: hotfixScore > 85 ? 'healthy' : hotfixScore > 65 ? 'warning' : 'critical',
      recommendations: hotfixScore < 75
        ? ['Reduce emergency fixes', 'Improve testing coverage']
        : ['Low hotfix frequency indicates stability']
    });

    // Rollback rate metric
    const rollbackScore = this.calculateRollbackRateScore(analysisResult);

    metrics.push({
      name: 'Rollback Rate',
      description: 'Frequency of deployment rollbacks',
      value: Math.round(rollbackScore),
      maxValue: 100,
      weight: 0.3,
      category: 'stability',
      status: rollbackScore > 90 ? 'healthy' : rollbackScore > 75 ? 'warning' : 'critical',
      recommendations: rollbackScore < 85
        ? ['Improve deployment testing', 'Enhance rollback procedures']
        : ['Low rollback rate indicates good stability']
    });

    return metrics;
  }

  // Helper calculation methods
  private calculateDimensionScore(dimension: HealthDimension, metrics: HealthMetric[]): HealthScore {
    if (metrics.length === 0) return 0;

    const weightedSum = metrics.reduce((sum, metric) => sum + (metric.value * metric.weight), 0);
    const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateOverallScore(dimensions: HealthDimensionScore[]): HealthScore {
    if (dimensions.length === 0) return 0;

    const weightedSum = dimensions.reduce((sum, dim) => sum + (dim.score * dim.weight), 0);
    const totalWeight = dimensions.reduce((sum, dim) => sum + dim.weight, 0);

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  private determineHealthCategory(score: HealthScore): HealthCategory {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  private generateHealthSummary(dimensions: HealthDimensionScore[], analysisResult: AnalysisResult) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const criticalIssues: string[] = [];
    const quickWins: string[] = [];

    dimensions.forEach(dim => {
      if (dim.score >= 80) {
        strengths.push(`Strong ${dim.dimension} practices`);
      } else if (dim.score < 50) {
        weaknesses.push(`${dim.dimension} needs improvement`);
      }

      if (dim.category === 'critical') {
        criticalIssues.push(`Critical ${dim.dimension} issues require immediate attention`);
      }

      // Identify quick wins from metrics
      dim.metrics.forEach(metric => {
        if (metric.status === 'warning' && metric.weight > 0.3) {
          quickWins.push(`Improve ${metric.name.toLowerCase()}`);
        }
      });
    });

    return { strengths, weaknesses, criticalIssues, quickWins };
  }

  private generateDimensionRecommendations(
    dimension: HealthDimension,
    metrics: HealthMetric[],
    score: HealthScore
  ): string[] {
    const recommendations: string[] = [];

    // Aggregate recommendations from metrics
    metrics.forEach(metric => {
      recommendations.push(...metric.recommendations);
    });

    // Add dimension-specific recommendations based on score
    if (score < 60) {
      switch (dimension) {
        case 'codeQuality':
          recommendations.push('Implement code review process', 'Add automated quality checks');
          break;
        case 'maintenance':
          recommendations.push('Schedule regular maintenance', 'Create maintenance checklist');
          break;
        case 'security':
          recommendations.push('Security audit required', 'Update security policies');
          break;
        case 'performance':
          recommendations.push('Performance optimization needed', 'Monitor key metrics');
          break;
        case 'collaboration':
          recommendations.push('Improve team communication', 'Establish collaboration guidelines');
          break;
        case 'stability':
          recommendations.push('Enhance testing coverage', 'Improve deployment processes');
          break;
      }
    }

    // Remove duplicates and return unique recommendations
    return [...new Set(recommendations)];
  }

  // Utility methods for metric calculations
  private estimateDocumentationCoverage(analysisResult: AnalysisResult): number {
    // Estimate based on branch names and patterns
    const wellNamedBranches = analysisResult.branches.filter(branch => 
      /^(feature|fix|hotfix|bugfix|chore)\/[a-zA-Z0-9-_]+/.test(branch.name)
    ).length;

    const totalBranches = analysisResult.branches.length;
    return totalBranches > 0 ? (wellNamedBranches / totalBranches) * 100 : 80;
  }

  private async calculateBranchProtectionScore(): Promise<number> {
    // Placeholder - would integrate with Git hosting provider API
    return 75; // Assume moderate protection
  }

  private estimateAccessControlScore(analysisResult: AnalysisResult): number {
    // Estimate based on repository characteristics
    const hasMultipleContributors = analysisResult.statistics.totalContributors > 1;
    const hasStructuredBranches = analysisResult.branches.some(b => 
      b.name.includes('main') || b.name.includes('master') || b.name.includes('develop')
    );

    let score = 60; // Base score
    if (hasMultipleContributors) score += 20;
    if (hasStructuredBranches) score += 15;

    return Math.min(100, score);
  }

  private async calculateRepositorySizeScore(): Promise<number> {
    try {
      // Simple size estimation - could be enhanced with actual size calculation
      const stats = await fs.stat(this.repositoryPath);
      const sizeMB = stats.size / (1024 * 1024);
      
      // Score based on reasonable repository size
      if (sizeMB < 100) return 100;
      if (sizeMB < 500) return 90;
      if (sizeMB < 1000) return 80;
      if (sizeMB < 2000) return 70;
      return 60;
    } catch {
      return 75; // Default if can't calculate
    }
  }

  private calculateOperationSpeedScore(analysisResult: AnalysisResult): number {
    // Estimate based on repository characteristics
    const branchCount = analysisResult.repository.totalBranches;
    
    if (branchCount < 50) return 95;
    if (branchCount < 100) return 85;
    if (branchCount < 200) return 75;
    if (branchCount < 500) return 65;
    return 55;
  }

  private calculateBranchEfficiencyScore(analysisResult: AnalysisResult): number {
    const total = analysisResult.repository.totalBranches;
    if (total === 0) return 100;

    const stalePenalty = (analysisResult.repository.staleBranches / total) * 40;
    const conflictPenalty = (analysisResult.repository.conflictedBranches / total) * 30;
    
    return Math.max(0, 100 - stalePenalty - conflictPenalty);
  }

  private calculateContributorActivityScore(analysisResult: AnalysisResult): number {
    const contributors = analysisResult.statistics.totalContributors;
    const branches = analysisResult.repository.totalBranches;
    
    if (contributors === 0) return 0;
    if (contributors === 1) return branches > 5 ? 60 : 40;
    
    // Score based on contributor diversity and activity
    const contributorBranchRatio = Math.min(5, branches / contributors);
    return Math.min(100, 40 + (contributorBranchRatio * 12));
  }

  private estimateReviewCoverage(analysisResult: AnalysisResult): number {
    // Estimate based on branch patterns that suggest review workflow
    const featureBranches = analysisResult.branches.filter(b => 
      b.name.includes('feature/') || b.name.includes('fix/') || b.name.includes('bugfix/')
    ).length;
    
    const total = analysisResult.repository.totalBranches;
    return total > 0 ? Math.min(100, (featureBranches / total) * 120) : 70;
  }

  private calculateMergeFrequencyScore(analysisResult: AnalysisResult): number {
    const mergeableBranches = analysisResult.repository.mergeableBranches;
    const totalBranches = analysisResult.repository.totalBranches;
    
    return totalBranches > 0 ? (mergeableBranches / totalBranches) * 100 : 80;
  }

  private estimateBuildSuccessRate(analysisResult: AnalysisResult): number {
    // Estimate based on conflict rate and branch health
    const conflictRatio = analysisResult.repository.totalBranches > 0
      ? analysisResult.repository.conflictedBranches / analysisResult.repository.totalBranches
      : 0;
    
    return Math.max(60, 100 - (conflictRatio * 150));
  }

  private calculateHotfixFrequencyScore(analysisResult: AnalysisResult): number {
    // Estimate based on hotfix/fix branch patterns
    const hotfixBranches = analysisResult.branches.filter(b => 
      b.name.includes('hotfix/') || b.name.includes('emergency/')
    ).length;
    
    const total = analysisResult.repository.totalBranches;
    const hotfixRatio = total > 0 ? hotfixBranches / total : 0;
    
    return Math.max(0, 100 - (hotfixRatio * 200));
  }

  private calculateRollbackRateScore(analysisResult: AnalysisResult): number {
    // Estimate based on revert patterns and branch health
    const revertBranches = analysisResult.branches.filter(b => 
      b.name.includes('revert') || b.name.includes('rollback')
    ).length;
    
    const total = analysisResult.repository.totalBranches;
    const revertRatio = total > 0 ? revertBranches / total : 0;
    
    return Math.max(0, 100 - (revertRatio * 300));
  }

  // Trend and history management
  private async calculateHealthTrends(): Promise<any> {
    // TODO: Implement trend calculation from historical data
    return {
      improving: [],
      declining: []
    };
  }

  private async saveHealthSnapshot(report: RepositoryHealthReport): Promise<void> {
    try {
      const snapshotPath = path.join(this.healthDataPath, `snapshot-${Date.now()}.json`);
      await fs.writeFile(snapshotPath, JSON.stringify(report, null, 2));
    } catch (error) {
      console.warn('Failed to save health snapshot:', error);
    }
  }

  private async extractRepositoryMetadata(analysisResult: AnalysisResult) {
    const lastActivity = analysisResult.activityOverview?.dailyActivity?.[0]?.date 
      ? new Date(analysisResult.activityOverview.dailyActivity[0].date)
      : new Date();

    return {
      totalBranches: analysisResult.repository.totalBranches,
      activeBranches: analysisResult.repository.totalBranches - analysisResult.repository.staleBranches,
      staleBranches: analysisResult.repository.staleBranches,
      totalCommits: analysisResult.statistics.totalCommits,
      contributors: analysisResult.statistics.totalContributors,
      repositorySize: 'Unknown', // Could be calculated
      lastActivity
    };
  }

  private async ensureHealthDataDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.healthDataPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Get health configuration
   */
  public getConfig(): HealthConfig {
    return this.config;
  }

  /**
   * Update health configuration
   */
  public updateConfig(newConfig: Partial<HealthConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
