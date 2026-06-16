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

Providers can optionally implement `IModuleSettingsProvider` to expose configurable settings (visible in the UI under Settings → Modules).

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
| `http-rest` | `HttpRestInputProvider` | HTTP REST API with full auth support (Bearer, OAuth2, mTLS, …) |
| `ssh` | `SshInputProvider` | Download files from a remote SSH/SFTP server with optional regex filtering |

**SSH input `config` shape:**

```typescript
{
  sources: Array<{
    path: string;         // Absolute remote path (file or directory)
    isDirectory: boolean;
    recursive: boolean;   // Recurse into sub-directories
    namePattern?: string; // Regex or glob pattern — supports {YYYY} {MM} {DD} {HH} tokens
  }>;
}
```

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

The `output` argument is the raw `BackupOutput` row from the database. Providers read whatever fields they need — typically `vaultId` for credentials and `pathOverride` for a custom destination path.

### Existing output providers

| Type | Class | Description |
|------|-------|-------------|
| `mail` | `MailOutputProvider` | Sends archive via SMTP using a vault email config |
| `ssh` | `SshOutputProvider` | Uploads archive to a remote server via SFTP or `sudo tee` |

---

## How to add an Input provider

### 1. Create the provider class

```typescript
// backend/src/providers/input/ftp/ftp.provider.ts

import { Injectable } from '@nestjs/common';
import type { IInputProvider, InputFetchContext } from '../input-provider.interface';
import type { FileToArchive, ProviderMeta } from '../../providers.types';
import type { InputRow } from '../../../modules/input/input.types';
import { VaultService } from '../../../modules/vault/vault.service';

@Injectable()
export class FtpInputProvider implements IInputProvider {
  readonly type = 'ftp';

  readonly meta: ProviderMeta = {
    type: 'ftp',
    label: 'FTP',
    icon: 'server',
    description: 'Download files from an FTP server.',
  };

  constructor(private readonly vault: VaultService) {}

  async fetch(input: InputRow, { maxSizeMb }: InputFetchContext): Promise<FileToArchive[]> {
    // 1. Load credentials from vault
    // 2. Parse provider-specific config (input.config)
    // 3. Connect, list files, download
    // 4. Return FileToArchive[]
  }
}
```

### 2. Register in ProvidersModule

```typescript
// backend/src/providers/providers.module.ts

import { FtpInputProvider } from './input/ftp/ftp.provider';

@Module({
  providers: [
    InputProviderRegistry,
    HttpRestInputProvider,
    SshInputProvider,
    FtpInputProvider,           // ← add
    OutputProviderRegistry,
    MailOutputProvider,
    SshOutputProvider,
  ],
  // ...
})
export class ProvidersModule implements OnModuleInit {
  constructor(
    // ... existing injections
    private readonly ftp: FtpInputProvider,     // ← inject
  ) {}

  onModuleInit() {
    this.inputRegistry.register(this.httpRest);
    this.inputRegistry.register(this.sshInput);
    this.inputRegistry.register(this.ftp);      // ← register
    this.outputRegistry.register(this.mail);
    this.outputRegistry.register(this.ssh);
  }
}
```

### 3. Add the frontend UI

Create a config form for your provider under `frontend/app/(app)/input/<type>/` so users can configure inputs of the new type. The form values are stored as `Input.config` (a JSON blob) and `Input.requestParams`.

---

## How to add an Output provider

### 1. Create the provider class

```typescript
// backend/src/providers/output/webhook/webhook.provider.ts

import { Injectable } from '@nestjs/common';
import type { IOutputProvider } from '../output-provider.interface';
import type { ProviderMeta, ArchiveResult, OutputRow } from '../../providers.types';

@Injectable()
export class WebhookOutputProvider implements IOutputProvider {
  readonly type = 'webhook';

  readonly meta: ProviderMeta = {
    type: 'webhook',
    label: 'Webhook',
    icon: 'webhook',
    description: 'POST backup metadata to a webhook URL.',
  };

  async send(
    output: OutputRow,
    archive: ArchiveResult,
    backupName: string,
    backupId: string,
  ): Promise<void> {
    const url = output.pathOverride ?? ''; // or read from vault
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupName, backupId, filename: archive.filename, size: archive.size }),
    });
  }
}
```

### 2. Register in ProvidersModule

```typescript
import { WebhookOutputProvider } from './output/webhook/webhook.provider';

// In @Module providers array: WebhookOutputProvider
// In constructor: private readonly webhook: WebhookOutputProvider
// In onModuleInit: this.outputRegistry.register(this.webhook);
```

### 3. Expose the new output type in the UI

Add `webhook` to the output type list in the backup wizard's output step so users can select it when building a pipeline.

---

## IModuleSettingsProvider (optional)

Providers can expose configurable settings by implementing `IModuleSettingsProvider`:

```typescript
export interface IModuleSettingsProvider {
  readonly moduleSettingsDefinition: ModuleSettingsDefinition;
}
```

`ModuleSettingsDefinition` describes the fields (name, type, default, label). Values are stored in `ModuleSetting` rows and retrieved via `ModuleSettingsService`. At startup, `ProvidersModule.onModuleInit()` auto-discovers all providers that implement this interface and registers their definitions.

---

## Error handling in providers

Providers should throw typed `OrbixException` subclasses for expected failure cases (auth error, size exceeded, connection refused, etc.) and let unexpected errors propagate as plain `Error`. `BackupRunner` catches both:

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

export class SshConnectionException extends OrbixException {
  constructor(host: string, cause: string) {
    super('SSH_CONNECTION_ERROR', `Cannot connect to ${host}: ${cause}`);
  }
}
```
