# Modules

Each module lives under `backend/src/modules/<name>/` and exposes a NestJS `@Module`. This page describes what each module owns and which endpoints/services it provides.

---

## AuthModule

**Path:** `modules/auth/`  
**Controller:** `POST /api/auth/setup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/auth/setup-required`

Handles the single-user authentication model.

- `setup` — first-run endpoint that creates the admin user (rate-limited, blocked once a user exists)
- `login` — validates password, issues a JWT stored in an HTTP-only cookie `orbix_token` (rate-limited: 20 req/min/IP)
- `logout` — clears the cookie
- `me` — returns the current user's identity from the JWT

---

## SettingsModule

**Path:** `modules/settings/`  
**Controller:** `GET /api/settings`, `PATCH /api/settings`

Manages a singleton `SystemSettings` row. Settings include:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxFileSizeMb` | 500 | Max individual source file size |
| `maxSourceFileSizeMb` | 500 | Max size per HTTP-fetched file |
| `maxBackupTotalSizeMb` | 2000 | Max total archive size |
| `logRetentionHours` | 720 | How long logs are kept (30 days) |
| `backupRetentionDays` | 90 | Backup history retention |
| `defaultTimezone` | UTC | Used for cron schedule display |
| `defaultLanguage` | en | UI language |
| `defaultTheme` | dark | UI theme |
| `filesRoot` | /data/files | Root path for file explorer |

---

## VaultModule

**Path:** `modules/vault/`  
**Controllers:**
- `GET|POST|PATCH|DELETE /api/vault/http` — HTTP credential entries
- `GET|POST|PATCH|DELETE /api/vault/email` — SMTP entries
- `GET|POST|PATCH|DELETE /api/vault/varset` — Variable set entries

Stores credentials encrypted with AES-256-GCM. Each entry is a `VaultEntity` row with an `encryptedPayload` field.

### HTTP credential subtypes

| Subtype | Fields |
|---------|--------|
| `token` | `token` |
| `username_password` | `username`, `password` |
| `key_secret` | `key`, `secret` |
| `oauth2_client_credentials` | `clientId`, `clientSecret`, `tokenUrl`, `scope?` |
| `oauth2_password_grant` | `clientId`, `username`, `password`, `tokenUrl` |
| `mtls_certificate` | `cert`, `key` |
| `ssh_key` | `privateKey`, `passphrase?` |
| `jwt_signing_key` | `privateKey`, `algorithm` |
| `aws_sigv4` | `accessKeyId`, `secretAccessKey`, `region`, `service` |
| `cookie` | `value` |
| `custom_kv` | `entries: [{key, value}]` |

### Variable sets

A variable set is a named collection of key/value pairs. Values are referenced in HTTP body templates and ZIP password fields using the syntax `{{vault.var.<slug>.<key>}}`.

Example: if a variable set named `db-creds` has key `password`, use `{{vault.var.db-creds.password}}` in an HTTP input body.

### VaultService public API

```typescript
getHttpPayload(id: string): Promise<HttpVaultPayload>
getEmailPayload(id: string): Promise<EmailVaultPayload>
getVariableSetPayloadBySlug(slug: string): Promise<Record<string, string>>
```

---

## InputModule

**Path:** `modules/input/`  
**Controller:** `GET|POST|PATCH|DELETE /api/inputs`, `POST /api/inputs/:id/test`

Manages input source definitions. An `Input` is a named, reusable configuration that points at an external API. Inputs can be:
- Tested independently via the UI or API
- Wired into one or more backup pipelines as sources

The `test()` method calls the real endpoint and records `lastTestStatus` (`ok` | `error`) so the UI can show whether the input is healthy before running a backup.

---

## BackupModule

**Path:** `modules/backup/`  
**Controller:** `GET|POST|PATCH|DELETE /api/backups`, `POST /api/backups/:id/run`, `POST /api/backups/:id/validate`

Core module. Owns:

- **BackupService** — CRUD for backups and their outputs
- **BackupRunner** — executes a backup: collect files → archive → send outputs
- **BackupScheduler** — cron tick every minute, triggers due backups

Validation runs the same pipeline as a real backup but writes `validationStatus` instead of `lastStatus`. A backup must be validated before it can be enabled for scheduling.

---

## LogsModule

**Path:** `modules/logs/`  
**Controller:** `GET /api/logs`, `GET /api/logs/categories`, `GET /api/logs/backup/:backupId`, `DELETE /api/logs/backup/:backupId`

**LogsWriter** is a service injected everywhere logs are needed. It writes directly to the `Log` table and never throws — log failures are swallowed so they don't disrupt the operation being logged.

```typescript
logs.info(category, code, message, detail?)
logs.warn(category, code, message, detail?)
logs.error(category, code, message, detail?, context?)
logs.exception(category, err: OrbixException, message, context?)
```

**Log categories** used internally:

| Category | Source |
|----------|--------|
| `auth` | Login, logout, setup |
| `backup` | Runner start/success/error |
| `input` | Input test results |
| `mail` | Email sends |
| `scheduler` | Scheduled run triggers |
| `system` | Startup, cleanup crons |
| `vault` | OAuth2 token refresh |

A cleanup cron runs every 10 minutes and deletes logs older than `logRetentionHours`.

---

## MailModule

**Path:** `modules/mail/`  
**Controllers:**
- `GET|POST|PATCH|DELETE /api/mail/templates` — email templates
- `GET /api/mail/logs` — send history

Templates support these variables:

| Variable | Value |
|----------|-------|
| `{{backup.name}}` | Backup name |
| `{{backup.size}}` | Human-readable archive size |
| `{{backup.archive}}` | Archive filename |
| `{{backup.files_count}}` | Number of files in archive |
| `{{date}}` | Current date (YYYY-MM-DD) |
| `{{time}}` | Current time (HH:MM) |
| `{{datetime}}` | Current datetime |
| `{{recipient.name}}` | Contact name |
| `{{recipient.email}}` | Contact email |

---

## ContactsModule

**Path:** `modules/contacts/`  
**Controller:** `GET|POST|PATCH|DELETE /api/contacts`

Simple directory of named email addresses used as backup output recipients. Contacts are referenced by ID in `BackupOutput.recipientsTo/Cc/Bcc`.

---

## FilesModule

**Path:** `modules/files/`  
**Controller:** `GET /api/files`, `GET /api/files/download`

Read-only file explorer for the configured `filesRoot`. Lists directories and files; provides download endpoints for individual files.
