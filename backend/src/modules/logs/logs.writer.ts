import { Injectable } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogCategory =
  | 'auth'
  | 'backup'
  | 'mail'
  | 'scheduler'
  | 'system'
  | 'vault';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  category: LogCategory;
  code: string;
  msg: string;
  detail?: string;
}

const LOG_DIR = process.env.NODE_ENV === 'production' ? '/app/logs' : './logs';

@Injectable()
export class LogsWriter {
  write(entry: Omit<LogEntry, 'ts'>) {
    const full: LogEntry = { ts: new Date().toISOString(), ...entry };
    const date = full.ts.slice(0, 10);
    const file = join(LOG_DIR, `${entry.category}-${date}.log`);
    try {
      mkdirSync(LOG_DIR, { recursive: true });
      appendFileSync(file, JSON.stringify(full) + '\n', 'utf8');
    } catch {
      // Swallow write errors to avoid cascading failures
    }
  }

  info(category: LogCategory, code: string, msg: string, detail?: string) {
    this.write({ level: 'INFO', category, code, msg, detail });
  }

  warn(category: LogCategory, code: string, msg: string, detail?: string) {
    this.write({ level: 'WARN', category, code, msg, detail });
  }

  error(category: LogCategory, code: string, msg: string, detail?: string) {
    this.write({ level: 'ERROR', category, code, msg, detail });
  }
}
