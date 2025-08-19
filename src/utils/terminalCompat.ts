/**
 * Terminal compatibility utilities for handling different character sets
 * across various terminal environments
 */

export interface CharacterSet {
  // Box drawing characters
  verticalLine: string;
  horizontalLine: string;
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  teeRight: string;
  teeDown: string;
  
  // Tree/branch characters
  treeBranch: string;
  treeEnd: string;
  treeVertical: string;
  treeSpace: string;
  
  // Progress/bar characters
  blockFull: string;
  blockThreeQuarters: string;
  blockHalf: string;
  blockQuarter: string;
  blockEmpty: string;
  
  // Arrow characters
  arrow: string;
}

export const UNICODE_CHARSET: CharacterSet = {
  verticalLine: '│',
  horizontalLine: '─',
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  teeRight: '├',
  teeDown: '┬',
  
  treeBranch: '├── ',
  treeEnd: '└── ',
  treeVertical: '│   ',
  treeSpace: '    ',
  
  blockFull: '█',
  blockThreeQuarters: '▓',
  blockHalf: '▒',
  blockQuarter: '░',
  blockEmpty: ' ',
  
  arrow: '──→'
};

export const ASCII_CHARSET: CharacterSet = {
  verticalLine: '|',
  horizontalLine: '-',
  topLeft: '+',
  topRight: '+',
  bottomLeft: '+',
  bottomRight: '+',
  teeRight: '+',
  teeDown: '+',
  
  treeBranch: '+-- ',
  treeEnd: '+-- ',
  treeVertical: '|   ',
  treeSpace: '    ',
  
  blockFull: '#',
  blockThreeQuarters: '#',
  blockHalf: '*',
  blockQuarter: '.',
  blockEmpty: ' ',
  
  arrow: '-->'
};

export class TerminalCompat {
  private static charset: CharacterSet = UNICODE_CHARSET;
  private static isCompatMode = false;

  /**
   * Detect terminal capabilities and set appropriate character set
   */
  static detectAndSetCharset(): void {
    // Check for known limited terminals
    const term = process.env.TERM?.toLowerCase() || '';
    const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || '';
    const isWindows = process.platform === 'win32';
    const isVSCode = termProgram.includes('vscode');

    // Use ASCII mode for:
    // - Windows Command Prompt
    // - Basic terminals
    // - Environments that explicitly request ASCII
    if (isWindows && !isVSCode && (term.includes('cmd') || term === 'dumb' || !term)) {
      this.setAsciiMode();
    } else {
      this.setUnicodeMode();
    }
  }

  /**
   * Force ASCII character mode for maximum compatibility
   */
  static setAsciiMode(): void {
    this.charset = ASCII_CHARSET;
    this.isCompatMode = true;
  }

  /**
   * Use Unicode characters for rich display
   */
  static setUnicodeMode(): void {
    this.charset = UNICODE_CHARSET;
    this.isCompatMode = false;
  }

  /**
   * Get current character set
   */
  static getCharset(): CharacterSet {
    return this.charset;
  }

  /**
   * Check if running in compatibility mode
   */
  static isCompatibilityMode(): boolean {
    return this.isCompatMode;
  }

  /**
   * Create a progress bar with current character set
   */
  static createProgressBar(value: number, max: number, width: number = 20): string {
    const percentage = Math.max(0, Math.min(1, value / max));
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    return this.charset.blockFull.repeat(filled) + 
           this.charset.blockEmpty.repeat(empty);
  }

  /**
   * Create a horizontal line with current character set
   */
  static createHorizontalLine(width: number): string {
    return this.charset.horizontalLine.repeat(width);
  }
}

// Auto-detect on module load
TerminalCompat.detectAndSetCharset();
