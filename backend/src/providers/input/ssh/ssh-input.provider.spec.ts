import { Test, TestingModule } from '@nestjs/testing';
import { SshInputProvider } from './ssh-input.provider';
import { VaultService } from '../../../modules/vault/vault.service';
import type { SshUserPasswordPayload } from '../../../modules/vault/vault.types';
import type { InputRow } from '../../../modules/input/input.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockVault = { getSshPayload: jest.fn() };

const SSH_PAYLOAD: SshUserPasswordPayload = {
  subtype: 'user_password',
  host: '10.0.0.1',
  port: 22,
  username: 'admin',
  password: 'secret',
  defaultPath: '/tmp',
};

function makeInput(overrides: Partial<InputRow> = {}): InputRow {
  return {
    id: 'input-1',
    name: 'SSH Backup',
    type: 'ssh',
    vaultId: 'vault-1',
    config: { sources: [] },
    requestParams: [],
    enabled: true,
    lastTestStatus: null,
    lastTestError: null,
    lastTestAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// Mode bits for stat() attributes
const FILE_MODE = 0o100644; // regular file, rw-r--r--
const DIR_MODE = 0o040755; // directory
const NO_READ_MODE = 0o100200; // write-only file (no read bit)

/** Build a mock SFTP wrapper whose stat() and readdir() can be configured per-test */
function makeMockSftp() {
  return {
    stat: jest.fn(),
    readdir: jest.fn(),
    createReadStream: jest.fn(),
  };
}

// ─── Helper: bypass withSftp and inject a controlled SFTP mock ────────────────

type SftpMock = ReturnType<typeof makeMockSftp>;
type WithSftpInternal = {
  withSftp: (
    p: unknown,
    fn: (s: SftpMock) => Promise<unknown>,
  ) => Promise<unknown>;
};

function setupSftp(provider: SshInputProvider, mockSftp: SftpMock) {
  jest
    .spyOn(provider as unknown as WithSftpInternal, 'withSftp')
    .mockImplementation((_p, fn) => fn(mockSftp));
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('SshInputProvider.test()', () => {
  let provider: SshInputProvider;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVault.getSshPayload.mockResolvedValue(SSH_PAYLOAD);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SshInputProvider,
        { provide: VaultService, useValue: mockVault },
      ],
    }).compile();

    provider = module.get(SshInputProvider);
  });

  it('returns error when no vaultId configured', async () => {
    const result = await provider.test(makeInput({ vaultId: null }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/vault/i);
  });

  it('returns error when sources array is empty', async () => {
    const input = makeInput({ config: { sources: [] } });
    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/source/i);
  });

  it('returns success when all file sources exist and are readable', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: FILE_MODE }),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/etc/nginx.conf', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it('returns success when all directory sources exist and are listable', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: DIR_MODE }),
    );
    sftp.readdir.mockImplementation((_p: string, cb: (e: null) => void) =>
      cb(null),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/srv/configs', isDirectory: true, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(true);
  });

  it('reports error when stat() cannot access a path', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation((_p: string, cb: (e: Error) => void) =>
      cb(new Error('No such file')),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/missing/file', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found|not accessible/i);
  });

  it('reports error when source is declared as directory but path is a file', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: FILE_MODE }),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/etc/nginx.conf', isDirectory: true, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expected a directory but found a file/i);
  });

  it('reports error when source is declared as file but path is a directory', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: DIR_MODE }),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/srv/configs', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expected a file but found a directory/i);
  });

  it('reports error when a file has no read permissions', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: NO_READ_MODE }),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/secure/file', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no read permissions/i);
  });

  it('reports error when directory cannot be listed (no readdir permission)', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: DIR_MODE }),
    );
    sftp.readdir.mockImplementation((_p: string, cb: (e: Error) => void) =>
      cb(new Error('Permission denied')),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/root/secrets', isDirectory: true, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot list directory/i);
  });

  it('accumulates errors from multiple sources into a single pipe-separated string', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation((_p: string, cb: (e: Error) => void) =>
      cb(new Error('ENOENT')),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/a/missing', isDirectory: false, recursive: false },
          { path: '/b/missing', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('|');
  });

  it('returns success with correct count for multiple valid sources', async () => {
    const sftp = makeMockSftp();
    sftp.stat.mockImplementation(
      (_p: string, cb: (e: null, a: { mode: number }) => void) =>
        cb(null, { mode: FILE_MODE }),
    );
    const input = makeInput({
      config: {
        sources: [
          { path: '/etc/file1.conf', isDirectory: false, recursive: false },
          { path: '/etc/file2.conf', isDirectory: false, recursive: false },
        ],
      },
    });
    setupSftp(provider, sftp);

    const result = await provider.test(input);
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });
});

// ─── resolveDatePattern (tested indirectly via fetch behaviour) ───────────────
// The private resolveDatePattern is the same logic as resolveSshDatePattern in
// VaultService, which is tested in vault.service.spec.ts.  Here we only verify
// that the provider's fetch() respects the pattern by checking it is applied.
describe('SshInputProvider.fetch() — pattern filtering', () => {
  let provider: SshInputProvider;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVault.getSshPayload.mockResolvedValue(SSH_PAYLOAD);
    const module = await Test.createTestingModule({
      providers: [
        SshInputProvider,
        { provide: VaultService, useValue: mockVault },
      ],
    }).compile();
    provider = module.get(SshInputProvider);
  });

  it('only fetches files whose names match the namePattern glob', async () => {
    const sftp = makeMockSftp();
    const fileA = {
      filename: 'nginx.conf',
      attrs: { mode: FILE_MODE, size: 100 },
    };
    const fileB = {
      filename: 'nginx.bak',
      attrs: { mode: FILE_MODE, size: 200 },
    };
    sftp.readdir.mockImplementation(
      (_p: string, cb: (e: null, l: (typeof fileA)[]) => void) =>
        cb(null, [fileA, fileB]),
    );
    const chunks = Buffer.from('data');
    const mockStream = {
      on: jest.fn().mockImplementation(function (
        this: unknown,
        event: string,
        handler: (c?: Buffer) => void,
      ) {
        if (event === 'data') handler(chunks);
        if (event === 'end') handler();
        return this;
      }),
    };
    sftp.createReadStream.mockReturnValue(mockStream);
    setupSftp(provider, sftp);

    const input = makeInput({
      config: {
        sources: [
          {
            path: '/etc',
            isDirectory: true,
            recursive: false,
            namePattern: '*.conf',
          },
        ],
      },
    });
    const files = await provider.fetch(input, { maxSizeMb: 100 });

    const names = files.map((f) => f.arc);
    expect(names).toContain('nginx.conf');
    expect(names).not.toContain('nginx.bak');
  });
});
