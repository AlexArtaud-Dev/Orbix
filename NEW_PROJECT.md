# NEW_PROJECT.md — Orbix v2

> Document de référence faisant autorité sur toutes les décisions d'architecture, convention et versioning.  
> Lire intégralement avant toute contribution. Mettre à jour dans le même commit que l'implémentation.

---

## Table des matières

1. [Vision & Objectifs](#1-vision--objectifs)
2. [Leçons de la v1](#2-leçons-de-la-v1)
3. [Stack technique](#3-stack-technique)
4. [Architecture générale](#4-architecture-générale)
5. [Structure des dossiers](#5-structure-des-dossiers)
6. [Base de données — Prisma + PostgreSQL](#6-base-de-données--prisma--postgresql)
7. [Sécurité](#7-sécurité)
8. [API REST — conventions](#8-api-rest--conventions)
9. [Module : Auth](#9-module--auth)
10. [Module : Vault](#10-module--vault)
11. [Module : Logs](#11-module--logs)
12. [Module : File Explorer](#12-module--file-explorer)
13. [Module : Mail](#13-module--mail)
14. [Module : Template Builder](#14-module--template-builder)
15. [Module : Scheduler](#15-module--scheduler)
16. [Module : Backup Routines](#16-module--backup-routines)
17. [Module : Outputs](#17-module--outputs)
18. [Module : System Settings](#18-module--system-settings)
19. [Frontend — Next.js App Router](#19-frontend--nextjs-app-router)
20. [Sidebar dynamique multi-niveaux](#20-sidebar-dynamique-multi-niveaux)
21. [Internationalisation (i18n)](#21-internationalisation-i18n)
22. [Theming — next-themes](#22-theming--next-themes)
23. [Toasts — Sonner](#23-toasts--sonner)
24. [Docker — dev vs prod](#24-docker--dev-vs-prod)
25. [Dev local — workflow](#25-dev-local--workflow)
26. [CI/CD — GitHub Actions](#26-cicd--github-actions)
27. [Tests](#27-tests)
28. [Conventions de code](#28-conventions-de-code)
29. [Conventions Git](#29-conventions-git)
30. [Variables d'environnement](#30-variables-denvironnement)
31. [Roadmap des versions](#31-roadmap-des-versions)

---

## 1. Vision & Objectifs

**Orbix** est une application web **self-hosted dockerisée** permettant d'automatiser des routines de backup de fichiers avec envoi vers des destinations configurables (mail, à terme S3, SFTP, Azure…).

### Principes directeurs

| Principe | Application concrète |
|---|---|
| **SOLID** | Un module NestJS = une responsabilité. Interfaces pour tout ce qui est extensible. |
| **DRY** | Aucune duplication. Helpers partagés dans `common/`. Types partagés dans `shared/`. |
| **Modularité** | Chaque module est indépendant. Pas d'import croisé entre modules — uniquement via interfaces. |
| **Sécurité** | Credentials AES-256-GCM, JWT HttpOnly cookie, validation stricte des inputs. |
| **Maintenabilité** | TypeScript strict partout, fichiers < 300 lignes, nommage explicite. |
| **Scalabilité** | Vault extensible, OutputProvider extensible, pagination curseur sur toutes les listes. |

---

## 2. Leçons de la v1

La v1 (Go + React/Vite) a livré un backend fonctionnel avec :
- Auth JWT HttpOnly cookie + setup first-run
- Vault EmailEntity chiffré AES-256-GCM, CRUD complet, test SMTP, job santé toutes les 5 min
- Colonnes `smtp_status` / `smtp_status_msg` / `smtp_checked_at` sur `VaultEntity`
- Logs JSON rotatifs + UI avec filtres et pagination
- System Settings, dark/light theme, i18n EN+FR
- Sidebar dynamique multi-niveaux (config par préfixe de route)
- Sonner toasts sur toutes les actions

### Pourquoi migrer vers NestJS + Next.js

| Friction v1 | Solution v2 |
|---|---|
| `go-sqlite3` exige CGO → compilation cassée sur Windows sans GCC | PostgreSQL dans Docker — zéro CGO, zéro compilation C |
| `shadcn/ui` conçu pour Next.js, `next-themes` absent en Vite | Next.js App Router — shadcn natif, `next-themes` natif |
| Verbosité Go pour JSON / validation | NestJS + `class-validator` + DTOs TypeScript |
| Pas de types partagés front/back | TypeScript end-to-end, types exportables |
| Hot reload inconfortable avec CGO | `nest start --watch` + `next dev` — instantané |

### Ce qui ne change PAS

- Toute la logique métier (modules, features, roadmap)
- Les principes de sécurité (JWT HttpOnly, AES-256-GCM, path confinement)
- Le schéma de données (traduit en Prisma schema PostgreSQL)
- Les conventions Git et de code
- L'architecture conteneur unique en production

### Les petits plus

On peut utiliser le fichier llms.txt (à la racine du projet) qui contient tous les liens vers la doc de shadcn ui mais également utiliser le skills en l'installant via : pnpm dlx skills add shadcn/ui
Evdiemment on utilise PNPM et non pas NPM.
Il faut que le projet puisse se run en local et en docker. Pour le local on utilisera le service DB du docker compose.

---

## 3. Stack technique

### Backend — NestJS

| Rôle | Choix |
|---|---|
| Framework | **NestJS 11** |
| Langage | **TypeScript 6** strict |
| ORM | **Prisma 7** |
| Base de données | **PostgreSQL 17** (Alpine, via Docker) |
| Auth | `@nestjs/jwt` + `cookie-parser` (HttpOnly cookie) |
| Chiffrement | Node.js `crypto` stdlib — AES-256-GCM, zéro lib externe |
| Hash passwords | `bcryptjs` |
| Validation | `class-validator` + `class-transformer` + `ValidationPipe` global |
| SMTP test | `nodemailer` |
| Scheduler | `@nestjs/schedule` + `@Cron()` |
| Static files (prod) | `@nestjs/serve-static` (sert le build Next.js) |
| Config | `@nestjs/config` |
| Tests | Jest + Supertest |

### Frontend — Next.js

| Rôle | Choix |
|---|---|
| Framework | **Next.js 16** (App Router, `output: 'export'`) |
| Langage | **TypeScript 6** strict |
| UI components | **shadcn/ui** (composants copiés localement, basé Radix UI) |
| Styles | **Tailwind CSS v4** |
| State | **Zustand** |
| Theming | **`next-themes`** (natif shadcn) |
| i18n | `react-i18next` |
| Toasts | **Sonner** |
| HTTP client | `fetch` natif encapsulé dans des services typés |
| Icônes | `lucide-react` |
| Tests | Vitest |

### Infrastructure dev

| Rôle | Choix |
|---|---|
| Base de données (dev) | PostgreSQL 17 Alpine **dans Docker Compose uniquement** |
| Backend (dev) | NestJS local `npm run start:dev` |
| Frontend (dev) | Next.js local `npm run dev` |
| Base de données (prod) | PostgreSQL 17 Alpine dans Docker Compose |
| App (prod) | NestJS + Next.js static export dans un seul conteneur |

---

## 4. Architecture générale

### Développement

```
┌─────────────────────────────────────────────────────┐
│  Local machine                                      │
│                                                     │
│  ┌─────────────────┐      ┌─────────────────────┐  │
│  │  Next.js :3000  │─────▶│  NestJS :3001       │  │
│  │  (npm run dev)  │ /api │  (npm run start:dev)│  │
│  └─────────────────┘      └──────────┬──────────┘  │
│                                      │             │
│                    ┌─────────────────▼───────────┐  │
│                    │   Docker Compose            │  │
│                    │   PostgreSQL :5432          │  │
│                    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Production (Docker)

```
┌──────────────────────────────────────────────────────┐
│  Docker Compose                                      │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  orbix (conteneur unique — NestJS :3000)        │ │
│  │                                                 │ │
│  │  /api/*  → Modules NestJS                       │ │
│  │  /*      → Next.js static export               │ │
│  │                                                 │ │
│  │  @nestjs/schedule : vault health, log cleaner  │ │
│  └───────────────────────────┬─────────────────────┘ │
│                              │                       │
│  ┌───────────────────────────▼─────────────────────┐ │
│  │  orbix-db (PostgreSQL 16 Alpine)                │ │
│  │  Volume persisté                                │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Volumes : /data (ro), /backups, /app/logs           │
└──────────────────────────────────────────────────────┘
```

---

## 5. Structure des dossiers

```
orbix/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── dto/
│   │   │   │       ├── login.dto.ts
│   │   │   │       └── setup.dto.ts
│   │   │   ├── vault/
│   │   │   │   ├── vault.module.ts
│   │   │   │   ├── vault.controller.ts
│   │   │   │   ├── vault.service.ts
│   │   │   │   ├── vault-health.service.ts   # Cron 5min
│   │   │   │   └── dto/
│   │   │   │       ├── create-email.dto.ts
│   │   │   │       └── update-email.dto.ts
│   │   │   ├── logs/
│   │   │   │   ├── logs.module.ts
│   │   │   │   ├── logs.controller.ts
│   │   │   │   ├── logs.service.ts
│   │   │   │   └── logs.writer.ts
│   │   │   ├── settings/
│   │   │   │   ├── settings.module.ts
│   │   │   │   ├── settings.controller.ts
│   │   │   │   ├── settings.service.ts
│   │   │   │   └── dto/update-settings.dto.ts
│   │   │   ├── files/                        # v0.3.0
│   │   │   ├── mail/                         # v0.4.0
│   │   │   │   ├── mail.module.ts
│   │   │   │   ├── mail.controller.ts
│   │   │   │   ├── mail.service.ts
│   │   │   │   └── contacts/
│   │   │   ├── templates/                    # v0.5.0
│   │   │   ├── scheduler/                    # v0.6.0
│   │   │   ├── backups/                      # v0.7.0
│   │   │   └── outputs/                      # v0.8.0
│   │   │       ├── output-provider.interface.ts
│   │   │       ├── output-registry.service.ts
│   │   │       └── email/
│   │   ├── common/
│   │   │   ├── crypto/
│   │   │   │   └── aes.service.ts
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   ├── decorators/
│   │   │   │   └── current-user.decorator.ts
│   │   │   └── filters/
│   │   │       └── http-exception.filter.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── schema.prisma
│   │   └── main.ts
│   ├── test/
│   ├── .env                                  # gitignored
│   ├── package.json
│   ├── nest-cli.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                        # Root : ThemeProvider + Toaster
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── setup/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx                    # AppLayout (sidebar + auth guard)
│   │       ├── page.tsx                      # Dashboard
│   │       ├── vault/email/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── files/page.tsx
│   │       ├── mail/
│   │       │   ├── page.tsx
│   │       │   └── contacts/page.tsx
│   │       ├── templates/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── backups/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── logs/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                               # shadcn/ui (copiés)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── sidebarLevels.ts
│   │   │   ├── MobileHeader.tsx
│   │   │   └── MobileBottomNav.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── api.ts                            # Fetch wrapper typé
│   │   └── utils.ts                          # cn(), formatters
│   ├── services/                             # vault.ts, logs.ts, auth.ts…
│   ├── stores/                               # authStore.ts (Zustand)
│   ├── i18n/
│   │   ├── locales/en.json
│   │   ├── locales/fr.json
│   │   └── index.ts
│   ├── public/flags/
│   ├── .env.local                            # gitignored
│   ├── next.config.ts
│   ├── components.json                       # shadcn config
│   └── package.json
│
├── docker-compose.yml                        # Dev : DB seule
├── docker-compose.prod.yml                   # Prod : DB + app
├── Dockerfile                                # Multi-stage (prod uniquement)
├── .env.example
├── .env                                      # gitignored
├── Makefile
├── dev.ps1
├── .github/workflows/ci.yml
└── NEW_PROJECT.md
```

---

## 6. Base de données — Prisma + PostgreSQL

### Pourquoi PostgreSQL

- Image Alpine ~80 MB, la plus légère des DB relationnelles en Docker
- Support Prisma de référence (migrations, studio, client typé)
- Pas de CGO, pas de binaire natif à compiler — fonctionne partout
- JSON natif, full-text search intégré pour les futures évolutions

### schema.prisma

```prisma
// backend/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model VaultEntity {
  id               String    @id @default(cuid())
  name             String    @unique
  type             String                      // "email" | "s3" | "sftp" ...
  encryptedPayload String
  smtpStatus       String?                     // "ok" | "error" | null
  smtpStatusMsg    String?
  smtpCheckedAt    DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model SystemSettings {
  id                  String  @id @default("singleton")
  maxFileSizeMb       Int     @default(500)
  logRetentionDays    Int     @default(30)
  backupRetentionDays Int     @default(90)
  defaultTimezone     String  @default("UTC")
  defaultLanguage     String  @default("en")
  defaultTheme        String  @default("dark")
}

// Ajoutés progressivement :
// Contact (v0.4.0), Template (v0.5.0), BackupRoutine (v0.7.0)
```

### Conventions Prisma

- **Migrations** : `prisma migrate dev --name <desc>` en dev, `prisma migrate deploy` en prod.
- **PrismaService** : singleton injectable via `PrismaModule` (global: true).
- **IDs** : `cuid()` — chaîne URL-safe, pas de UUID lib externe.
- **Pas de `$queryRaw`** sauf nécessité absolue documentée.

### PrismaService

```typescript
// src/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }
}
```

---

## 7. Sécurité

### JWT — HttpOnly Cookie

```typescript
// auth.service.ts — à la connexion
res.cookie('orbix_token', jwt, {
  httpOnly: true,
  secure: configService.get('ORBIX_SECURE') === 'true',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,  // 24h
  path: '/',
})
```

- **Jamais dans `localStorage` / `sessionStorage` / mémoire JS.**
- `JwtAuthGuard` global — exceptions sur `/api/auth/*`.
- Setup first-run : si aucun `User` en DB → seule `/api/auth/setup` accessible.

### Chiffrement Vault — AES-256-GCM

```typescript
// common/crypto/aes.service.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

@Injectable()
export class AesService {
  private readonly key: Buffer

  constructor(private config: ConfigService) {
    this.key = scryptSync(
      config.getOrThrow('VAULT_ENCRYPTION_KEY'),
      'orbix-v2-salt',
      32,
    ) as Buffer
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString('utf8') + decipher.final('utf8')
  }
}
```

- **Valeurs chiffrées jamais renvoyées en API.**
- `VAULT_ENCRYPTION_KEY` minimum 32 caractères — NestJS lève une exception au démarrage sinon.

### Sécurité fichiers

- Toutes les opérations fichier confinées dans `/data` et `/backups`.
- Path traversal rejeté avec code `FORBIDDEN` avant tout traitement.

### Validation

- `ValidationPipe` global avec `whitelist: true`, `forbidNonWhitelisted: true`.
- `helmet()` global sur toutes les réponses NestJS.

---

## 8. API REST — conventions

### Format de réponse uniforme

```typescript
// Succès — liste paginée
{ "data": [...], "nextCursor": "cuid_dernier" | null }

// Succès — objet unique
{ "data": { ... } }

// Erreur
{ "error": { "code": "INVALID_INPUT", "message": "...", "details": [...] } }
```

### Pagination curseur (OBLIGATOIRE sur toutes les listes)

```
GET /api/vault/email?cursor=<cuid>&limit=20
```

- `cursor` : ID du dernier item reçu (absent = première page).
- `limit` : défaut 20, max 100.
- Tri stable par défaut : `createdAt DESC`.

```typescript
// Implémentation type dans un service
async listEmail(cursor?: string, limit = 20) {
  const items = await this.prisma.vaultEntity.findMany({
    where: { type: 'email' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
  })
  const hasNext = items.length > limit
  return {
    data: items.slice(0, limit).map(this.toSafeResponse),
    nextCursor: hasNext ? items[limit - 1].id : null,
  }
}
```

### Codes d'erreur applicatifs

| Code | HTTP | Signification |
|---|---|---|
| `UNAUTHORIZED` | 401 | Non authentifié |
| `FORBIDDEN` | 403 | Non autorisé ou path traversal |
| `NOT_FOUND` | 404 | Ressource inexistante |
| `CONFLICT` | 409 | Contrainte d'unicité |
| `INVALID_INPUT` | 422 | Validation DTO échouée |
| `CRYPTO_ERROR` | 500 | Erreur chiffrement |
| `SMTP_ERROR` | 502 | Échec connexion SMTP |
| `UNHANDLED` | 500 | Erreur non gérée (loggée avec detail) |

---

## 9. Module : Auth

### Endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/setup` | Non | Création admin (désactivé après 1er user) |
| `POST` | `/api/auth/login` | Non | Login → set cookie JWT |
| `POST` | `/api/auth/logout` | Oui | Supprime le cookie |
| `GET` | `/api/auth/me` | Oui | User courant |

### DTOs

```typescript
export class LoginDto {
  @IsString() @MinLength(1) username: string
  @IsString() @MinLength(1) password: string
}

export class SetupDto {
  @IsString() @MinLength(1) username: string
  @IsString() @MinLength(8) password: string
}
```

---

## 10. Module : Vault

### EmailEntity — payload chiffré

```typescript
interface EmailPayload {
  host: string
  port: number
  username: string
  password: string
  fromName: string
  fromAddr: string
  tls: boolean      // true = TLS implicite (465), false = STARTTLS (587)
}
```

### Réponse API (sans password)

```typescript
interface EmailSafeResponse {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  fromName: string
  fromAddr: string
  tls: boolean
  smtpStatus: 'ok' | 'error' | null
  smtpStatusMsg: string | null
  smtpCheckedAt: string | null
  createdAt: string
  updatedAt: string
}
```

### Test SMTP

```typescript
// vault.service.ts
async testSmtp(payload: EmailPayload): Promise<void> {
  const transport = nodemailer.createTransport({
    host: payload.host,
    port: payload.port,
    secure: payload.tls,
    auth: { user: payload.username, pass: payload.password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 15_000,
  })
  await transport.verify()
}
```

### Job santé — toutes les 5 minutes

```typescript
// vault-health.service.ts
@Injectable()
export class VaultHealthService {
  constructor(private readonly vaultService: VaultService) {}

  @Cron('*/5 * * * *')
  async checkAllEmail(): Promise<void> {
    await this.vaultService.checkAndUpdateAllSmtpStatus()
  }
}
```

### Endpoints

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/vault/email` | Liste paginée (cursor) |
| `GET` | `/api/vault/email/:id` | Détail sans password |
| `POST` | `/api/vault/email` | Création |
| `PATCH` | `/api/vault/email/:id` | Mise à jour partielle |
| `DELETE` | `/api/vault/email/:id` | Suppression |
| `POST` | `/api/vault/email/:id/test` | Test SMTP + maj statut |

### DTOs

```typescript
export class CreateEmailDto {
  @IsString() @MinLength(1) name: string
  @IsString() @MinLength(1) host: string
  @IsInt() @Min(1) @Max(65535) port: number
  @IsString() username: string
  @IsString() @MinLength(1) password: string
  @IsString() fromName: string
  @IsEmail() fromAddr: string
  @IsBoolean() tls: boolean
}

export class UpdateEmailDto {
  @IsOptional() @IsString() @MinLength(1) name?: string
  @IsOptional() @IsString() host?: string
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number
  @IsOptional() @IsString() username?: string
  @IsOptional() @IsString() password?: string
  @IsOptional() @IsString() fromName?: string
  @IsOptional() @IsEmail() fromAddr?: string
  @IsOptional() @IsBoolean() tls?: boolean
}
```

---

## 11. Module : Logs

### Architecture

Fichiers JSON Lines rotatifs dans `/app/logs/` (volume Docker).

```
/app/logs/
├── app-2025-01-15.log
├── backup-2025-01-15.log
└── vault-2025-01-15.log
```

### Format JSON Lines

```json
{"ts":"2025-01-15T14:32:01Z","level":"ERROR","category":"vault","code":"SMTP_ERROR","msg":"Connection failed","detail":"connect ETIMEDOUT 74.125.140.109:587"}
```

### Catégories

`auth` | `backup` | `mail` | `scheduler` | `system` | `vault`

### Endpoint

```
GET /api/logs?cursor=&limit=&category=&level=&from=&to=
```

---

## 12. Module : File Explorer

- Navigation dans `/data` uniquement — path traversal rejeté.
- Affichage : nom, type, taille, date modification, permissions.
- Indicateur visuel si inaccessible (code `FORBIDDEN`).
- Composant `FileSelector` réutilisable (module Backup).
- **Lecture seule.**

---

## 13. Module : Mail

Indépendant du module Backup. Consommé par le module Outputs.

```typescript
interface MailService {
  sendWithAttachment(opts: SendOptions): Promise<void>
  testConnection(vaultEntityId: string): Promise<void>
}

interface SendOptions {
  vaultEntityId: string
  to: ContactRef[]
  cc?: ContactRef[]
  bcc?: ContactRef[]
  subject: string
  bodyHtml: string
  attachmentPath?: string
}

interface ContactRef {
  contactId?: string   // null = email libre
  email: string
  name?: string
}
```

### Contacts (sous-module)

```prisma
// Ajouté en v0.4.0
model Contact {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 14. Module : Template Builder

- Éditeur HTML avec **preview temps réel** (iframe sandboxée).
- Variables dans le corps ET l'objet.

### Variables

| Variable | Description |
|---|---|
| `{{routineName}}` | Nom de la routine |
| `{{backupFileName}}` | Fichier généré |
| `{{backupFileSizeHuman}}` | Taille lisible ex: `12.4 MB` |
| `{{executionDate}}` | `YYYY-MM-DD` |
| `{{executionDateISO}}` | ISO 8601 |
| `{{status}}` | `SUCCESS` ou `FAILURE` |
| `{{errorMessage}}` | Message si FAILURE |

```prisma
// Ajouté en v0.5.0
model Template {
  id         String   @id @default(cuid())
  name       String   @unique
  subject    String
  bodyHtml   String
  defaultTo  Json     @default("[]")
  defaultCc  Json     @default("[]")
  defaultBcc Json     @default("[]")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

## 15. Module : Scheduler

- `@nestjs/schedule`, cron expressions standard.
- Toutes les routines `enabled = true` chargées au démarrage.
- Jobs isolés — crash d'un job n'affecte pas les autres.
- Timezone IANA par routine.

---

## 16. Module : Backup Routines

```prisma
// Ajouté en v0.7.0
model BackupRoutine {
  id                     String    @id @default(cuid())
  name                   String    @unique
  description            String    @default("")
  enabled                Boolean   @default(false)
  scheduleType           String                       // "one_shot" | "interval" | "cron"
  intervalSeconds        Int?
  cronExpression         String?
  timezone               String    @default("UTC")
  sourcePaths            Json                         // string[]
  archiveType            String    @default("zip")    // "none" | "zip" | "tar_gz" | "tar_bz2"
  outputFilenameTemplate String    @default("{routine_name}_{datetime}")
  retentionDays          Int       @default(30)
  lastRunAt              DateTime?
  runCount               Int       @default(0)
  outputs                Json      @default("[]")     // OutputConfig[]
  testPassed             Boolean   @default(false)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt
}
```

### Variables nommage fichier

`{routine_name}` `{date}` `{datetime}` `{timestamp_unix}` `{year}` `{month}` `{day}` `{run_count}`

### Dry-run obligatoire

Vérifie : accès source paths, accès `/backups`, résolution nom, test connexion outputs, envoi fichier test `[TEST]`.

---

## 17. Module : Outputs

```typescript
// outputs/output-provider.interface.ts
export interface OutputProvider {
  getType(): string
  getRequiredVaultEntityType(): string
  send(payload: OutputPayload): Promise<void>
  test(vaultEntityId: string): Promise<void>
}

export interface OutputPayload {
  filePath: string
  fileName: string
  routineName: string
  templateId?: string
  metadata: Record<string, string>
}
```

**Outputs prévus** : Email (v0.8.0), S3 (futur), SFTP (futur), Azure (futur).

---

## 18. Module : System Settings

Singleton en DB (ID fixe `"singleton"`).

| Paramètre | Type | Défaut |
|---|---|---|
| `maxFileSizeMb` | Int | 500 |
| `logRetentionDays` | Int | 30 |
| `backupRetentionDays` | Int | 90 |
| `defaultTimezone` | String | `"UTC"` |
| `defaultLanguage` | String | `"en"` |
| `defaultTheme` | String | `"dark"` |

---

## 19. Frontend — Next.js App Router

### next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',           // Static export — servi par NestJS en prod
  trailingSlash: true,
  images: { unoptimized: true },
}

export default nextConfig
```

> En dev, Next.js proxy `/api` vers NestJS via `rewrites` (uniquement en mode dev server) :

```typescript
// next.config.ts — section dev seulement
async rewrites() {
  return process.env.NODE_ENV === 'development'
    ? [{ source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' }]
    : []
},
```

### Root layout

```tsx
// app/layout.tsx
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import I18nProvider from '@/i18n/provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <I18nProvider>
            {children}
          </I18nProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### AppLayout — protection auth

```tsx
// app/(app)/layout.tsx
'use client'
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
```

### Service API typé

```typescript
// lib/api.ts
export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init })
  const json = await res.json()
  if (!res.ok) throw new ApiError(json.error?.code ?? 'UNHANDLED', json.error?.message ?? 'Error')
  return json.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

---

## 20. Sidebar dynamique multi-niveaux

Même pattern que v1, adapté à `usePathname()` de Next.js.

```typescript
// components/layout/sidebarLevels.ts
export type SidebarNavItem = {
  to: string
  icon: LucideIcon
  labelKey: string
  end?: boolean
}

export type SidebarLevel = {
  parentPath: string
  titleKey: string
  items: SidebarNavItem[]
}

export const SIDEBAR_LEVELS: Record<string, SidebarLevel> = {
  '/vault': {
    parentPath: '/',
    titleKey: 'nav.vault',
    items: [
      { to: '/vault/email', icon: Mail, labelKey: 'nav.emailConfigs' },
    ],
  },
  '/mail': {
    parentPath: '/',
    titleKey: 'nav.mail',
    items: [
      { to: '/mail', icon: Send, labelKey: 'nav.mailSend' },
      { to: '/mail/contacts', icon: Users, labelKey: 'nav.contacts' },
    ],
  },
}

// Trouve le niveau actif par préfixe le plus long
export function getActiveSidebarLevel(pathname: string): SidebarLevel | null {
  const match = Object.keys(SIDEBAR_LEVELS)
    .filter(prefix => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0]
  return match ? SIDEBAR_LEVELS[match] : null
}
```

```tsx
// components/layout/Sidebar.tsx
'use client'
const pathname = usePathname()   // next/navigation
const activeLevel = getActiveSidebarLevel(pathname)
```

**Le bouton Back** est toujours positionné **en bas de la sidebar**, juste au-dessus du footer utilisateur.

---

## 21. Internationalisation (i18n)

- `react-i18next` avec provider client-side (compatible `'use client'`).
- Fichiers : `frontend/i18n/locales/en.json` et `fr.json`.
- **Aucun string hardcodé dans les composants.**
- Les erreurs API retournent des **codes** — traduction uniquement côté frontend.
- Langue persistée dans `localStorage` (`orbix_lang`).

### Structure clés i18n

```json
{
  "common": { "save", "cancel", "delete", "edit", "loading", "error", "confirm", "actions" },
  "auth": { "login", "logout", "username", "password", ... },
  "nav": { "dashboard", "vault", "back", "emailConfigs", ... },
  "vault": {
    "email": {
      "title", "subtitle", "name", "host", "port", "status",
      "statusOk", "statusError", "statusPending",
      "testSmtp", "testSuccess", "saved", "deleted", ...
    }
  },
  "errors": { "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INVALID_INPUT", "CRYPTO_ERROR", "SMTP_ERROR", "UNHANDLED", "CONFLICT" }
}
```

---

## 22. Theming — next-themes

```tsx
// app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
```

- `attribute="class"` → Tailwind `dark:` variant.
- Pas de Zustand `themeStore` — utiliser `useTheme()` de `next-themes` directement partout.

```tsx
// Toggle dans la sidebar
const { theme, setTheme } = useTheme()
```

---

## 23. Toasts — Sonner

### Placement (root layout)

```tsx
// app/layout.tsx — après {children}, dans le ThemeProvider
<Toaster />
```

### components/ui/sonner.tsx

```typescript
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from 'next-themes'
import { CircleCheckIcon, OctagonXIcon, InfoIcon, TriangleAlertIcon, Loader2Icon } from 'lucide-react'

export function Toaster({ ...props }: ToasterProps) {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      richColors
      position="bottom-right"
      duration={6000}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
```

### Règle d'usage

**Toute action utilisateur** (create, update, delete, test) déclenche un toast :

```typescript
import { toast } from '@/components/ui/sonner'

// Succès
toast.success(t('vault.email.saved'))

// Erreur
toast.error(err instanceof ApiError ? err.message : t('common.error'))
```

---

## 24. Docker — dev vs prod

### Dev — DB seule dans Docker

```yaml
# docker-compose.yml (dev)
services:
  db:
    image: postgres:17-alpine
    container_name: orbix-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: orbix
      POSTGRES_USER: orbix
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - orbix_db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbix"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  orbix_db:
```

**Lancement dev** : `docker compose up db -d` → PostgreSQL disponible sur `localhost:5432`.

---

### Production — tout dans Docker

```yaml
# docker-compose.prod.yml
services:
  db:
    image: postgres:17-alpine
    container_name: orbix-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: orbix
      POSTGRES_USER: orbix
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - orbix_db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbix"]
      interval: 5s
      timeout: 5s
      retries: 5

  orbix:
    build: .
    container_name: orbix
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${ORBIX_PORT:-3000}:3000"
    volumes:
      - ./data:/data:ro
      - orbix_backups:/backups
      - orbix_logs:/app/logs
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://orbix:${DB_PASSWORD}@db:5432/orbix
      JWT_SECRET: ${JWT_SECRET}
      VAULT_ENCRYPTION_KEY: ${VAULT_ENCRYPTION_KEY}
      TZ: ${TZ:-UTC}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      ORBIX_SECURE: ${ORBIX_SECURE:-false}

volumes:
  orbix_db:
  orbix_backups:
  orbix_logs:
```

### Dockerfile (multi-stage — prod uniquement)

```dockerfile
# Stage 1 — Build frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output : /build/frontend/out

# Stage 2 — Build backend
FROM node:24-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build
# Output : /build/backend/dist

# Stage 3 — Production image
FROM node:24-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/node_modules ./node_modules
COPY --from=backend-builder /build/backend/package.json ./
COPY --from=backend-builder /build/backend/src/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=frontend-builder /build/frontend/out ./public

RUN mkdir -p /app/logs /backups

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

---

## 25. Dev local — workflow

### Prérequis

- Node.js 22+
- Docker Desktop (pour PostgreSQL uniquement)
- npm

### .env (racine — gitignored)

```env
# DB (partagé Docker Compose + backend local)
DB_PASSWORD=orbix_dev_password

# Backend NestJS local
JWT_SECRET=orbix-dev-jwt-secret-key-minimum-32-chars
VAULT_ENCRYPTION_KEY=orbix-dev-vault-key-minimum-32-chars-long
DATABASE_URL=postgresql://orbix:orbix_dev_password@localhost:5432/orbix
ORBIX_PORT=3001
NODE_ENV=development
LOG_LEVEL=DEBUG
TZ=Europe/Paris
ORBIX_SECURE=false
```

### backend/.env (gitignored — reprend les vars du .env racine)

```env
DATABASE_URL=postgresql://orbix:orbix_dev_password@localhost:5432/orbix
JWT_SECRET=orbix-dev-jwt-secret-key-minimum-32-chars
VAULT_ENCRYPTION_KEY=orbix-dev-vault-key-minimum-32-chars-long
PORT=3001
NODE_ENV=development
```

### frontend/.env.local (gitignored)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Démarrage dev (3 étapes)

```bash
# 1. Lancer PostgreSQL
docker compose up db -d

# 2. Lancer le backend (terminal 1)
cd backend && npm run start:dev

# 3. Lancer le frontend (terminal 2)
cd frontend && npm run dev
```

### Makefile

```makefile
-include .env
export

.PHONY: dev db backend frontend migrate

## Lance db + backend + frontend
dev:
	$(MAKE) db
	@$(MAKE) -j2 backend frontend

## Lance uniquement PostgreSQL dans Docker
db:
	docker compose up db -d

## Backend NestJS hot reload
backend:
	cd backend && npm run start:dev

## Frontend Next.js hot reload
frontend:
	cd frontend && npm run dev

## Applique les migrations Prisma
migrate:
	cd backend && npx prisma migrate dev

## Arrête la DB Docker
down:
	docker compose down
```

### dev.ps1 (Windows PowerShell)

```powershell
# Orbix dev launcher — PowerShell
$root = $PSScriptRoot

# Charger .env
Get-Content "$root\.env" | ForEach-Object {
    if ($_ -match "^([A-Z_][A-Z0-9_]*)=(.*)$") {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

# 1. Démarrer PostgreSQL
docker compose up db -d

# 2. Backend dans une nouvelle fenêtre
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\backend'; `$env:DATABASE_URL='$($env:DATABASE_URL)'; `$env:JWT_SECRET='$($env:JWT_SECRET)'; `$env:VAULT_ENCRYPTION_KEY='$($env:VAULT_ENCRYPTION_KEY)'; npm run start:dev"

# 3. Frontend dans la fenêtre courante
Set-Location "$root\frontend"
npm run dev
```

### Première installation

```bash
# Installer les dépendances
cd backend && npm install
cd ../frontend && npm install

# Lancer la DB
docker compose up db -d

# Générer le client Prisma + appliquer migrations
cd backend && npx prisma migrate dev --name init

# Démarrer
make dev   # ou .\dev.ps1 sur Windows
```

---

## 26. CI/CD — GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
  pull_request:
    branches: [master]

jobs:
  lint-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: cd backend && npm ci
      - run: cd backend && npm run lint
      - run: cd backend && npx tsc --noEmit

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_DB: orbix_test
          POSTGRES_USER: orbix
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://orbix:test@localhost:5432/orbix_test
      - run: cd backend && npm run test:cov
        env:
          DATABASE_URL: postgresql://orbix:test@localhost:5432/orbix_test
          JWT_SECRET: test-secret-minimum-32-chars-long
          VAULT_ENCRYPTION_KEY: test-vault-key-minimum-32-chars-long

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npx tsc --noEmit

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test

  build-docker:
    runs-on: ubuntu-latest
    needs: [lint-backend, test-backend, lint-frontend, test-frontend]
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t orbix:ci -f Dockerfile .
```

---

## 27. Tests

### Backend — Jest

- `*.service.spec.ts` : mock de `PrismaService` et `AesService` via `@nestjs/testing`.
- `*.controller.spec.ts` : Supertest pour les handlers HTTP.
- Coverage minimale : **70%** sur services + crypto.

```typescript
// vault.service.spec.ts — structure type
describe('VaultService', () => {
  let service: VaultService
  let prisma: DeepMockProxy<PrismaService>
  let aes: AesService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [VaultService, PrismaService, AesService, ConfigService],
    })
    .overrideProvider(PrismaService)
    .useValue(mockDeep<PrismaService>())
    .compile()

    service = module.get(VaultService)
    prisma = module.get(PrismaService)
    aes = module.get(AesService)
  })

  it('createEmail — chiffre le payload, ne retourne pas le password', async () => { ... })
  it('listEmail — retourne sans password, paginé', async () => { ... })
  it('updateEmailStatus — persiste ok/error + checkedAt', async () => { ... })
  it('testSmtp — met à jour le statut en cas d\'échec SMTP', async () => { ... })
})
```

### Frontend — Vitest

```typescript
// sidebarLevels.test.ts
it('retourne level vault pour /vault/email', () =>
  expect(getActiveSidebarLevel('/vault/email')).not.toBeNull())
it('retourne null pour /', () =>
  expect(getActiveSidebarLevel('/')).toBeNull())
it('retourne null pour /settings', () =>
  expect(getActiveSidebarLevel('/settings')).toBeNull())
```

---

## 28. Conventions de code

### TypeScript (backend + frontend)

- TypeScript **6** — `strict: true` dans tous les `tsconfig.json`.
- Pas de `any` — utiliser `unknown` + type guard si nécessaire.
- `camelCase` variables/fonctions, `PascalCase` classes/interfaces/types, `UPPER_SNAKE` constantes.
- Fichiers < 300 lignes. Si dépassement, scinder.
- Toute fonction/méthode publique porte un commentaire JSDoc.

### NestJS spécifique

- **Un module = un dossier** avec `module.ts`, `controller.ts`, `service.ts`, `dto/`.
- DTOs pour **tous** les inputs — jamais de validation manuelle dans les services.
- **Pas de logique métier dans les controllers** — les controllers délèguent aux services.
- Injection de dépendances via constructeur.
- `@Injectable()` sur tous les providers.

### Next.js / React spécifique

- `'use client'` uniquement sur les composants qui utilisent des hooks React.
- Un composant = un fichier. Props typées avec une interface `*Props`.
- **Pas de `useEffect` pour du data-fetching** — hooks custom.
- Les pages `app/(app)/*/page.tsx` sont `'use client'` si elles ont de l'état — sinon server component.

---

## 29. Conventions Git

### Branches

```
master            → stable, CI verte obligatoire pour merger
feat/v0.X.0       → développement d'une version
fix/description   → hotfix
```

### Conventional Commits

```
<type>(<scope>): <description courte en anglais>

Types  : feat | fix | refactor | test | docs | chore | style
Scopes : auth | vault | logs | settings | files | mail | contacts |
         template | scheduler | backup | output | docker | ci | ui

Exemples :
feat(vault): add email entity with AES-256-GCM encryption
feat(vault): add SMTP health check cron every 5 minutes
fix(auth): handle expired JWT cookie gracefully
test(vault): add service unit tests with prisma mock
chore(docker): add postgres service to docker-compose
```

### Règles absolues

- **Aucune mention d'un outil d'IA** dans commits, PRs, ou commentaires de code.
- Commits au nom du développeur uniquement.
- PR vers `master` bloquée si CI échoue.

---

## 30. Variables d'environnement

### Racine / Docker Compose

| Variable | Obligatoire | Description |
|---|---|---|
| `DB_PASSWORD` | ✅ | Mot de passe PostgreSQL |
| `JWT_SECRET` | ✅ | Minimum 32 caractères |
| `VAULT_ENCRYPTION_KEY` | ✅ | Minimum 32 caractères |

### Backend NestJS

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | `postgresql://orbix:<pwd>@localhost:5432/orbix` |
| `JWT_SECRET` | ✅ | — | Minimum 32 caractères |
| `VAULT_ENCRYPTION_KEY` | ✅ | — | Minimum 32 caractères |
| `PORT` | — | `3001` (dev) / `3000` (prod) | Port NestJS |
| `NODE_ENV` | — | `development` | `production` en prod |
| `TZ` | — | `UTC` | Timezone serveur |
| `LOG_LEVEL` | — | `INFO` | `DEBUG\|INFO\|WARN\|ERROR` |
| `ORBIX_SECURE` | — | `false` | `true` pour cookie Secure (HTTPS) |

### Frontend Next.js

| Variable | Obligatoire | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Dev | `http://localhost:3001` |

### .env.example

```env
# Base de données
DB_PASSWORD=change-me

# Sécurité
JWT_SECRET=change-me-minimum-32-characters-long-secret
VAULT_ENCRYPTION_KEY=change-me-minimum-32-characters-long-key

# Optionnel
ORBIX_PORT=3000
TZ=Europe/Paris
LOG_LEVEL=INFO
ORBIX_SECURE=false
```

---

## 31. Roadmap des versions

| Version | Branche | Contenu |
|---|---|---|
| **v0.1.0** | `feat/v0.1.0` | Fondations : NestJS + Next.js, PostgreSQL Docker, CI, logging JSON rotatif, auth JWT HttpOnly cookie, setup first-run, System Settings, dark/light (next-themes), i18n EN+FR, Sonner, sidebar statique |
| **v0.2.0** | `feat/v0.2.0` | Vault : EmailVaultEntity, AES-256-GCM, CRUD, test SMTP (nodemailer), job santé 5min, smtpStatus/msg/checkedAt, sidebar dynamique multi-niveaux, cursor pagination sur tous les endpoints |
| **v0.3.0** | `feat/v0.3.0` | File Explorer : navigation `/data`, confinement strict, permissions, composant `FileSelector` réutilisable |
| **v0.4.0** | `feat/v0.4.0` | Mail : envoi avec PJ (nodemailer), test connexion UI, contacts CRUD |
| **v0.5.0** | `feat/v0.5.0` | Templates : éditeur HTML + preview temps réel, variables, destinataires To/CC/BCC par défaut |
| **v0.6.0** | `feat/v0.6.0` | Scheduler : tick minute, timezones IANA, UI sélecteur timezone |
| **v0.7.0** | `feat/v0.7.0` | Backup : CRUD routines, archiver (zip/tar.gz/tar.bz2), variables nommage, dry-run obligatoire, cleaner |
| **v0.8.0** | `feat/v0.8.0` | Output Email : `OutputProvider` interface + registre, multi-destinataires, pièce jointe |
| **v0.9.0** | `feat/v0.9.0` | Polish : responsive validé toutes pages, System Settings complet, README, documentation |

---

*Ce document est vivant. Toute décision d'architecture qui s'écarte des choix documentés ici doit faire l'objet d'une mise à jour dans le même commit que l'implémentation.*
