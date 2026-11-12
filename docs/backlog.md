# Backlog

Відкладені пункти зі специфікації 00 (відхилення, «На потім», «Рев'ю на майбутнє», «Відкладене після code-review PR #1») і ухвалені рішення, що переносять роботу в наступні специфікації. Перелік перевірено за кодом на гілці `feat/01-auth`: уже виправлене (текст логу фільтра, `error`-слухач і `connectionTimeoutMillis` у пулі `pg`) сюди не входить.

Закриваючи пункт, видаляйте рядок і згадуйте його в tasks.md відповідної специфікації. Рядки зі значенням «не робимо» довідкові й не закриваються. Під час планування 03–05 для відповідних рядків створюються задачі в їхніх tasks.md.

| Пункт | Звідки | У якій spec |
|---|---|---|
| Додати `res.headers["set-cookie"]` у `REDACT_PATHS` pino (разом із auth-cookie) | 00-07, рев'ю на майбутнє | 01 (задача 01-03) |
| Захист від `TEST_DATABASE_URL` = dev-БД перед очищенням таблиць у тестах (`assertTestDatabaseUrl`) | 00-09, на потім | 01 (задача 01-02) |
| Стратегія очищення тестової БД між тестами (`resetUserData`, `fileParallelism: false`) | 00 «Технічні рішення» | 01 (задача 01-02) |
| Лічильник журналу міграцій у `db-schema.test.ts`: замість `count === 3` порівнювати з кількістю `entries` у `_journal.json` | 00-09, на потім | 01 (задача 01-02) |
| `COLLATE "C"` в `ORDER BY` тесту `db-schema.test.ts` | 00-09, на потім | 01 (задача 01-02) |
| Кириличні коментарі в `.env.example` перекласти англійською | Відкладене після PR #1 | 01 (задача 01-03) |
| `WordState` з `profile` перенести в `packages/shared` (дублює CHECK) | 00-12, відхилення | 02 |
| Нижні вкладки на Mantine `NavLink`/`UnstyledButton` замість голого `NavLink` react-router | 00-14, на потім | 02 |
| `weakAreas`: за замовчуванням `limit = 3`, spec 02 передає 5 явно | 00-12, відхилення | 02 |
| Fake-поведінка за `docs/specs/stubs.md`: `planSession` | 00 «Fake-адаптери – мінімум» | 03 |
| Fake-поведінка за `docs/specs/stubs.md`: `transcribe` (разом із `reset()` лічильника, який stubs.md припускає), `analyzeUtterance`, `nextTurn`, `hint` | 00 «Fake-адаптери – мінімум» | 04 |
| Fake-поведінка за `docs/specs/stubs.md`: `summarizeSession` | 00 «Fake-адаптери – мінімум» | 05 |
| Підпис `hint` (union за `kind`) відрізняється від заголовків `stubs.md`: звірити й оновити `stubs.md` (звірити також специфікації 03 і 05) | 00-11, відхилення | 04 |
| Внутрішні `ZodError` (відповідь LLM, рядок БД) мають бути 5xx із логом, а не 400 `VALIDATION_ERROR` | Відкладене після PR #1 | 04 |
| `FAKE_STT_FAIL`/`FAKE_LLM_FAIL`: зробити enum зі `stubs.md` і підтримку режимів у Fake-адаптерах | Відкладене після PR #1; 00-11 (режими не робили) | 04 |
| Fake `analyzeUtterance`: регістронезалежні RegExp | 00-11, на потім | 04 |
| Fake: словник перекладів `translation_uk` | 00-11, на потім | 04 |
| Fake `summarizeSession`: шаблон | 00-11, на потім | 05 |
| Заглушки сервісів ядра (`void arg;`, `NotImplementedException` зі spec-посиланням) зникають разом з реалізацією методів | Відкладене після PR #1; 00-12 | 02–05 (де реалізується метод) |
| `@Injectable()` на `PoolShutdown` у `db.module.ts` | 00-09, на потім | будь-яка |
| Падіння health логується двічі (`HealthService` і фільтр): прибрати лог із сервісу, передавати `cause` | 00-10, на потім; Відкладене після PR #1 | будь-яка |
| У лозі фільтра лише path без query (зараз `getRequestUrl` віддає повний URL) | 00-08, на потім | будь-яка |
| `.catch` на `i18n.init` у `apps/web/src/i18n/index.ts` | 00-14, на потім | будь-яка |
| `NODE_ENV=production` у контейнері api (pino-pretty – devDependency, вмикається для будь-якого `NODE_ENV` крім `production`); контейнера api ще немає | 00-07, рев'ю на майбутнє; Відкладене після PR #1 | деплой |
| Swagger (`/api/docs`, `/api/docs-json`) вимкнути або закрити за прапорцем у production (глобальний guard його не покриває; додати `addSecurityRequirements('bearer')`) | 00-08, на потім; Відкладене після PR #1 | деплой |
| e2e у CI (зараз `ci.yml` запускає лише lint, typecheck, test) | 00-16, для 00-17 | деплой |
| Після `git push`: CI зелений (`pnpm/action-setup@v6` без `version`, `cache: pnpm` з Node 26) | 00-17, відхилення | Антон |
| Ручна перевірка `[TC-00-03]`: відкриття й встановлення PWA на Android (емулятор, `adb reverse`) | 00-15, 00-18 | Антон |
| Мігровані кириличні коментарі в `db/migrations/0000`–`0002`: не редагуємо, нові міграції англійською | Відкладене після PR #1 | не робимо |
| Переліки провайдерів `fake/deepgram` і `fake/gemini` дубльовані в `packages/shared/src/auth.ts` та `apps/api/src/config/env.schema.ts`: винести `SttProviderSchema`/`LlmProviderSchema` у shared | рев'ю 01-04 | будь-яка |
