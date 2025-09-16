enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ')}` : '';
    
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();
