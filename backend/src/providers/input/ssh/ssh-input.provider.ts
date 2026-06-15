import { Injectable } from '@nestjs/common';
import { VaultService } from '../../../modules/vault/vault.service';
import type {
  IInputProvider,
  InputFetchContext,
} from '../input-provider.interface';
import type { ProviderMeta, FileToArchive } from '../../providers.types';
import type { InputRow } from '../../../modules/input/input.types';
import type { SshPayload } from '../../../modules/vault/vault.types';
import type { SshInputConfig } from './ssh-input.types';

function isDir(attrs: import('ssh2').Attributes): boolean {
  return ((attrs.mode ?? 0) & 0o170000) === 0o040000;
}

function resolveDatePattern(template: string, now: Date): RegExp {
  const resolved = template
    .replace(/\{YYYY\}/g, String(now.getFullYear()))
    .replace(/\{MM\}/g, String(now.getMonth() + 1).padStart(2, '0'))
    .replace(/\{DD\}/g, String(now.getDate()).padStart(2, '0'))
    .replace(/\{HH\}/g, String(now.getHours()).padStart(2, '0'));

  const toRegexPart = (s: string): string => {
    try {
      new RegExp(`^${s}$`);
      return s;
    } catch {
      /* treat as glob */
    }
    return s
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
  };

  const parts = resolved
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(toRegexPart);
  return new RegExp(`^(${parts.join('|')})$`);
}

function buildConnConfig(payload: SshPayload) {
  const password =
    payload.subtype === 'user_password' ? payload.password : undefined;
  return {
    host: payload.host,
    port: payload.port,
    username: payload.username,
    readyTimeout: 30000,
    tryKeyboard: payload.subtype === 'user_password',
    ...(payload.subtype === 'user_password'
      ? { password }
      : {
          privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
          passphrase: payload.passphrase,
        }),
    onKeyboard: password,
  };
}

@Injectable()
export class SshInputProvider implements IInputProvider {
  readonly type = 'ssh';
  readonly meta: ProviderMeta = {
    type: 'ssh',
    label: 'SSH / SFTP',
    icon: 'server',
    description: 'Fetch files from a remote server via SFTP.',
  };

  constructor(private readonly vault: VaultService) {}

  async fetch(
    input: InputRow,
    context: InputFetchContext,
  ): Promise<FileToArchive[]> {
    if (!input.vaultId) throw new Error('SSH Input requires an SSH vault');
    const config = input.config as unknown as SshInputConfig;
    const payload = await this.vault.getSshPayload(input.vaultId);
    const now = new Date();

    return this.withSftp(payload, async (sftp) => {
      const files: FileToArchive[] = [];
      for (const source of config.sources ?? []) {
        const regex = source.namePattern
          ? resolveDatePattern(source.namePattern, now)
          : null;
        if (source.isDirectory) {
          await this.collectDir(
            sftp,
            source.path,
            source.path,
            source.recursive,
            regex,
            files,
            context.maxSizeMb,
          );
        } else {
          const buf = await this.readFile(sftp, source.path);
          if (buf.length <= context.maxSizeMb * 1024 * 1024) {
            files.push({
              buffer: buf,
              arc: source.path.split('/').pop() ?? 'file',
            });
          }
        }
      }
      return files;
    });
  }

  async test(
    input: InputRow,
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!input.vaultId)
      return { success: false, error: 'No SSH vault configured' };
    const config = input.config as unknown as SshInputConfig;
    if (!config.sources?.length)
      return { success: false, error: 'No sources configured' };

    try {
      const payload = await this.vault.getSshPayload(input.vaultId);
      const errors: string[] = [];

      await this.withSftp(payload, async (sftp) => {
        for (const source of config.sources) {
          const attrs = await this.statAttrs(sftp, source.path).catch(
            () => null,
          );
          if (!attrs) {
            errors.push(`"${source.path}": not found or not accessible`);
            continue;
          }
          const isDir = ((attrs.mode ?? 0) & 0o170000) === 0o040000;
          if (source.isDirectory && !isDir) {
            errors.push(
              `"${source.path}": expected a directory but found a file`,
            );
            continue;
          }
          if (!source.isDirectory && isDir) {
            errors.push(
              `"${source.path}": expected a file but found a directory`,
            );
            continue;
          }
          if (source.isDirectory) {
            await new Promise<void>((res, rej) =>
              sftp.readdir(source.path, (e) =>
                e
                  ? rej(
                      new Error(
                        `"${source.path}": cannot list directory — ${e.message}`,
                      ),
                    )
                  : res(),
              ),
            ).catch((e: Error) => errors.push(e.message));
          } else {
            if (!((attrs.mode ?? 0) & 0o444)) {
              errors.push(`"${source.path}": file has no read permissions`);
            }
          }
        }
      });

      if (errors.length > 0)
        return { success: false, error: errors.join(' | ') };
      return { success: true, count: config.sources.length };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  private withSftp<T>(
    payload: SshPayload,
    fn: (sftp: import('ssh2').SFTPWrapper) => Promise<T>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
        const conn = new Client();
        const cfg = buildConnConfig(payload);
        const password = (cfg as { onKeyboard?: string }).onKeyboard;

        conn
          .on('keyboard-interactive', (_n, _i, _l, _p, finish) =>
            finish([password ?? '']),
          )
          .on('ready', () => {
            conn.sftp((err, sftp) => {
              if (err) {
                conn.end();
                reject(err);
                return;
              }
              fn(sftp)
                .then((result) => {
                  conn.end();
                  resolve(result);
                })
                .catch((e: unknown) => {
                  conn.end();
                  reject(e instanceof Error ? e : new Error(String(e)));
                });
            });
          })
          .on('error', reject)
          .connect({
            host: cfg.host,
            port: cfg.port,
            username: cfg.username,
            readyTimeout: cfg.readyTimeout,
            tryKeyboard: cfg.tryKeyboard,
            ...(payload.subtype === 'user_password'
              ? { password: payload.password }
              : {
                  privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                  passphrase: payload.passphrase,
                }),
          });
      });
    });
  }

  private async collectDir(
    sftp: import('ssh2').SFTPWrapper,
    rootPath: string,
    dirPath: string,
    recursive: boolean,
    filter: RegExp | null,
    out: FileToArchive[],
    maxSizeMb: number,
  ): Promise<void> {
    const entries = await this.readdir(sftp, dirPath);
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.filename}`;
      if (isDir(entry.attrs)) {
        if (recursive)
          await this.collectDir(
            sftp,
            rootPath,
            fullPath,
            recursive,
            filter,
            out,
            maxSizeMb,
          );
      } else {
        if (filter && !filter.test(entry.filename)) continue;
        if ((entry.attrs.size ?? 0) > maxSizeMb * 1024 * 1024) continue;
        const buf = await this.readFile(sftp, fullPath);
        const arcPath = fullPath.slice(rootPath.length).replace(/^\//, '');
        out.push({ buffer: buf, arc: arcPath || entry.filename });
      }
    }
  }

  private readdir(
    sftp: import('ssh2').SFTPWrapper,
    path: string,
  ): Promise<import('ssh2').FileEntry[]> {
    return new Promise((res, rej) =>
      sftp.readdir(path, (err, list) => (err ? rej(err) : res(list))),
    );
  }

  private readFile(
    sftp: import('ssh2').SFTPWrapper,
    path: string,
  ): Promise<Buffer> {
    return new Promise((res, rej) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(path);
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => res(Buffer.concat(chunks)));
      stream.on('error', rej);
    });
  }

  private statAttrs(
    sftp: import('ssh2').SFTPWrapper,
    path: string,
  ): Promise<import('ssh2').Attributes> {
    return new Promise((res, rej) =>
      sftp.stat(path, (err, attrs) =>
        err
          ? rej(new Error(`Cannot access "${path}": ${err.message}`))
          : res(attrs),
      ),
    );
  }
}
