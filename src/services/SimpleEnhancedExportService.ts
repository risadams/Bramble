/**
 * Enhanced export service with PDF, XML, and template support
 * Simplified version focusing on core functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  ExportData, 
  ExportOptions, 
  ExportFormat, 
  PDFExportOptions, 
  XMLExportOptions,
  ExportResult 
} from '../types/export.js';
import { ExportService } from './ExportService.js';

export class EnhancedExportService extends ExportService {
  private templates: Map<string, any> = new Map();

  constructor() {
    super();
    this.loadBuiltInTemplates();
  }

  /**
   * Export data with enhanced options including PDF and XML
   */
  public async exportData(
    data: ExportData,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      let output: string;
      
      // Generate output based on format
      switch (options.format) {
        case 'pdf':
          output = await this.generatePDFContent(data, options.pdf);
          break;
        case 'xml':
          output = await this.generateXML(data, options.xml);
          break;
        case 'json':
          output = this.generateJSON(data);
          break;
        case 'html':
          output = this.generateHTML(data);
          break;
        case 'csv':
          output = this.generateCSV(data);
          break;
        case 'markdown':
          output = this.generateMarkdown(data);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Save to file if path specified
      let outputPath: string | undefined;
      if (options.outputPath) {
        outputPath = await this.saveToFile(output, options.outputPath);
      }

      const duration = Date.now() - startTime;

      const result: ExportResult = {
        success: true,
        format: options.format,
        size: Buffer.byteLength(output, 'utf8'),
        duration,
        metadata: data.metadata
      };

      if (outputPath) {
        result.outputPath = outputPath;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        format: options.format,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        metadata: data.metadata
      };
    }
  }

  /**
   * Generate PDF content (placeholder for now)
   */
  private async generatePDFContent(
    data: ExportData,
    options: PDFExportOptions = {}
  ): Promise<string> {
    // For now, generate HTML that could be converted to PDF
    const html = this.generateHTML(data);
    
    // Add PDF-specific styling
    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bramble Analysis Report</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20mm;
            font-size: 12px;
            line-height: 1.4;
        }
        .header { 
            border-bottom: 2px solid #333; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
        }
        .section { 
            margin-bottom: 30px; 
            page-break-inside: avoid; 
        }
        .section h2 { 
            color: #333; 
            border-bottom: 1px solid #ccc; 
            padding-bottom: 5px; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 10px 0; 
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
        }
        th { 
            background-color: #f5f5f5; 
            font-weight: bold; 
        }
        .metric { 
            display: inline-block; 
            margin: 10px; 
            padding: 15px; 
            border: 1px solid #ddd; 
            border-radius: 5px; 
            background: #f9f9f9; 
        }
        .metric .value { 
            font-size: 18px; 
            font-weight: bold; 
            color: #333; 
        }
        .metric .label { 
            font-size: 12px; 
            color: #666; 
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
    
    return pdfHtml;
  }

  /**
   * Generate XML export
   */
  private async generateXML(
    data: ExportData,
    options: XMLExportOptions = {}
  ): Promise<string> {
    const encoding = options.encoding || 'UTF-8';
    const pretty = options.pretty !== false;
    const includeDeclaration = options.includeDeclaration !== false;
    
    let xml = '';
    
    if (includeDeclaration) {
      xml += `<?xml version="1.0" encoding="${encoding}"?>\n`;
    }

    if (options.stylesheet) {
      xml += `<?xml-stylesheet type="text/xsl" href="${options.stylesheet}"?>\n`;
    }

    xml += this.objectToXML(data, 'bramble-export', pretty ? 0 : -1, options);

    return xml;
  }

  /**
   * Convert object to XML recursively
   */
  private objectToXML(
    obj: any,
    rootName: string,
    indentLevel: number = 0,
    options: XMLExportOptions = {}
  ): string {
    const indent = indentLevel >= 0 ? '  '.repeat(indentLevel) : '';
    const newline = indentLevel >= 0 ? '\n' : '';
    
    if (obj === null || obj === undefined) {
      return `${indent}<${rootName} />${newline}`;
    }

    if (typeof obj !== 'object') {
      const escaped = this.escapeXML(String(obj));
      return `${indent}<${rootName}>${escaped}</${rootName}>${newline}`;
    }

    if (Array.isArray(obj)) {
      let xml = `${indent}<${rootName}>${newline}`;
      obj.forEach((item) => {
        const itemName = options.arrayItemName || 'item';
        xml += this.objectToXML(item, itemName, indentLevel + 1, options);
      });
      xml += `${indent}</${rootName}>${newline}`;
      return xml;
    }

    if (obj instanceof Date) {
      return `${indent}<${rootName}>${obj.toISOString()}</${rootName}>${newline}`;
    }

    let xml = `${indent}<${rootName}>${newline}`;
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeXMLTagName(key);
      xml += this.objectToXML(value, sanitizedKey, indentLevel + 1, options);
    }
    
    xml += `${indent}</${rootName}>${newline}`;
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Sanitize XML tag names
   */
  private sanitizeXMLTagName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_');
  }

  /**
   * Generate JSON export
   */
  private generateJSON(data: ExportData): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate HTML export
   */
  private generateHTML(data: ExportData): string {
    const sections: string[] = [];

    // Header section
    sections.push(`
      <div class="header">
        <h1>Bramble Git Analysis Report</h1>
        <p>Generated on ${data.metadata.generatedAt.toLocaleString()}</p>
        <p>Repository: ${data.metadata.repository.name} (${data.metadata.repository.branch})</p>
      </div>
    `);

    // Analysis section
    if (data.analysis) {
      sections.push(`
        <div class="section">
          <h2>Repository Analysis</h2>
          <div class="metric">
            <div class="value">${data.analysis.repository.totalBranches}</div>
            <div class="label">Total Branches</div>
          </div>
          <div class="metric">
            <div class="value">${data.analysis.statistics.totalCommits}</div>
            <div class="label">Total Commits</div>
          </div>
          <div class="metric">
            <div class="value">${data.analysis.statistics.totalContributors}</div>
            <div class="label">Contributors</div>
          </div>
        </div>
      `);
    }

    // Branch comparison section
    if (data.comparison) {
      sections.push(`
        <div class="section">
          <h2>Branch Comparison</h2>
          <p>Comparing ${data.comparison.sourceBranch} with ${data.comparison.targetBranch}</p>
          <div class="metric">
            <div class="value">${data.comparison.ahead}</div>
            <div class="label">Commits Ahead</div>
          </div>
          <div class="metric">
            <div class="value">${data.comparison.behind}</div>
            <div class="label">Commits Behind</div>
          </div>
        </div>
      `);
    }

    // Stale branches section
    if (data.staleAnalysis) {
      const veryStaleCount = data.staleAnalysis.riskSummary.high + data.staleAnalysis.riskSummary.critical;
      sections.push(`
        <div class="section">
          <h2>Stale Branch Analysis</h2>
          <div class="metric">
            <div class="value">${data.staleAnalysis.staleBranches.length}</div>
            <div class="label">Stale Branches</div>
          </div>
          <div class="metric">
            <div class="value">${veryStaleCount}</div>
            <div class="label">High Risk Branches</div>
          </div>
        </div>
      `);
    }

    // Performance section
    if (data.performance) {
      const avgGitOpTime = data.performance.gitOperations.length > 0 
        ? data.performance.gitOperations.reduce((sum, op) => sum + op.duration, 0) / data.performance.gitOperations.length
        : 0;
      
      sections.push(`
        <div class="section">
          <h2>Performance Metrics</h2>
          <div class="metric">
            <div class="value">${(data.performance.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</div>
            <div class="label">Memory Used</div>
          </div>
          <div class="metric">
            <div class="value">${avgGitOpTime.toFixed(0)}ms</div>
            <div class="label">Avg Git Op Time</div>
          </div>
        </div>
      `);
    }

    return sections.join('\n');
  }

  /**
   * Generate CSV export
   */
  private generateCSV(data: ExportData): string {
    const lines: string[] = [];
    
    // Add metadata
    lines.push('Section,Metric,Value');
    lines.push(`Metadata,Generated At,${data.metadata.generatedAt.toISOString()}`);
    lines.push(`Metadata,Repository,${data.metadata.repository.name}`);
    lines.push(`Metadata,Branch,${data.metadata.repository.branch}`);
    
    // Add analysis data
    if (data.analysis) {
      lines.push(`Analysis,Total Branches,${data.analysis.repository.totalBranches}`);
      lines.push(`Analysis,Total Commits,${data.analysis.statistics.totalCommits}`);
      lines.push(`Analysis,Contributors,${data.analysis.statistics.totalContributors}`);
    }
    
    // Add comparison data
    if (data.comparison) {
      lines.push(`Comparison,Source Branch,${data.comparison.sourceBranch}`);
      lines.push(`Comparison,Target Branch,${data.comparison.targetBranch}`);
      lines.push(`Comparison,Commits Ahead,${data.comparison.ahead}`);
      lines.push(`Comparison,Commits Behind,${data.comparison.behind}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Generate Markdown export
   */
  private generateMarkdown(data: ExportData): string {
    const sections: string[] = [];

    // Header
    sections.push('# Bramble Git Analysis Report\n');
    sections.push(`**Generated:** ${data.metadata.generatedAt.toLocaleString()}`);
    sections.push(`**Repository:** ${data.metadata.repository.name}`);
    sections.push(`**Branch:** ${data.metadata.repository.branch}\n`);

    // Analysis section
    if (data.analysis) {
      sections.push('## Repository Analysis\n');
      sections.push(`- **Total Branches:** ${data.analysis.repository.totalBranches}`);
      sections.push(`- **Total Commits:** ${data.analysis.statistics.totalCommits}`);
      sections.push(`- **Contributors:** ${data.analysis.statistics.totalContributors}\n`);
    }

    // Branch comparison
    if (data.comparison) {
      sections.push('## Branch Comparison\n');
      sections.push(`Comparing \`${data.comparison.sourceBranch}\` with \`${data.comparison.targetBranch}\``);
      sections.push(`- **Commits Ahead:** ${data.comparison.ahead}`);
      sections.push(`- **Commits Behind:** ${data.comparison.behind}\n`);
    }

    // Stale branches
    if (data.staleAnalysis) {
      const veryStaleCount = data.staleAnalysis.riskSummary.high + data.staleAnalysis.riskSummary.critical;
      sections.push('## Stale Branch Analysis\n');
      sections.push(`- **Stale Branches:** ${data.staleAnalysis.staleBranches.length}`);
      sections.push(`- **High Risk Branches:** ${veryStaleCount}\n`);
    }

    return sections.join('\n');
  }

  /**
   * Load built-in templates
   */
  private loadBuiltInTemplates(): void {
    // Executive Summary Template
    this.templates.set('executive-summary', {
      name: 'Executive Summary',
      description: 'High-level overview focusing on key metrics',
      format: 'pdf'
    });

    // Technical Report Template
    this.templates.set('technical-report', {
      name: 'Technical Report',
      description: 'Detailed technical analysis with full data',
      format: 'html'
    });

    // Cleanup Report Template
    this.templates.set('cleanup-report', {
      name: 'Cleanup Report',
      description: 'Focus on stale branches and cleanup recommendations',
      format: 'markdown'
    });
  }

  /**
   * Save content to file
   */
  private async saveToFile(
    content: string,
    outputPath: string
  ): Promise<string> {
    const directory = path.dirname(outputPath);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
    return outputPath;
  }

  /**
   * Get available templates
   */
  public getTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template info
   */
  public getTemplateInfo(templateName: string): any {
    return this.templates.get(templateName);
  }
}
