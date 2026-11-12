# GoToTalk

PWA-тренер говоріння англійською для україномовних користувачів (рівень від A2): відповідь голосом, дослівний транскрипт із підсвіченими помилками й модель учня (патерни помилок, слова зі станами new / partial / passive / active).

## Вимоги

- Node 26 (`.node-version`)
- pnpm (версія в `packageManager` кореневого `package.json`), встановлений окремо, без corepack
- Podman з `podman compose` (Docker не використовуємо)
- Для e2e локально: Microsoft Edge (див. нижче)
- Для Android: Android Studio (емулятор) або телефон через USB, `adb`

## Швидкий старт (PowerShell)

```powershell
Copy-Item .env.example .env
# Заповни у .env усі змінні, що в .env.example без значення (POSTGRES_*, DATABASE_URL, TEST_DATABASE_URL)
pnpm install
podman compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Відкрий `http://localhost:5173`. `pnpm dev` збирає `packages/shared` і запускає api (порт 3000) та web (порт 5173) разом; web проксує `/api` на бекенд. Перевірка бекенда: `http://localhost:3000/api/health`, Swagger: `http://localhost:3000/api/docs`.

Файл `.env` не потрапляє в git. База `gototalk_test` для інтеграційних тестів створюється init-скриптом `db/init` під час першого запуску контейнера.

## Перевірки

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

- `pnpm test` включає інтеграційні тести API, тому потрібні піднятий `podman compose up -d` і заданий `TEST_DATABASE_URL`; міграції до тестової БД застосовує сам Vitest (globalSetup), а `pnpm db:migrate` потрібен для dev-БД.
- `pnpm test:e2e` (Playwright, мобільний в'юпорт 360×800) потребує піднятої БД: `/api/health` перевіряє з'єднання з нею. Застосунки Playwright запускає сам (або використовує вже запущені `pnpm dev`). Локально тести йдуть у встановленому Edge; інший канал задає змінна `PW_CHANNEL`. У CI використовується Chromium від Playwright: `pnpm exec playwright install --with-deps chromium`.

## Android і PWA

Мікрофон у браузері працює лише на HTTPS або на `localhost`, тому застосунок відкривається через `localhost` з прокиданням порту:

```powershell
adb reverse tcp:5173 tcp:5173
```

Після цього відкрий `http://localhost:5173` у Chrome на емуляторі чи телефоні (`pnpm dev` має працювати на ПК). Окремий порт для бекенда не потрібен: фронт звертається до нього через проксі Vite `/api`. Встановлення PWA: меню браузера, «Установити застосунок» / «Додати на головний екран».

Vite слухає `127.0.0.1` (див. `server.host` у `apps/web/vite.config.ts`): на Windows типове `localhost` лишається лише на IPv6 `[::1]`, а `adb reverse` стукає на IPv4, і Chrome показує `ERR_EMPTY_RESPONSE` або чорний екран. Якщо після зміни порту чи перезапуску емулятора сторінка порожня, повтори `adb reverse tcp:5173 tcp:5173`.

## Структура репозиторію

```
apps/api         NestJS 12 (ESM), Vitest, Drizzle ORM
apps/web         React 19 + Vite 8, Mantine 9, vite-plugin-pwa
packages/shared  Zod-схеми й типи контрактів API
packages/prompts Версіоновані промпти до мовної моделі
db/              SQL-міграції (db/migrations), init-скрипти Postgres (db/init), seed.sql
e2e/             Playwright-тести
docs/            продукт, технічні рішення, специфікації
```

## База даних і міграції

Джерело правди – SQL-міграції в `db/migrations` (drizzle-kit, кастомні міграції). Їх пишуть вручну, застосовують `pnpm db:migrate`, після цього `pnpm db:pull` оновлює TS-схему `apps/api/src/db/schema.ts` (вручну не правити). Заборонено: `drizzle-kit push`, редагування вже застосованих міграцій, `podman compose down -v`. Повна процедура – скіл `/db-migration` (`.claude/skills/db-migration/SKILL.md`).

## Документація

- [docs/product.md](docs/product.md): що будуємо, хід сесії, обсяг MVP
- [docs/tech-decisions.md](docs/tech-decisions.md): ухвалені технічні рішення
- [docs/specs](docs/specs): специфікації сценаріїв і тест-кейси
- [CLAUDE.md](CLAUDE.md): правила роботи з Claude Code
