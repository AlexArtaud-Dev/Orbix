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
13. [Module : Output — Mail](#13-module--output--mail)
14. [Module : Backup](#14-module--backup)
15. [Module : System Settings](#15-module--system-settings)
16. [Frontend — Next.js App Router](#16-frontend--nextjs-app-router)
17. [Sidebar dynamique multi-niveaux](#17-sidebar-dynamique-multi-niveaux)
18. [Internationalisation (i18n)](#18-internationalisation-i18n)
19. [Theming — next-themes](#19-theming--next-themes)
20. [Toasts — Sonner](#20-toasts--sonner)
21. [Docker — dev vs prod](#21-docker--dev-vs-prod)
22. [Dev local — workflow](#22-dev-local--workflow)
23. [CI/CD — GitHub Actions](#23-cicd--github-actions)
24. [Tests](#24-tests)
25. [Conventions de code](#25-conventions-de-code)
26. [Conventions Git](#26-conventions-git)
27. [Variables d'environnement](#27-variables-denvironnement)
28. [Roadmap des versions](#28-roadmap-des-versions)

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

### Notes pratiques

- Utiliser **pnpm** (pas npm) dans les deux workspaces.
- Le projet se run en local (DB seule dans Docker) et en Docker complet.
- Doc shadcn dans `documentation/shadcn/` — lire uniquement le fichier `.md` du composant concerné.

---

## 3. Stack technique

### Backend — NestJS

| Rôle | Choix |
|---|---|
| Framework | **NestJS 11** |
| Langage | **TypeScript** strict |
| ORM | **Prisma 7** |
| Base de données | **PostgreSQL 17** (Alpine, via Docker) |
| Auth | `@nestjs/jwt` + `cookie-parser` (HttpOnly cookie) |
| Chiffrement | Node.js `crypto` stdlib — AES-256-GCM, zéro lib externe |
| Hash passwords | `bcryptjs` |
| Validation | `class-validator` + `class-transformer` + `ValidationPipe` global |
| SMTP | `nodemailer` |
| Scheduler | `@nestjs/schedule` + `@Cron()` |
| Static files (prod) | `@nestjs/serve-static` (sert le build Next.js) |
| Config | `@nestjs/config` |
| Tests | Jest |

### Frontend — Next.js

| Rôle | Choix |
|---|---|
| Framework | **Next.js 14** (App Router) |
| Langage | **TypeScript** strict |
| UI components | **shadcn/ui** (composants copiés localement, basé Radix UI) |
| Styles | **Tailwind CSS v4** |
| State | **Zustand** |
| Theming | **`next-themes`** |
| i18n | `react-i18next` |
| Toasts | **Sonner** |
| HTTP client | `fetch` natif encapsulé dans `lib/api.ts` |
| Icônes | `lucide-react` |
| Tests | Vitest |

> **`output: 'export'` est désactivé.** Next.js en mode static export est incompatible avec les routes dynamiques `[id]` sans `generateStaticParams`. Seul `images: { unoptimized: true }` est conservé dans `next.config.ts`.

---

## 4. Architecture générale

### Développement

```
┌─────────────────────────────────────────────────────┐
│  Local machine                                      │
│                                                     │
│  ┌─────────────────┐      ┌─────────────────────┐  │
│  │  Next.js :3000  │─────▶│  NestJS :3001       │  │
│  │  (pnpm dev)     │ /api │  (pnpm start:dev)   │  │
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
│  ┌───────────────────────┐  ┌───────────────────┐   │
│  │  orbix-backend :3001  │  │  orbix-frontend   │   │
│  │  NestJS               │  │  Next.js :3000    │   │
│  │  /api/*               │  │  /*               │   │
│  └───────────┬───────────┘  └───────────────────┘   │
│              │                                       │
│  ┌───────────▼───────────────────────────────────┐  │
│  │  orbix-db (PostgreSQL 17 Alpine)              │  │
│  │  Volume persisté                              │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Volumes : /data (ro), /backups, /app/logs           │
└──────────────────────────────────────────────────────┘
```

---

## 5. Structure des dossiers

```
orbix/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── dto/
│   │   │   ├── vault/
│   │   │   │   ├── vault.module.ts       # exports VaultService
│   │   │   │   ├── vault.controller.ts
│   │   │   │   ├── vault.service.ts
│   │   │   │   ├── vault.scheduler.ts    # Cron 5min
│   │   │   │   ├── vault.types.ts
│   │   │   │   └── dto/
│   │   │   ├── logs/
│   │   │   │   ├── logs.module.ts        # @Global() — exports LogsWriter
│   │   │   │   ├── logs.controller.ts
│   │   │   │   ├── logs.service.ts
│   │   │   │   ├── logs.writer.ts
│   │   │   │   └── logs.types.ts
│   │   │   ├── settings/
│   │   │   │   ├── settings.module.ts
│   │   │   │   ├── settings.controller.ts
│   │   │   │   ├── settings.service.ts
│   │   │   │   └── dto/
│   │   │   ├── files/                    # v0.3.0
│   │   │   │   ├── files.module.ts
│   │   │   │   ├── files.controller.ts
│   │   │   │   └── files.service.ts
│   │   │   ├── contacts/                 # v0.4.0
│   │   │   │   ├── contacts.module.ts
│   │   │   │   ├── contacts.controller.ts
│   │   │   │   ├── contacts.service.ts
│   │   │   │   └── dto/
│   │   │   ├── mail/                     # v0.4.0
│   │   │   │   ├── mail.module.ts        # imports VaultModule
│   │   │   │   ├── mail.controller.ts    # POST /api/mail/send (interne)
│   │   │   │   ├── mail.service.ts
│   │   │   │   ├── templates.controller.ts
│   │   │   │   ├── templates.service.ts
│   │   │   │   └── dto/
│   │   │   └── backup/                   # v0.5.0
│   │   │       ├── backup.module.ts
│   │   │       ├── backup.controller.ts
│   │   │       ├── backup.service.ts
│   │   │       ├── backup.runner.ts
│   │   │       ├── backup.scheduler.ts
│   │   │       └── dto/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   └── filters/
│   │   │       └── http-exception.filter.ts
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── generated/prisma/             # Client généré par Prisma
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env                              # gitignored
│   ├── package.json
│   ├── nest-cli.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                    # Root : ThemeProvider + Toaster + i18n
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── setup/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx                # AppLayout (sidebar + auth guard)
│   │       ├── page.tsx                  # Dashboard
│   │       ├── vault/email/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── files/page.tsx
│   │       ├── output/                   # v0.4.0 — sélecteur de type d'output
│   │       │   ├── page.tsx              # Cards : Mail (actif), S3/Webhook (soon)
│   │       │   └── mail/
│   │       │       ├── page.tsx          # redirect → /output/mail/contacts
│   │       │       ├── contacts/page.tsx # CRUD contacts
│   │       │       └── templates/
│   │       │           ├── page.tsx      # Liste des templates
│   │       │           ├── new/page.tsx  # Éditeur split view (création)
│   │       │           └── [id]/page.tsx # Éditeur split view (édition)
│   │       ├── backups/                  # v0.5.0
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── logs/page.tsx
│   │       └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                           # shadcn/ui (copiés)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── sidebarLevels.ts
│   │   └── mail/                         # Composants réutilisables mail/output
│   │       ├── ContactPicker.tsx         # Multi-select Outlook (Command+Popover)
│   │       ├── VariableInserter.tsx      # Bouton {{}} + popover variables
│   │       └── TemplateEditor.tsx        # Éditeur split gauche/droite + iframe
│   ├── lib/
│   │   ├── api.ts                        # Fetch wrapper : get/post/patch/delete/postForm
│   │   └── utils.ts
│   ├── services/
│   │   ├── auth.ts
│   │   ├── vault.ts
│   │   ├── logs.ts
│   │   ├── settings.ts
│   │   ├── files.ts
│   │   ├── contacts.ts
│   │   ├── mail.ts
│   │   └── templates.ts
│   ├── stores/
│   │   └── authStore.ts                  # Zustand
│   ├── i18n/
│   │   ├── locales/en.json
│   │   ├── locales/fr.json
│   │   └── index.ts
│   ├── next.config.ts                    # images: { unoptimized: true } seulement
│   ├── components.json
│   └── package.json
│
├── docker-compose.yml                    # Dev : DB seule
├── docker-compose.prod.yml               # Prod : DB + backend + frontend
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
├── .env                                  # gitignored
├── Makefile
├── dev.ps1
├── .github/workflows/ci.yml
└── NEW_PROJECT.md
```

---

## 6. Base de données — Prisma + PostgreSQL

### Configuration

```prisma
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}
```

### Schéma complet (état v0.4.0)

```prisma
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
  type             String                      // "email" | futur "s3" | "sftp"
  encryptedPayload String                      // AES-256-GCM, jamais renvoyé en clair
  smtpStatus       String?                     // "ok" | "error" | null
  smtpStatusMsg    String?
  smtpCheckedAt    DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model Contact {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  tags      String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MailTemplate {
  id        String   @id @default(cuid())
  name      String   @unique
  subject   String                             // Supporte {{variables}}
  body      String                             // Texte ou HTML avec {{variables}}
  bodyType  String   @default("text")          // "text" | "html"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MailLog {
  id       String   @id @default(cuid())
  vaultId  String
  toAddrs  String[]
  subject  String
  status   String                              // "sent" | "error"
  errorMsg String?
  sentAt   DateTime @default(now())
}

model SystemSettings {
  id                  String @id @default("singleton")
  maxFileSizeMb       Int    @default(500)
  logRetentionDays    Int    @default(30)
  backupRetentionDays Int    @default(90)
  defaultTimezone     String @default("UTC")
  defaultLanguage     String @default("en")
  defaultTheme        String @default("dark")
  filesRoot           String @default("/data/files")
}

// Ajouté en v0.5.0 :
// Backup, BackupOutput
```

### Conventions Prisma

- **Migrations** : `prisma migrate dev --name <desc>` en dev, `prisma migrate deploy` en prod.
- **PrismaService** : singleton injectable via `PrismaModule`.
- **IDs** : `cuid()` — chaîne URL-safe.
- **Pas de `$queryRaw`** sauf nécessité absolue documentée.
- Après chaque migration : `prisma generate` pour régénérer le client typé.

---

## 7. Sécurité

### JWT — HttpOnly Cookie

```typescript
res.cookie('orbix_token', jwt, {
  httpOnly: true,
  secure: configService.get('ORBIX_SECURE') === 'true',
  sameSite: secure ? 'strict' : 'lax',   // lax en dev (cross-port), strict en prod
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
})
```

- **Jamais dans `localStorage` / `sessionStorage` / mémoire JS.**
- `JwtAuthGuard` global — exceptions sur `/api/auth/*`.
- Setup first-run : si aucun `User` en DB → seule `/api/auth/setup` accessible.

### Chiffrement Vault — AES-256-GCM

- Clé dérivée via `scryptSync(VAULT_ENCRYPTION_KEY, 'orbix-vault', 32)`.
- Format stocké : `iv_hex:authTag_hex:encrypted_hex`.
- **Valeurs chiffrées jamais renvoyées en API** — le champ `password` est absent de toutes les réponses.
- `VaultService.getEmailPayload(id)` existe pour usage **interne uniquement** (MailService).

### Sécurité fichiers

- Toutes les opérations fichier confinées dans le `filesRoot` défini dans SystemSettings.
- Path traversal rejeté avec code `FORBIDDEN` avant tout traitement.

### Sécurité preview HTML

- L'iframe de preview des templates utilise `sandbox=""` (attribut vide) — **aucun script ne s'exécute**, l'origine est traitée comme null.

### Validation

- `ValidationPipe` global avec `whitelist: true`, `forbidNonWhitelisted: true`.

---

## 8. API REST — conventions

### Format de réponse uniforme

```typescript
// Succès — liste paginée (les controllers wrappent toujours dans { data: result })
{ "data": { "data": [...], "nextCursor": "cuid" | null } }

// Succès — objet unique
{ "data": { ... } }

// Erreur
{ "error": { "code": "INVALID_INPUT", "message": "..." } }
```

> **Important :** `api.get<T>()` côté frontend unwrappe `json.data`. Pour les listes paginées, le controller retourne `{ data: result }` où `result = { data: [], nextCursor }`. Le frontend reçoit donc directement `{ data: [], nextCursor }`.

### Pagination curseur (OBLIGATOIRE sur toutes les listes)

```
GET /api/contacts?cursor=<cuid>&limit=20
```

- `cursor` : ID du dernier item reçu (absent = première page).
- `limit` : défaut 20, max 100. La requête Prisma fait `take: limit + 1` pour détecter s'il y a une page suivante.

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
| `UNHANDLED` | 500 | Erreur non gérée |

---

## 9. Module : Auth

### Endpoints

| Méthode | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/setup` | Non | Création admin (désactivé après 1er user) |
| `POST` | `/api/auth/login` | Non | Login → set cookie JWT |
| `POST` | `/api/auth/logout` | Oui | Supprime le cookie |
| `GET` | `/api/auth/me` | Oui | User courant |

**Logs écrits :** `AUTH_SETUP` (INFO), `AUTH_LOGIN` (INFO), `AUTH_LOGIN_FAILED` (WARN), `AUTH_LOGOUT` (INFO).

---

## 10. Module : Vault

### Payload EmailEntity (chiffré, jamais exposé)

```typescript
interface EmailPayload {
  host: string
  port: number
  user: string
  password: string
  fromAddr: string
  fromName: string
  secure: boolean   // true = SSL/TLS, false = STARTTLS
}
```

### Endpoints

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/vault/email` | Liste paginée (cursor) |
| `GET` | `/api/vault/email/count` | Comptage pour dashboard |
| `GET` | `/api/vault/email/:id` | Détail sans password |
| `POST` | `/api/vault/email` | Création |
| `PATCH` | `/api/vault/email/:id` | Mise à jour partielle |
| `DELETE` | `/api/vault/email/:id` | Suppression |
| `POST` | `/api/vault/email/:id/test` | Test SMTP + maj statut |

**Méthode interne :** `VaultService.getEmailPayload(id): Promise<EmailPayload>` — décrypte et retourne le payload complet. À appeler uniquement depuis d'autres services NestJS (MailService), jamais depuis un controller.

**Cron 5 min :** `VaultScheduler` vérifie toutes les connexions SMTP et met à jour `smtpStatus`.

**Logs écrits :** `VAULT_SMTP_CREATED`, `VAULT_SMTP_DELETED`, `VAULT_SMTP_TEST_OK`, `VAULT_SMTP_TEST_FAIL`, `VAULT_SMTP_CRON_START/DONE/ERROR`.

---

## 11. Module : Logs

### Architecture

Fichiers JSON Lines rotatifs dans `./logs/` (dev) ou `/app/logs/` (prod, volume Docker).

```
logs/
├── auth-2026-01-15.log
├── vault-2026-01-15.log
├── mail-2026-01-15.log
└── backup-2026-01-15.log
```

### Format JSON Lines

```json
{"ts":"2026-01-15T14:32:01Z","level":"ERROR","category":"vault","code":"SMTP_ERROR","msg":"Connection failed","detail":"ETIMEDOUT"}
```

### Catégories & niveaux

**Catégories :** `auth` | `backup` | `mail` | `scheduler` | `system` | `vault`  
**Niveaux :** `DEBUG` | `INFO` | `WARN` | `ERROR`

### LogsWriter — règle d'usage

`LogsModule` est `@Global()` → `LogsWriter` est injectable partout **sans importer `LogsModule`**.

```typescript
// Dans n'importe quel service
constructor(private readonly logs: LogsWriter) {}

this.logs.info('vault', 'VAULT_SMTP_TEST_OK', `SMTP test OK: ${name}`)
this.logs.warn('vault', 'VAULT_SMTP_TEST_FAIL', `SMTP test failed: ${name}`, errorDetail)
this.logs.error('backup', 'BACKUP_RUN_FAILED', `Backup failed: ${name}`, errorMsg)
```

**Mock obligatoire dans les tests :**

```typescript
{ provide: LogsWriter, useValue: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }
```

Tout service qui injecte `LogsWriter` doit fournir ce mock dans son `*.service.spec.ts`.

### Endpoint

```
GET /api/logs?cursor=&limit=&category=&level=&from=&to=
```

---

## 12. Module : File Explorer

- Navigation dans `filesRoot` (défini dans SystemSettings, défaut `/data/files`).
- Path traversal rejeté strictement avant tout traitement.
- Affichage : nom, type, taille, date modification, permissions, propriétaire.
- **Lecture seule.**
- Composant frontend : `FileSelector` réutilisable pour le module Backup.

---

## 13. Module : Output — Mail

### Vue d'ensemble

Le module Mail fournit :
1. **Contacts** — annuaire des destinataires (CRUD)
2. **Templates** — modèles d'emails avec variables `{{...}}` (CRUD + éditeur)
3. **Envoi** — `MailService.send()` est **interne uniquement** (appelé par le Backup runner, pas exposé dans l'UI)

### Navigation frontend

```
/output                          ← sélecteur de type (Mail actif, S3/Webhook soon)
/output/mail/contacts            ← CRUD contacts
/output/mail/templates           ← liste des templates
/output/mail/templates/new       ← éditeur plein écran (création)
/output/mail/templates/:id       ← éditeur plein écran (édition)
```

### Contacts

```typescript
// GET /api/contacts?cursor=&limit=
// POST /api/contacts
// GET /api/contacts/:id
// PATCH /api/contacts/:id
// DELETE /api/contacts/:id
```

**Règle :** les destinataires des emails sont **uniquement des contacts pré-créés**. Aucun free-input email dans l'UI.

**Composant frontend :** `ContactPicker` — multi-select style Outlook (Command + Popover) :
- Recherche par nom ou email.
- Contacts sélectionnés affichés en tête de liste quand pas de recherche.
- Chips supprimables dans le champ.

### Templates

```typescript
// GET /api/mail/templates?cursor=&limit=
// POST /api/mail/templates
// GET /api/mail/templates/:id
// PATCH /api/mail/templates/:id
// DELETE /api/mail/templates/:id
```

**Éditeur plein écran split :**
- Gauche : champs Subject + Body (textarea monospace)
- Droite : preview live — iframe sandboxée (`sandbox=""`) pour HTML, `<pre>` pour texte plain
- Bouton `{}` sur Subject et Body : ouvre un Popover listant les variables disponibles, les insère à la position du curseur

### Système de variables

Syntaxe : `{{variable}}`. Disponibles dans subject ET body.

| Variable | Scope | Description |
|---|---|---|
| `{{recipient.name}}` | Destinataire | Nom du contact |
| `{{recipient.email}}` | Destinataire | Email du contact |
| `{{date}}` | Système | Date courante |
| `{{time}}` | Système | Heure courante |
| `{{datetime}}` | Système | Date + heure |
| `{{backup.name}}` | Backup | Nom de la routine |
| `{{backup.size}}` | Backup | Taille de l'archive |
| `{{backup.archive}}` | Backup | Nom du fichier archive |
| `{{backup.files_count}}` | Backup | Nombre de fichiers |

La résolution des variables se fait côté backend dans `BackupRunner` au moment de l'envoi.

### Envoi

`POST /api/mail/send` — multipart/form-data, **interne uniquement**, pas d'UI associée.

```typescript
interface SendMailDto {
  vaultId: string        // Compte SMTP (VaultEntity)
  to: string[]           // Adresses emails (résolues depuis contacts)
  subject: string        // Après résolution des variables
  body: string           // Après résolution des variables
  bodyType?: 'text' | 'html'
}
```

**Logs écrits :** `MAIL_SENT` (INFO), `MAIL_SEND_FAILED` (ERROR), `MAIL_TEMPLATE_CREATED/UPDATED/DELETED` (INFO).

---

## 14. Module : Backup

### Vue d'ensemble

Définit les routines de sauvegarde : quoi (sources), comment (compression), quand (schedule cron), vers où (outputs mail).

### Schéma Prisma (v0.5.0)

```prisma
model Backup {
  id          String         @id @default(cuid())
  name        String         @unique
  sources     Json           // { paths: string[], exclude: string[] }
  compression String         @default("auto")  // "none" | "auto" | "forced"
  schedule    String?        // Expression cron ou null (manuel uniquement)
  enabled     Boolean        @default(true)
  lastRunAt   DateTime?
  lastStatus  String?        // "success" | "error" | null
  outputs     BackupOutput[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}

model BackupOutput {
  id               String   @id @default(cuid())
  backupId         String
  backup           Backup   @relation(fields: [backupId], references: [id], onDelete: Cascade)
  type             String   // "mail" (futur : "s3", "sftp")
  vaultId          String   // Compte SMTP à utiliser
  templateId       String?  // MailTemplate de base
  recipientsTo     String[] // IDs de Contact
  recipientsCc     String[]
  recipientsBcc    String[]
  overrideSubject  String?  // Remplace le subject du template (supporte {{variables}})
  overrideBody     String?  // Remplace le body du template
  overrideBodyType String?  // "text" | "html"
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

### Compression

| Valeur | Comportement |
|---|---|
| `none` | Copie fichiers tels quels, pas d'archive |
| `auto` | Zip uniquement si plusieurs fichiers/dossiers |
| `forced` | Zip toujours, même pour un seul fichier |

### Endpoints

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/backups` | Liste paginée |
| `POST` | `/api/backups` | Création |
| `GET` | `/api/backups/:id` | Détail |
| `PATCH` | `/api/backups/:id` | Mise à jour |
| `DELETE` | `/api/backups/:id` | Suppression |
| `POST` | `/api/backups/:id/run` | Déclenchement manuel |

### BackupRunner

Exécute un backup :
1. Résout les chemins sources, vérifie l'accès
2. Archive selon la config de compression
3. Pour chaque `BackupOutput` : résout les contacts, résout les variables dans subject/body, appelle `MailService.send()`
4. Met à jour `lastRunAt`, `lastStatus`
5. Logue le résultat (category: `backup`)

### BackupScheduler

Charge tous les backups `enabled = true` au démarrage de l'app. Ajoute/retire/remplace dynamiquement les cron jobs quand un backup est créé, mis à jour ou supprimé.

### Frontend

- `/backups` — liste (nom, schedule human-readable, last run status, toggle enabled, bouton Run now)
- `/backups/new` — formulaire unique (sources via `FileSelector`, compression, cron, outputs)
- `/backups/[id]` — même formulaire pré-rempli

Les composants `ContactPicker` et `VariableInserter` sont réutilisés dans la configuration des outputs.

---

## 15. Module : System Settings

Singleton en DB (ID fixe `"singleton"`).

| Paramètre | Type | Défaut |
|---|---|---|
| `maxFileSizeMb` | Int | 500 |
| `logRetentionDays` | Int | 30 |
| `backupRetentionDays` | Int | 90 |
| `defaultTimezone` | String | `"UTC"` |
| `defaultLanguage` | String | `"en"` |
| `defaultTheme` | String | `"dark"` |
| `filesRoot` | String | `"/data/files"` |

---

## 16. Frontend — Next.js App Router

### next.config.ts

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // output: 'export' est DÉSACTIVÉ — incompatible avec les routes [id] sans generateStaticParams
}

export default nextConfig
```

### Service API typé (`lib/api.ts`)

```typescript
export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? ''
  const res = await fetch(base + path, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const json = await res.json()
    throw new ApiError(json.error?.code ?? 'UNHANDLED', json.error?.message ?? 'Error')
  }
  const json = await res.json()
  return json.data as T
}

export const api = {
  get:      <T>(path: string) => request<T>(path),
  post:     <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  patch:    <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete:   <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
}
```

> `postForm` ne définit **pas** de `Content-Type` — le navigateur l'ajoute automatiquement avec le boundary multipart correct.

---

## 17. Sidebar dynamique multi-niveaux

### Principe

`getActiveSidebarLevel(pathname)` retourne le niveau dont le **préfixe est le plus long** correspondant au pathname courant. La sidebar affiche soit les items du niveau actif, soit `ROOT_NAV_ITEMS` (si aucun niveau actif). Un bouton Back (en bas de sidebar) navigue vers `level.parentPath`.

### Niveaux actuels

```typescript
SIDEBAR_LEVELS = {
  '/vault': {
    parentPath: '/',
    titleKey: 'nav.vault',
    items: [{ to: '/vault/email', icon: Mail, labelKey: 'nav.emailConfigs' }],
  },
  '/output': {
    parentPath: '/',
    titleKey: 'nav.output',
    items: [{ to: '/output/mail/contacts', icon: Mail, labelKey: 'nav.outputMail' }],
  },
  '/output/mail': {           // Plus long que '/output' → gagne sur /output/mail/*
    parentPath: '/output',
    titleKey: 'nav.outputMail',
    items: [
      { to: '/output/mail/contacts', icon: Users, labelKey: 'nav.contacts' },
      { to: '/output/mail/templates', icon: FileText, labelKey: 'nav.templates' },
    ],
  },
}
```

**Navigation résultante :**

| Pathname | Sidebar affiche |
|---|---|
| `/` | ROOT_NAV_ITEMS |
| `/output` | Niveau output (types disponibles) |
| `/output/mail/*` | Niveau output/mail (contacts, templates) + Back → `/output` |
| `/output/mail/templates/new` | Niveau output/mail (préfixe le plus long) |

Pour ajouter un nouveau type d'output (ex. S3) : ajouter une entrée dans `SIDEBAR_LEVELS['/output'].items` et créer `SIDEBAR_LEVELS['/output/s3']`.

---

## 18. Internationalisation (i18n)

- `react-i18next` avec provider client-side.
- Fichiers : `frontend/i18n/locales/en.json` et `fr.json`.
- **Aucun string hardcodé dans les composants** — tout passe par `t('clé')`.
- Les erreurs API retournent des **codes** — traduction uniquement côté frontend via `t('errors.CODE')`.

### Clés principales (état v0.4.0)

```
common.*         — save, cancel, delete, edit, loading, error, confirm, back, noResults
auth.*           — login, logout, setup, ...
nav.*            — dashboard, vault, files, output, outputMail, contacts, templates, backups, logs, settings
dashboard.*
logs.*
settings.*
vault.*
files.*
output.*         — title, subtitle, type.mail, type.s3, comingSoon, soon
mail.*           — bodyText, bodyHtml, bodyTextPlaceholder, bodyHtmlPlaceholder
contacts.*       — title, subtitle, add, empty, name, email, tags, create/update/deleteSuccess, ...
templates.*      — title, subtitle, add, empty, name, subject, body, preview, backToList, errorNo*, ...
errors.*         — UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INVALID_INPUT, CRYPTO_ERROR, SMTP_ERROR, UNHANDLED
```

---

## 19. Theming — next-themes

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
```

- `attribute="class"` → Tailwind `dark:` variant.
- Utiliser `useTheme()` de `next-themes` directement, pas de Zustand pour le thème.

---

## 20. Toasts — Sonner

```typescript
import { toast } from 'sonner'   // ← TOUJOURS depuis "sonner" directement

toast.success(t('vault.createSuccess'))
toast.error(err instanceof ApiError ? t(`errors.${err.code}`) : t('common.error'))
```

> `@/components/ui/sonner` n'exporte que `Toaster` (le renderer dans le layout root). Il n'exporte **pas** `toast`. Importer `toast` depuis `"sonner"` directement.

**Toute action utilisateur** (create, update, delete, test, send) déclenche un toast success ou error.

---

## 21. Docker — dev vs prod

### Dev — DB seule

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: orbix
      POSTGRES_USER: orbix
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes: [orbix_db:/var/lib/postgresql/data]
```

### Production — deux conteneurs séparés

```yaml
# docker-compose.prod.yml
services:
  db:
    image: postgres:17-alpine
    ...

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      DATABASE_URL: postgresql://orbix:${DB_PASSWORD}@db:5432/orbix
      JWT_SECRET: ${JWT_SECRET}
      VAULT_ENCRYPTION_KEY: ${VAULT_ENCRYPTION_KEY}
      NODE_ENV: production
      ORBIX_SECURE: "true"
    volumes:
      - ./data:/data:ro
      - orbix_backups:/backups
      - orbix_logs:/app/logs

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3001
```

---

## 22. Dev local — workflow

### Prérequis

- Node.js 22+, pnpm 9+
- Docker Desktop (pour PostgreSQL uniquement en dev)

### backend/.env

```env
DATABASE_URL=postgresql://orbix:orbix_dev_password@localhost:5432/orbix
JWT_SECRET=orbix-dev-jwt-secret-key-minimum-32-chars
VAULT_ENCRYPTION_KEY=orbix-dev-vault-key-minimum-32-chars-long
PORT=3001
NODE_ENV=development
ORBIX_SECURE=false
```

### frontend/.env.local

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Démarrage

```powershell
# Windows — script tout-en-un
.\dev.ps1

# Ou manuellement (3 terminaux)
docker compose up db -d
cd backend  && pnpm run start:dev
cd frontend && pnpm run dev
```

### Première installation

```powershell
cd backend  && pnpm install && npx prisma migrate dev --name init
cd frontend && pnpm install
```

---

## 23. CI/CD — GitHub Actions

Les jobs sont définis dans `.github/workflows/ci.yml` :

- **lint-backend** : `pnpm lint` + `tsc --noEmit`
- **test-backend** : Jest (les tests mockent Prisma — pas besoin de DB)
- **lint-frontend** : `pnpm lint` + `tsc --noEmit`
- **test-frontend** : Vitest
- **build-docker** : `docker build` (déclenché uniquement si les 4 précédents passent)

PR vers `master` bloquée si CI échoue.

---

## 24. Tests

### Backend — Jest

**Pattern type :**

```typescript
// contacts.service.spec.ts
import { LogsWriter } from '../logs/logs.writer'

// Mock LogsWriter — OBLIGATOIRE pour tout service qui l'injecte
const mockLogs = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

beforeEach(async () => {
  const module = await Test.createTestingModule({
    providers: [
      ContactsService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: LogsWriter, useValue: mockLogs },  // ← ne pas oublier
    ],
  }).compile()
})
```

**Ce qu'on teste :**
- Logique métier des services (CRUD, pagination, conflit, not found)
- Chiffrement/déchiffrement Vault (round-trip)
- Que les réponses API ne contiennent pas de champs sensibles (`password`)

**Ce qu'on ne teste pas :** controllers HTTP, logique de routage Next.js.

### Frontend — Vitest

**Ce qu'on teste :**
- Fonctions pures utilitaires (`files.utils.ts`)
- Logique de navigation sidebar (`sidebarLevels.ts`) — notamment que le préfixe le plus long gagne

```typescript
it('output/mail level prend le dessus sur output level', () => {
  const level = getActiveSidebarLevel('/output/mail/contacts')
  expect(level?.titleKey).toBe('nav.outputMail')   // pas 'nav.output'
})
```

### Commandes

```bash
cd backend  && pnpm run test
cd frontend && pnpm run test
```

---

## 25. Conventions de code

### TypeScript

- `strict: true` dans tous les `tsconfig.json`.
- Pas de `any` — utiliser `unknown` + type guard.
- Pas de `@ts-ignore` / `@ts-expect-error` sans commentaire expliquant pourquoi.

### NestJS

- **Un module = un dossier** avec `module.ts`, `controller.ts`, `service.ts`, `dto/`.
- DTOs pour **tous** les inputs — jamais de validation manuelle dans les services.
- **Pas de logique métier dans les controllers** — déléguer aux services.
- **`LogsWriter` injecté** dans tout service qui effectue des actions utilisateur significatives.

### React / Next.js

- `'use client'` uniquement si hooks ou interactivité.
- Un composant = un fichier. Props typées avec interface `*Props`.
- **Pas de `useEffect` pour reset de formulaire** — utiliser le pattern `key` prop :

  ```tsx
  // ✅ Correct : key force le remount avec les nouvelles props
  <MyDialog key={`${entity?.id ?? 'new'}-${String(isOpen)}`} entity={entity} />

  // ❌ À éviter : setState synchrone dans useEffect → règle react-hooks/set-state-in-effect
  useEffect(() => { setName(entity?.name ?? '') }, [entity])
  ```

- **Pas de `useEffect` pour data-fetching** dans les pages — fetch dans un handler ou `useEffect` avec une guard `// eslint-disable-line`.

### shadcn UI

- **Exclusivement** les composants shadcn installés — jamais de `<input>`, `<button>`, `<select>` HTML bruts.
- Composants installés : Button, Input, Label, Card, Field/FieldGroup, Select, Separator, Sonner, Dialog, Textarea, Popover, Command.
- `toast` importé depuis `"sonner"`, jamais depuis `"@/components/ui/sonner"`.
- Layouts de listes : cards compactes avec actions icon-only à droite (`size="icon-sm"`).

---

## 26. Conventions Git

### Branches

```
master              → stable, CI verte obligatoire pour merger
feature/v0.X.0-*    → développement d'une version
fix/description     → hotfix
```

### Conventional Commits

```
<type>(<scope>): <description en anglais>

Types  : feat | fix | refactor | test | docs | chore | style
Scopes : auth | vault | logs | settings | files | output | mail |
         contacts | templates | backup | scheduler | docker | ci | ui
```

### Règles absolues

- **Aucune mention d'un outil d'IA** dans commits, PRs, ou commentaires de code.
- Commits au nom du développeur uniquement (`AlexArtaud-Dev`).
- `documentation/` et `.claude/` dans `.gitignore` — ne jamais les stager.
- PR vers `master` bloquée si CI échoue.

---

## 27. Variables d'environnement

### Backend NestJS

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | `postgresql://orbix:<pwd>@localhost:5432/orbix` |
| `JWT_SECRET` | ✅ | — | Minimum 32 caractères |
| `VAULT_ENCRYPTION_KEY` | ✅ | — | Minimum 32 caractères |
| `PORT` | — | `3001` | Port NestJS |
| `NODE_ENV` | — | `development` | `production` en prod |
| `ORBIX_SECURE` | — | `false` | `true` pour cookie Secure (HTTPS) |

### Frontend Next.js

| Variable | Obligatoire | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Dev | `http://localhost:3001` — absent en prod (même origine) |

---

## 28. Roadmap des versions

| Version | Statut | Contenu réel |
|---|---|---|
| **v0.1.0** | ✅ Done | Auth JWT, Settings, Logs, Dashboard, i18n EN+FR, dark/light, sidebar dynamique |
| **v0.2.0** | ✅ Done | Vault email AES-256-GCM, CRUD, test SMTP, cron health 5min, dashboard stats, tests |
| **v0.3.0** | ✅ Done | File Explorer, navigation serveur, confinement path, propriétés fichier |
| **v0.3.5** | ✅ Done | Split Docker (frontend + backend conteneurs séparés) |
| **v0.4.0** | ✅ Done | Output mail : contacts CRUD, templates (éditeur split + live preview HTML + variables `{{...}}`), ContactPicker, VariableInserter, fix LogsWriter non câblé |
| **v0.5.0** | ❌ | Backup : sources (FileSelector), compression auto/forced, schedule cron, outputs (contacts + template + override), BackupRunner, BackupScheduler dynamique |
| **v0.6.0** | ❌ | Output pipeline : résolution variables au run-time, envoi par destinataire (per-recipient substitution), MailLog |
| **v0.7.0** | ❌ | Polish, responsive, System Settings complet, README, documentation |

> **Note v0.4.0 :** le Template Builder initialement prévu en v0.5.0 a été absorbé dans v0.4.0 sous le module Output Mail. La v0.5.0 est donc maintenant le module Backup (précédemment v0.7.0).

---

*Ce document est vivant. Toute décision d'architecture qui s'écarte des choix documentés ici doit faire l'objet d'une mise à jour dans le même commit que l'implémentation.*
