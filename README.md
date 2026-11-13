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

Email and password sign-up (no email confirmation). The API issues a 15-minute access JWT, kept only in the memory of the frontend, and a 30-day refresh token in the `gtt_refresh` cookie (HttpOnly, Secure, SameSite=Strict, `Path=/api/auth`); only its SHA-256 hash is stored in `refresh_tokens`. A refresh rotates the token, and presenting an already revoked token revokes all refresh tokens of that user. After the first sign-in the consent screen must be accepted before any recording (`users.consent_at`). The account can be deleted from the profile (password required); the cascade removes the user's data.

- `JWT_ACCESS_SECRET` is required (at least 32 characters). Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- `pnpm db:seed` creates the demo user `demo@gototalk.local` with the password `demo-password-1` (local development only).
- `pnpm test:e2e` runs against the dev database and removes the accounts it creates (`e2e-<uuid>@example.test`); after a killed run, remove leftovers with `DELETE FROM users WHERE email LIKE 'e2e-%@example.test'`.

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

## Database and migrations

The source of truth is the SQL migrations in `db/migrations` (drizzle-kit, custom migrations). They are written by hand and applied with `pnpm db:migrate`; afterwards `pnpm db:pull` updates the TS schema `apps/api/src/db/schema.ts` (do not edit it manually). Forbidden: `drizzle-kit push`, editing already applied migrations, `podman compose down -v`. The full procedure is the `/db-migration` skill (`.claude/skills/db-migration/SKILL.md`).

## Documentation

- [docs/product.md](docs/product.md): what we are building, session flow, MVP scope
- [docs/tech-decisions.md](docs/tech-decisions.md): accepted technical decisions
- [docs/specs](docs/specs): scenario specifications and test cases
- [CLAUDE.md](CLAUDE.md): rules for working with Claude Code
