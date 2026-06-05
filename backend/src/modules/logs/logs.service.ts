import { Injectable } from '@nestjs/common';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { type LogEntry } from './logs.writer';
import type { ListLogsQuery } from './logs.types';

const LOG_DIR = process.env.NODE_ENV === 'production' ? '/app/logs' : './logs';

@Injectable()
export class LogsService {
  async list(query: ListLogsQuery) {
    const limit = Math.min(query.limit ?? 50, 200);
    const entries = await this.readAllEntries(query);

    entries.sort((a, b) => b.ts.localeCompare(a.ts));

    let startIdx = 0;
    if (query.cursor) {
      const idx = entries.findIndex((e) => e.ts === query.cursor);
      if (idx !== -1) startIdx = idx + 1;
    }

    const page = entries.slice(startIdx, startIdx + limit + 1);
    const hasNext = page.length > limit;

    return {
      data: page.slice(0, limit),
      nextCursor: hasNext ? page[limit - 1].ts : null,
    };
  }

  private async readAllEntries(query: ListLogsQuery): Promise<LogEntry[]> {
    if (!existsSync(LOG_DIR)) return [];

    const files = readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .filter((f) => !query.category || f.startsWith(query.category));

    const results = await Promise.all(
      files.map((f) => this.readFile(join(LOG_DIR, f))),
    );

    return results.flat().filter((e) => this.matchesFilter(e, query));
  }

  private readFile(path: string): Promise<LogEntry[]> {
    return new Promise((resolve) => {
      const entries: LogEntry[] = [];
      if (!existsSync(path)) return resolve(entries);

      const rl = createInterface({ input: createReadStream(path) });
      rl.on('line', (line) => {
        try {
          entries.push(JSON.parse(line) as LogEntry);
        } catch {
          // Skip malformed lines
        }
      });
      rl.on('close', () => resolve(entries));
      rl.on('error', () => resolve(entries));
    });
  }

  private matchesFilter(entry: LogEntry, query: ListLogsQuery): boolean {
    if (query.category && entry.category !== query.category) return false;
    if (query.level && entry.level !== query.level) return false;
    if (query.from && entry.ts < query.from) return false;
    if (query.to && entry.ts > query.to) return false;
    return true;
  }
}
