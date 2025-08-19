import { AnalysisResult } from '../types/analysis.js';

export interface ExportOptions {
  format: 'json' | 'html' | 'csv' | 'markdown';
  outputPath?: string;
}

export class ExportService {
  public async export(data: AnalysisResult, options: ExportOptions): Promise<string> {
    switch (options.format) {
      case 'json':
        return this.exportToJSON(data);
      case 'html':
        return this.exportToHTML(data);
      case 'csv':
        return this.exportToCSV(data);
      case 'markdown':
        return this.exportToMarkdown(data);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private exportToJSON(data: AnalysisResult): string {
    return JSON.stringify(data, null, 2);
  }

  private exportToHTML(data: AnalysisResult): string {
    // Basic HTML template - can be enhanced later
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Bramble Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .stale { color: red; }
        .current { font-weight: bold; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>🌿 Bramble Analysis Report</h1>
    <h2>Repository: ${data.repository.path}</h2>
    <p>Generated on: ${new Date().toISOString()}</p>
    
    <h3>Overview</h3>
    <ul>
        <li>Total Branches: ${data.repository.totalBranches}</li>
        <li>Stale Branches: ${data.repository.staleBranches}</li>
        <li>Default Branch: ${data.repository.defaultBranch}</li>
    </ul>
    
    <h3>Branch Details</h3>
    <table>
        <tr>
            <th>Branch Name</th>
            <th>Last Activity</th>
            <th>Commits</th>
            <th>Status</th>
        </tr>
        ${data.branches.map(branch => `
        <tr>
            <td class="${branch.current ? 'current' : ''}">${branch.name}</td>
            <td>${branch.lastActivity.toLocaleDateString()}</td>
            <td>${branch.commitCount}</td>
            <td class="${branch.isStale ? 'stale' : ''}">${branch.isStale ? 'STALE' : 'Active'}</td>
        </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
  }

  private exportToCSV(data: AnalysisResult): string {
    const headers = 'Branch Name,Current,Last Activity,Commit Count,Is Stale,Contributors\n';
    const rows = data.branches.map(branch => 
      `"${branch.name}",${branch.current},${branch.lastActivity.toISOString()},${branch.commitCount},${branch.isStale},"${branch.contributors.join(';')}"`
    ).join('\n');
    
    return headers + rows;
  }

  private exportToMarkdown(data: AnalysisResult): string {
    return `
# 🌿 Bramble Analysis Report

**Repository:** ${data.repository.path}  
**Generated:** ${new Date().toISOString()}

## Overview

- **Total Branches:** ${data.repository.totalBranches}
- **Stale Branches:** ${data.repository.staleBranches}
- **Default Branch:** ${data.repository.defaultBranch}

## Statistics

- **Average Branch Age:** ${data.statistics.averageAge.toFixed(1)} days
- **Most Active Branch:** ${data.statistics.mostActive}
- **Least Active Branch:** ${data.statistics.leastActive}
- **Total Commits:** ${data.statistics.totalCommits}

## Branch Details

| Branch | Current | Last Activity | Commits | Status |
|--------|---------|---------------|---------|--------|
${data.branches.map(branch => 
  `| ${branch.name} | ${branch.current ? '✓' : ''} | ${branch.lastActivity.toLocaleDateString()} | ${branch.commitCount} | ${branch.isStale ? '🚨 STALE' : '✅ Active'} |`
).join('\n')}
    `;
  }
}
