# Orbix

**Self-hosted backup pipeline manager.**  
Configure your sources, schedule your runs, route your archives — without depending on any third-party cloud.

---

## What is Orbix?

Orbix lets you build automated backup pipelines from a web UI. Pick where your data comes from (local files, HTTP APIs), choose how it gets packaged (zip, tar, encrypted), and decide where it ends up (email, local storage, …). Everything runs on your own infrastructure.

```
  Sources          Archive          Outputs
  ───────          ───────          ───────
  Local files  ──►               ──► Email
  Folders      ──► zip / tar  ──► S3 (soon)
  HTTP API     ──► encrypted   ──► FTP (soon)
  SFTP (soon)  ──►               ──► Webhook (soon)
```

---

## Features

- **Visual pipeline builder** — build backups step by step with a guided wizard
- **Multiple source types** — local files, folders, and HTTP REST APIs (with auth, custom body, OAuth2)
- **Flexible archiving** — zip, tar, tar.gz, tar.bz2, with optional AES-256 password
- **Scheduled runs** — manual, one-shot, cron expression, or fixed interval
- **Vault** — encrypted storage for HTTP credentials, SMTP configs, and variable sets; supports Bearer, Basic, OAuth2 (client credentials, password grant), mTLS, cookies, custom headers
- **Email output** — send archives via SMTP with templated messages, to/cc/bcc, per-recipient variables
- **File explorer** — browse, download, and manage the configured files root
- **Structured logs** — real-time log viewer with multi-select filtering by category and level
- **Input testing** — test HTTP inputs before wiring them into a backup
- **Security** — JWT authentication, AES-256 vault encryption, rate-limited auth endpoints

---

## Quick start

**Requirements:** Docker, Docker Compose

```bash
git clone <repo> orbix && cd orbix
cp .env.example .env
# Open .env and set DB_PASSWORD, JWT_SECRET, VAULT_ENCRYPTION_KEY
docker compose -f docker-compose.prod.yml up -d
```

Open [http://localhost:3000](http://localhost:3000) and complete the setup wizard.

---

## Configuration

| Variable               | Required | Default | Description |
|------------------------|----------|---------|-------------|
| `DB_PASSWORD`          | ✓        | —       | PostgreSQL password |
| `JWT_SECRET`           | ✓        | —       | JWT signing secret (≥32 chars) |
| `VAULT_ENCRYPTION_KEY` | ✓        | —       | Vault AES-256 key (≥32 chars) |
| `ORBIX_PORT`           |          | `3000`  | Exposed port |
| `TZ`                   |          | `UTC`   | Timezone for cron schedules |
| `LOG_LEVEL`            |          | `INFO`  | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |
| `ORBIX_SECURE`         |          | `false` | HTTPS-only cookies — set `true` behind TLS |

---

## Data volumes

| Volume          | Contents                        |
|-----------------|---------------------------------|
| `orbix_db`      | PostgreSQL data                 |
| `orbix_backups` | Generated archive files         |
| `./data`        | Source files root (bind mount)  |

---

## Tech stack

- **Backend** — NestJS · PostgreSQL · Prisma · node-archiver
- **Frontend** — Next.js 15 (App Router) · shadcn/ui · Tailwind CSS
- **Auth** — JWT via HTTP-only cookie

---

## Documentation

Full technical documentation lives in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | System overview, module map, execution flow |
| [`docs/modules.md`](docs/modules.md) | NestJS modules — responsibilities and APIs |
| [`docs/providers.md`](docs/providers.md) | Provider pattern — how to add Input/Output types |
| [`docs/data-model.md`](docs/data-model.md) | Prisma schema reference |

---

## Development

```bash
# Start the database
docker compose up -d postgres

# Backend
cd backend && pnpm install && pnpm prisma migrate dev && pnpm start:dev

# Frontend (separate terminal)
cd frontend && pnpm install && pnpm dev
```

Backend: http://localhost:3001 · Frontend: http://localhost:3000

```bash
# Run tests
cd backend && pnpm test
cd frontend && pnpm test
```

---

## License

MIT
