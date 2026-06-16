# Architecture

## Overview

Orbix is a two-process application: a **NestJS backend** (API + scheduler + runner) and a **Next.js frontend** (web UI). In production they run as **separate Docker containers** and are proxied through a reverse proxy.

```
Browser
  │
  │  HTTPS (reverse proxy)
  ▼
Next.js container (port 3000)    ←── SSR + static assets
  │
  │  HTTP (REST, /api/*)
  ▼
NestJS container (port 3001)     ←── Business logic, scheduler, runner
  │
  ├── PostgreSQL container        ←── All persistent state
  └── /backups, /data volumes     ←── Archives + source files root
```

At startup, the NestJS container runs `prisma migrate deploy` before starting the server (via `docker-entrypoint.sh`).

---

## Module map

```
app.module.ts
├── PrismaModule          Database client (singleton)
├── AuthModule            Login, JWT generation / validation
├── SettingsModule        System-wide configuration (singleton row)
├── LogsModule            Structured log writer + retention cron
├── VaultModule           AES-256 encrypted credential storage (HTTP, email, variable sets, SSH)
├── FilesModule           File explorer (list, download)
├── ContactsModule        Email contact directory
├── MailModule            SMTP sending + mail templates
├── InputModule           Input source config + test runner (HTTP REST, SSH)
├── BackupModule          Backup CRUD, scheduler, BackupRunner
├── StatsModule           Dashboard KPIs and time-series charts
├── ModuleSettingsModule  Per-provider configurable settings
└── ProvidersModule       Input/Output provider registry
      ├── HttpRestInputProvider
      ├── SshInputProvider
      ├── MailOutputProvider
      └── SshOutputProvider
```

`ProvidersModule` is consumed by `BackupModule`. `VaultModule` is consumed by `ProvidersModule`, `InputModule`, `BackupModule`, and `StatsModule`.

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

`BackupScheduler` registers cron jobs at startup for all enabled backups with a non-manual schedule. It uses `@nestjs/schedule` / the `cron` package.

- `recurring` schedules: one `CronJob` per rule (supports multiple day/time rules per backup)
- `interval` schedules: a cron expression stored in `Backup.schedule` (e.g. `*/30 * * * *`)
- `oneshoot` schedules: a `setTimeout` fired once, then the backup is disabled
- `manual`: no job registered

Cron jobs call `BackupRunner.run(backupId)` on tick. Errors are caught and written to the `Log` table.

Schedule expressions are stored as cron strings in `Backup.schedule`. Timezone is stored in `Backup.scheduleConfig.timezone`.

---

## Auth flow

1. Browser calls `POST /api/auth/login` with `{ username, password }`
2. NestJS validates credentials, signs a JWT, sets `orbix_token` as an HTTP-only cookie
3. All subsequent API requests include the cookie automatically
4. `JwtAuthGuard` (global `APP_GUARD`) validates the cookie on every route not decorated `@Public()`

---

## Vault encryption

Vault credentials (HTTP auth configs, SMTP configs, SSH credentials, variable sets) are stored as a single JSON blob per entry, encrypted with AES-256-GCM using `VAULT_ENCRYPTION_KEY`. The encrypted payload is stored in `VaultEntity.encryptedPayload`. Decryption happens in-process at runtime; the raw credential never leaves the server.

---

## Directory layout

```
backend/src/
├── app.module.ts
├── main.ts
├── common/
│   ├── crypto/           AES service
│   ├── decorators/       @Public(), @CurrentUser()
│   ├── exceptions/       OrbixException hierarchy
│   ├── filters/          Global HTTP exception filter
│   └── guards/           JwtAuthGuard, RateLimitGuard
├── modules/
│   ├── auth/
│   ├── backup/           BackupService, BackupRunner, BackupScheduler
│   ├── contacts/
│   ├── files/
│   ├── input/
│   ├── logs/
│   ├── mail/
│   ├── module-settings/  Per-provider settings storage
│   ├── output/
│   │   └── ssh/          SshOutputService, SshOutputController
│   ├── settings/
│   ├── stats/
│   └── vault/
├── providers/
│   ├── input/
│   │   ├── http-rest/    HttpRestInputProvider
│   │   └── ssh/          SshInputProvider
│   └── output/
│       ├── mail/         MailOutputProvider
│       └── ssh/          SshOutputProvider
└── prisma/               PrismaService

frontend/
├── app/
│   ├── (app)/            Authenticated pages
│   └── (auth)/           Login + setup pages
├── components/
│   ├── backup/           Backup wizard + step components
│   ├── input/            Input config pages (http-rest, ssh)
│   ├── output/           Output config pages (ssh)
│   ├── ssh/              Shared SSH browser components
│   ├── ui/               shadcn components
│   └── vault/            Vault form components
├── services/             API client functions
└── lib/                  Utilities (api.ts, utils.ts)
```
