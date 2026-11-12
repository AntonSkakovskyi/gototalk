# 00. Каркас: задачі

Специфікація: `docs/specs/00-scaffold.md`. Гілка: `feat/00-scaffold`.
Одна задача = одна сесія (`/clear` перед стартом). Після задачі: зелені `pnpm typecheck`, `pnpm lint`, `pnpm test` → `reviewer` → відмітити чекбокс → коміт (Conventional Commits).

## Погоджені рішення

- **Міграції.** `db/migrations/0000_baseline.sql` (лише коментар), `0001_init.sql`, `0002_mvp_adjustments.sql` + `meta/_journal.json` drizzle-kit. Наступна згенерована міграція отримає номер 0003.
- **ID тестів.** Файл `docs/specs/test-cases.md` генерується з `iit/labs/lab9/src/tests.json`, вручну його не правити. Тег `[TC-00-NN]` у назві тесту береться з нього; той самий ID можуть мати кілька тестів.
  - `[TC-00-01]` – `podman compose up -d` + `pnpm db:migrate` дають 15 таблиць і всі CHECK.
  - `[TC-00-02]` – `pnpm dev`: мобільний layout українською, `/api/health` повертає ok.
  - `[TC-00-03]` – Android: `adb reverse`, застосунок відкривається й встановлюється як PWA (ручна перевірка).
  - `[TC-00-04]` – `pnpm lint/typecheck/test` зелені, є тести api і web.
  - `[TC-00-05]` – Fake-адаптери детерміновані.
  - `[TC-00-06]` – конфігурація валідується через Zod, відсутня змінна зупиняє запуск із поясненням (додатковий).
  - `[TC-00-07]` – усі помилки API мають формат `{ error: { code, message } }` (додатковий).
- **Fake-адаптери – мінімум.** Інтерфейси всіх методів портів, по одній фіксованій відповіді на метод, тест детермінованості. Повна поведінка з `docs/specs/stubs.md` – у специфікаціях, де метод уперше потрібен: `planSession` – 03; `transcribe`, `analyzeUtterance`, `nextTurn`, `hint` – 04; `summarizeSession` – 05. Під час планування 03–05 додати відповідні задачі в їхні tasks.md.

## Технічні рішення

- Drizzle стабільна 0.x, драйвер `pg`. `apps/api/drizzle.config.ts`: `out: '../../db/migrations'`. Мігратор drizzle-orm для pg сам обгортає міграції в транзакцію, тому з 0002 при перенесенні прибираються лише рядки `BEGIN;`/`COMMIT;` (спершу перевірити в `node_modules/drizzle-orm/pg-core/dialect.js`). Через drizzle ці міграції ще ніде не застосовувались, тож це перенесення, а не редагування застосованої міграції.
- `db:pull`: окремий `drizzle.pull.config.ts` з `out` у тимчасову теку з .gitignore і `schemaFilter: ['public']`; скрипт копіює `schema.ts` і `relations.ts` в `apps/api/src/db/` і форматує їх Prettier.
- Один `.env` у корені (compose, api, drizzle-конфіги через `process.loadEnvFile`). `.env` не читати.
- NestJS 12 ESM, як генерує `nest new` (`"type": "module"`, `module: nodenext`, імпорти з `.js`), Vitest. Метадані декораторів у Vitest – як радить документація Nest 12 (context7), запасний варіант `unplugin-swc`. Глобальний префікс `api`.
- `packages/shared` збирається tsc у `dist`, споживачі підключають його через `workspace:*`, кореневі скрипти спершу збирають shared.
- Нижня навігація: «Сесія», «Слова», «Історія», «Профіль» (поки порожні).
- ESLint: `no-restricted-imports` для SDK провайдерів поза `apps/api/src/adapters/**`; `i18next/no-literal-string` (JSX) у web.
- `.gitattributes` з `eol=lf`, Prettier `endOfLine: lf`.
- TypeScript закріплено на 6.0.3 (точна версія): typescript-eslint 8.x має peer `<6.1.0` і не підтримує TS 7. Кореневий `lint` – один `eslint .` на весь монорепо, у пакетах окремих `lint`-скриптів не додаємо. `types`/`lib` (node, DOM) і декоратори (`experimentalDecorators`, `emitDecoratorMetadata` у api) задаємо в tsconfig пакетів, не в базовому.
- `pnpm test` включає інтеграційні тести API, тому локально потрібен `podman compose up -d`. Очищення тестової БД між тестами вирішуємо в spec 01.

## Задачі

- [x] **00-01. Кореневий монорепо**
  - Що: `package.json` (private, `"type": "module"`, `engines.node >=26`, `packageManager: pnpm@<pnpm -v>`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), `eslint.config.js` (flat, typescript-eslint), Prettier (`endOfLine: lf`), `.gitignore` (`.env`, `.env.*` крім `.env.example`, тека dev-аудіо, `dist`, тимчасова тека pull, `node_modules`, звіти Playwright), `.gitattributes`, `.editorconfig`, `.node-version`. Скрипти `dev`, `test`, `test:e2e`, `lint`, `typecheck`, `db:migrate`, `db:pull`, `db:seed` через `pnpm -r --if-present`.
  - Перевірка: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` завершуються з кодом 0; `pnpm exec prettier --check .` без помилок.

- [x] **00-02. packages/shared і packages/prompts**
  - Що: `@gototalk/shared`: Zod, `ErrorResponseSchema` (`{ error: { code, message } }`), `HealthResponseSchema`, `MistakeCategoryCodeSchema` (13 кодів із 0002), збірка tsc у `dist` (`exports` з `types`), Vitest. `@gototalk/prompts`: `package.json` + README (призначення, формат назв `<name>.vN.md`).
  - Перевірка: тест `[TC-00-04]` на схеми зелений; `pnpm --filter @gototalk/shared build` створює `dist`.

- [x] **00-03. compose.yaml і .env.example**
  - Що: Postgres 17, named volume, порт 5432, healthcheck; `db/init/01-test-db.sql` (`CREATE DATABASE gototalk_test`) у `/docker-entrypoint-initdb.d`; `.env.example` з усіма змінними без значень секретів (`DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `LOG_LEVEL`, `STT_PROVIDER`, `LLM_PROVIDER`, `FAKE_STT_FAIL`, `FAKE_LLM_FAIL`, `DEV_KEEP_AUDIO`, `DEV_AUDIO_DIR`, `POSTGRES_*`).
  - Перевірка: `podman compose up -d` → контейнер healthy; `podman compose exec db psql -U <user> -c '\l'` показує `gototalk` і `gototalk_test`; `podman volume ls` показує named volume.

- [x] **00-04. Міграції drizzle-kit, db:migrate, db:seed**
  - Що: мінімальний `apps/api/package.json` (drizzle-orm, drizzle-kit, pg), `apps/api/drizzle.config.ts`; `drizzle-kit generate --custom --name=baseline|init|mvp_adjustments` (команду для 0.x звірити з context7), перенести SQL із наявних файлів (у 0002 прибрати `BEGIN;`/`COMMIT;` після перевірки мігратора), старі файли видалити, щоб лишились лише файли з журналу. Скрипт `db:seed` (Node + `pg`, застосовує `db/seed.sql`).
  - context7: Drizzle 0.x (custom migrations, `migrate`).
  - Перевірка: на чистій `gototalk_test` (з `DATABASE_URL` тестової БД) і на dev-БД `pnpm db:migrate` створює 15 таблиць у `public`, у `drizzle.__drizzle_migrations` 3 рядки; повторний запуск нічого не змінює; `pnpm db:seed` двічі поспіль без помилок.

- [x] **00-05. db:pull → apps/api/src/db/schema.ts**
  - Що: `apps/api/drizzle.pull.config.ts`, `apps/api/scripts/db-pull.mjs`; файли `schema.ts` і `relations.ts` згенеровані, вручну не правити.
  - Перевірка: `schema.ts` має 15 `pgTable` і `check(...)` для кожного CHECK з міграцій; повторний `pnpm db:pull` не дає diff; `pnpm typecheck` зелений.
  - Відхилення: скрипт замінює `./schema` на `./schema.js` у relations.ts (NodeNext); drizzle-kit і Prettier викликаються через node без shell; 16 `check(...)` (17 CHECK у SQL мінус замінений `words_state_check`); `typecheck` схему охопить з 00-06 (tsconfig у api).

- [x] **00-06. Бутстрап NestJS**
  - Що: ESM `src/main.ts`, `src/app.module.ts`, `nest-cli.json`, `tsconfig.json`/`tsconfig.build.json`, Vitest з двома проєктами (unit, integration), глобальний префікс `api`, скрипти `dev`, `build`, `test`, `typecheck`, `lint`.
  - context7: NestJS 12 (ESM, Vitest).
  - Перевірка: `pnpm --filter api dev` стартує на порту 3000; тест-«димок» `[TC-00-04]` (AppModule компілюється) зелений.
  - Відхилення: скрипта `lint` у api немає (кореневий `eslint .`, за технічними рішеннями); `@swc/core: false` в allowBuilds (бінарник з optional-пакета); integration-проєкт Vitest з `passWithNoTests` до 00-09 (тоді прибрати); порт тимчасово з `process.env.PORT` до 00-07.

- [x] **00-07. Конфіг з Zod і логер Pino**
  - Що: `ConfigModule` з `validate` через Zod-схему env, типізований доступ до конфігу; `nestjs-pino` (pino-pretty у dev, redact `authorization` і `cookie`). `STT_PROVIDER`/`LLM_PROVIDER` приймають `fake|deepgram` / `fake|gemini`, реальні значення поки дають помилку «not implemented».
  - Перевірка: тести `[TC-00-06]`: невалідний env → помилка з назвою змінної; `deepgram`/`gemini` → помилка «not implemented»; без `DATABASE_URL` застосунок не стартує й називає змінну.
  - Відхилення: `AppModule` став динамічним (`AppModule.register({ env? })`, тести передають env явно); додано `NODE_ENV` і правило `DEV_KEEP_AUDIO=true` ⇒ потрібен `DEV_AUDIO_DIR`; `FAKE_*_FAIL` лише як необов'язкові рядки. Рев'ю на майбутнє: `res.headers["set-cookie"]` у redact (разом з auth), `NODE_ENV=production` у контейнері api (pino-pretty – devDependency).

- [x] **00-08. Глобальний фільтр помилок і Swagger**
  - Що: фільтр: `HttpException` → код зі статусу (`NOT_FOUND`, `BAD_REQUEST`…), `ZodError` → 400 `VALIDATION_ERROR`, невідома помилка → 500 `INTERNAL_ERROR` без деталей у відповіді (деталі в лог). Формат – `ErrorResponseSchema` із shared. Swagger на `/api/docs`.
  - Перевірка: інтеграційний тест `[TC-00-07]` (неіснуючий маршрут і невалідне тіло дають `{ error: { code, message } }`) і unit-тести фільтра на три гілки; `GET /api/nope` → 404 `{ "error": { "code": "NOT_FOUND", … } }`; `/api/docs` відкривається.
  - Відхилення: додатково оброблені 4xx від body-parser і 5xx `HttpException` (узагальнене повідомлення); `configureApp(app)` спільна для main.ts і тестів; `@scarf/scarf: false` в allowBuilds; нові залежності `@nestjs/swagger`, dev `supertest`. На потім: у лозі лише path без query; Swagger вимкнути/обмежити перед публічним деплоєм; прибрати `passWithNoTests` у 00-09.

- [x] **00-09. DB-модуль і інтеграційна обв'язка**
  - Що: провайдер Drizzle (`pg` Pool, закриття на shutdown); Vitest globalSetup застосовує міграції до `TEST_DATABASE_URL` (мігратор drizzle-orm); інтеграційний тест `[TC-00-01]`: 15 таблиць у `public` і повний очікуваний список CHECK-обмежень з `pg_constraint` (список виписати з 0001 і 0002).
  - Перевірка: `pnpm --filter api test` зелений при піднятому Podman.
  - Відхилення: globalSetup парсить кореневий `.env` через `util.parseEnv` (не `loadEnvFile`, щоб не засмічувати `process.env` воркерів), URL передається тестам через `project.provide`; `passWithNoTests` прибрано. На потім (рев'ю): `pool.on('error')` з логуванням, `@Injectable()` на `PoolShutdown`, захист від `TEST_DATABASE_URL` = dev-БД перед очищенням таблиць у тестах (spec 01), `COLLATE "C"` у ORDER BY тесту, `count === 3` у журналі зламається з міграцією 0003.

- [ ] **00-10. Health-ендпоінт**
  - Що: `GET /api/health` робить `select 1`: 200 `{ "status": "ok", "db": "ok" }`; БД недоступна → 503 у форматі помилки. Відповідь відповідає `HealthResponseSchema`; опис у Swagger.
  - Перевірка: інтеграційні тести через supertest: `[TC-00-02]` 200; `[TC-00-07]` 503 з підміненим провайдером БД; `curl http://localhost:3000/api/health` → ok.

- [ ] **00-11. Порти й Fake-адаптери (мінімум)**
  - Що: `apps/api/src/ports/speech-recognition.port.ts`, `language-model.port.ts` (DI-токени; методи зі specs 03–05 і stubs.md: `transcribe(audio, mime, index?)` → `{ verbatim, clean, words? }`, `analyzeUtterance`, `planSession`, `nextTurn`, `hint`, `summarizeSession`). Zod-схеми результатів у shared: Mistake `{ start, end, original, suggestion, category, explanation_en, translation_uk }`, AnalysisResult (mistakes + better `{ original, better }`), мінімальні Plan, Turn, Hint, Summary. `apps/api/src/adapters/fake/`: одна фіксована відповідь на метод (STT – транскрипт №0 зі stubs.md; analyze – помилки verb_tense і word_order з коректними позиціями в verbatim); `reset()` і режими `FAKE_*_FAIL` не робимо. `ProvidersModule` обирає адаптер за env.
  - Перевірка: тести `[TC-00-05]`: два виклики з тим самим входом дають ідентичний результат; результат проходить Zod-схему; `text.slice(start, end) === original`; `STT_PROVIDER=fake` і `LLM_PROVIDER=fake` дають Fake-адаптери.

- [ ] **00-12. Скелети сервісів ядра**
  - Що: модулі `profile`, `session`, `analysis`, `dialogue`: `LearnerModelService` (`weakAreas`, `vocabularyStats`, `applyAnalysis`), `SessionPlannerService.planSession`, `MistakeAnalyzerService` (`analyzeUtterance`, `groupIntoPatterns`), `DialogueService.nextTurn`. Залежності лише від портів і `LearnerModelService`; методи кидають `NotImplementedException` з посиланням на spec, де їх реалізують. ESLint `no-restricted-imports` для SDK провайдерів (`@deepgram/*`, `@google/genai`, `@google/generative-ai`) поза `src/adapters/**`.
  - Перевірка: тест `[TC-00-04]`: AppModule резолвить усі 4 сервіси з Fake-провайдерами; тимчасовий імпорт `@google/genai` у `src/analysis` дає помилку `pnpm lint` (перевірити й відкотити).

- [ ] **00-13. Бутстрап web**
  - Що: `apps/web`: Vite 8 + React 19 + TS, Mantine 9 (`postcss-preset-mantine`, `@mantine/core/styles.css`, `MantineProvider`), `src/theme.ts`, `sass-embedded` і хоча б один `*.module.scss`, проксі `/api` → `http://localhost:3000`, Vitest + Testing Library (jsdom, mock `matchMedia`).
  - context7: Vite 8, Mantine 9.
  - Перевірка: `pnpm --filter web dev` → сторінка на `http://localhost:5173`; `curl http://localhost:5173/api/health` → ok через проксі (api запущено); тест `[TC-00-04]` рендерить App.

- [ ] **00-14. Роутинг, i18n і мобільний layout**
  - Що: React Router (4 маршрути-вкладки), `QueryClientProvider` (TanStack Query), react-i18next з `src/i18n/uk.json`, AppShell з нижньою навігацією «Сесія», «Слова», «Історія», «Профіль» (Mantine + `*.module.scss`), порожні сторінки із заголовком з i18n. ESLint `i18next/no-literal-string` для JSX.
  - Перевірка: тест `[TC-00-02]`: підписи вкладок українською, клік перемикає маршрут; Playwright MCP на 360×800: навігація внизу екрана, без горизонтального скролу.

- [ ] **00-15. PWA**
  - Що: vite-plugin-pwa (`registerType: 'autoUpdate'`, `devOptions.enabled: true`), маніфест (name і short_name GoToTalk, `lang: 'uk'`, description, `theme_color` = `<meta name="theme-color">`, `display: standalone`), іконки 192, 512 і maskable із SVG через `@vite-pwa/assets-generator`, `preview.proxy` для `/api`.
  - context7: vite-plugin-pwa.
  - Перевірка: `pnpm --filter web build` створює `sw.js` і `manifest.webmanifest`; Chrome DevTools → Application → Manifest без помилок, застосунок можна встановити на десктопі.

- [ ] **00-16. Кореневий pnpm dev і e2e**
  - Що: `pnpm dev` паралельно запускає shared (watch), api і web; Playwright (`@playwright/test`, проєкт з мобільним в'юпортом 360 px, `webServer`), smoke e2e `[TC-00-02]`: layout українською і `/api/health` через проксі повертає ok.
  - Перевірка: `pnpm dev` піднімає обидва застосунки; `pnpm test:e2e` зелений.

- [ ] **00-17. CI на GitHub Actions**
  - Що: `.github/workflows/ci.yml`: `pnpm/action-setup`, `actions/setup-node` з Node 26 і кешем pnpm, Postgres 17 як service (`gototalk_test`), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
  - Перевірка: YAML проходить локальну валідацію (`pnpm dlx @action-validator/cli .github/workflows/ci.yml`); остаточно – зелений прогін після `git push` (робить Антон).

- [ ] **00-18. README і фінальна перевірка**
  - Що: README: вимоги (Node 26, pnpm, Podman), команди для PowerShell (install, `podman compose up -d`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`, тести, e2e, `adb reverse tcp:5173 tcp:5173`), примітка про HTTPS/localhost для мікрофона. Прогін усіх пунктів «Готово, коли» spec 00.
  - Перевірка: зелені `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; Антон вручну перевіряє `[TC-00-03]` на емуляторі (відкриття й встановлення PWA); `reviewer` дає `REVIEW: PASS`.

## Покриття spec 00

| «Готово, коли» | Задачі |
|---|---|
| 15 таблиць після compose + migrate | 03, 04, 09 |
| `pnpm dev`, layout українською, health ok | 10, 13, 14, 16 |
| Android + встановлення PWA | 15, 18 |
| lint, typecheck, test зелені; тести api і web | усі |
| Fake-адаптери детерміновані | 11 |
