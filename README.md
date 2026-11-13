# GoToTalk

A PWA speaking trainer for Ukrainian-speaking learners of English (level A2 and above): the user answers by voice, sees a verbatim transcript with highlighted mistakes, and the system maintains a learner model (error patterns and words with the states new / partial / passive / active).

## Requirements

- Node 26 (`.node-version`)
- pnpm (version in `packageManager` of the root `package.json`), installed separately, without corepack
- Podman with `podman compose` (Docker is not used)
- For e2e locally: Microsoft Edge (see below)
- For Android: Android Studio (emulator) or a phone over USB, `adb`

## Quick start (PowerShell)

```powershell
Copy-Item .env.example .env
# Fill in every variable in .env that has no value in .env.example (POSTGRES_*, DATABASE_URL, TEST_DATABASE_URL, JWT_ACCESS_SECRET)
pnpm install
podman compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:5173`. `pnpm dev` builds `packages/shared` and starts the api (port 3000) and web (port 5173) together; web proxies `/api` to the backend. Backend check: `http://localhost:3000/api/health`, Swagger: `http://localhost:3000/api/docs`.

The `.env` file is not committed to git. The `gototalk_test` database for integration tests is created by the `db/init` script when the container starts for the first time.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

- `pnpm test` includes the API integration tests, so `podman compose up -d` must be running and `TEST_DATABASE_URL` must be set; Vitest applies migrations to the test database itself (globalSetup), while `pnpm db:migrate` is needed for the dev database.
- `pnpm test:e2e` (Playwright, mobile viewport 360×800) needs the database up: `/api/health` checks the connection to it. Playwright starts the apps itself (or reuses an already running `pnpm dev`). Locally the tests run in the installed Edge; another channel can be set with the `PW_CHANNEL` variable. CI uses Playwright Chromium: `pnpm exec playwright install --with-deps chromium`.

## Authentication

Email and password sign-up (no email confirmation). The API issues a 15-minute access JWT, kept only in the memory of the frontend, and a 30-day refresh token in the `gtt_refresh` cookie (HttpOnly, Secure, SameSite=Strict, `Path=/api/auth`); only its SHA-256 hash is stored in `refresh_tokens`. A refresh rotates the token. Presenting a rotated token again within 60 seconds (a reload or a second tab while the new cookie was lost) is not treated as theft: it yields another new token and revokes nothing. A later replay deletes all refresh tokens of that user, and logout deletes the presented token. After the first sign-in the consent screen must be accepted before any recording (`users.consent_at`). The account can be deleted from the profile (password required); the cascade removes the user's data.

- `JWT_ACCESS_SECRET` is required (at least 32 characters). Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- `pnpm db:seed` creates the demo user `demo@gototalk.local` with the password `demo-password-1` (local development only). The demo user already has a profile (level B1, scenes `work_meetings` and `small_talk`, two goals), so it skips onboarding.
- `pnpm test:e2e` runs against the dev database and removes the accounts it creates (`e2e-<uuid>@example.test`); after a killed run, remove leftovers with `DELETE FROM users WHERE email LIKE 'e2e-%@example.test'`.

## Profile and onboarding

After consent, a user without a profile is redirected to `/onboarding` (level, then scenes, then goals) and returns to the page they requested once it is finished. The profile page edits level, scenes and goals and shows the learner model (top error patterns and word counts by state). If the silent token refresh fails on startup (network or server error), the app shows a retry screen instead of the login page.

Scenes are stored as an array of strings: either a preset code (`work_meetings`, `small_talk`, `interviews`, `daily_services`, `travel`) or custom free text.

Profile endpoints are protected by the access JWT and do not require consent (see Swagger for the schemas):

| Method and path | Description |
| --- | --- |
| `GET /api/profile` | Current profile; `404 PROFILE_NOT_FOUND` if it does not exist yet |
| `PUT /api/profile` | Create or replace the profile (level, scenes) |
| `GET /api/goals` | Goals of the user |
| `POST /api/goals` | Create a goal; at most 3 active goals, otherwise `409 ACTIVE_GOALS_LIMIT` |
| `PATCH /api/goals/:id` | Update a goal |
| `DELETE /api/goals/:id` | Delete a goal |
| `GET /api/profile/learner-model` | Top 5 error patterns and word counts by state |

Foreign and unknown goal ids both return `404 GOAL_NOT_FOUND`.

## Android and PWA

The browser microphone works only over HTTPS or on `localhost`, so the app is opened through `localhost` with a forwarded port:

```powershell
adb reverse tcp:5173 tcp:5173
```

Then open `http://localhost:5173` in Chrome on the emulator or phone (`pnpm dev` must be running on the PC). No separate port is needed for the backend: the frontend reaches it through the Vite `/api` proxy. To install the PWA, use the browser menu: "Install app" / "Add to home screen".

Vite listens on `127.0.0.1` (see `server.host` in `apps/web/vite.config.ts`): on Windows the default `localhost` is bound only to IPv6 `[::1]` while `adb reverse` connects over IPv4, and Chrome shows `ERR_EMPTY_RESPONSE` or a black screen. If the page is empty after a port change or an emulator restart, run `adb reverse tcp:5173 tcp:5173` again.

## Repository structure

```
apps/api         NestJS 12 (ESM), Vitest, Drizzle ORM
apps/web         React 19 + Vite 8, Mantine 9, vite-plugin-pwa
packages/shared  Zod schemas and types of the API contracts
packages/prompts Versioned prompts for the language model
db/              SQL migrations (db/migrations), Postgres init scripts (db/init), seed.sql
e2e/             Playwright tests
docs/            product, technical decisions, specifications
```

Web (`apps/web/src`) is split into layers that import only downward: `app → pages → features → shared`. Cross-folder imports use the `@/` alias (→ `apps/web/src`); ESLint (`eslint-plugin-import-x`) enforces the boundaries.

```
app/       App, layout (AppLayout, BottomNav), providers (AuthBootstrap), router guards, Mantine theme
pages/     one folder per route: login, register, consent, session, words, history, profile
features/  one folder per domain, e.g. auth/{api,lib,components}
shared/    api (HTTP client, refresh), session (client state), i18n, testing
```

Api (`apps/api/src`) keeps infrastructure apart from domain modules; imports are relative with a `.js` suffix (ESM). `core`, `common` and `integrations` never import `modules`, which ESLint enforces.

```
core/          config, db (schema, relations), logger, errors, health
common/        decorators and pipes shared by several modules and core (@Public, ZodBodyPipe)
integrations/  ports with fake adapters per capability (speech-recognition, language-model); provider SDKs only here
modules/       one folder per domain: auth (guards, decorators, persistence, lib), me, profile, session, dialogue, analysis
```

## Database and migrations

The source of truth is the SQL migrations in `db/migrations` (drizzle-kit, custom migrations). They are written by hand and applied with `pnpm db:migrate`; afterwards `pnpm db:pull` updates the TS schema `apps/api/src/core/db/schema.ts` (do not edit it manually). Forbidden: `drizzle-kit push`, editing already applied migrations, `podman compose down -v`. The full procedure is the `/db-migration` skill (`.claude/skills/db-migration/SKILL.md`).

## Documentation

- [docs/product.md](docs/product.md): what we are building, session flow, MVP scope
- [docs/tech-decisions.md](docs/tech-decisions.md): accepted technical decisions
- [docs/specs](docs/specs): scenario specifications and test cases
- [CLAUDE.md](CLAUDE.md): rules for working with Claude Code
