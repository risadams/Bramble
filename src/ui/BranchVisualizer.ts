import { BranchInfo, AnalysisResult } from '../core/GitAnalyzer.js';

export interface TreeNode {
  name: string;
  branch: BranchInfo;
  children: TreeNode[];
  level: number;
}

export class BranchVisualizer {
  /**
   * Generate ASCII tree representation of branch relationships
   */
  public static generateBranchTree(branches: BranchInfo[], defaultBranch: string): string {
    const tree = this.buildBranchTree(branches, defaultBranch);
    return this.renderTree(tree);
  }

  /**
   * Generate activity heatmap for a specific time period
   */
  public static generateActivityHeatmap(branches: BranchInfo[], days: number = 30): string {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const heatmapData = this.buildHeatmapData(branches, startDate, endDate);
    return this.renderHeatmap(heatmapData, startDate, days);
  }

  /**
   * Generate branch relationship graph
   */
  public static generateRelationshipGraph(branches: BranchInfo[], defaultBranch: string): string {
    const relationships = this.analyzeRelationships(branches, defaultBranch);
    return this.renderRelationships(relationships);
  }

  private static buildBranchTree(branches: BranchInfo[], defaultBranch: string): TreeNode[] {
    const defaultBranchInfo = branches.find(b => b.name === defaultBranch);
    if (!defaultBranchInfo) return [];

    const root: TreeNode = {
      name: defaultBranch,
      branch: defaultBranchInfo,
      children: [],
      level: 0
    };

    // Sort other branches by relationship and age
    const otherBranches = branches
      .filter(b => b.name !== defaultBranch)
      .sort((a, b) => {
        // Prioritize by divergence (closer to main first)
        if (a.divergence.behind !== b.divergence.behind) {
          return a.divergence.behind - b.divergence.behind;
        }
        // Then by last activity
        return b.lastActivity.getTime() - a.lastActivity.getTime();
      });

    // Build tree structure (simplified - assumes branches come from main)
    for (const branch of otherBranches) {
      root.children.push({
        name: branch.name,
        branch,
        children: [],
        level: 1
      });
    }

    return [root];
  }

  private static renderTree(nodes: TreeNode[]): string {
    let result = '\n🌳 Branch Tree\n';
    result += '==============\n\n';

    const renderNode = (node: TreeNode, prefix: string = '', isLast: boolean = true): string => {
      let output = '';
      const connector = isLast ? '└── ' : '├── ';
      const status = this.getBranchStatus(node.branch);
      const age = Math.floor((Date.now() - node.branch.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      
      output += `${prefix}${connector}${status} ${node.name} (${age}d, ${node.branch.commitCount} commits)\n`;
      
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child) {
          const isLastChild = i === node.children.length - 1;
          output += renderNode(child, childPrefix, isLastChild);
        }
      }
      
      return output;
    };

    for (const node of nodes) {
      result += renderNode(node);
    }

    return result;
  }

  private static getBranchStatus(branch: BranchInfo): string {
    if (branch.current) return '📍';
    if (branch.isStale) return '🚨';
    if (!branch.mergeable) return '⚠️';
    return '🌿';
  }

  private static buildHeatmapData(branches: BranchInfo[], startDate: Date, endDate: Date): Map<string, number> {
    const heatmapData = new Map<string, number>();
    
    // Initialize all dates with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dateStr) {
        heatmapData.set(dateStr, 0);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate activity from all branches
    for (const branch of branches) {
      for (const activity of branch.commitFrequency) {
        const existing = heatmapData.get(activity.date) || 0;
        heatmapData.set(activity.date, existing + activity.count);
      }
    }

    return heatmapData;
  }

  private static renderHeatmap(heatmapData: Map<string, number>, startDate: Date, days: number): string {
    let result = '\n📈 Activity Heatmap\n';
    result += '==================\n\n';

    const maxActivity = Math.max(...Array.from(heatmapData.values()));
    const scale = Math.max(1, Math.ceil(maxActivity / 7)); // Scale to 7 levels

    result += 'Intensity: ░▒▓█ (each level = ' + scale + ' commits)\n\n';

    // Generate weekly view
    const weeks: string[][] = [];
    let currentWeek: string[] = [];
    
    const currentDate = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dateStr) {
        const activity = heatmapData.get(dateStr) || 0;
        const intensity = this.getIntensityChar(activity, scale);
        
        currentWeek.push(intensity);
        
        if (currentDate.getDay() === 6 || i === days - 1) { // Sunday or last day
          weeks.push([...currentWeek]);
          currentWeek = [];
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Render calendar view
    result += '    S M T W T F S\n';
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      if (week) {
        result += `W${(i + 1).toString().padStart(2)}: ${week.join(' ')}\n`;
      }
    }

    // Add legend
    result += '\nLegend:\n';
    result += '📍 Current branch  🌿 Active  🚨 Stale  ⚠️ Conflicts\n';

    return result;
  }

  private static getIntensityChar(activity: number, scale: number): string {
    if (activity === 0) return '░';
    if (activity <= scale) return '▒';
    if (activity <= scale * 2) return '▓';
    return '█';
  }

  private static analyzeRelationships(branches: BranchInfo[], defaultBranch: string): Array<{from: string, to: string, type: string}> {
    const relationships: Array<{from: string, to: string, type: string}> = [];

    for (const branch of branches) {
      if (branch.name === defaultBranch) continue;

      // Determine relationship type based on divergence
      let relationshipType = 'feature';
      if (branch.divergence.ahead === 0 && branch.divergence.behind > 0) {
        relationshipType = 'outdated';
      } else if (branch.divergence.ahead > 10) {
        relationshipType = 'major-feature';
      } else if (branch.name.includes('hotfix') || branch.name.includes('fix')) {
        relationshipType = 'hotfix';
      }

      relationships.push({
        from: defaultBranch,
        to: branch.name,
        type: relationshipType
      });
    }

    return relationships;
  }

  private static renderRelationships(relationships: Array<{from: string, to: string, type: string}>): string {
    let result = '\n🔗 Branch Relationships\n';
    result += '======================\n\n';

    const typeSymbols = {
      'feature': '🌿',
      'hotfix': '🚑',
      'major-feature': '🎯',
      'outdated': '⏰'
    };

    const groupedByType = new Map<string, Array<{from: string, to: string}>>();
    
    for (const rel of relationships) {
      if (!groupedByType.has(rel.type)) {
        groupedByType.set(rel.type, []);
      }
      groupedByType.get(rel.type)?.push({from: rel.from, to: rel.to});
    }

    for (const [type, rels] of groupedByType) {
      const symbol = typeSymbols[type as keyof typeof typeSymbols] || '📝';
      result += `${symbol} ${type.toUpperCase()} BRANCHES:\n`;
      
      for (const rel of rels) {
        result += `  ${rel.from} ──→ ${rel.to}\n`;
      }
      result += '\n';
    }

    return result;
  }

  /**
   * Generate a visual statistics dashboard
   */
  public static generateStatsDashboard(analysisResult: AnalysisResult): string {
    let result = '\n📊 Branch Statistics Dashboard\n';
    result += '===============================\n\n';

    // Health score calculation
    const healthScore = this.calculateHealthScore(analysisResult);
    const healthBar = this.generateHealthBar(healthScore);
    
    result += `Repository Health: ${healthBar} ${healthScore}%\n\n`;

    // Branch distribution chart
    result += 'Branch Distribution:\n';
    const total = analysisResult.repository.totalBranches;
    const active = total - analysisResult.repository.staleBranches;
    const stale = analysisResult.repository.staleBranches;
    const mergeable = analysisResult.repository.mergeableBranches;
    
    result += `Active:    ${'█'.repeat(Math.floor((active / total) * 20))} ${active}\n`;
    result += `Stale:     ${'█'.repeat(Math.floor((stale / total) * 20))} ${stale}\n`;
    result += `Mergeable: ${'█'.repeat(Math.floor((mergeable / total) * 20))} ${mergeable}\n\n`;

    // Commit activity trend
    result += 'Recent Activity Trend:\n';
    const recentActivity = analysisResult.activityOverview.dailyActivity.slice(-7);
    const maxRecentActivity = Math.max(...recentActivity.map(a => a.count), 1);
    
    for (const activity of recentActivity) {
      const barLength = Math.floor((activity.count / maxRecentActivity) * 15);
      const bar = '█'.repeat(barLength) + '░'.repeat(15 - barLength);
      result += `${activity.date}: ${bar} ${activity.count}\n`;
    }

    return result;
  }

  private static calculateHealthScore(analysisResult: AnalysisResult): number {
    const total = analysisResult.repository.totalBranches;
    if (total === 0) return 100;

    const staleRatio = analysisResult.repository.staleBranches / total;
    const mergeableRatio = analysisResult.repository.mergeableBranches / total;
    const conflictRatio = analysisResult.repository.conflictedBranches / total;

    // Calculate score based on various factors
    let score = 100;
    score -= staleRatio * 40; // Stale branches reduce score
    score += mergeableRatio * 20; // Mergeable branches boost score
    score -= conflictRatio * 30; // Conflicts reduce score

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private static generateHealthBar(score: number): string {
    const filled = Math.floor(score / 5); // 20 chars max
    const empty = 20 - filled;
    
    let color = '🟩'; // Green
    if (score < 70) color = '🟨'; // Yellow
    if (score < 40) color = '🟥'; // Red
    
    return color.repeat(filled) + '⬜'.repeat(empty);
  }
}
