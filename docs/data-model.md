# Data model

All persistent state is stored in PostgreSQL via Prisma. Schema: `backend/prisma/schema.prisma`.

---

## Tables

### User

Single admin user (created during first-run setup).

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `username` | String | Unique |
| `passwordHash` | String | bcrypt hash |

---

### VaultEntity

Encrypted credential storage. One row per vault entry regardless of type.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `type` | String | `"email"` \| `"http"` \| `"variable_set"` \| `"ssh-remote"` |
| `encryptedPayload` | String | AES-256-GCM encrypted JSON blob |

Payload shape depends on `type`:
- `"email"` — SMTP config (host, port, user, pass, from address, TLS settings)
- `"http"` — HTTP credential (see [modules.md — VaultModule](modules.md#vaultmodule) for subtypes)
- `"variable_set"` — `{ entries: [{ key, value }] }`
- `"ssh-remote"` — SSH connection (host, port, username, subtype, credentials, defaultPath, useSudo)

Email vault health check status is stored in the separate `VaultHealthCheck` table (1-1 relation).

---

### VaultHealthCheck

SMTP connectivity test result for email vault entries. Created or updated on each `POST /api/vault/email/:id/test` call.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `vaultId` | String | Unique FK → VaultEntity (cascade delete) |
| `status` | String | `"ok"` \| `"error"` |
| `statusMsg` | String? | Error message from last failed test |
| `checkedAt` | DateTime | Timestamp of last test |

---

### Input

A reusable external data source definition.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `type` | String | Provider type — `"http-rest"` \| `"ssh"` |
| `vaultId` | String? | Optional vault entry for auth / connection |
| `config` | Json | Provider-specific config blob |
| `requestParams` | Json | Array of `InputRequestParam` (HTTP only) |
| `enabled` | Boolean | Default `true` |
| `lastTestAt` | DateTime? | Last test timestamp |
| `lastTestStatus` | String? | `"ok"` \| `"error"` |
| `lastTestError` | String? | Error message from last failed test |

**`config` shape for `http-rest`:**

```typescript
{
  baseUrl: string;
  method?: string;            // GET | POST | PUT | PATCH | DELETE (default: GET)
  listEndpoint?: string;
  downloadEndpoint?: string;
  insecureSkipVerify?: boolean;
  body?: {
    type: "none" | "json" | "raw" | "graphql" | "x-www-form-urlencoded" | "form-data";
    json?: string;
    raw?: string;
    graphqlVariables?: string;
    urlEncoded?: Array<{ key: string; value?: string; valueType: "literal" }>;
  };
  detectedExtension?: string;
}
```

**`config` shape for `ssh`:**

```typescript
{
  sources: Array<{
    path: string;           // Absolute remote path (file or directory)
    isDirectory: boolean;
    recursive: boolean;
    namePattern?: string;   // Regex / glob — supports {YYYY} {MM} {DD} {HH} tokens
  }>;
}
```

**`requestParams` shape:**

```typescript
Array<{
  key: string;
  in: "header" | "query" | "body";
  valueType: "literal" | "vault";
  value?: string;
  vaultId?: string;
  vaultField?: string;
}>
```

---

### Backup

The main pipeline entity.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `backupType` | String | `"local"` \| `"input"` |
| `sources` | Json | `BackupSources` — see below |
| `scheduleType` | String | `"manual"` \| `"oneshoot"` \| `"recurring"` \| `"interval"` |
| `scheduleConfig` | Json? | Schedule parameters — shape varies by `scheduleType` |
| `schedule` | String? | Computed cron expression |
| `enabled` | Boolean | Whether the scheduler picks it up |
| `noArchive` | Boolean | Pass-through single file without zipping |
| `archiveFormat` | String | `"zip"` \| `"tar"` \| `"tar-gz"` \| `"tar-bz2"` |
| `zipCompression` | String | `"store"` \| `"fast"` \| `"default"` \| `"best"` |
| `zipPassword` | String? | Literal ZIP password |
| `zipPasswordVaultRef` | String? | `"slug.key"` reference to a variable set value |
| `zipFilename` | String? | Filename template — supports `{{backup.name}}`, `{{date}}`, etc. |
| `isValidated` | Boolean | Set to `true` after a successful validation run |
| `validationStatus` | String? | `"running"` \| `"success"` \| `"error"` |
| `validationError` | String? | Error message from last failed validation |
| `validatedAt` | DateTime? | Last validation timestamp |
| `lastRunAt` | DateTime? | Last run timestamp |
| `lastStatus` | String? | `"success"` \| `"error"` |

**`sources` shape:**

```typescript
{
  sources: Array<
    | { type: "file";   path: string; exclude?: string[] }
    | { type: "folder"; path: string; exclude?: string[] }
    | { type: "url";    path: string; vaultId?: string; requestParams?: RequestParam[]; transferMode?: "stream" | "buffer" }
    | { type: "input";  inputId: string }
  >
}
```

**`scheduleConfig` shapes by `scheduleType`:**

```typescript
// oneshoot
{ datetime: string; timezone: string }

// recurring — multi-rule (new)
{ timezone: string; rules: Array<{ days: number[]; hour: number; minute: number }> }
// recurring — legacy flat (backward compat, single rule)
{ timezone: string; days: number[]; hour: number; minute: number }

// interval
{ every: number; unit: "minutes" | "hours"; startDate?: string; endDate?: string }
```

Day numbers follow JavaScript `Date.getDay()` convention: 0 = Sunday, 1 = Monday … 6 = Saturday.

---

### BackupRun

One row per execution of a backup, written by `BackupRunner`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `backupId` | String | FK → Backup (cascade delete) |
| `startedAt` | DateTime | Run start timestamp (indexed) |
| `finishedAt` | DateTime? | Run end timestamp — null while running |
| `status` | String | `"running"` \| `"success"` \| `"error"` |
| `archiveSizeBytes` | Int? | Compressed archive size in bytes — set on success |
| `filesCount` | Int? | Number of files in the archive — set on success |
| `errorMessage` | String? | Error detail — set on error |
| `triggerType` | String | `"manual"` \| `"scheduler"` \| `"api"` |
| `createdAt` | DateTime | Insert timestamp |

Indexes: `(backupId, startedAt desc)`, `(status, startedAt desc)`, `(startedAt desc)`.

Rows older than `SystemSettings.backupRetentionDays` are automatically purged hourly by `BackupScheduler.purgeOldRuns()`.

---

### BackupOutput

One output destination per backup. A backup can have multiple ordered outputs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `backupId` | String | FK → Backup (cascade delete) |
| `type` | String | Output provider type — `"mail"` \| `"ssh"` |
| `vaultId` | String | Vault entry used by the provider |
| `templateId` | String? | FK → MailTemplate (mail only) |
| `recipientsTo` | String[] | Contact IDs (mail only) |
| `recipientsCc` | String[] | Contact IDs (mail only) |
| `recipientsBcc` | String[] | Contact IDs (mail only) |
| `overrideSubject` | String? | Overrides template subject (mail only) |
| `overrideBody` | String? | Overrides template body (mail only) |
| `overrideBodyType` | String? | `"text"` \| `"html"` (mail only) |
| `pathOverride` | String? | Override destination path (SSH: overrides `SshOutputConfig.destPath`) |
| `order` | Int | Execution order (ascending) |

---

### SshOutputConfig

A named, reusable SSH output destination. Must be tested before it can be used in a backup pipeline.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `vaultId` | String | FK → VaultEntity (type `"ssh-remote"`) |
| `destPath` | String | Default remote destination directory |
| `lastTestStatus` | String? | `"ok"` \| `"error"` |
| `lastTestError` | String? | Error detail from last failed test |
| `lastTestAt` | DateTime? | Last test timestamp |

---

### Log

Append-only activity log. Never updated after insert.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `ts` | DateTime | Log timestamp (indexed) |
| `level` | String | `"DEBUG"` \| `"INFO"` \| `"WARN"` \| `"ERROR"` |
| `category` | String | `"auth"` \| `"backup"` \| `"input"` \| `"mail"` \| `"scheduler"` \| `"system"` \| `"vault"` |
| `code` | String | Machine-readable event code (e.g. `BACKUP_RUN_SUCCESS`) |
| `msg` | String | Human-readable message |
| `detail` | String? | Extra context (stack trace, HTTP status, etc.) |
| `backupId` | String? | Optional link to a specific backup |

Indexes: `(ts desc)`, `(level, ts desc)`, `(category, ts desc)`, `(backupId, ts desc)`.

---

### MailTemplate

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `subject` | String | Template variables supported |
| `body` | String | Template variables supported |
| `bodyType` | String | `"text"` \| `"html"` |

---

### Contact

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name |
| `email` | String | Unique |
| `tags` | String[] | Optional labels |

---

### MailLog

Send history written by `MailOutputProvider` after each send attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `vaultId` | String | SMTP config used |
| `toAddrs` | String[] | Recipient addresses |
| `subject` | String | Rendered subject |
| `status` | String | `"sent"` \| `"error"` |
| `errorMsg` | String? | Error details |
| `sentAt` | DateTime | Send timestamp |

---

### ModuleSetting

Per-provider configurable settings. Each key/value pair is scoped to a module name (the provider type string).

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `module` | String | Provider type (e.g. `"http-rest"`, `"ssh"`) |
| `key` | String | Setting key |
| `value` | String | Setting value (always stored as string) |
| `updatedAt` | DateTime | Last update timestamp |

Unique constraint on `(module, key)`.

---

### SystemSettings

Singleton row (`id = "singleton"`). Created on first startup, updated via `PATCH /api/settings`.

| Column | Type | Default |
|--------|------|---------|
| `maxFileSizeMb` | Int | 500 |
| `maxSourceFileSizeMb` | Int | 500 |
| `maxBackupTotalSizeMb` | Int | 2000 |
| `logRetentionHours` | Int | 720 |
| `backupRetentionDays` | Int | 90 |
| `defaultTimezone` | String | UTC |
| `defaultLanguage` | String | en |
| `defaultTheme` | String | dark |
| `filesRoot` | String | /data/files |
