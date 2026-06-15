import { Injectable } from '@nestjs/common';
import { VaultService } from '../../../modules/vault/vault.service';
import { LogsWriter } from '../../../modules/logs/logs.writer';
import { ModuleSettingsService } from '../../../modules/module-settings/module-settings.service';
import { SshOutputService } from '../../../modules/output/ssh/ssh-output.service';
import type { IOutputProvider } from '../output-provider.interface';
import type { IModuleSettingsProvider } from '../../module-settings.interface';
import type {
  ProviderMeta,
  ArchiveResult,
  OutputRow,
} from '../../providers.types';
import type { ModuleSettingsDefinition } from '../../module-settings.types';
import type {
  SshPayload,
  SshUserPasswordPayload,
} from '../../../modules/vault/vault.types';
import { SshOutputFailedException } from '../../../common/exceptions';

@Injectable()
export class SshOutputProvider
  implements IOutputProvider, IModuleSettingsProvider
{
  readonly type = 'ssh';
  readonly meta: ProviderMeta = {
    type: 'ssh',
    label: 'SSH / SFTP',
    icon: 'server',
    description: 'Upload the backup archive to a remote server via SFTP.',
  };

  readonly moduleSettingsDefinition: ModuleSettingsDefinition = {
    module: 'ssh-output',
    labelKey: 'output.type.ssh',
    descriptionKey: 'output.typeDesc.ssh',
    fields: [
      {
        key: 'connectionTimeoutMs',
        type: 'number',
        defaultValue: 30000,
        labelKey: 'moduleSettings.sshOutput.connectionTimeoutMs',
        descriptionKey: 'moduleSettings.sshOutput.connectionTimeoutMsDesc',
        min: 1000,
        max: 120000,
      },
    ],
  };

  constructor(
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
    private readonly moduleSettings: ModuleSettingsService,
    private readonly sshOutputConfigs: SshOutputService,
  ) {}

  async send(
    output: OutputRow,
    archive: ArchiveResult,
    _backupName: string,
    _backupId: string,
    isValidation = false,
  ): Promise<void> {
    const { values } = await this.moduleSettings.getOne('ssh-output');
    const timeoutMs =
      (values.connectionTimeoutMs as number | undefined) ?? 30000;

    const config = await this.sshOutputConfigs.getOne(output.vaultId);
    const payload = await this.vault.getSshPayload(config.vaultId);
    const remotePath = config.destPath.replace(/\/+$/, '');
    const remoteFile = `${remotePath}/${archive.filename}`;

    if (payload.useSudo) {
      await this.uploadViaSudoTee(
        payload,
        archive.buffer,
        remoteFile,
        timeoutMs,
      );
    } else {
      await this.uploadViaSftp(payload, archive.buffer, remoteFile, timeoutMs);
    }

    if (isValidation) {
      await this.deleteRemoteFile(payload, remoteFile, timeoutMs);
    }
  }

  private deleteRemoteFile(
    payload: SshPayload,
    remoteFile: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
        const conn = new Client();
        const password =
          payload.subtype === 'user_password' ? payload.password : undefined;

        conn.on('ready', () => {
          const cmd = payload.useSudo
            ? `sudo -S -p '' rm -f ${JSON.stringify(remoteFile)}`
            : `rm -f ${JSON.stringify(remoteFile)}`;
          conn.exec(cmd, (err, stream) => {
            if (err) {
              conn.end();
              return reject(
                new SshOutputFailedException(payload.host, err.message),
              );
            }
            stream.on('data', () => {});
            stream.stderr.on('data', () => {});
            stream.on('close', (code: number) => {
              conn.end();
              if (code === 0) resolve();
              else
                reject(
                  new SshOutputFailedException(
                    payload.host,
                    `rm exit code ${code}`,
                  ),
                );
            });
            if (payload.useSudo) stream.write((password ?? '') + '\n');
            stream.end();
          });
        });

        conn.on('error', (err) =>
          reject(new SshOutputFailedException(payload.host, err.message)),
        );
        conn.on('keyboard-interactive', (_n, _i, _l, _p, finish) =>
          finish([password ?? '']),
        );

        conn.connect({
          host: payload.host,
          port: payload.port,
          username: payload.username,
          readyTimeout: timeoutMs,
          tryKeyboard: payload.subtype === 'user_password',
          ...(payload.subtype === 'user_password'
            ? { password }
            : {
                privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                passphrase: payload.passphrase,
              }),
        });
      });
    });
  }

  private uploadViaSftp(
    payload: SshPayload,
    buffer: Buffer,
    remoteFile: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
        const conn = new Client();
        const password =
          payload.subtype === 'user_password' ? payload.password : undefined;
        const connConfig: Parameters<
          InstanceType<typeof Client>['connect']
        >[0] = {
          host: payload.host,
          port: payload.port,
          username: payload.username,
          readyTimeout: timeoutMs,
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
            finish([password ?? '']);
          },
        );

        conn.on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(
                new SshOutputFailedException(payload.host, err.message),
              );
            }
            const writeStream = sftp.createWriteStream(remoteFile);
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              conn.end();
              resolve();
            };
            const fail = (e: Error) => {
              if (settled) return;
              settled = true;
              conn.end();
              reject(new SshOutputFailedException(payload.host, e.message));
            };
            writeStream.on('error', fail);
            writeStream.on('finish', done);
            writeStream.on('close', done);
            writeStream.end(buffer);
          });
        });

        conn.on('error', (err) => {
          reject(new SshOutputFailedException(payload.host, err.message));
        });

        conn.connect(connConfig);
      });
    });
  }

  private uploadViaSudoTee(
    payload: SshPayload,
    buffer: Buffer,
    remoteFile: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      void import('ssh2').then(({ Client }) => {
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
          readyTimeout: timeoutMs,
          tryKeyboard: payload.subtype === 'user_password',
          ...(payload.subtype === 'user_password'
            ? { password: payload.password }
            : {
                privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                passphrase: payload.passphrase,
              }),
        };

        conn.on('keyboard-interactive', (_n, _i, _l, _p, finish) => {
          finish([(payload as SshUserPasswordPayload).password ?? '']);
        });

        conn.on('ready', () => {
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
            stream.stdout.on('data', () => {});
            stream.on('close', (code: number, signal: unknown) => {
              void signal;
              conn.end();
              if (code === 0) {
                resolve();
              } else {
                reject(
                  new SshOutputFailedException(
                    payload.host,
                    errOut.trim() || `Exit code ${code}`,
                  ),
                );
              }
            });
            stream.write(sudoPassword + '\n');
            stream.end(buffer);
          });
        });

        conn.on('error', (err) => {
          reject(new SshOutputFailedException(payload.host, err.message));
        });

        conn.connect(connConfig);
      });
    });
  }
}
