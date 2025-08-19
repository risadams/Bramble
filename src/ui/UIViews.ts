import blessed from 'blessed';
import chalk from 'chalk';
import { AnalysisResult, BranchInfo } from '../types/analysis.js';
import { BranchVisualizer } from './BranchVisualizer.js';
import { TerminalCompat } from '../utils/terminalCompat.js';

export enum ViewType {
  OVERVIEW = 'overview',
  BRANCH_LIST = 'branch_list',
  BRANCH_DETAIL = 'branch_detail',
  STATISTICS = 'statistics',
  ACTIVITY = 'activity',
  VISUALIZATIONS = 'visualizations'
}

export interface UIView {
  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void;
  handleKeypress(key: string, data: AnalysisResult): boolean;
}

export class OverviewView implements UIView {
  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void {
    const content = this.generateOverviewContent(data);
    container.setContent(content);
  }

  handleKeypress(key: string, data: AnalysisResult): boolean {
    // No specific key handling for overview
    return false;
  }

  private generateOverviewContent(data: AnalysisResult): string {
    return `
📊 Repository Overview
=====================
Path: ${data.repository.path}
Default Branch: ${data.repository.defaultBranch}
Total Branches: ${data.repository.totalBranches}

Branch Health:
- Active Branches: ${data.repository.totalBranches - data.repository.staleBranches}
- Stale Branches: ${data.repository.staleBranches}
- Mergeable: ${data.repository.mergeableBranches}
- With Conflicts: ${data.repository.conflictedBranches}

📈 Key Statistics:
- Average Branch Age: ${data.statistics.averageAge.toFixed(1)} days
- Total Commits: ${data.statistics.totalCommits}
- Average Commits/Branch: ${data.statistics.averageCommitsPerBranch.toFixed(1)}
- Total Contributors: ${data.statistics.totalContributors}
- Most Active Branch: ${data.statistics.mostActive}
- Most Conflicted: ${data.statistics.mostConflicted}

🏆 Top Contributors:
${data.activityOverview.topContributors.slice(0, 5).map(c => 
  `- ${c.name}: ${c.commits} commits`
).join('\n')}

📋 Recent Activity (Last 7 days):
${data.activityOverview.dailyActivity.slice(-7).map(a => 
  `${a.date}: ${TerminalCompat.getCharset().blockFull.repeat(Math.min(a.count, 20))} (${a.count})`
).join('\n')}
    `;
  }
}

export class BranchListView implements UIView {
  private selectedIndex = 0;
  private sortBy: 'name' | 'activity' | 'commits' | 'conflicts' = 'activity';
  private filterStale = false;
  private scrollOffset = 0;
  private pageSize = 20; // Number of branches to show per page

  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void {
    const content = this.generateBranchListContent(data);
    container.setContent(content);
  }

  handleKeypress(key: string, data: AnalysisResult): boolean {
    const branches = this.getSortedBranches(data.branches);
    
    switch (key) {
      case 'up':
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          // Scroll up if selection goes above visible area
          if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
          }
        }
        return true;
      case 'down':
        if (this.selectedIndex < branches.length - 1) {
          this.selectedIndex++;
          // Scroll down if selection goes below visible area
          if (this.selectedIndex >= this.scrollOffset + this.pageSize) {
            this.scrollOffset = this.selectedIndex - this.pageSize + 1;
          }
        }
        return true;
      case 'pageup':
        this.selectedIndex = Math.max(0, this.selectedIndex - this.pageSize);
        this.scrollOffset = Math.max(0, this.scrollOffset - this.pageSize);
        return true;
      case 'pagedown':
        this.selectedIndex = Math.min(branches.length - 1, this.selectedIndex + this.pageSize);
        this.scrollOffset = Math.min(
          Math.max(0, branches.length - this.pageSize),
          this.scrollOffset + this.pageSize
        );
        return true;
      case 'home':
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        return true;
      case 'end':
        this.selectedIndex = branches.length - 1;
        this.scrollOffset = Math.max(0, branches.length - this.pageSize);
        return true;
      case 't':
        this.cycleSortOrder();
        return true;
      case 'f':
        this.filterStale = !this.filterStale;
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        return true;
      default:
        return false;
    }
  }

  private getSortedBranches(branches: BranchInfo[]): BranchInfo[] {
    let filtered = this.filterStale ? branches.filter(b => b.isStale) : branches;
    
    switch (this.sortBy) {
      case 'name':
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case 'activity':
        return filtered.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      case 'commits':
        return filtered.sort((a, b) => b.commitCount - a.commitCount);
      case 'conflicts':
        return filtered.sort((a, b) => b.conflictCount - a.conflictCount);
      default:
        return filtered;
    }
  }

  private cycleSortOrder(): void {
    const orders: Array<typeof this.sortBy> = ['name', 'activity', 'commits', 'conflicts'];
    const currentIndex = orders.indexOf(this.sortBy);
    const nextIndex = (currentIndex + 1) % orders.length;
    this.sortBy = orders[nextIndex] || 'activity';
    this.selectedIndex = 0;
  }

  private generateBranchListContent(data: AnalysisResult): string {
    const branches = this.getSortedBranches(data.branches);
    const visibleBranches = branches.slice(this.scrollOffset, this.scrollOffset + this.pageSize);
    
    const header = `
📋 Branch List (Sorted by ${this.sortBy}${this.filterStale ? ', Stale Only' : ''})
${'='.repeat(100)}

Controls: ↑/↓ Navigate | t: Sort | f: Filter Stale | PgUp/PgDn: Page | Home/End

Showing ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + this.pageSize, branches.length)} of ${branches.length} branches

${'Sel'.padEnd(3)} ${'Cur'.padEnd(3)} ${'Status'.padEnd(6)} ${'Branch Name'.padEnd(25)} ${'Age'.padEnd(5)} ${'Commits'.padEnd(7)} ${'Last Commit'.padEnd(16)} ${'Author'.padEnd(15)} ${'Merge'}
${'---'.padEnd(3)} ${'---'.padEnd(3)} ${'------'.padEnd(6)} ${'-'.repeat(25)} ${'-----'.padEnd(5)} ${'-------'.padEnd(7)} ${'-'.repeat(16)} ${'-'.repeat(15)} ${'-----'}
`;

    const branchLines = visibleBranches.map((branch, displayIndex) => {
      const actualIndex = this.scrollOffset + displayIndex;
      const isSelected = actualIndex === this.selectedIndex;
      const prefix = isSelected ? '►' : ' ';
      const current = branch.current ? '*' : ' ';
      
      // Create a cleaner status indicator using simple characters
      let status = '';
      if (branch.isStale) {
        status = 'STALE ';
      } else if (branch.conflictCount > 0) {
        status = 'CONFCT';
      } else {
        status = 'ACTIVE';
      }
      
      const mergeable = branch.mergeable ? '✓' : '✗';
      
      const age = Math.floor((Date.now() - branch.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      const branchName = branch.name.length > 24 ? branch.name.substring(0, 21) + '...' : branch.name;
      const ageStr = `${age}d`;
      
      // Format last commit date/time
      const lastCommitDate = branch.lastActivity;
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60));
      
      let lastCommitStr = '';
      if (diffHours < 1) {
        lastCommitStr = 'just now';
      } else if (diffHours < 24) {
        lastCommitStr = `${diffHours}h ago`;
      } else if (diffHours < 24 * 7) {
        const days = Math.floor(diffHours / 24);
        lastCommitStr = `${days}d ago`;
      } else {
        // For older commits, show the actual date
        lastCommitStr = lastCommitDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: lastCommitDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
      
      // Ensure the lastCommitStr fits in the column
      if (lastCommitStr.length > 15) {
        lastCommitStr = lastCommitStr.substring(0, 12) + '...';
      }
      
      // Format author name
      let authorStr = branch.lastCommitAuthor || 'Unknown';
      if (authorStr.length > 14) {
        authorStr = authorStr.substring(0, 11) + '...';
      }
      
      return `${prefix.padEnd(3)} ${current.padEnd(3)} ${status.padEnd(6)} ${branchName.padEnd(25)} ${ageStr.padEnd(5)} ${branch.commitCount.toString().padEnd(7)} ${lastCommitStr.padEnd(16)} ${authorStr.padEnd(15)} ${mergeable}`;
    });

    const legend = `

Legend:
  ► = Selected  * = Current Branch  
  Status: ACTIVE = Normal branch, STALE = No recent activity, CONFCT = Has conflicts
  Merge: ✓ = Mergeable, ✗ = Has conflicts
`;

    return header + branchLines.join('\n') + legend;
  }
}

export class StatisticsView implements UIView {
  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void {
    const content = this.generateStatisticsContent(data);
    container.setContent(content);
  }

  handleKeypress(key: string, data: AnalysisResult): boolean {
    return false;
  }

  private generateStatisticsContent(data: AnalysisResult): string {
    return `
📊 Detailed Statistics
=====================

Repository Health:
- Total Branches: ${data.repository.totalBranches}
- Stale Branches: ${data.repository.staleBranches} (${((data.repository.staleBranches / data.repository.totalBranches) * 100).toFixed(1)}%)
- Mergeable Branches: ${data.repository.mergeableBranches} (${((data.repository.mergeableBranches / data.repository.totalBranches) * 100).toFixed(1)}%)
- Conflicted Branches: ${data.repository.conflictedBranches}

Commit Statistics:
- Total Commits: ${data.statistics.totalCommits}
- Average per Branch: ${data.statistics.averageCommitsPerBranch.toFixed(1)}
- Average Branch Age: ${data.statistics.averageAge.toFixed(1)} days
- Average Branch Size: ${data.statistics.averageBranchSize.toFixed(0)} lines

Branch Categories:
${data.activityOverview.branchTypes.map(type => 
  `- ${type.type}: ${type.count} branches`
).join('\n')}

Top 10 Contributors:
${data.activityOverview.topContributors.map((contributor, index) => 
  `${(index + 1).toString().padStart(2)}. ${contributor.name.padEnd(25)} ${contributor.commits} commits`
).join('\n')}

Active vs Stale Analysis:
- Most Active: ${data.statistics.mostActive}
- Least Active: ${data.statistics.leastActive}
- Most Conflicted: ${data.statistics.mostConflicted}
    `;
  }
}

export class ActivityView implements UIView {
  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void {
    const content = this.generateActivityContent(data);
    container.setContent(content);
  }

  handleKeypress(key: string, data: AnalysisResult): boolean {
    return false;
  }

  private generateActivityContent(data: AnalysisResult): string {
    const maxActivity = Math.max(...data.activityOverview.dailyActivity.map(a => a.count));
    const scale = Math.max(1, Math.floor(maxActivity / 20)); // Scale to max 20 chars
    
    return `
📈 Activity Heatmap (Last 30 Days)
==================================

Daily Commit Activity:
${'Date'.padEnd(12)} ${'Activity'.padEnd(25)} Count

${data.activityOverview.dailyActivity.slice(-30).map(activity => {
  const charset = TerminalCompat.getCharset();
  const bars = charset.blockFull.repeat(Math.floor(activity.count / scale));
  const dots = '.'.repeat(Math.max(0, 20 - bars.length));
  return `${activity.date} ${bars}${dots} ${activity.count}`;
}).join('\n')}

Scale: Each ${TerminalCompat.getCharset().blockFull} represents ${scale} commit(s)

Weekly Summary:
${this.generateWeeklySummary(data.activityOverview.dailyActivity)}

Contribution Pattern:
${data.activityOverview.topContributors.slice(0, 8).map(contributor => {
  const percentage = ((contributor.commits / data.statistics.totalCommits) * 100).toFixed(1);
  const maxContributorCommits = data.activityOverview.topContributors[0]?.commits || 1;
  const barLength = Math.floor((contributor.commits / maxContributorCommits) * 15);
  const charset = TerminalCompat.getCharset();
  const bar = charset.blockFull.repeat(barLength) + charset.blockEmpty.repeat(15 - barLength);
  return `${contributor.name.padEnd(20)} ${bar} ${percentage}%`;
}).join('\n')}
    `;
  }

  private generateWeeklySummary(dailyActivity: Array<{ date: string; count: number }>): string {
    const weeks = [];
    const sortedActivity = [...dailyActivity].sort((a, b) => a.date.localeCompare(b.date));
    
    for (let i = 0; i < sortedActivity.length; i += 7) {
      const weekData = sortedActivity.slice(i, i + 7);
      const weekTotal = weekData.reduce((sum, day) => sum + day.count, 0);
      const weekStart = weekData[0]?.date || '';
      const weekEnd = weekData[weekData.length - 1]?.date || '';
      
      if (weekTotal > 0) {
        weeks.push(`${weekStart} to ${weekEnd}: ${weekTotal} commits`);
      }
    }
    
    return weeks.slice(-4).join('\n'); // Show last 4 weeks
  }
}

export class VisualizationsView implements UIView {
  private currentVisualization: 'tree' | 'heatmap' | 'relationships' | 'dashboard' = 'tree';

  render(container: blessed.Widgets.BoxElement, data: AnalysisResult): void {
    const content = this.generateVisualizationContent(data);
    container.setContent(content);
  }

  handleKeypress(key: string, data: AnalysisResult): boolean {
    switch (key) {
      case 't':
        this.currentVisualization = 'tree';
        return true;
      case 'h':
        this.currentVisualization = 'heatmap';
        return true;
      case 'r':
        this.currentVisualization = 'relationships';
        return true;
      case 'd':
        this.currentVisualization = 'dashboard';
        return true;
      default:
        return false;
    }
  }

  private generateVisualizationContent(data: AnalysisResult): string {
    let header = `
🎨 Visualizations (${this.currentVisualization.toUpperCase()})
${'='.repeat(50)}

Controls: t: Tree | h: Heatmap | r: Relationships | d: Dashboard

`;

    switch (this.currentVisualization) {
      case 'tree':
        return header + BranchVisualizer.generateBranchTree(data.branches, data.repository.defaultBranch);
      case 'heatmap':
        return header + BranchVisualizer.generateActivityHeatmap(data.branches, 30);
      case 'relationships':
        return header + BranchVisualizer.generateRelationshipGraph(data.branches, data.repository.defaultBranch);
      case 'dashboard':
        return header + BranchVisualizer.generateStatsDashboard(data);
      default:
        return header + 'Unknown visualization type';
    }
  }
}
