import blessed from 'blessed';
import { AnalysisResult } from '../core/GitAnalyzer.js';
import { TerminalCompat } from '../utils/terminalCompat.js';
import { 
  ViewType, 
  UIView, 
  OverviewView, 
  BranchListView, 
  StatisticsView, 
  ActivityView,
  VisualizationsView
} from './UIViews.js';

export class TerminalUI {
  private screen: blessed.Widgets.Screen | null = null;
  private currentView: ViewType = ViewType.OVERVIEW;
  private views: Map<ViewType, UIView> = new Map();
  private content: blessed.Widgets.BoxElement | null = null;
  private navigation: blessed.Widgets.BoxElement | null = null;
  private footer: blessed.Widgets.BoxElement | null = null;

  constructor() {
    this.initializeViews();
  }

  private initializeViews(): void {
    this.views.set(ViewType.OVERVIEW, new OverviewView());
    this.views.set(ViewType.BRANCH_LIST, new BranchListView());
    this.views.set(ViewType.STATISTICS, new StatisticsView());
    this.views.set(ViewType.ACTIVITY, new ActivityView());
    this.views.set(ViewType.VISUALIZATIONS, new VisualizationsView());
  }

  public async start(analysisResult: AnalysisResult): Promise<void> {
    // Initialize terminal compatibility
    TerminalCompat.detectAndSetCharset();
    
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Bramble - Git Branch Analysis',
      fullUnicode: !TerminalCompat.isCompatibilityMode()
    });

    // Create main layout
    this.createLayout(analysisResult);

    // Handle key events
    this.setupKeyHandlers(analysisResult);

    // Initial render
    this.renderCurrentView(analysisResult);

    // Render the screen
    this.screen.render();
  }

  private createLayout(analysisResult: AnalysisResult): void {
    if (!this.screen) return;

    // Create header
    const header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ` 🌿 Bramble - ${analysisResult.repository.path}`,
      style: {
        bg: 'blue',
        fg: 'white',
        bold: true
      }
    });

    // Create navigation bar
    this.navigation = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '100%',
      height: 2,
      content: this.getNavigationContent(),
      style: {
        bg: 'gray',
        fg: 'white'
      }
    });

    // Create main content area
    this.content = blessed.box({
      parent: this.screen,
      top: 5,
      left: 1,
      width: '100%-2',
      height: '100%-9',
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      wrap: false,
      tags: false,
      padding: {
        left: 1,
        right: 1
      },
      style: {
        bg: 'black',
        fg: 'white'
      },
      border: {
        type: 'line'
      }
    });

    // Create footer with instructions
    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: this.getFooterContent(),
      style: {
        bg: 'gray',
        fg: 'white'
      }
    });
  }

  private getNavigationContent(): string {
    const views = [
      { key: 'o', name: 'Overview', type: ViewType.OVERVIEW },
      { key: 'b', name: 'Branches', type: ViewType.BRANCH_LIST },
      { key: 's', name: 'Statistics', type: ViewType.STATISTICS },
      { key: 'a', name: 'Activity', type: ViewType.ACTIVITY },
      { key: 'v', name: 'Visualizations', type: ViewType.VISUALIZATIONS }
    ];

    return ' ' + views.map(view => {
      const active = view.type === this.currentView;
      return active ? `[${view.key}] ${view.name}` : `${view.key}: ${view.name}`;
    }).join(' | ');
  }

  private getFooterContent(): string {
    const baseControls = 'q/Esc: Quit | o: Overview | b: Branches | s: Statistics | a: Activity | v: Visualizations';
    
    switch (this.currentView) {
      case ViewType.BRANCH_LIST:
        return ` ${baseControls} | ↑/↓: Navigate | s: Sort | f: Filter`;
      case ViewType.VISUALIZATIONS:
        return ` ${baseControls} | t: Tree | h: Heatmap | r: Relationships | d: Dashboard`;
      default:
        return ` ${baseControls}`;
    }
  }

  private setupKeyHandlers(analysisResult: AnalysisResult): void {
    if (!this.screen) return;

    this.screen.key(['escape', 'q', 'C-c'], () => {
      if (this.screen) {
        this.screen.destroy();
      }
      process.exit(0);
    });

    // View navigation keys
    this.screen.key(['o'], () => {
      this.switchView(ViewType.OVERVIEW, analysisResult);
    });

    this.screen.key(['b'], () => {
      this.switchView(ViewType.BRANCH_LIST, analysisResult);
    });

    this.screen.key(['s'], () => {
      this.switchView(ViewType.STATISTICS, analysisResult);
    });

    this.screen.key(['a'], () => {
      this.switchView(ViewType.ACTIVITY, analysisResult);
    });

    this.screen.key(['v'], () => {
      this.switchView(ViewType.VISUALIZATIONS, analysisResult);
    });

    // Handle view-specific key events
    this.screen.on('keypress', (ch, key) => {
      const currentViewHandler = this.views.get(this.currentView);
      if (currentViewHandler && currentViewHandler.handleKeypress(key.name, analysisResult)) {
        this.renderCurrentView(analysisResult);
        this.updateNavigation();
        this.screen?.render();
      }
    });
  }

  private switchView(newView: ViewType, analysisResult: AnalysisResult): void {
    this.currentView = newView;
    this.renderCurrentView(analysisResult);
    this.updateNavigation();
    this.screen?.render();
  }

  private renderCurrentView(analysisResult: AnalysisResult): void {
    if (!this.content) return;

    const view = this.views.get(this.currentView);
    if (view) {
      view.render(this.content, analysisResult);
    }
  }

  private updateNavigation(): void {
    if (this.navigation) {
      this.navigation.setContent(this.getNavigationContent());
    }

    if (this.footer) {
      this.footer.setContent(this.getFooterContent());
    }
  }
}
