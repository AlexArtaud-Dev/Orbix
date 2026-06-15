import { Injectable } from '@nestjs/common';
import { VaultService } from '../../../modules/vault/vault.service';
import { LogsWriter } from '../../../modules/logs/logs.writer';
import type { IOutputProvider } from '../output-provider.interface';
import type {
  ProviderMeta,
  ArchiveResult,
  OutputRow,
} from '../../providers.types';
import type {
  SshPayload,
  SshUserPasswordPayload,
} from '../../../modules/vault/vault.types';
import { SshOutputFailedException } from '../../../common/exceptions';

@Injectable()
export class SshOutputProvider implements IOutputProvider {
  readonly type = 'ssh';
  readonly meta: ProviderMeta = {
    type: 'ssh',
    label: 'SSH / SFTP',
    icon: 'server',
    description: 'Upload the backup archive to a remote server via SFTP.',
  };

  constructor(
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  async send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
  ): Promise<void> {
    const payload = await this.vault.getSshPayload(output.vaultId);
    const remotePath = (
      output.pathOverride?.trim() || payload.defaultPath
    ).replace(/\/+$/, '');
    const remoteFile = `${remotePath}/${archive.filename}`;

    if (payload.useSudo) {
      await this.uploadViaSudoTee(
        payload,
        archive.buffer,
        remoteFile,
        backupId,
        backupName,
      );
    } else {
      await this.uploadViaSftp(
        payload,
        archive.buffer,
        remoteFile,
        backupId,
        backupName,
      );
    }
  }

  private uploadViaSftp(
    payload: SshPayload,
    buffer: Buffer,
    remoteFile: string,
    backupId: string,
    backupName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
        console.log(
          `[SSH OUTPUT] Uploading backup "${backupName}" (${backupId})`,
        );
        console.log(
          `[SSH OUTPUT] Target: ${payload.username}@${payload.host}:${payload.port}`,
        );
        console.log(`[SSH OUTPUT] Remote file: ${remoteFile}`);
        console.log(`[SSH OUTPUT] Auth method: ${payload.subtype}`);
        console.log(`[SSH OUTPUT] Buffer size: ${buffer.length} bytes`);

        const conn = new Client();
        const password =
          payload.subtype === 'user_password' ? payload.password : undefined;
        const connConfig: Parameters<
          InstanceType<typeof Client>['connect']
        >[0] = {
          host: payload.host,
          port: payload.port,
          username: payload.username,
          readyTimeout: 30000,
          debug: (msg: string) => console.log('[SSH2 DEBUG]', msg),
          tryKeyboard: payload.subtype === 'user_password',
          ...(payload.subtype === 'user_password'
            ? { password }
            : {
                privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                passphrase: payload.passphrase,
              }),
        };

        conn.on(
          'keyboard-interactive',
          (_name, _instructions, _lang, _prompts, finish) => {
            console.log(
              '[SSH OUTPUT] keyboard-interactive challenge — replying with password',
            );
            finish([password ?? '']);
          },
        );

        conn.on('ready', () => {
          console.log('[SSH OUTPUT] Connection ready, opening SFTP…');
          conn.sftp((err, sftp) => {
            if (err) {
              console.error('[SSH OUTPUT] SFTP open error:', err.message, err);
              conn.end();
              return reject(
                new SshOutputFailedException(payload.host, err.message),
              );
            }
            console.log('[SSH OUTPUT] SFTP open, writing stream…');
            const writeStream = sftp.createWriteStream(remoteFile);
            writeStream.on('error', (e: Error) => {
              console.error('[SSH OUTPUT] Write stream error:', e.message, e);
              conn.end();
              reject(new SshOutputFailedException(payload.host, e.message));
            });
            writeStream.on('close', () => {
              console.log('[SSH OUTPUT] Upload complete:', remoteFile);
              conn.end();
              resolve();
            });
            writeStream.end(buffer);
          });
        });

        conn.on('error', (err) => {
          console.error('[SSH OUTPUT] Connection error:', err.message, err);
          reject(new SshOutputFailedException(payload.host, err.message));
        });

        console.log('[SSH OUTPUT] Connecting…');
        conn.connect(connConfig);
      });
    });
  }

  private uploadViaSudoTee(
    payload: SshPayload,
    buffer: Buffer,
    remoteFile: string,
    backupId: string,
    backupName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
        console.log(
          `[SSH OUTPUT sudo] Uploading "${backupName}" via sudo tee → ${remoteFile}`,
        );
        const sudoPassword =
          payload.subtype === 'user_password'
            ? payload.password
            : (payload.sudoPassword ?? '');

        const conn = new Client();
        const connConfig: Parameters<
          InstanceType<typeof Client>['connect']
        >[0] = {
          host: payload.host,
          port: payload.port,
          username: payload.username,
          readyTimeout: 30000,
          debug: (msg: string) => console.log('[SSH2 DEBUG]', msg),
          tryKeyboard: payload.subtype === 'user_password',
          ...(payload.subtype === 'user_password'
            ? { password: payload.password }
            : {
                privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                passphrase: payload.passphrase,
              }),
        };

        conn.on('keyboard-interactive', (_n, _i, _l, _p, finish) =>
          finish([(payload as SshUserPasswordPayload).password ?? '']),
        );

        conn.on('ready', () => {
          console.log('[SSH OUTPUT sudo] Connection ready, running sudo tee…');
          const cmd = `sudo -S -p '' tee ${JSON.stringify(remoteFile)} > /dev/null`;
          conn.exec(cmd, (err, stream) => {
            if (err) {
              conn.end();
              return reject(
                new SshOutputFailedException(payload.host, err.message),
              );
            }
            let errOut = '';
            stream.stderr.on('data', (d: Buffer) => {
              errOut += d.toString();
            });
            stream.on('close', (code: number) => {
              conn.end();
              if (code === 0) {
                console.log('[SSH OUTPUT sudo] Upload complete:', remoteFile);
                resolve();
              } else {
                console.error('[SSH OUTPUT sudo] tee failed:', errOut.trim());
                reject(
                  new SshOutputFailedException(
                    payload.host,
                    errOut.trim() || `Exit code ${code}`,
                  ),
                );
              }
            });
            // sudo reads password from first line, tee reads the rest as file content
            stream.write(sudoPassword + '\n');
            stream.end(buffer);
          });
        });

        conn.on('error', (err) => {
          console.error('[SSH OUTPUT sudo] Connection error:', err.message);
          reject(new SshOutputFailedException(payload.host, err.message));
        });

        conn.connect(connConfig);
      });
    });
  }
}
