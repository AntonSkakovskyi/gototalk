# Реорганізація структури: задачі

Специфікація: `docs/specs/refactor-structure.md`. Одна задача = один коміт = одна сесія. Після кожної: зелені `pnpm typecheck`, `pnpm lint`, `pnpm test` → чекбокс → коміт. Переміщення лише `git mv`. У промпт кожного сабагента: правила «вся кодова база англійською…» і «коментарів за замовчуванням немає…» з CLAUDE.md.

## Частина 1: web (у гілці `feat/01-auth`, без нових гілок)

- [x] **W1. Базова лінія й tooling**
  - Базова лінія: api 193, web 112, shared 19, e2e 8 (записати фактичні числа).
  - `pnpm add -Dw eslint-plugin-import-x eslint-import-resolver-typescript` (перевірити, що `allowBuilds` не потрібен).
  - `apps/web/tsconfig.json`: `"paths": { "@/*": ["./src/*"] }`; `vite.config.ts`: `resolve: { tsconfigPaths: true }`.
  - Спайк: 2–3 імпорти через `@/` без `.js` (наприклад, у `main.tsx`) → `pnpm typecheck`, `pnpm --filter web build`, `pnpm --filter web test`. Якщо щось ламається, зупинка.
  - Прибрати `.js` з усіх відносних імпортів `apps/web/src/**` і `vitest.setup.ts` (крім `.json`, `.module.scss`).
  - `eslint.config.js`: плагін, `import-x/resolver-next`, web-правила меж, `no-cycle`, regex `../../` (з повтором SDK-патернів), api-зона core/common/integrations ↛ modules – усе `warn`. Перевірити regex на тимчасовому імпорті й відкотити.
  - Перевірка: typecheck/lint/test зелені; `pnpm --filter web build`.
  - Коміт: `build(web): import-x boundaries, @/ alias and extensionless imports`

- [x] **W2. `shared/api` і `shared/session`**
  - `api/http.ts`, `http.test.ts`, `api-error.ts`, `auth/refresh.ts`, `refresh.test.ts` → `shared/api/`; `auth/session-store.ts`, `query-cache.ts` (+ тести) → `shared/session/`. Залежності односпрямовані (`api → session`), цикл зникає повністю.
  - Імпорти в `auth/*`, `main.tsx`, `test-utils.tsx`, `vitest.setup.ts` → `@/shared/...`.
  - Коміт: `refactor(web): move http client and session store to shared`

- [x] **W3. `shared/i18n`, `shared/testing`, `app/theme`**
  - `i18n/index.ts`, `i18n.test.ts`, `uk.json` → `shared/i18n/`; `test-utils.tsx`, `test-fixtures.ts` → `shared/testing/`; `theme.ts` → `app/theme/theme.ts`.
  - `eslint.config.js`: виняток i18next `apps/web/src/test-utils.tsx` → `apps/web/src/shared/testing/**`.
  - Коміт: `refactor(web): move i18n, test utilities and theme`

- [x] **W4. `features/auth`**
  - `auth/auth-api.ts` (+test) → `features/auth/api/`; `auth-form.ts` → `features/auth/lib/`; `AuthLayout.*` → `features/auth/components/AuthLayout/`; `AccountSection.*` (tsx, scss, test) → `components/AccountSection/`; `DeleteAccountDialog.*` → `components/DeleteAccountDialog/`.
  - Коміт: `refactor(web): group auth feature api, lib and components`

- [x] **W5. `pages/*`**
  - `auth/LoginPage.*` → `pages/login/`; `RegisterPage.*` → `pages/register/`; `ConsentPage.*` (tsx, scss, test) → `pages/consent/`; `pages/SessionPage.tsx` → `pages/session/`, `WordsPage` → `pages/words/`, `HistoryPage` → `pages/history/`, `ProfilePage` → `pages/profile/`.
  - Коміт: `refactor(web): one folder per route page`

- [x] **W6. `app/*` і `main.tsx`**
  - `App.tsx`, `App.test.tsx` → `app/`; `app/AppLayout.*` → `app/layout/AppLayout/`; `app/BottomNav.*` → `app/layout/BottomNav/`, `app/routes.ts` → `app/layout/BottomNav/tabs.ts`; `auth/AuthBootstrap.*` → `app/providers/AuthBootstrap/`; `auth/guards.*` → `app/router/guards/`. Папка `src/auth` має зникнути.
  - Коміт: `refactor(web): app shell, providers and router guards under app`

- [x] **W7. Правила в `error`, документація, перевірка**
  - Правила меж web → `error` (зона `shared/session ↛ shared/api` теж); перевірити тимчасовим імпортом `shared → features` (помилка) і відкотити.
  - CLAUDE.md (розділ «Структура коду», шлях теми `apps/web/src/app/theme/theme.ts`), README (структура web), `docs/tech-decisions.md` (рішення 29 «Структура коду»), `docs/specs/01-auth-consent.tasks.md` і `docs/backlog.md` (оновити старі шляхи на нові; нові рядки: чистка `refresh_tokens`, винесення форм Login/Register/Consent, `shared/ui/` з першим спільним компонентом, `packages/shared` за доменами).
  - `pnpm --filter web build`, `pnpm test:e2e`, рев'ю сабагентом `reviewer`.
  - Таблиця «старий шлях → новий» для тестових файлів web.
  - Коміт: `refactor(web): enforce import boundaries and document the structure`

## Частина 2: api (у тій самій гілці після частини 1)

- [x] **A1. `core/` і `common/public.decorator.ts`**
  - `config/`, `db/` (з `pg-timestamp`, `schema`, `relations`), `logger/`, `errors/`, `health/` → `core/`; `auth/public.decorator.ts` → `common/`.
  - `app-config.module.ts`: `'../../../../.env'` → `'../../../../../.env'`.
  - `drizzle.config.ts` (`./src/core/db/schema.ts`), коментар `drizzle.pull.config.ts`, `scripts/db-pull.mjs` (targetDir, шлях Prettier, лог). Імпорти в `apps/api/test/*`.
  - Перевірка: + `pnpm db:pull` без diff; `pnpm dev` → `/api/health` ok (`.env` знаходиться).
  - Коміт: `refactor(api): move infrastructure into core`

- [x] **A2. `integrations/`**
  - `ports/speech-recognition.port.ts`, `adapters/fake/fake-speech-recognition.ts` → `integrations/speech-recognition/`; `language-model.port.ts`, `fake-language-model.ts` → `integrations/language-model/`; `providers/providers.module.ts` (+test), `adapters/fake/fake-adapters.test.ts` → `integrations/`.
  - `eslint.config.js`: виняток SDK `apps/api/src/adapters/**` → `apps/api/src/integrations/**`, текст повідомлення.
  - Коміт: `refactor(api): ports and adapters under integrations`

- [x] **A3. `modules/` для me, profile, session, dialogue, analysis**
  - Папки цілком → `modules/<name>/`; імпорти `auth` тимчасово `../../auth/...`.
  - Коміт: `refactor(api): domain modules under modules`

- [x] **A4. `modules/auth` з підпапками**
  - Корінь: `auth.module.ts`, `auth.controller.ts`, `auth.service.ts` (+test), `refresh-token.service.ts` (+test), `refresh-token.errors.ts`; `guards/`: `auth.guard.ts`, `consent.guard.ts`; `decorators/`: `current-user.decorator.ts`, `requires-consent.decorator.ts`; `persistence/`: `refresh-tokens.repository.ts`, `drizzle-refresh-tokens.repository.ts`, `users.repository.ts`; `lib/`: `refresh-cookie.ts`, `password-hasher.ts` (+test), `clock.ts`; `testing/` без змін.
  - `password-hasher.test.ts`: `'../../../../db/seed.sql'` → `'../../../../../../db/seed.sql'`.
  - Коміт: `refactor(api): split auth module into guards, decorators, persistence and lib`

- [ ] **A5. Правила в `error`, документація, перевірка**
  - Api-зона → `error`; перевірити тимчасовим імпортом `core → modules` і відкотити.
  - `pnpm db:pull` без diff; `pnpm --filter api build`; `pnpm test:e2e`; `reviewer`.
  - CLAUDE.md (структура модуля NestJS, межі), README, `.claude/skills/db-migration/SKILL.md` (`apps/api/src/core/db/schema.ts`), `.claude/agents/reviewer.md` (шляхи портів/адаптерів), `docs/tech-decisions.md` (доповнення рішення 29), `docs/backlog.md` (шляхи).
  - Таблиця «старий шлях → новий» для тестових файлів api.
  - Коміт: `refactor(api): enforce module boundaries and document the structure`

## Таблиця переміщень тестових файлів: web

Обчислено з git: `git diff -M --name-status 3d46051 HEAD -- apps/web`. Шляхи від `apps/web/src`. `pwa-config.test.ts` не переміщувався (змінено лише імпорти). Кількість тестів не змінилась (web 112).

| Старий шлях | Новий шлях |
|---|---|
| `App.test.tsx` | `app/App.test.tsx` |
| `auth/AuthBootstrap.test.tsx` | `app/providers/AuthBootstrap/AuthBootstrap.test.tsx` |
| `auth/guards.test.tsx` | `app/router/guards/guards.test.tsx` |
| `auth/auth-api.test.ts` | `features/auth/api/auth-api.test.ts` |
| `auth/AccountSection.test.tsx` | `features/auth/components/AccountSection/AccountSection.test.tsx` |
| `auth/ConsentPage.test.tsx` | `pages/consent/ConsentPage.test.tsx` |
| `auth/LoginPage.test.tsx` | `pages/login/LoginPage.test.tsx` |
| `auth/RegisterPage.test.tsx` | `pages/register/RegisterPage.test.tsx` |
| `api/http.test.ts` | `shared/api/http.test.ts` |
| `auth/refresh.test.ts` | `shared/api/refresh.test.ts` |
| `i18n/i18n.test.ts` | `shared/i18n/i18n.test.ts` |
| `auth/query-cache.test.ts` | `shared/session/query-cache.test.ts` |
| `auth/session-store.test.ts` | `shared/session/session-store.test.ts` |
| `test-fixtures.ts` | `shared/testing/test-fixtures.ts` |
| `test-utils.tsx` | `shared/testing/test-utils.tsx` |
