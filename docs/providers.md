# Provider pattern

Orbix uses a registry-based provider pattern to make input sources and output destinations pluggable. Adding a new provider requires implementing one interface and registering the class in `ProvidersModule` — no changes to the core backup logic.

---

## Concepts

| Concept | What it does |
|---------|-------------|
| **Input provider** | Fetches files from an external source and returns them as a list of `FileToArchive` items |
| **Output provider** | Receives the finished `ArchiveResult` and delivers it to a destination |
| **Registry** | A `Map<type, provider>` injected into `BackupRunner` at runtime |

Both registries live in `backend/src/providers/`.

---

## Input providers

### Interface

```typescript
// backend/src/providers/input/input-provider.interface.ts

export interface IInputProvider {
  /** Unique string identifier — matches Input.type in the database */
  readonly type: string;

  /** UI metadata shown in the wizard */
  readonly meta: ProviderMeta;

  /** Fetch files from the source. Throw an OrbixException on failure. */
  fetch(input: InputRow, context: InputFetchContext): Promise<FileToArchive[]>;
}

export interface InputFetchContext {
  maxSizeMb: number; // from SystemSettings.maxSourceFileSizeMb
}
```

### FileToArchive

The fetch method returns an array of file descriptors. Each can be one of three forms:

```typescript
// File on disk — archiver reads it directly
type DiskFile = { abs: string; arc: string };

// In-memory buffer — use for small responses
type BufferFile = { buffer: Buffer; arc: string };

// Node.js Readable stream — use for large responses to avoid buffering
type StreamFile = { stream: Readable; arc: string };

type FileToArchive = DiskFile | BufferFile | StreamFile;
```

`arc` is the relative path the file will have inside the archive (e.g., `"data/export.json"`).

### ProviderMeta

```typescript
export interface ProviderMeta {
  type: string;        // Same as IInputProvider.type
  label: string;       // Human-readable name shown in the UI
  icon: string;        // Lucide icon name (optional)
  description: string; // Tooltip/help text
}
```

### Existing input providers

| Type | Class | Description |
|------|-------|-------------|
| `http-rest` | `HttpRestInputProvider` | HTTP REST API with full auth support |

---

## Output providers

### Interface

```typescript
// backend/src/providers/output/output-provider.interface.ts

export interface IOutputProvider {
  readonly type: string;
  readonly meta: ProviderMeta;

  /** Deliver the archive. Throw on failure — BackupRunner will catch and log. */
  send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
  ): Promise<void>;
}
```

### ArchiveResult

```typescript
export interface ArchiveResult {
  buffer: Buffer;    // The full archive as an in-memory buffer
  filename: string;  // Suggested filename (e.g. "my_backup_2024-06-10.zip")
  size: number;      // Bytes
  filesCount: number;
}
```

### OutputRow

The `output` argument is the raw `BackupOutput` row from the database. Your provider reads whatever fields it needs — typically `vaultId` for credentials.

### Existing output providers

| Type | Class | Description |
|------|-------|-------------|
| `mail` | `MailOutputProvider` | Sends archive via SMTP using a vault email config |

---

## How to add an Input provider

### 1. Create the provider class

```typescript
// backend/src/providers/input/sftp/sftp.provider.ts

import { Injectable } from '@nestjs/common';
import type { IInputProvider, InputFetchContext } from '../input-provider.interface';
import type { FileToArchive, ProviderMeta } from '../../providers.types';
import type { InputRow } from '../../../modules/input/input.types';
import { VaultService } from '../../../modules/vault/vault.service';

@Injectable()
export class SftpInputProvider implements IInputProvider {
  readonly type = 'sftp';

  readonly meta: ProviderMeta = {
    type: 'sftp',
    label: 'SFTP',
    icon: 'server',
    description: 'Download files from a remote SFTP server.',
  };

  constructor(private readonly vault: VaultService) {}

  async fetch(input: InputRow, { maxSizeMb }: InputFetchContext): Promise<FileToArchive[]> {
    // 1. Load credentials from vault
    const creds = await this.vault.getHttpPayload(input.vaultId!);

    // 2. Parse provider-specific config
    const config = input.config as { host: string; port: number; remotePath: string };

    // 3. Connect, list files, download
    // ... SFTP logic here ...

    // 4. Return files
    return [
      { buffer: /* downloaded file */, arc: 'export.tar.gz' },
    ];
  }
}
```

### 2. Add Input.type to the database enum

`Input.type` is a plain `String` — no migration needed. Just make sure the value you use in `readonly type` matches what gets stored when the user creates an input of this type.

### 3. Register in ProvidersModule

```typescript
// backend/src/providers/providers.module.ts

import { SftpInputProvider } from './input/sftp/sftp.provider';

@Module({
  providers: [
    InputProviderRegistry,
    HttpRestInputProvider,
    SftpInputProvider,           // ← add
    OutputProviderRegistry,
    MailOutputProvider,
  ],
  exports: [InputProviderRegistry, OutputProviderRegistry],
})
export class ProvidersModule implements OnModuleInit {
  constructor(
    private readonly inputRegistry: InputProviderRegistry,
    private readonly httpRest: HttpRestInputProvider,
    private readonly sftp: SftpInputProvider,              // ← inject
    private readonly outputRegistry: OutputProviderRegistry,
    private readonly mail: MailOutputProvider,
  ) {}

  onModuleInit() {
    this.inputRegistry.register(this.httpRest);
    this.inputRegistry.register(this.sftp);               // ← register
    this.outputRegistry.register(this.mail);
  }
}
```

### 4. Add the frontend UI

Create a config form for your provider under `frontend/app/(app)/input/` so users can configure inputs of the new type. The form values are stored as `Input.config` (a JSON blob) and `Input.requestParams`.

---

## How to add an Output provider

### 1. Create the provider class

```typescript
// backend/src/providers/output/webhook/webhook.provider.ts

import { Injectable } from '@nestjs/common';
import type { IOutputProvider } from '../output-provider.interface';
import type { ProviderMeta, ArchiveResult, OutputRow } from '../../providers.types';
import { VaultService } from '../../../modules/vault/vault.service';

@Injectable()
export class WebhookOutputProvider implements IOutputProvider {
  readonly type = 'webhook';

  readonly meta: ProviderMeta = {
    type: 'webhook',
    label: 'Webhook',
    icon: 'webhook',
    description: 'POST backup metadata to a webhook URL.',
  };

  constructor(private readonly vault: VaultService) {}

  async send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
  ): Promise<void> {
    // 1. Load webhook URL from vault (e.g. custom_kv with key "url")
    const creds = await this.vault.getHttpPayload(output.vaultId);

    // 2. POST to webhook
    await fetch(/* url */, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backupName,
        backupId,
        filename: archive.filename,
        size: archive.size,
        filesCount: archive.filesCount,
      }),
    });
  }
}
```

### 2. Register in ProvidersModule

```typescript
import { WebhookOutputProvider } from './output/webhook/webhook.provider';

// In @Module providers array:
WebhookOutputProvider,

// In constructor:
private readonly webhook: WebhookOutputProvider,

// In onModuleInit:
this.outputRegistry.register(this.webhook);
```

### 3. Expose the new output type in the UI

Add `webhook` to the output type list in the backup wizard's output step so users can select it when building a pipeline.

---

## Error handling in providers

Providers should throw typed `OrbixException` subclasses for expected failure cases (auth error, size exceeded, etc.) and let unexpected errors propagate as plain `Error`. `BackupRunner` catches both:

```typescript
} catch (err) {
  if (err instanceof OrbixException) {
    this.logs.exception('backup', err, `Backup failed: ${backup.name}`, { backupId });
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    this.logs.error('backup', 'BACKUP_RUN_ERROR', `Backup failed: ${backup.name}`, msg, { backupId });
  }
}
```

Custom exception classes live in `backend/src/common/exceptions/`. Extend `OrbixException`:

```typescript
import { OrbixException } from '../../common/exceptions/orbix-exception';

export class SftpConnectionException extends OrbixException {
  constructor(host: string, cause: string) {
    super('SFTP_CONNECTION_ERROR', `Cannot connect to ${host}: ${cause}`);
  }
}
```
