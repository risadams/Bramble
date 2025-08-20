/**
 * Enhanced Visualization Types and Interfaces
 * 
 * Comprehensive type definitions for advanced visualization features
 */

import { BranchInfo, AnalysisResult } from './analysis.js';

export interface VisualizationConfig {
  // ASCII Art Configuration
  ascii: {
    useEmojis: boolean;
    useColors: boolean;
    compactMode: boolean;
    maxWidth: number;
  };
  
  // Chart Configuration
  charts: {
    showLegend: boolean;
    showGridlines: boolean;
    barHeight: number;
    maxBars: number;
  };
  
  // Heatmap Configuration
  heatmap: {
    days: number;
    intensityLevels: number;
    showWeekends: boolean;
    showDayLabels: boolean;
  };
  
  // Tree Configuration
  tree: {
    maxDepth: number;
    showCommitCounts: boolean;
    showAge: boolean;
    sortBy: 'name' | 'age' | 'commits' | 'activity';
  };
}

export interface ChartData {
  label: string;
  value: number;
  maxValue?: number;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
  percentage?: number;
}

export interface HeatmapCell {
  date: string;
  value: number;
  intensity: number;
  dayOfWeek: number;
  weekOfYear: number;
}

export interface TreeNodeEnhanced {
  name: string;
  branch: BranchInfo;
  children: TreeNodeEnhanced[];
  level: number;
  displayName: string;
  icon: string;
  metadata: {
    age: number;
    commits: number;
    author: string;
    status: 'active' | 'stale' | 'conflicted' | 'merged';
  };
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  layout: 'tree' | 'circular' | 'force' | 'hierarchical';
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'branch' | 'commit' | 'merge' | 'tag';
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  metadata: Record<string, any>;
}

export interface NetworkEdge {
  from: string;
  to: string;
  type: 'parent' | 'merge' | 'branch' | 'tag';
  weight?: number;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface Dashboard {
  title: string;
  sections: DashboardSection[];
  layout: 'vertical' | 'horizontal' | 'grid';
  width: number;
  height: number;
}

export interface DashboardSection {
  title: string;
  type: 'chart' | 'table' | 'heatmap' | 'tree' | 'text' | 'metric';
  content: any;
  position: { x: number; y: number; width: number; height: number };
}

export interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  status?: 'success' | 'warning' | 'error' | 'info';
  description?: string;
}

export interface TimelineEvent {
  date: Date;
  type: 'commit' | 'branch' | 'merge' | 'tag' | 'release';
  title: string;
  description?: string;
  branch?: string;
  author?: string;
  impact?: 'major' | 'minor' | 'patch';
}

export interface ActivityPattern {
  hourly: number[];
  daily: number[];
  weekly: number[];
  monthly: number[];
  contributors: Map<string, number[]>;
}

export interface VisualizationTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    text: string;
  };
  symbols: {
    active: string;
    stale: string;
    conflict: string;
    merged: string;
    current: string;
    remote: string;
  };
  charts: {
    fillChar: string;
    emptyChar: string;
    borderChar: string;
  };
}

// Default configuration
export const DEFAULT_VISUALIZATION_CONFIG: VisualizationConfig = {
  ascii: {
    useEmojis: true,
    useColors: true,
    compactMode: false,
    maxWidth: 120
  },
  charts: {
    showLegend: true,
    showGridlines: false,
    barHeight: 1,
    maxBars: 20
  },
  heatmap: {
    days: 90,
    intensityLevels: 4,
    showWeekends: true,
    showDayLabels: true
  },
  tree: {
    maxDepth: 5,
    showCommitCounts: true,
    showAge: true,
    sortBy: 'activity'
  }
};

// Default dark theme
export const DARK_THEME: VisualizationTheme = {
  name: 'dark',
  colors: {
    primary: '#61dafb',
    secondary: '#282c34',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    background: '#1e1e1e',
    text: '#ffffff'
  },
  symbols: {
    active: '🌿',
    stale: '🚨',
    conflict: '⚠️',
    merged: '✅',
    current: '📍',
    remote: '🌐'
  },
  charts: {
    fillChar: '█',
    emptyChar: '░',
    borderChar: '│'
  }
};

// Light theme alternative
export const LIGHT_THEME: VisualizationTheme = {
  name: 'light',
  colors: {
    primary: '#0066cc',
    secondary: '#f5f5f5',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    background: '#ffffff',
    text: '#333333'
  },
  symbols: {
    active: '●',
    stale: '○',
    conflict: '✗',
    merged: '✓',
    current: '→',
    remote: '↑'
  },
  charts: {
    fillChar: '■',
    emptyChar: '□',
    borderChar: '|'
  }
};

export type VisualizationType = 
  | 'tree'
  | 'heatmap' 
  | 'timeline'
  | 'network'
  | 'dashboard'
  | 'charts'
  | 'table'
  | 'calendar'
  | 'flow'
  | 'gantt';

export interface VisualizationRequest {
  type: VisualizationType;
  config?: Partial<VisualizationConfig>;
  theme?: VisualizationTheme;
  data: AnalysisResult;
  filters?: {
    branches?: string[];
    dateRange?: { start: Date; end: Date };
    contributors?: string[];
    branchTypes?: string[];
  };
}
