/**
 * Enhanced Visualization Engine
 * 
 * Advanced visualization system with ASCII art, charts, and interactive dashboards
 */

import { BranchInfo, AnalysisResult } from '../types/analysis.js';
import { 
  VisualizationConfig, 
  VisualizationTheme, 
  VisualizationRequest,
  ChartData, 
  HeatmapCell, 
  TreeNodeEnhanced, 
  MetricCard,
  TimelineEvent,
  ActivityPattern,
  DEFAULT_VISUALIZATION_CONFIG,
  DARK_THEME
} from '../types/visualization.js';
import { TerminalCompat } from '../utils/terminalCompat.js';

export class EnhancedVisualizationEngine {
  private config: VisualizationConfig;
  private theme: VisualizationTheme;

  constructor(config?: Partial<VisualizationConfig>, theme?: VisualizationTheme) {
    this.config = { ...DEFAULT_VISUALIZATION_CONFIG, ...config };
    this.theme = theme || DARK_THEME;
  }

  /**
   * Generate visualization based on request
   */
  public generate(request: VisualizationRequest): string {
    this.config = { ...this.config, ...request.config };
    this.theme = request.theme || this.theme;

    switch (request.type) {
      case 'tree':
        return this.generateEnhancedTree(request.data);
      case 'heatmap':
        return this.generateEnhancedHeatmap(request.data);
      case 'timeline':
        return this.generateTimeline(request.data);
      case 'network':
        return this.generateNetworkGraph(request.data);
      case 'dashboard':
        return this.generateDashboard(request.data);
      case 'charts':
        return this.generateChartsView(request.data);
      case 'calendar':
        return this.generateCalendarView(request.data);
      case 'flow':
        return this.generateFlowDiagram(request.data);
      default:
        return this.generateDashboard(request.data);
    }
  }

  /**
   * Enhanced ASCII tree with better styling and information
   */
  private generateEnhancedTree(data: AnalysisResult): string {
    const tree = this.buildEnhancedTree(data.branches, data.repository.defaultBranch);
    return this.renderEnhancedTree(tree);
  }

  private buildEnhancedTree(branches: BranchInfo[], defaultBranch: string): TreeNodeEnhanced[] {
    const defaultBranchInfo = branches.find(b => b.name === defaultBranch);
    if (!defaultBranchInfo) return [];

    const root: TreeNodeEnhanced = {
      name: defaultBranch,
      branch: defaultBranchInfo,
      children: [],
      level: 0,
      displayName: this.formatBranchName(defaultBranch),
      icon: this.theme.symbols.current,
      metadata: {
        age: Math.floor((Date.now() - defaultBranchInfo.lastActivity.getTime()) / (1000 * 60 * 60 * 24)),
        commits: defaultBranchInfo.commitCount,
        author: defaultBranchInfo.lastCommitAuthor,
        status: this.getBranchStatus(defaultBranchInfo)
      }
    };

    // Sort branches by the configured sort method
    const otherBranches = branches
      .filter(b => b.name !== defaultBranch)
      .sort((a, b) => this.sortBranches(a, b));

    // Group branches by type for better tree structure
    const groupedBranches = this.groupBranchesByType(otherBranches);

    // Build tree with grouped structure
    for (const [groupName, groupBranches] of groupedBranches) {
      if (groupBranches.length === 0) continue;

      // Create group node if multiple types
      if (groupedBranches.size > 1 && groupBranches.length > 0) {
        const groupNode: TreeNodeEnhanced = {
          name: `${groupName}_group`,
          branch: groupBranches[0]!, // Use first branch as representative (guaranteed to exist)
          children: [],
          level: 1,
          displayName: `📁 ${groupName.toUpperCase()} (${groupBranches.length})`,
          icon: '📂',
          metadata: {
            age: 0,
            commits: groupBranches.reduce((sum, b) => sum + b.commitCount, 0),
            author: '',
            status: 'active'
          }
        };

        for (const branch of groupBranches) {
          groupNode.children.push({
            name: branch.name,
            branch,
            children: [],
            level: 2,
            displayName: this.formatBranchName(branch.name),
            icon: this.getBranchIcon(branch),
            metadata: {
              age: Math.floor((Date.now() - branch.lastActivity.getTime()) / (1000 * 60 * 60 * 24)),
              commits: branch.commitCount,
              author: branch.lastCommitAuthor,
              status: this.getBranchStatus(branch)
            }
          });
        }

        root.children.push(groupNode);
      } else {
        // Add branches directly under root
        for (const branch of groupBranches) {
          root.children.push({
            name: branch.name,
            branch,
            children: [],
            level: 1,
            displayName: this.formatBranchName(branch.name),
            icon: this.getBranchIcon(branch),
            metadata: {
              age: Math.floor((Date.now() - branch.lastActivity.getTime()) / (1000 * 60 * 60 * 24)),
              commits: branch.commitCount,
              author: branch.lastCommitAuthor,
              status: this.getBranchStatus(branch)
            }
          });
        }
      }
    }

    return [root];
  }

  private renderEnhancedTree(nodes: TreeNodeEnhanced[]): string {
    let result = '\n🌳 Enhanced Branch Tree\n';
    result += '=' .repeat(50) + '\n\n';

    const renderNode = (node: TreeNodeEnhanced, prefix: string = '', isLast: boolean = true): string => {
      let output = '';
      const charset = TerminalCompat.getCharset();
      const connector = isLast ? charset.treeEnd : charset.treeBranch;
      
      // Format the line with enhanced information
      let line = `${prefix}${connector}`;
      
      // Add icon and name
      line += `${node.icon} ${node.displayName}`;
      
      // Add metadata if configured
      if (this.config.tree.showAge && node.metadata.age > 0) {
        line += ` ${this.formatAge(node.metadata.age)}`;
      }
      
      if (this.config.tree.showCommitCounts && node.metadata.commits > 0) {
        line += ` 📊${node.metadata.commits}`;
      }
      
      // Add status indicator
      const statusColor = this.getStatusColor(node.metadata.status);
      line += ` ${statusColor}`;
      
      output += line + '\n';
      
      // Render children
      const childPrefix = prefix + (isLast ? charset.treeSpace : charset.treeVertical);
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

    // Add legend
    result += '\n📖 Legend:\n';
    result += `${this.theme.symbols.current} Current  ${this.theme.symbols.active} Active  `;
    result += `${this.theme.symbols.stale} Stale  ${this.theme.symbols.conflict} Conflicts\n`;
    result += '📊 Commit count  🕒 Days since last commit\n';

    return result;
  }

  /**
   * Enhanced heatmap with better calendar layout
   */
  private generateEnhancedHeatmap(data: AnalysisResult): string {
    const days = this.config.heatmap.days;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const heatmapData = this.buildEnhancedHeatmapData(data.branches, startDate, endDate);
    return this.renderEnhancedHeatmap(heatmapData, startDate, days);
  }

  private buildEnhancedHeatmapData(branches: BranchInfo[], startDate: Date, endDate: Date): HeatmapCell[] {
    const cells: HeatmapCell[] = [];
    const activityMap = new Map<string, number>();

    // Aggregate activity from all branches
    for (const branch of branches) {
      for (const activity of branch.commitFrequency) {
        const existing = activityMap.get(activity.date) || 0;
        activityMap.set(activity.date, existing + activity.count);
      }
    }

    // Create cells for each day
    const currentDate = new Date(startDate);
    let weekIndex = 0;
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dateStr) {
        const value = activityMap.get(dateStr) || 0;
        const maxValue = Math.max(...Array.from(activityMap.values()), 1);
        
        cells.push({
          date: dateStr,
          value,
          intensity: Math.floor((value / maxValue) * this.config.heatmap.intensityLevels),
          dayOfWeek: currentDate.getDay(),
          weekOfYear: weekIndex
        });
        
        if (currentDate.getDay() === 6) weekIndex++; // New week on Sunday
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return cells;
  }

  private renderEnhancedHeatmap(cells: HeatmapCell[], startDate: Date, days: number): string {
    let result = '\n📈 Enhanced Activity Heatmap\n';
    result += '=' .repeat(50) + '\n\n';

    // Calculate intensity levels
    const maxValue = Math.max(...cells.map(c => c.value), 1);
    const intensityChars = ['░', '▒', '▓', '█'];

    // Group by weeks
    const weeks: HeatmapCell[][] = [];
    let currentWeek: HeatmapCell[] = [];

    for (const cell of cells) {
      currentWeek.push(cell);
      if (cell.dayOfWeek === 6 || cell === cells[cells.length - 1]) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    }

    // Render calendar header
    if (this.config.heatmap.showDayLabels) {
      result += '     S  M  T  W  T  F  S\n';
      result += '    ' + '═'.repeat(21) + '\n';
    }

    // Render weeks
    weeks.forEach((week, weekIndex) => {
      if (week.length === 0) return;
      
      const weekLabel = `W${(weekIndex + 1).toString().padStart(2)}`;
      let weekLine = this.config.heatmap.showDayLabels ? `${weekLabel} │ ` : '';
      
      // Pad beginning of first week if it doesn't start on Sunday
      if (weekIndex === 0 && week.length > 0 && week[0]!.dayOfWeek > 0) {
        weekLine += '   '.repeat(week[0]!.dayOfWeek);
      }
      
      // Add cells for this week
      for (const cell of week) {
        const intensityLevel = Math.min(
          intensityChars.length - 1, 
          Math.floor((cell.value / maxValue) * intensityChars.length)
        );
        const char = intensityChars[intensityLevel];
        
        // Weekend styling
        if (!this.config.heatmap.showWeekends && (cell.dayOfWeek === 0 || cell.dayOfWeek === 6)) {
          weekLine += '·  ';
        } else {
          weekLine += `${char}  `;
        }
      }
      
      result += weekLine + '\n';
    });

    // Add statistics
    const totalCommits = cells.reduce((sum, cell) => sum + cell.value, 0);
    const averageDaily = Math.round((totalCommits / days) * 10) / 10;
    const mostActiveDay = cells.length > 0 ? cells.reduce((max, cell) => cell.value > max.value ? cell : max) : null;

    result += '\n📊 Statistics:\n';
    result += `Total commits: ${totalCommits}\n`;
    result += `Daily average: ${averageDaily}\n`;
    if (mostActiveDay) {
      result += `Most active day: ${mostActiveDay.date} (${mostActiveDay.value} commits)\n`;
    }

    // Add intensity legend
    result += '\n🎨 Intensity levels:\n';
    intensityChars.forEach((char, index) => {
      const range = index === 0 ? '0' : `${Math.ceil((index / intensityChars.length) * maxValue)}+`;
      result += `${char} ${range}  `;
    });
    result += '\n';

    return result;
  }

  /**
   * Generate timeline view of repository events
   */
  private generateTimeline(data: AnalysisResult): string {
    const events = this.extractTimelineEvents(data);
    return this.renderTimeline(events);
  }

  private extractTimelineEvents(data: AnalysisResult): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Add branch creation events
    for (const branch of data.branches) {
      events.push({
        date: branch.lastActivity,
        type: 'branch',
        title: `Branch: ${branch.name}`,
        description: `${branch.commitCount} commits by ${branch.lastCommitAuthor}`,
        branch: branch.name,
        author: branch.lastCommitAuthor,
        impact: branch.commitCount > 50 ? 'major' : branch.commitCount > 10 ? 'minor' : 'patch'
      });
    }

    // Sort by date
    return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);
  }

  private renderTimeline(events: TimelineEvent[]): string {
    let result = '\n📅 Repository Timeline\n';
    result += '=' .repeat(50) + '\n\n';

    const typeIcons = {
      commit: '🔸',
      branch: '🌿',
      merge: '🔀',
      tag: '🏷️',
      release: '🚀'
    };

    const impactColors = {
      major: '🔴',
      minor: '🟡',
      patch: '🟢'
    };

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      
      const isLast = i === events.length - 1;
      const connector = isLast ? '└─' : '├─';
      const continuation = isLast ? '  ' : '│ ';
      
      const icon = typeIcons[event.type] || '📝';
      const impact = impactColors[event.impact || 'patch'] || '🔘';
      const date = event.date.toLocaleDateString();
      
      result += `${connector} ${icon} ${impact} ${event.title}\n`;
      result += `${continuation}    📅 ${date}`;
      
      if (event.author) {
        result += ` 👤 ${event.author}`;
      }
      
      result += '\n';
      
      if (event.description) {
        result += `${continuation}    💬 ${event.description}\n`;
      }
      
      if (!isLast) {
        result += `${continuation}\n`;
      }
    }

    return result;
  }

  /**
   * Generate comprehensive dashboard
   */
  private generateDashboard(data: AnalysisResult): string {
    let result = '\n📊 Repository Dashboard\n';
    result += '=' .repeat(80) + '\n\n';

    // Metrics row
    const metrics = this.generateMetrics(data);
    result += this.renderMetricsRow(metrics);
    result += '\n';

    // Charts section
    result += this.generateChartsSection(data);
    result += '\n';

    // Recent activity
    result += this.generateRecentActivity(data);

    return result;
  }

  private generateMetrics(data: AnalysisResult): MetricCard[] {
    const total = data.repository.totalBranches;
    const stale = data.repository.staleBranches;
    const active = total - stale;
    const health = Math.round((active / total) * 100);

    return [
      {
        title: 'Total Branches',
        value: total,
        status: total > 50 ? 'warning' : 'success',
        description: 'Active repository'
      },
      {
        title: 'Health Score',
        value: health,
        unit: '%',
        status: health > 80 ? 'success' : health > 60 ? 'warning' : 'error',
        trend: 'stable'
      },
      {
        title: 'Contributors',
        value: data.statistics.totalContributors,
        status: 'info',
        description: 'Team size'
      },
      {
        title: 'Total Commits',
        value: data.statistics.totalCommits,
        status: 'success',
        trend: 'up'
      }
    ];
  }

  private renderMetricsRow(metrics: MetricCard[]): string {
    let result = '┌' + '─'.repeat(18) + ('┬' + '─'.repeat(18)).repeat(metrics.length - 1) + '┐\n';
    
    // Titles
    let titleRow = '│';
    for (const metric of metrics) {
      titleRow += ` ${metric.title.padEnd(16)} │`;
    }
    result += titleRow + '\n';
    
    // Values
    let valueRow = '│';
    for (const metric of metrics) {
      const value = `${metric.value}${metric.unit || ''}`;
      valueRow += ` ${value.padEnd(16)} │`;
    }
    result += valueRow + '\n';
    
    result += '└' + '─'.repeat(18) + ('┴' + '─'.repeat(18)).repeat(metrics.length - 1) + '┘\n';
    
    return result;
  }

  private generateChartsSection(data: AnalysisResult): string {
    let result = '📈 Distribution Charts\n';
    result += '-'.repeat(30) + '\n\n';

    // Branch status distribution
    const total = data.repository.totalBranches;
    const active = total - data.repository.staleBranches;
    const stale = data.repository.staleBranches;
    const conflicted = data.repository.conflictedBranches;

    const statusData: ChartData[] = [
      { label: 'Active', value: active, color: 'green' },
      { label: 'Stale', value: stale, color: 'yellow' },
      { label: 'Conflicted', value: conflicted, color: 'red' }
    ];

    result += this.renderHorizontalBarChart('Branch Status', statusData, 30);
    result += '\n';

    // Contributor activity
    const contributors = data.activityOverview.topContributors.slice(0, 5);
    const contributorData: ChartData[] = contributors.map(c => ({
      label: c.name.substring(0, 12),
      value: c.commits,
      color: 'blue'
    }));

    result += this.renderHorizontalBarChart('Top Contributors', contributorData, 30);

    return result;
  }

  private renderHorizontalBarChart(title: string, data: ChartData[], maxWidth: number): string {
    let result = `${title}:\n`;
    
    const maxValue = Math.max(...data.map(d => d.value));
    const maxLabelWidth = Math.max(...data.map(d => d.label.length));
    
    for (const item of data) {
      const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
      const barWidth = Math.floor((percentage / 100) * maxWidth);
      const bar = this.theme.charts.fillChar.repeat(barWidth) + 
                  this.theme.charts.emptyChar.repeat(maxWidth - barWidth);
      
      const label = item.label.padEnd(maxLabelWidth);
      const value = item.value.toString().padStart(4);
      const percent = `${Math.round(percentage)}%`.padStart(4);
      
      result += `${label} │${bar}│ ${value} ${percent}\n`;
    }
    
    return result;
  }

  private generateRecentActivity(data: AnalysisResult): string {
    let result = '🕒 Recent Activity\n';
    result += '-'.repeat(20) + '\n\n';

    const recentActivities = data.activityOverview.dailyActivity.slice(-7);
    
    for (const activity of recentActivities) {
      const date = new Date(activity.date).toLocaleDateString();
      const commits = activity.count;
      const bar = '▓'.repeat(Math.min(commits, 20));
      
      result += `${date}: ${bar} ${commits}\n`;
    }

    return result;
  }

  // Helper methods
  private formatBranchName(name: string): string {
    if (name.length <= 25) return name;
    return name.substring(0, 22) + '...';
  }

  private getBranchIcon(branch: BranchInfo): string {
    if (branch.current) return this.theme.symbols.current;
    if (branch.isStale) return this.theme.symbols.stale;
    if (!branch.mergeable) return this.theme.symbols.conflict;
    if (branch.branchType === 'remote') return this.theme.symbols.remote;
    return this.theme.symbols.active;
  }

  private getBranchStatus(branch: BranchInfo): 'active' | 'stale' | 'conflicted' | 'merged' {
    if (branch.isStale) return 'stale';
    if (!branch.mergeable) return 'conflicted';
    return 'active';
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'active': return '🟢';
      case 'stale': return '🟡';
      case 'conflicted': return '🔴';
      case 'merged': return '🟦';
      default: return '⚪';
    }
  }

  private formatAge(days: number): string {
    if (days === 0) return '🕒today';
    if (days === 1) return '🕒1d';
    if (days < 7) return `🕒${days}d`;
    if (days < 30) return `🕒${Math.floor(days / 7)}w`;
    return `🕒${Math.floor(days / 30)}m`;
  }

  private sortBranches(a: BranchInfo, b: BranchInfo): number {
    switch (this.config.tree.sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'age':
        return a.lastActivity.getTime() - b.lastActivity.getTime();
      case 'commits':
        return b.commitCount - a.commitCount;
      case 'activity':
      default:
        return b.lastActivity.getTime() - a.lastActivity.getTime();
    }
  }

  private groupBranchesByType(branches: BranchInfo[]): Map<string, BranchInfo[]> {
    const groups = new Map<string, BranchInfo[]>();
    
    for (const branch of branches) {
      let group = 'other';
      
      if (branch.name.startsWith('feature/')) group = 'features';
      else if (branch.name.startsWith('fix/') || branch.name.startsWith('bugfix/')) group = 'fixes';
      else if (branch.name.startsWith('hotfix/')) group = 'hotfixes';
      else if (branch.name.startsWith('release/')) group = 'releases';
      else if (branch.branchType === 'remote') group = 'remote';
      
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)?.push(branch);
    }
    
    return groups;
  }

  // Additional visualization methods for network, flow, etc.
  private generateNetworkGraph(data: AnalysisResult): string {
    let result = '\n🕸️ Branch Network Graph\n';
    result += '=' .repeat(50) + '\n\n';
    result += 'Network graph visualization (coming soon)\n';
    // TODO: Implement network graph visualization
    return result;
  }

  private generateChartsView(data: AnalysisResult): string {
    return this.generateChartsSection(data);
  }

  private generateCalendarView(data: AnalysisResult): string {
    return this.generateEnhancedHeatmap(data);
  }

  private generateFlowDiagram(data: AnalysisResult): string {
    let result = '\n🌊 Git Flow Diagram\n';
    result += '=' .repeat(50) + '\n\n';
    result += 'Flow diagram visualization (coming soon)\n';
    // TODO: Implement flow diagram
    return result;
  }
}
