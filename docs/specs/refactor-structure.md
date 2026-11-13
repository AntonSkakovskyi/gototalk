# Реорганізація структури коду (web і api)

Працюємо в поточній гілці `feat/01-auth` (PR #3), нових гілок і PR не відкриваємо; спершу web, потім api. Задачі: `docs/specs/refactor-structure.tasks.md`.

## Мета
Зрозуміла структура за шарами й доменами, межі імпортів перевіряє ESLint. Поведінка не змінюється.

## Незмінні обмеження
- Жодних правок логіки, назв експортів, DI-токенів, SQL, міграцій. Не чіпаємо `db/migrations/*`, `db/seed.sql`, `docs/specs/test-cases.md`, історичні `docs/specs/00-*` і `01-*`.
- Імена файлів не міняються, лише розташування. Виняток: `app/routes.ts` → `tabs.ts`.
- Переміщення лише через `git mv`, імпорти виправляються в тому самому коміті. Кожен коміт зелений: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Нові залежності: лише dev `eslint-plugin-import-x`, `eslint-import-resolver-typescript`.
- Шляхи від `import.meta.url` (`app-config.module.ts` → `.env`, `password-hasher.test.ts` → `seed.sql`) перераховуються під нову глибину.

## Web: цільова структура (`apps/web/src`)
```
main.tsx, vite-env.d.ts
app/
  App.tsx, App.test.tsx
  layout/AppLayout/AppLayout.tsx + .module.scss
  layout/BottomNav/BottomNav.tsx + .module.scss + tabs.ts
  providers/AuthBootstrap/AuthBootstrap.tsx + .module.scss + .test.tsx
  router/guards/guards.tsx + guards.test.tsx
  theme/theme.ts
pages/
  login/LoginPage.tsx + .test.tsx
  register/RegisterPage.tsx + .test.tsx
  consent/ConsentPage.tsx + .module.scss + .test.tsx
  session/SessionPage.tsx, words/WordsPage.tsx, history/HistoryPage.tsx, profile/ProfilePage.tsx
features/auth/
  api/auth-api.ts + .test.ts
  lib/auth-form.ts
  components/AuthLayout/AuthLayout.tsx + .module.scss
  components/AccountSection/AccountSection.tsx + .module.scss + .test.tsx
  components/DeleteAccountDialog/DeleteAccountDialog.tsx + .module.scss
shared/
  api/http.ts + .test.ts, api-error.ts, refresh.ts + .test.ts
  session/session-store.ts, query-cache.ts (+ тести)
  i18n/index.ts, i18n.test.ts, uk.json
  testing/test-utils.tsx, test-fixtures.ts
```

### Правила web
- Шари `app → pages → features → shared`, імпорти лише вниз. Фіча не імпортує іншу фічу.
- Mantine – наші атоми. Власних atoms/molecules і обгорток над Button/Card не робимо; кастомізація через `theme.components` + `X.extend()` / `X.withProps()`.
- Компонент однієї фічі → `features/<f>/components/`; потрібен ≥2 фічам → `shared/ui/` (створюється з першим таким компонентом).
- Папка на компонент, коли поруч є `.module.scss` або тест; самотній файл лишається файлом. Сторінка завжди в папці маршруту.
- Іменування: компоненти й їхні файли PascalCase; папки, хуки, утиліти kebab-case.
- Імпорти між папками через `@/` (→ `src/`), відносні лише в межах однієї папки; без суфікса `.js`.
- Без barrel-файлів `index.ts`.
- Односпрямовані залежності всередині `shared`: `api → session`, ніколи навпаки. Тому `refresh.ts` (виклик API, що оновлює сесію) лежить у `shared/api`, а `shared/session` містить лише клієнтський стан без мережі.
- Сторінки тонкі (правило для нового коду); форми з Login/Register/Consent винесемо при наступній зміні цих сторінок.

## API: цільова структура (`apps/api/src`)
```
main.ts, configure-app.ts, app.module.ts, app.module.test.ts, core-services.test.ts
core/          config/, db/, logger/, errors/, health/
common/        zod-body.pipe.ts + test, public.decorator.ts
integrations/
  speech-recognition/  speech-recognition.port.ts, fake-speech-recognition.ts
  language-model/      language-model.port.ts, fake-language-model.ts
  providers.module.ts + test, fake-adapters.test.ts
modules/       auth/, me/, profile/, session/, dialogue/, analysis/
  auth/: auth.module.ts, auth.controller.ts, auth.service.ts + test,
         refresh-token.service.ts + test, refresh-token.errors.ts
  auth/guards/       auth.guard.ts, consent.guard.ts
  auth/decorators/   current-user.decorator.ts, requires-consent.decorator.ts
  auth/persistence/  refresh-tokens.repository.ts, drizzle-refresh-tokens.repository.ts, users.repository.ts
  auth/lib/          refresh-cookie.ts, password-hasher.ts + test, clock.ts
  auth/testing/      in-memory-refresh-tokens.repository.ts
```

### Правила api
- Модуль NestJS = доменна область у `modules/`. `core`, `common`, `integrations` не імпортують `modules`.
- `common/` – спільне для кількох модулів і core (`@Public()` потрібен health, тож він тут).
- SDK провайдерів лише в `integrations/**`, решта через порти.
- Підпапки типів (guards/decorators/persistence/lib) лише за ≥2 файлів одного типу.
- Імпорти відносні з `.js` (ESM NodeNext), без аліасу. `apps/api/test/` не реорганізуємо.

## ESLint: межі
- `import-x/resolver-next`: TypeScript-резолвер (project: `apps/web/tsconfig.json`, `apps/api/tsconfig.json`) + node.
- Web (`apps/web/src/**`, крім `*.test.*` і `shared/testing/**`): `import-x/no-restricted-paths` (shared ↛ features|pages|app; features ↛ pages|app; pages ↛ app; feature ↛ інша feature для auth, session, dialogue, vocabulary, history, report, cards, profile; shared/session ↛ shared/api), `import-x/no-cycle`, `no-restricted-imports` з regex `^(\.\./){2,}` («використовуй `@/`») разом із повтором патернів SDK.
- Api: `core`, `common`, `integrations` ↛ `modules`; виняток SDK-правила для `apps/api/src/integrations/**`.
- Нові правила спершу `warn`, у фінальній задачі гілки `error`. Порушення в тестах не приховуємо: показуємо.

## Свідомо НЕ робимо
Atomic design і обгортки над Mantine; повний FSD (entities/widgets, Steiger); barrel `index.ts`; гексагональні шари `domain/mappers`; `createBrowserRouter` (лишаємо `<Routes>`); `AppProviders` (main.tsx короткий); розкладання `packages/shared` за доменами (до ~6+ схем); реорганізацію `apps/api/test/`.

## Готово, коли
- Структура збігається з наведеною; `git log --follow` показує історію переміщених файлів.
- `pnpm typecheck`, `pnpm lint` (нові правила в `error`), `pnpm test` зелені; кількість тестів не змінилась (api 193, web 112, shared 19, e2e 8).
- `pnpm --filter web build`, `pnpm test:e2e` зелені; `pnpm db:pull` не дає diff у `apps/api/src/core/db/`.
- Тимчасові порушення меж (імпорт `features` з `shared` тощо) дають помилку lint.
- Оновлені CLAUDE.md («Структура коду», шлях до теми), README, `db-migration/SKILL.md`, `docs/tech-decisions.md` (рішення 29), `docs/backlog.md`, таблиця «старий шлях → новий» для тестів у tasks.md.
