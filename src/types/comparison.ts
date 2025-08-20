export interface FileDiff {
  path: string;
  oldPath?: string; // For renamed files
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary: boolean;
  similarityIndex?: number; // For renamed/copied files
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflictingFiles: string[];
  conflictTypes: {
    contentConflicts: number;
    renameConflicts: number;
    deleteModifyConflicts: number;
    addAddConflicts: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionSuggestions: string[];
}

export interface MergeComplexity {
  score: number; // 0-100, higher = more complex
  factors: {
    filesChanged: number;
    linesChanged: number;
    conflictPotential: number;
    authorDiversity: number;
    timeSpan: number; // days between branches
    binaryFiles: number;
  };
  category: 'trivial' | 'simple' | 'moderate' | 'complex' | 'high-risk';
  recommendations: string[];
}

export interface BranchComparison {
  sourceBranch: string;
  targetBranch: string;
  commonAncestor: string;
  ahead: number;
  behind: number;
  diverged: boolean;
  files: FileDiff[];
  conflicts: ConflictAnalysis;
  complexity: MergeComplexity;
  summary: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
    netChange: number;
    affectedDirectories: string[];
    languageBreakdown: { [language: string]: number };
  };
  timeline: {
    firstDivergence: Date;
    lastActivity: Date;
    commits: {
      source: number;
      target: number;
    };
  };
}

export interface ComparisonOptions {
  includeContext?: number; // Lines of context around changes
  ignoreWhitespace?: boolean;
  detectRenames?: boolean;
  maxFiles?: number; // Limit for performance
  conflictAnalysis?: boolean;
  complexityAnalysis?: boolean;
}
