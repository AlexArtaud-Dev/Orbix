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
| `type` | String | `"email"` \| `"http"` \| `"variable_set"` |
| `encryptedPayload` | String | AES-256-GCM encrypted JSON blob |

Email vault health check status is stored in the separate `VaultHealthCheck` table (1-1 relation). The raw payload shape depends on `type` — see [modules.md — VaultModule](modules.md#vaultmodule) for the field list per HTTP subtype.

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

One row per email vault entry at most (upsert on `vaultId`). Non-email vault types do not have a `VaultHealthCheck` row.

---

### Input

A reusable external data source definition.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Unique display name |
| `type` | String | Provider type — currently `"http-rest"` |
| `vaultId` | String? | Optional vault entry for auth |
| `config` | Json | Provider-specific config blob |
| `requestParams` | Json | Array of `InputRequestParam` |
| `enabled` | Boolean | Default `true` |
| `lastTestAt` | DateTime? | Last test timestamp |
| `lastTestStatus` | String? | `"ok"` \| `"error"` |
| `lastTestError` | String? | Error message from last failed test |

**`config` shape for `http-rest`:**

```typescript
{
  baseUrl: string;            // Base URL for single-file download or API root
  method?: string;            // GET | POST | PUT | PATCH | DELETE (default: GET)
  listEndpoint?: string;      // Optional: fetch this endpoint to get a list of items
  downloadEndpoint?: string;  // Optional: used with list — {id} substituted per item
  insecureSkipVerify?: boolean;
  body?: {
    type: "none" | "json" | "raw" | "graphql" | "x-www-form-urlencoded" | "form-data";
    json?: string;
    raw?: string;
    graphqlVariables?: string;
    urlEncoded?: Array<{ key: string; value?: string; valueType: "literal" }>;
  };
  detectedExtension?: string; // Set automatically after a successful test
}
```

**`requestParams` shape:**

```typescript
Array<{
  key: string;
  in: "header" | "query" | "body";
  valueType: "literal" | "vault";
  value?: string;     // Used when valueType = "literal"
  vaultId?: string;   // Used when valueType = "vault"
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
| `scheduleConfig` | Json? | Schedule parameters — shape varies by `scheduleType` (see below) |
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

Day numbers follow JavaScript `Date.getDay()` convention: 0 = Sunday, 1 = Monday … 6 = Saturday. Display order in the UI is Mon→Tue→Wed→Thu→Fri→Sat→Sun.

---

### BackupRun

One row per execution of a backup, written by `BackupRunner`. Used by the v0.9 dashboard (KPIs, charts, last-runs table).

| Column | Type | Notes |
|--------|------|-------|
| `id` | String (cuid) | Primary key |
| `backupId` | String | FK → Backup (cascade delete) |
| `startedAt` | DateTime | Run start timestamp (indexed) |
| `finishedAt` | DateTime? | Run end timestamp — null while status is `"running"` |
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
| `type` | String | Output provider type — currently `"mail"` |
| `vaultId` | String | Vault entry used by the provider (SMTP config for mail) |
| `templateId` | String? | FK → MailTemplate |
| `recipientsTo` | String[] | Contact IDs |
| `recipientsCc` | String[] | Contact IDs |
| `recipientsBcc` | String[] | Contact IDs |
| `overrideSubject` | String? | Overrides template subject |
| `overrideBody` | String? | Overrides template body |
| `overrideBodyType` | String? | `"text"` \| `"html"` |
| `order` | Int | Execution order (ascending) |

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

Rows older than `SystemSettings.logRetentionHours` are automatically purged by a cron job every 10 minutes.

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
