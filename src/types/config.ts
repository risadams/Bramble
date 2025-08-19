export interface BrambleConfig {
  staleDays: number;
  defaultExportFormat: 'json' | 'html' | 'csv' | 'markdown';
  theme: 'dark' | 'light';
  maxBranches: number;
  includeRemoteBranches: boolean;
}

export const DEFAULT_CONFIG: BrambleConfig = {
  staleDays: 30,
  defaultExportFormat: 'json',
  theme: 'dark',
  maxBranches: 100,
  includeRemoteBranches: true
};
