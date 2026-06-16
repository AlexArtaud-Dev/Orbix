# Orbix

**Self-hosted backup pipeline manager.**  
Configure your sources, schedule your runs, route your archives — without depending on any third-party cloud.

---

## What is Orbix?

Orbix lets you build automated backup pipelines from a web UI. Pick where your data comes from (local files, HTTP APIs, remote SFTP), choose how it gets packaged (zip, tar, encrypted), and decide where it ends up (email, remote SSH server). Everything runs on your own infrastructure.

```
  Sources              Archive            Outputs
  ───────              ───────            ───────
  Local files     ──►                ──► Email (SMTP)
  Folders         ──► zip / tar      ──► SSH / SFTP
  HTTP REST API   ──► encrypted      ──► (more planned)
  SFTP (remote)   ──►
```

---

## Features

- **Visual pipeline builder** — build backups step by step with a guided wizard
- **Multiple input types** — local files, folders, HTTP REST APIs (custom body, auth, OAuth2), remote SFTP
- **Flexible archiving** — zip, tar, tar.gz, tar.bz2, with optional AES-256 password encryption
- **Scheduled runs** — manual, cron expression, or fixed interval
- **Vault** — encrypted storage for HTTP credentials, SMTP configs, SSH credentials (user/pass, PEM key), and variable sets
- **Email output** — send archives via SMTP with HTML/text templates, to/cc/bcc, per-recipient variables
- **SSH output** — upload archives to remote servers via SFTP or `sudo tee`
- **File explorer** — browse and download files from a configurable server path
- **Dashboard** — KPIs, run history charts (success/error, archive sizes)
- **Structured logs** — real-time log viewer with filtering by category and level
- **Settings** — global settings and per-module configuration
- **Security** — JWT via HTTP-only cookie, AES-256 vault encryption, rate-limited auth endpoints

---

## Quick start

**Requirements:** Docker, Docker Compose

```bash
git clone <repo> orbix && cd orbix
cp .env.example .env
# Edit .env and fill in all required variables
docker compose -f docker-compose.prod.yml up -d
```

Open [http://localhost:6666](http://localhost:6666) and complete the setup wizard.

Migrations run automatically on every container start via `docker-entrypoint.sh`.

---

## Configuration

| Variable               | Required | Default    | Description |
|------------------------|----------|------------|-------------|
| `DB_PASSWORD`          | ✓        | —          | PostgreSQL password |
| `JWT_SECRET`           | ✓        | —          | JWT signing secret (≥32 chars) |
| `VAULT_ENCRYPTION_KEY` | ✓        | —          | Vault AES-256 encryption key (≥32 chars) |
| `FRONTEND_URL`         | ✓        | —          | Public URL of the app — used for CORS (no trailing slash) |
| `NEXT_PUBLIC_API_URL`  | ✓        | —          | Public URL baked into the frontend image at build time |
| `TZ`                   |          | `UTC`      | Timezone for cron schedules and timestamps |
| `LOG_LEVEL`            |          | `INFO`     | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |
| `ORBIX_SECURE`         |          | `false`    | Set `true` to enforce HTTPS-only cookies (behind a TLS reverse proxy) |

> `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` should both point to the public app URL (e.g., `https://orbix.yourdomain.com`). `NEXT_PUBLIC_API_URL` is a Docker build argument and must be set before building the frontend image.

---

## Production with a reverse proxy

`docker-compose.prod.yml` exposes the backend on port **6667** and the frontend on port **6666**. It connects to an external Docker network named **`bifrost`** — create it once if it doesn't exist:

```bash
docker network create bifrost
```

Example SWAG/nginx proxy configuration for `orbix.*`:

```nginx
server {
    listen 443 ssl;
    server_name orbix.*;
    include /config/nginx/ssl.conf;
    include /config/nginx/authelia-server.conf;

    location /api {
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        set $upstream_app   orbix-backend;
        set $upstream_port  3001;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;
    }

    location / {
        include /config/nginx/authelia-location.conf;
        include /config/nginx/proxy.conf;
        include /config/nginx/resolver.conf;
        set $upstream_app   orbix-frontend;
        set $upstream_port  3000;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;
    }
}
```

---

## Data volumes

| Volume / Mount    | Contents |
|-------------------|----------|
| `orbix_db`        | PostgreSQL data |
| `orbix_backups`   | Generated archive files |
| `orbix_logs`      | Application logs |
| `./data`          | Bind mount — files accessible via the File Explorer (configurable root in Settings) |

To expose local directories in the File Explorer, place them under `./data/` on the host (or adjust the bind mount in your compose file). The default file root is `/data/files`.

---

## Tech stack

- **Backend** — NestJS 11 · PostgreSQL 17 · Prisma 7 · node-archiver · ssh2-sftp-client
- **Frontend** — Next.js 14 (App Router) · shadcn/ui · Tailwind CSS v4 · Recharts
- **Auth** — JWT via HTTP-only cookie

---

## Development

```bash
# Start the database only
docker compose up db -d

# Backend (separate terminal)
cd backend
pnpm install
pnpm prisma migrate dev   # first time only, or after schema changes
pnpm run start:dev

# Frontend (separate terminal)
cd frontend
pnpm install
pnpm run dev
```

Backend: [http://localhost:3001](http://localhost:3001) · Frontend: [http://localhost:3000](http://localhost:3000)

```bash
# Run backend tests
cd backend && pnpm test

# Run frontend tests
cd frontend && pnpm test
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | System overview, module map, execution flow, directory layout |
| [`docs/modules.md`](docs/modules.md) | NestJS modules — responsibilities and API endpoints |
| [`docs/providers.md`](docs/providers.md) | Provider pattern — how to add Input/Output types |
| [`docs/data-model.md`](docs/data-model.md) | Prisma schema reference — all tables and column types |

---

## License

MIT
