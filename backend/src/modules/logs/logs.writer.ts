import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  backupId?: string;
}

export interface LogContext {
  backupId?: string;
}

@Injectable()
export class LogsWriter {
  constructor(private readonly prisma: PrismaService) {}

  write(entry: Omit<LogEntry, 'ts'>) {
    // Fire-and-forget: never block callers on log I/O
    this.prisma.log
      .create({
        data: {
          ts: new Date(),
          level: entry.level,
          category: entry.category,
          code: entry.code,
          msg: entry.msg,
          detail: entry.detail ?? null,
          backupId: entry.backupId ?? null,
        },
      })
      .catch(() => {
        // Swallow — logging must never crash the app
      });
  }

  info(category: LogCategory, code: string, msg: string, detail?: string, ctx?: LogContext) {
    this.write({ level: 'INFO', category, code, msg, detail, backupId: ctx?.backupId });
  }

  warn(category: LogCategory, code: string, msg: string, detail?: string, ctx?: LogContext) {
    this.write({ level: 'WARN', category, code, msg, detail, backupId: ctx?.backupId });
  }

  error(category: LogCategory, code: string, msg: string, detail?: string, ctx?: LogContext) {
    this.write({ level: 'ERROR', category, code, msg, detail, backupId: ctx?.backupId });
  }
}
