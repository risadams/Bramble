import chalk from 'chalk';

export interface ProgressOptions {
  total: number;
  width?: number;
  label?: string;
  showPercentage?: boolean;
  showEta?: boolean;
}

export class ProgressIndicator {
  private total: number;
  private current: number = 0;
  private startTime: number;
  private width: number;
  private label: string;
  private showPercentage: boolean;
  private showEta: boolean;

  constructor(options: ProgressOptions) {
    this.total = options.total;
    this.width = options.width || 40;
    this.label = options.label || 'Progress';
    this.showPercentage = options.showPercentage !== false;
    this.showEta = options.showEta !== false;
    this.startTime = Date.now();
  }

  public update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    this.render(message);
  }

  public increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  public complete(message?: string): void {
    this.current = this.total;
    this.render(message);
    console.log(); // Add new line after completion
  }

  private render(message?: string): void {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const filled = Math.round((percentage / 100) * this.width);
    const empty = this.width - filled;

    const progressBar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    
    let output = `\r${chalk.cyan(this.label)}: [${progressBar}]`;

    if (this.showPercentage) {
      output += ` ${percentage.toFixed(1)}%`;
    }

    output += ` (${this.current}/${this.total})`;

    if (this.showEta && this.current > 0) {
      const elapsed = Date.now() - this.startTime;
      const rate = this.current / elapsed;
      const remaining = (this.total - this.current) / rate;
      
      if (remaining > 0 && isFinite(remaining)) {
        output += ` ETA: ${this.formatTime(remaining)}`;
      }
    }

    if (message) {
      output += ` - ${message}`;
    }

    // Clear the line and write the progress
    process.stdout.write('\x1b[2K' + output);
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export class SpinnerIndicator {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private current = 0;
  private interval: NodeJS.Timeout | null = null;
  private message: string;

  constructor(message: string = 'Loading...') {
    this.message = message;
  }

  public start(): void {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(this.frames[this.current])} ${this.message}`);
      this.current = (this.current + 1) % this.frames.length;
    }, 100);
  }

  public updateMessage(message: string): void {
    this.message = message;
  }

  public stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r\x1b[2K'); // Clear the line
    if (finalMessage) {
      console.log(finalMessage);
    }
  }
}
