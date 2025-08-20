/**
 * Enhanced export system types for Bramble
 */

import { AnalysisResult } from './analysis.js';
import { BranchComparison } from './comparison.js';
import { StaleBranchReport } from './staleBranches.js';
import { PerformanceMetrics } from './performance.js';

// Enhanced export formats
export type ExportFormat = 'json' | 'html' | 'csv' | 'markdown' | 'pdf' | 'xml';

// Template configuration
export interface TemplateConfig {
  name: string;
  description: string;
  format: ExportFormat;
  sections: string[];
  dataFilters: DataFilter[];
}

export interface DataFilter {
  type: string;
  target: string;
  criteria?: string;
}

// Export data types
export interface ExportData {
  analysis?: AnalysisResult;
  comparison?: BranchComparison;
  staleAnalysis?: StaleBranchReport;
  performance?: PerformanceMetrics;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  generatedAt: Date;
  generatedBy: string;
  version: string;
  repository: {
    name: string;
    path: string;
    url?: string;
    branch: string;
    commit: string;
  };
  configuration: {
    profile?: string;
    environment?: string;
    options: Record<string, any>;
  };
}

// Export options
export interface ExportOptions {
  format: ExportFormat;
  outputPath?: string;
  template?: string;
  templateData?: Record<string, any>;
  compression?: 'none' | 'gzip' | 'zip';
  includeTimestamp?: boolean;
  overwrite?: boolean;
  metadata?: Partial<ExportMetadata>;
  // PDF-specific options
  pdf?: PDFExportOptions;
  // XML-specific options
  xml?: XMLExportOptions;
  // Export targets
  targets?: ExportTarget[];
}

export interface PDFExportOptions {
  format?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeCharts?: boolean;
  includeTimeline?: boolean;
  pageNumbers?: boolean;
  watermark?: string;
  theme?: 'light' | 'dark';
  fontSize?: number;
  fontFamily?: string;
}

export interface XMLExportOptions {
  pretty?: boolean;
  indent?: string;
  encoding?: 'UTF-8' | 'UTF-16';
  includeSchema?: boolean;
  schemaLocation?: string;
  namespace?: string;
  rootElement?: string;
  includeDeclaration?: boolean;
  stylesheet?: string;
  arrayItemName?: string;
}

// Template system
export interface ExportTemplate {
  name: string;
  description?: string;
  format: ExportFormat;
  template: string;
  variables?: TemplateVariable[];
  metadata?: {
    author?: string;
    version?: string;
    created?: Date;
    modified?: Date;
    tags?: string[];
  };
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description?: string;
  required?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

// Scheduled exports
export interface ScheduledExport {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: ExportSchedule;
  options: ExportOptions;
  targets: ExportTarget[];
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'error' | 'completed';
  errorMessage?: string;
  runCount: number;
  retryCount: number;
  maxRetries: number;
}

export interface ExportSchedule {
  type: 'interval' | 'cron' | 'manual';
  interval?: string; // e.g., '1h', '30m', '1d'
  cron?: string; // cron expression
  timezone?: string;
  runOnStartup?: boolean;
  endDate?: Date;
}

export interface ExportTarget {
  type: 'file' | 'email' | 'webhook' | 's3' | 'ftp' | 'github-release';
  config: ExportTargetConfig;
}

export interface ExportTargetConfig {
  // File target
  path?: string;
  filename?: string;
  
  // Email target
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  emailBody?: string;
  
  // Webhook target
  url?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  
  // S3 target
  bucket?: string;
  key?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  
  // FTP target
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  remotePath?: string;
  
  // GitHub Release target
  repo?: string;
  tag?: string;
  name?: string;
  releaseBody?: string;
  draft?: boolean;
  prerelease?: boolean;
}

// Export results
export interface ExportResult {
  success: boolean;
  outputPath?: string;
  outputPaths?: string[];
  size?: number;
  duration: number;
  format: ExportFormat;
  template?: string;
  error?: string;
  warnings?: string[];
  metadata: ExportMetadata;
}

// Batch export
export interface BatchExportOptions {
  formats: ExportFormat[];
  outputDirectory: string;
  baseFilename?: string;
  parallel?: boolean;
  maxConcurrency?: number;
  includeManifest?: boolean;
  compression?: 'none' | 'zip';
}

export interface BatchExportResult {
  success: boolean;
  results: ExportResult[];
  manifestPath?: string;
  archivePath?: string;
  totalSize: number;
  duration: number;
  errors: string[];
  warnings: string[];
}

// Export statistics and monitoring
export interface ExportStatistics {
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  averageDuration: number;
  totalSize: number;
  formatBreakdown: Record<ExportFormat, number>;
  lastExport?: Date;
  mostUsedFormat: ExportFormat;
  errorRate: number;
}

// Template validation
export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
  variables: TemplateVariable[];
}

export interface TemplateValidationError {
  line?: number;
  column?: number;
  message: string;
  variable?: string;
  severity: 'error' | 'warning';
}

export interface TemplateValidationWarning {
  line?: number;
  column?: number;
  message: string;
  variable?: string;
  suggestion?: string;
}

// Export events
export interface ExportEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  exportId: string;
  timestamp: Date;
  progress?: number; // 0-100
  message?: string;
  data?: any;
}

// Built-in template names
export const BUILTIN_TEMPLATES = {
  // HTML templates
  'default-html': 'Default HTML Report',
  'detailed-html': 'Detailed HTML Report with Charts',
  'minimal-html': 'Minimal HTML Summary',
  'dashboard-html': 'Interactive Dashboard',
  
  // PDF templates
  'executive-pdf': 'Executive Summary PDF',
  'technical-pdf': 'Technical Detailed PDF',
  'timeline-pdf': 'Timeline Analysis PDF',
  'comparison-pdf': 'Branch Comparison PDF',
  
  // XML templates
  'standard-xml': 'Standard XML Format',
  'detailed-xml': 'Detailed XML with Metadata',
  'compact-xml': 'Compact XML Format',
  
  // Markdown templates
  'github-md': 'GitHub-style Markdown',
  'wiki-md': 'Wiki-style Markdown',
  'technical-md': 'Technical Documentation',
} as const;

export type BuiltinTemplateName = keyof typeof BUILTIN_TEMPLATES;
