# Architecture

## Overview

Orbix is a two-process application: a **NestJS backend** (API + scheduler + runner) and a **Next.js frontend** (web UI). Both are bundled into a single Docker image for production.

```
Browser
  │
  │  HTTP (cookies / JSON)
  ▼
Next.js (port 3000)          ←── Server-side rendering + API proxy
  │
  │  HTTP (REST)
  ▼
NestJS (port 3001)           ←── Business logic, scheduler, runner
  │
  ├── PostgreSQL              ←── All persistent state (backups, vault, logs…)
  └── File system             ←── Source files root + generated archives
```

In the Docker image, NestJS starts first and runs database migrations, then Next.js starts. Both processes share the same container and volumes.

---

## Module map

```
app.module.ts
├── PrismaModule         Database client (singleton)
├── AuthModule           Login, JWT generation / validation
├── SettingsModule       System-wide configuration (singleton row)
├── LogsModule           Structured log writer + retention cron
├── VaultModule          AES-256 encrypted credential storage
├── FilesModule          File explorer (list, download)
├── ContactsModule       Email contact directory
├── MailModule           SMTP sending + mail templates
├── InputModule          HTTP input source config + test runner
├── BackupModule         Backup CRUD, scheduler, BackupRunner
└── ProvidersModule      Input/Output provider registry
```

`ProvidersModule` is consumed by `BackupModule`. `VaultModule` is consumed by `ProvidersModule`, `InputModule`, and `BackupModule`.

---

## Backup execution flow

When a backup is triggered (manually, via scheduler, or via the `/run` endpoint):

```
BackupService.run(backupId)
  │
  └─► BackupRunner.run(backupId)
        │
        ├─ 1. Load Backup row (sources, archiveFormat, outputs)
        │
        ├─ 2. Collect files  ─────────────────────────────────────────────
        │     For each source:
        │       type = "file" | "folder"  → resolve path on disk
        │       type = "url"              → HTTP fetch (fetchUrlSource)
        │       type = "input"            → InputProviderRegistry.get(input.type)
        │                                   └─► provider.fetch(input, {maxSizeMb})
        │                                       returns FileToArchive[]
        │
        ├─ 3. Build archive
        │     zip | tar | tar-gz | tar-bz2
        │     optional: AES-256 ZIP password
        │     optional: noArchive (passthrough single file)
        │     result: ArchiveResult { buffer, filename, size, filesCount }
        │
        └─ 4. Send to outputs (in order field)
              For each BackupOutput:
                OutputProviderRegistry.get(output.type)
                └─► provider.send(output, archive, backupName, backupId)
```

---

## Scheduler

`BackupScheduler` runs every minute via NestJS `@Cron`. On each tick it:

1. Queries all enabled, validated backups whose next scheduled time is in the past
2. Calls `BackupRunner.run(backupId)` for each — fire-and-forget (errors are caught and logged)
3. Updates `lastRunAt` and `lastStatus`

Schedule expressions are stored as cron strings in `Backup.schedule`.

---

## Auth flow

1. Browser calls `POST /api/auth/login` with `{ username, password }`
2. NestJS validates credentials, signs a JWT, sets `orbix_token` as an HTTP-only cookie
3. All subsequent API requests include the cookie automatically
4. `JwtAuthGuard` (global `APP_GUARD`) validates the cookie on every route not decorated `@Public()`

---

## Vault encryption

Vault credentials (HTTP auth configs, SMTP configs, variable sets) are stored as a single JSON blob per entry, encrypted with AES-256-GCM using `VAULT_ENCRYPTION_KEY`. The encrypted payload is stored in `VaultEntity.encryptedPayload`. Decryption happens in-process at runtime; the raw credential never leaves the server.

---

## Directory layout

```
backend/src/
├── app.module.ts
├── main.ts
├── common/
│   ├── crypto/         AES service
│   ├── decorators/     @Public(), @CurrentUser()
│   ├── exceptions/     OrbixException hierarchy
│   ├── filters/        Global HTTP exception filter
│   └── guards/         JwtAuthGuard, RateLimitGuard
├── modules/            Business modules (see docs/modules.md)
├── providers/          Input/Output providers (see docs/providers.md)
└── prisma/             PrismaService

frontend/
├── app/
│   ├── (app)/          Authenticated pages
│   └── (auth)/         Login + setup pages
├── components/
│   ├── backup/         Backup wizard + step components
│   ├── ui/             shadcn components
│   └── vault/          Vault form components
├── services/           API client functions
└── lib/                Utilities (api.ts, utils.ts)
```
