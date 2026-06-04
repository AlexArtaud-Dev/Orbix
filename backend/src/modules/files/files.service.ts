import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import { SettingsService } from '../settings/settings.service';

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
  modifiedAt: string;
}

export interface FileStat {
  name: string;
  path: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  itemCount: number | null;
  createdAt: string;
  modifiedAt: string;
  mode: string;
  uid: number;
  gid: number;
  extension: string | null;
}

@Injectable()
export class FilesService {
  constructor(private readonly settings: SettingsService) {}

  private async getRoot(): Promise<string> {
    const s = await this.settings.get();
    return nodePath.resolve(s.filesRoot);
  }

  private safePath(root: string, rel: string): string {
    const clean = rel.replace(/\\/g, '/').replace(/^\/+/, '');
    const abs = nodePath.resolve(nodePath.join(root, clean));
    if (!abs.startsWith(root + nodePath.sep) && abs !== root) {
      throw new ForbiddenException('Path traversal detected');
    }
    return abs;
  }

  async list(relPath: string): Promise<FileEntry[]> {
    const root = await this.getRoot();
    const dir = relPath ? this.safePath(root, relPath) : root;

    if (!fsSync.existsSync(dir)) {
      throw new NotFoundException('Directory not found');
    }

    const raw = await fs.readdir(dir, { withFileTypes: true });
    const entries: FileEntry[] = [];

    await Promise.all(
      raw.map(async (e) => {
        const abs = nodePath.join(dir, e.name);
        const rel = nodePath.relative(root, abs).replace(/\\/g, '/');
        let size: number | null = null;
        let modifiedAt = new Date().toISOString();
        try {
          const stat = await fs.stat(abs);
          modifiedAt = stat.mtime.toISOString();
          if (!e.isDirectory()) size = stat.size;
        } catch {
          // skip unreadable entries
        }
        entries.push({ name: e.name, path: rel, isDir: e.isDirectory(), size, modifiedAt });
      }),
    );

    return entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private async dirStats(abs: string): Promise<{ size: number; itemCount: number }> {
    let size = 0;
    let itemCount = 0;
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true });
      for (const e of entries) {
        itemCount++;
        const child = nodePath.join(abs, e.name);
        if (e.isDirectory()) {
          const sub = await this.dirStats(child);
          size += sub.size;
          itemCount += sub.itemCount;
        } else {
          try {
            const st = await fs.stat(child);
            size += st.size;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip unreadable */ }
    return { size, itemCount };
  }

  async stat(relPath: string): Promise<FileStat> {
    const root = await this.getRoot();
    const abs = relPath ? this.safePath(root, relPath) : root;
    let s: Awaited<ReturnType<typeof fs.stat>>;
    try {
      s = await fs.stat(abs);
    } catch {
      throw new NotFoundException('Path not found');
    }
    const name = nodePath.basename(abs);
    const isDir = s.isDirectory();
    const ext = !isDir ? (nodePath.extname(name) || null) : null;

    let size: number;
    let itemCount: number | null;
    if (isDir) {
      const ds = await this.dirStats(abs);
      size = ds.size;
      itemCount = ds.itemCount;
    } else {
      size = s.size;
      itemCount = null;
    }

    return {
      name,
      path: relPath,
      fullPath: abs,
      isDir,
      size,
      itemCount,
      createdAt: s.birthtime.toISOString(),
      modifiedAt: s.mtime.toISOString(),
      mode: (s.mode & 0o777).toString(8).padStart(3, '0'),
      uid: s.uid,
      gid: s.gid,
      extension: ext,
    };
  }
}
