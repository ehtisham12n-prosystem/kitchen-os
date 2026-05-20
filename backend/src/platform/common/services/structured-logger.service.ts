import { Injectable } from '@nestjs/common';

type LogLevel = 'log' | 'warn' | 'error';

@Injectable()
export class StructuredLoggerService {
  log(message: string, context: Record<string, unknown> = {}) {
    this.write('log', message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}) {
    this.write('warn', message, context);
  }

  error(message: string, context: Record<string, unknown> = {}) {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context: Record<string, unknown>) {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };

    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
      return;
    }

    if (level === 'warn') {
      console.warn(serialized);
      return;
    }

    console.log(serialized);
  }
}
