import { SshOutputProvider } from './ssh.provider';
import type { VaultService } from '../../../modules/vault/vault.service';
import type { LogsWriter } from '../../../modules/logs/logs.writer';
import type { ModuleSettingsService } from '../../../modules/module-settings/module-settings.service';
import type { SshOutputService } from '../../../modules/output/ssh/ssh-output.service';
import type { OutputRow, ArchiveResult } from '../../providers.types';
import type { SshUserPasswordPayload } from '../../../modules/vault/vault.types';

const SSH_VAULT_ID = 'vault-1';
const SSH_CONFIG_ID = 'config-1';

const PAYLOAD: SshUserPasswordPayload = {
  subtype: 'user_password',
  host: 'backup.example.com',
  port: 22,
  username: 'admin',
  password: 'secret',
  defaultPath: '/backups',
  useSudo: false,
};

const SSH_CONFIG = {
  id: SSH_CONFIG_ID,
  name: 'Prod backups',
  vaultId: SSH_VAULT_ID,
  destPath: '/backups',
  lastTestStatus: 'ok',
  lastTestError: null,
  lastTestAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ARCHIVE: ArchiveResult = {
  buffer: Buffer.from('archive data'),
  filename: 'backup_2026.zip',
  size: 12,
  filesCount: 1,
};

// output.vaultId stores the SshOutputConfig.id
const OUTPUT: OutputRow = {
  id: 'o1',
  backupId: 'b1',
  type: 'ssh',
  vaultId: SSH_CONFIG_ID,
  templateId: null,
  recipientsTo: [],
  recipientsCc: [],
  recipientsBcc: [],
  overrideSubject: null,
  overrideBody: null,
  overrideBodyType: null,
  pathOverride: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type PrivateMethods = {
  uploadViaSftp: (
    payload: unknown,
    buffer: Buffer,
    remoteFile: string,
    timeoutMs: number,
  ) => Promise<void>;
  uploadViaSudoTee: (
    payload: unknown,
    buffer: Buffer,
    remoteFile: string,
    timeoutMs: number,
  ) => Promise<void>;
  deleteRemoteFile: (
    payload: unknown,
    remoteFile: string,
    timeoutMs: number,
  ) => Promise<void>;
};

describe('SshOutputProvider', () => {
  let provider: SshOutputProvider;
  let vault: jest.Mocked<Pick<VaultService, 'getSshPayload'>>;
  let moduleSettings: jest.Mocked<Pick<ModuleSettingsService, 'getOne'>>;
  let sshOutputConfigs: jest.Mocked<Pick<SshOutputService, 'getOne'>>;

  beforeEach(() => {
    vault = { getSshPayload: jest.fn().mockResolvedValue(PAYLOAD) };
    moduleSettings = {
      getOne: jest
        .fn()
        .mockResolvedValue({ values: { connectionTimeoutMs: 30000 } }),
    };
    sshOutputConfigs = {
      getOne: jest.fn().mockResolvedValue(SSH_CONFIG),
    };
    provider = new SshOutputProvider(
      vault as unknown as VaultService,
      {} as LogsWriter,
      moduleSettings as unknown as ModuleSettingsService,
      sshOutputConfigs as unknown as SshOutputService,
    );
  });

  describe('moduleSettingsDefinition', () => {
    it('declares module ssh-output with connectionTimeoutMs field', () => {
      expect(provider.moduleSettingsDefinition.module).toBe('ssh-output');
      const field = provider.moduleSettingsDefinition.fields.find(
        (f) => f.key === 'connectionTimeoutMs',
      );
      expect(field).toBeDefined();
      expect(field?.defaultValue).toBe(30000);
    });
  });

  describe('send()', () => {
    it('loads SshOutputConfig by output.vaultId and resolves SSH credentials from config.vaultId', async () => {
      jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sshOutputConfigs.getOne).toHaveBeenCalledWith(SSH_CONFIG_ID);
      expect(vault.getSshPayload).toHaveBeenCalledWith(SSH_VAULT_ID);
    });

    it('dispatches to uploadViaSftp when useSudo is false', async () => {
      const sftp = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sftp).toHaveBeenCalledWith(
        PAYLOAD,
        ARCHIVE.buffer,
        '/backups/backup_2026.zip',
        30000,
      );
    });

    it('dispatches to uploadViaSudoTee when useSudo is true', async () => {
      vault.getSshPayload.mockResolvedValue({ ...PAYLOAD, useSudo: true });
      const tee = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSudoTee')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(tee).toHaveBeenCalled();
    });

    it('builds remote path from config.destPath', async () => {
      sshOutputConfigs.getOne.mockResolvedValue({
        ...SSH_CONFIG,
        destPath: '/custom/path',
      });
      const sftp = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sftp).toHaveBeenCalledWith(
        PAYLOAD,
        ARCHIVE.buffer,
        '/custom/path/backup_2026.zip',
        30000,
      );
    });

    it('strips trailing slash from destPath', async () => {
      sshOutputConfigs.getOne.mockResolvedValue({
        ...SSH_CONFIG,
        destPath: '/backups/',
      });
      const sftp = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sftp).toHaveBeenCalledWith(
        expect.any(Object),
        ARCHIVE.buffer,
        '/backups/backup_2026.zip',
        30000,
      );
    });

    it('uses custom connectionTimeoutMs from module settings', async () => {
      moduleSettings.getOne.mockResolvedValue({
        definition: provider.moduleSettingsDefinition,
        values: { connectionTimeoutMs: 5000 },
      });
      const sftp = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sftp).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
        expect.any(String),
        5000,
      );
    });

    it('falls back to 30000ms when connectionTimeoutMs is not configured', async () => {
      moduleSettings.getOne.mockResolvedValue({
        definition: provider.moduleSettingsDefinition,
        values: {},
      });
      const sftp = jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(sftp).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
        expect.any(String),
        30000,
      );
    });

    it('calls deleteRemoteFile after upload when isValidation is true', async () => {
      jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);
      const del = jest
        .spyOn(provider as unknown as PrivateMethods, 'deleteRemoteFile')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1', true);

      expect(del).toHaveBeenCalledWith(
        PAYLOAD,
        '/backups/backup_2026.zip',
        30000,
      );
    });

    it('does not call deleteRemoteFile when isValidation is false (default)', async () => {
      jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);
      const del = jest
        .spyOn(provider as unknown as PrivateMethods, 'deleteRemoteFile')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1');

      expect(del).not.toHaveBeenCalled();
    });

    it('does not call deleteRemoteFile when isValidation is explicitly false', async () => {
      jest
        .spyOn(provider as unknown as PrivateMethods, 'uploadViaSftp')
        .mockResolvedValue(undefined);
      const del = jest
        .spyOn(provider as unknown as PrivateMethods, 'deleteRemoteFile')
        .mockResolvedValue(undefined);

      await provider.send(OUTPUT, ARCHIVE, 'my-backup', 'b1', false);

      expect(del).not.toHaveBeenCalled();
    });
  });
});
