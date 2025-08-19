import blessed from 'blessed';
import { AnalysisResult } from '../core/GitAnalyzer.js';

export class TerminalUI {
  private screen: blessed.Widgets.Screen | null = null;

  public async start(analysisResult: AnalysisResult): Promise<void> {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Bramble - Git Branch Analysis'
    });

    // Create main container
    const container = blessed.box({
      parent: this.screen,
      width: '100%',
      height: '100%',
      style: {
        bg: 'black'
      }
    });

    // Create header
    const header = blessed.box({
      parent: container,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' 🌿 Bramble - Git Branch Analysis Tool',
      style: {
        bg: 'blue',
        fg: 'white',
        bold: true
      }
    });

    // Create main content area
    const content = blessed.box({
      parent: container,
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      scrollable: true,
      style: {
        bg: 'black',
        fg: 'white'
      }
    });

    // Display analysis results
    this.displayOverview(content, analysisResult);

    // Create footer with instructions
    const footer = blessed.box({
      parent: container,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ' Press q to quit | Press b for branch list | Press s for statistics',
      style: {
        bg: 'gray',
        fg: 'white'
      }
    });

    // Handle key events
    this.screen.key(['escape', 'q', 'C-c'], () => {
      if (this.screen) {
        this.screen.destroy();
      }
      process.exit(0);
    });

    // Render the screen
    this.screen.render();
  }

  private displayOverview(container: blessed.Widgets.BoxElement, result: AnalysisResult): void {
    const overview = `
Repository Overview:
==================
Path: ${result.repository.path}
Default Branch: ${result.repository.defaultBranch}
Total Branches: ${result.repository.totalBranches}
Stale Branches: ${result.repository.staleBranches}

Statistics:
===========
Average Branch Age: ${result.statistics.averageAge.toFixed(1)} days
Most Active Branch: ${result.statistics.mostActive}
Least Active Branch: ${result.statistics.leastActive}
Total Commits: ${result.statistics.totalCommits}

Recent Branches:
===============`;

    container.setContent(overview);

    // Add branch list
    const recentBranches = result.branches
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, 10);

    let branchList = '';
    for (const branch of recentBranches) {
      const status = branch.current ? '* ' : '  ';
      const staleMarker = branch.isStale ? ' (STALE)' : '';
      const age = Math.floor((Date.now() - branch.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      branchList += `${status}${branch.name} - ${age} days ago${staleMarker}\n`;
    }

    container.setContent(overview + '\n\n' + branchList);
  }
}
