# 01. Реєстрація, вхід, згода, видалення акаунта: задачі

Специфікація: `docs/specs/01-auth-consent.md`. Гілка: `feat/01-auth`.
Одна задача = одна сесія (`/clear` перед стартом). Після задачі: зелені `pnpm typecheck`, `pnpm lint`, `pnpm test`, потім `reviewer`, відмітити чекбокс і зробити коміт (Conventional Commits).
Задачі з позначкою **[Антон]** потребують ручної дії.

## Погоджені рішення

- **Хешування паролів.** `@node-rs/argon2` (napi-rs: бінарник з optional-пакета платформи, без postinstall і node-gyp, у `allowBuilds` нічого не додаємо). argon2id, параметри як у `db/seed.sql`: `memoryCost 65536, timeCost 3, parallelism 4`, PHC-рядок генерує й розбирає бібліотека. Хеш демо-користувача з seed має проходити `verify`. Відкинуто: `node:crypto.argon2` (Stability 1.2, PHC довелося б кодувати самим), `argon2` (install-скрипт).
- **JWT.** `@nestjs/jwt` 12.x (peer `^12`), HS256, `algorithms: ['HS256']` явно у verify, секрет `JWT_ACCESS_SECRET` (≥ 32 символи, Zod). Payload `{ sub: userId }`, термін 15 хв. Власний `AuthGuard` за рецептом документації Nest (без passport), глобально через `APP_GUARD`; відкриті маршрути позначаються `@Public()`. Нові маршрути у 02–05 захищені за замовчуванням.
- **Refresh-cookie.** `gtt_refresh`: HttpOnly, Secure (Chromium приймає на `http://localhost`, тож працює з adb reverse і Playwright), SameSite=Strict, `Path=/api/auth`, Max-Age 30 днів. Значення: 32 випадкові байти base64url; у `refresh_tokens.token_hash` лише SHA-256 (hex). Парсинг через `cookie-parser`. `DELETE /api/me` очищує cookie з тим самим Path.
- **Ротація й повторне використання.** Кожен refresh відкликає старий токен і видає новий. Повторне пред'явлення відкликаного токена дає 401 і відкликає всі активні refresh-токени користувача (OWASP: ознака крадіжки). Частково замінено рішенням 01-17 нижче.
  - Уточнення (01-17): повторне пред'явлення токена, обернутого менш ніж `REFRESH_REUSE_GRACE_MS` (60 с) тому, не вважається крадіжкою: видається новий токен-«сусід», нічого не відкликається (гонка двох вкладок, reload під час refresh, коли нова cookie не дійшла до браузера). Старіший реплей лишається reuse: усі токени користувача видаляються. Протермінований токен, що вже був обернутий, тепер дає звичайний `InvalidRefreshToken` без видалення токенів. Зловмисник із щойно обернутим токеном має до 60 с доступу (прийнятий компроміс). `revoked_at` ставить лише ротація; вихід і reuse видаляють рядки, тож токен після виходу дає звичайний 401.
- **Access-токен після перезавантаження.** Лише в пам'яті. При старті застосунку AuthProvider робить тихий `POST /api/auth/refresh`; відповідь `{ accessToken, user: { id, email, consentAt } }` відновлює сесію й одразу каже, чи потрібна згода. Та сама функція обробляє 401 посеред сесії: single-flight у вкладці + `navigator.locks` між вкладками, щоб ротація не давала хибного «reuse».
- **ID тестів.** Тег `[TC-01-NN]` з `docs/specs/test-cases.md`:
  - `[TC-01-01]` – unit: argon2, ротація й відкликання refresh-токенів.
  - `[TC-01-02]` – integration: register → login → refresh → logout; відкликаний токен дає 401; `DELETE /api/me` прибирає рядки користувача в усіх таблицях.
  - `[TC-01-03]` – e2e (360 px): реєстрація → згода → головний екран; вихід → вхід. Unit-тести фронтенду для цього потоку теж мають цей тег.
  - `[TC-01-04]` – захищені ендпоінти без токена дають 401.
  - `[TC-01-05]` – помилка входу однакова для неіснуючого email і хибного пароля (додатковий).
  - `[TC-01-06]` – користувач не бачить даних іншого (додатковий).
  - `[TC-01-07]` – ручний: екран згоди називає сервіси, каже, що аудіо не зберігається, і що дані можна видалити (додатковий).
- **Пункти «На потім» зі spec 00** переносимо в `docs/backlog.md` (01-01). У цю spec входять: redact `set-cookie`, захист від `TEST_DATABASE_URL` = dev-БД, очищення тестової БД, лічильник журналу міграцій (і `COLLATE "C"` у тому самому тесті), переклад `.env.example` англійською (файл однаково змінюється).

## Технічні рішення

- **API і коди помилок** (формат `{ error: { code, message } }`):
  - `POST /api/auth/register` `{ email, password }` → 201 `AuthResponse` + Set-Cookie; email зайнятий → 409 `EMAIL_TAKEN` (зокрема при гонці: перехоплюємо `23505`).
  - `POST /api/auth/login` → 200 `AuthResponse` + Set-Cookie; будь-яка невдача → 401 `INVALID_CREDENTIALS` з тим самим повідомленням. Для неіснуючого email виконується `verify` проти фіктивного хешу, щоб час відповіді не розкривав існування.
  - `POST /api/auth/refresh` (cookie) → 200 `AuthResponse` + нова cookie; немає, протерміновано, невідомо чи відкликано → 401 + очищення cookie.
  - `POST /api/auth/logout` (cookie, `@Public`) → 204, відкликає поточний токен, очищує cookie; ідемпотентний.
  - `GET /api/me` → `Me { id, email, consentAt: string | null }`; користувача вже немає → 401.
  - `GET /api/me/consent` → `{ consentAt, providers: { stt: 'fake'|'deepgram', llm: 'fake'|'gemini' } }` (з конфігу; людські назви провайдерів в `uk.json`).
  - `POST /api/me/consent` → 200 `Me`; ідемпотентний, `consent_at` ставиться лише якщо NULL.
  - `DELETE /api/me` `{ password }` → 204 + очищення cookie; хибний пароль → 403 `INVALID_PASSWORD` (не 401, щоб фронтенд не запускав refresh).
  - `@RequiresConsent()` + `ConsentGuard` → 403 `CONSENT_REQUIRED`. У 01 перевіряється тестовим контролером, застосовується в 03 до старту сесії.
- **Фільтр помилок**: якщо тіло `HttpException` має рядкове поле `code`, воно йде у відповідь замість `codeFromStatus`.
- **Валідація тіла**: `ZodBodyPipe(schema)` у `apps/api/src/common/`; помилки віддає наявна гілка `ZodError` фільтра (400 `VALIDATION_ERROR` без значень полів, отже без паролів).
- **Контракти** (`packages/shared/src/auth.ts`): `EmailSchema` (trim + lowercase, бо `users.email UNIQUE` чутливий до регістру), `PasswordSchema` (8–128; верхня межа захищає argon2 від довгих входів), `RegisterRequestSchema`, `LoginRequestSchema`, `MeSchema`, `AuthResponseSchema`, `ConsentInfoSchema`, `DeleteAccountRequestSchema`, `ERROR_CODES` (`INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `INVALID_PASSWORD`, `CONSENT_REQUIRED`).
- **Модулі API**: `auth` (контролер `/auth`, `AuthService`, `PasswordHasher`, `RefreshTokenService`, репозиторії `UsersRepository`/`RefreshTokensRepository` на Drizzle, `AuthGuard`, `ConsentGuard`, декоратори `@Public`, `@CurrentUser`, `@RequiresConsent`) і `me` (контролер `/me`). `RefreshTokenService` залежить від інтерфейсу репозиторію, тож unit-тести йдуть на in-memory реалізації.
- **Атомарна ротація**: `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() RETURNING user_id`. Якщо рядків 0, шукаємо хеш: відкликаний → reuse (відкликати всі токени користувача) → 401 (замінено 01-17: у межах grace видається новий токен, пізніше – видалення всіх токенів). Вставка нового токена в тій самій транзакції.
- **Тестова БД**: `assertTestDatabaseUrl(url)`: ім'я бази має закінчуватися на `_test`, інакше globalSetup і `resetUserData` падають до будь-яких змін (CI має `DATABASE_URL` = `TEST_DATABASE_URL` = `gototalk_test`, правило це пропускає). Integration-проєкт Vitest з `fileParallelism: false`. `resetUserData(pool)` = `TRUNCATE users CASCADE` у `beforeEach` файлів, що створюють користувачів (довідники `mistake_categories`, `theory_links` не чіпаємо). Унікальні email у тестах (`randomUUID`).
- **Swagger-обхід для [TC-01-04]**: тест бере всі операції з `/api/docs-json` і для кожної, крім списку відкритих, перевіряє 401 без токена. Маршрути зі specs 02–05 потраплять під перевірку автоматично.
- **Фронтенд**: `src/shared/api/http.ts` (`apiFetch`: Bearer, на 401 refresh + один повтор, помилки через `ErrorResponseSchema` → `ApiError { status, code }`); `src/shared/session/session-store.ts` (стан у модулі + `useSyncExternalStore`: `unknown | anonymous | authenticated`); `src/shared/api/refresh.ts` (single-flight + `navigator.locks`, у jsdom без locks); маршрути: `/login`, `/register` (лише для анонімних), `/consent` (автентифікований без згоди), решта під `RequireAuth` → `RequireConsent` → `AppLayout`. Форми: react-hook-form + `@hookform/resolvers/zod` зі схемами shared (підтримку Zod 4 звірити з context7). Вихід і видалення акаунта тимчасово в розділі «Акаунт» на ProfilePage (екран профілю перебудує 02). Вихід також чистить кеш TanStack Query.
- **e2e** йде на dev-БД (api dev-сервер): унікальний email на прогін, тест наприкінці видаляє свій акаунт через UI.
- Нові залежності: api `@node-rs/argon2`, `@nestjs/jwt`, `cookie-parser`, dev `@types/cookie-parser`; web `react-hook-form`, `@hookform/resolvers`. Після `pnpm install` перевірити, що pnpm не просить нових `allowBuilds`.

## Задачі

- [x] **01-01. Backlog зі spec 00**
  - Що: `docs/backlog.md`, таблиця «Пункт | Звідки | У якій spec». Джерела: «Відхилення / На потім / Рев'ю на майбутнє» задач 00-07…00-17, розділ «Відкладене після code-review PR #1», рішення «Fake-адаптери – мінімум», технічне рішення про очищення тестової БД. Розподіл: 01 (redact set-cookie, захист тестової БД, очищення БД, лічильник журналу + `COLLATE "C"`, `.env.example` англійською); 02 (`WordState` у shared, вкладки на Mantine, `weakAreas(5)`); 03–05 (Fake-поведінка за stubs.md, підписи `hint`/stubs.md, внутрішні ZodError → 5xx, `FAKE_*_FAIL` enum, RegExp/словник/шаблон summary); «будь-яка» (`@Injectable()` на `PoolShutdown`, подвійний лог health через `cause`, query у лозі, `.catch` на `i18n.init`); «деплой» (`NODE_ENV=production` у контейнері, Swagger за прапорцем, e2e у CI); «Антон» (CI зелений після push, ручна перевірка `[TC-00-03]`). Мігровані кириличні коментарі 0000–0002 – рядок «не робимо». У `00-scaffold.tasks.md` нічого не видаляємо, лише одне речення-посилання на backlog.md.
  - Перевірка: кожен пункт «На потім»/«Рев'ю на майбутнє»/«Відкладене» з 00 є в таблиці (звірка grep за ключовими словами); пункти з колонкою «01» мають задачу в цьому файлі.

- [x] **01-02. Тестова БД: захист і очищення**
  - Що: `apps/api/test/support/test-db.ts`: `assertTestDatabaseUrl`, `resetUserData(pool)`; виклик assert у `global-setup.ts` перед міграціями; `fileParallelism: false` для integration у `vitest.config.ts`; `test/support/test-app.ts`: `createTestApp(overrides?)` (спільний `buildEnv`, зараз дубльований у тестах); `db-schema.test.ts`: кількість рядків журналу = кількість `entries` у `db/migrations/meta/_journal.json`, `ORDER BY ... COLLATE "C"`.
  - Перевірка: unit `[TC-00-04]` для `assertTestDatabaseUrl` (`gototalk` → помилка з поясненням, `gototalk_test` → ок, невалідний URL → помилка); `[TC-00-01]` зелений; тимчасово `TEST_DATABASE_URL=…/gototalk` у процесі → globalSetup падає до міграцій (перевірити й відкотити).
  - Відхилення: unit-тест лежить поруч із хелпером (`test/support`), `unit.include` розширено; `resetUserData` і globalSetup додатково перевіряють `current_database()`, а не лише URL; `createTestApp({ env?, controllers?, providers? })`.

- [ ] **01-03. Конфіг JWT, redact set-cookie, .env.example** **[Антон]**
  - Що: `JWT_ACCESS_SECRET` (обов'язковий, ≥ 32) в `env.schema.ts`; `res.headers["set-cookie"]` у `REDACT_PATHS`; `.env.example`: нова змінна + коментарі англійською; `ci.yml`: тестове значення секрету в `env` (з коментарем, що це не секрет); `createTestApp` передає секрет.
  - Перевірка: `[TC-00-06]` відсутній чи короткий секрет називає змінну; `[TC-00-04]` лог із `res.headers['set-cookie']` не містить значення cookie.
  - Ручна дія: Антон додає `JWT_ACCESS_SECRET` у свій `.env` (згенерувати, наприклад, `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`), інакше `pnpm dev` не стартує.
  - Стан: код і тести готові; `.env.example` (змінна `JWT_ACCESS_SECRET=` і переклад коментарів англійською) чекає на дозвіл доступу до файлу.

- [x] **01-04. Контракти auth у shared**
  - Що: `packages/shared/src/auth.ts` (схеми й коди з «Технічних рішень»), експорт з `index.ts`.
  - Перевірка: unit `[TC-01-02]`: email нормалізується (`' A@B.com '` → `a@b.com`), пароль 7 символів відхилено, 8 прийнято, 129 відхилено; `AuthResponseSchema` приймає `consentAt: null`.

- [x] **01-05. PasswordHasher (argon2)**
  - Що: `apps/api/src/modules/auth/lib/password-hasher.ts` на `@node-rs/argon2` з параметрами seed; `hash`, `verify` (некоректний PHC-рядок → `false`, не виняток); фіктивний хеш для вирівнювання часу входу. TDD.
  - context7: `@node-rs/argon2` (hash/verify/parseOptions).
  - Перевірка: unit `[TC-01-01]`: хеш ≠ паролю й починається з `$argon2id$v=19$m=65536,t=3,p=4$`; verify правильного й хибного пароля; хеш демо-користувача з `db/seed.sql` проходить з `demo-password-1`; два хеші одного пароля різні (сіль). `pnpm install` не вимагає `allowBuilds`.
  - Відхилення: `algorithm: 2` числом (ambient const enum не імпортується при `verbatimModuleSyntax`). `PasswordHasher` рахує фіктивний хеш у кожному екземплярі (~100 мс): у AuthModule (01-07/01-08) надавати як єдиний провайдер.

- [x] **01-06. RefreshTokenService (домен)**
  - Що: `apps/api/src/modules/auth/refresh-token.service.ts` + інтерфейс `RefreshTokensRepository`; генерація (32 байти base64url), SHA-256, `issue`, `rotate` (reuse → відкликати всі токени користувача), `revoke`; in-memory репозиторій лише для тестів. TDD.
  - Перевірка: unit `[TC-01-01]`: rotate видає новий токен і відкликає старий; повторний rotate старого → помилка `TokenReused` і всі токени користувача відкликані; протермінований → помилка; у репозиторії лише хеш (немає сирого значення).
  - Відхилення: до інтерфейсу репозиторію додано `rotateActive(oldHash, next, now)` (відкликання й вставка однією транзакцією); `CLOCK` оголошено в сервісі, його варто перенести в спільний файл при складанні AuthModule. Відкликаний через logout токен при повторному пред'явленні теж вважається reuse (затверджене рішення; замінено 01-17: logout видаляє рядок, повторне пред'явлення дає звичайний 401).

- [x] **01-07. Guard, декоратори, cookie-parser, фільтр**
  - Що: `JwtModule.registerAsync` (секрет із ConfigService, HS256, 15 хв); `AuthGuard` (APP_GUARD) + `@Public()` + `@CurrentUser()`; `@Public()` на health; `cookie-parser` у `configureApp`; `ZodBodyPipe`; поле `code` у фільтрі; `addBearerAuth` у Swagger.
  - context7: `@nestjs/jwt` 12, NestJS 12 guards і cookies.
  - Перевірка: unit фільтра `[TC-00-07]` (кастомний `code`); integration `[TC-01-04]` з тестовим контролером: без токена 401, з невалідним, протермінованим, `alg: none` або чужим секретом 401, з валідним 200; `/api/health` лишається відкритим (`[TC-00-02]` зелений).
  - Відхилення: `CLOCK` у `src/modules/auth/lib/clock.ts`; `AuthModule` поки без `RefreshTokenService` (прив'язка в 01-08); власний код у тілі `HttpException` береться лише для статусів < 500; guard вимагає `exp`; `AuthenticatedRequest` локальний інтерфейс (`@types/express` не резолвиться напряму під pnpm). У 01-09 Swagger-обхід: операції треба позначити `@ApiBearerAuth`.

- [x] **01-08. Ендпоінти register, login, refresh, logout**
  - Що: `UsersRepository`, Drizzle-реалізація `RefreshTokensRepository` (атомарна ротація), `AuthService`, `AuthController` (`/auth/*`), установка й очищення cookie з атрибутами з рішень, опис у Swagger. Drizzle-репозиторій використовує переданий `now` (не SQL `now()`) і мапить рядкові timestamps Drizzle (`mode: 'string'`) у `Date`; `rotateActive` одним `db.transaction`; TTL cookie Max-Age беремо з `REFRESH_TOKEN_TTL_MS`; `PasswordHasher` і `CLOCK` надаємо єдиними провайдерами. Інтеграційний тест: два паралельні refresh одного токена дають рівно один успіх.
  - Перевірка: integration `[TC-01-02]`: register → login → refresh (нова cookie, старий токен у БД відкликаний) → logout (401 на наступний refresh); повторний відкликаний токен → 401 і всі токени користувача відкликані; атрибути Set-Cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api/auth`); у `refresh_tokens.token_hash` немає сирого токена; дубль email → 409 `EMAIL_TAKEN`. `[TC-01-05]`: неіснуючий email і хибний пароль дають однаковий статус і тіло.
  - Відхилення: недійсний або повторно використаний refresh дає один і той самий `UNAUTHORIZED` з однаковим повідомленням (reuse не розкривається); переможець паралельного refresh отримує cookie, яку вже відкликано (програвший запит рахується як reuse, затверджене рішення; замінено 01-17: обидва паралельні запити успішні), тож клієнт мусить робити single-flight (01-11); фільтр логує DrizzleQueryError без query/params (`sanitizeForLog`); `toMe(user)` в `auth.service.ts` перевикористати в 01-09; Swagger-обхід у 01-09 має вважати чотири auth-операції відкритими.

- [x] **01-09. /api/me і згода**
  - Що: `MeController`: `GET /me`, `GET /me/consent` (провайдери з конфігу), `POST /me/consent`; `ConsentGuard` + `@RequiresConsent()`. Drizzle віддає `consent_at` рядком Postgres (`2026-11-13 10:00:00+00`), тож перед побудовою `Me` конвертувати через `new Date(v).toISOString()` (схема приймає лише ISO з `Z`).
  - Перевірка: integration `[TC-01-02]`: новий користувач має `consentAt: null`, після POST – дату, повторний POST її не змінює; тестовий маршрут з `@RequiresConsent()` дає 403 `CONSENT_REQUIRED` до згоди й 200 після. `[TC-01-04]`: Swagger-обхід усіх операцій без токена → 401 (крім відкритих).
  - Відхилення: `AuthModule` став `@Global()` (залежності `ConsentGuard` мають резолвитись поза ним; знадобиться в 03); Swagger-обхід читає `/api/docs-json`, відкриті операції перелічено явно, тож нові маршрути перевіряються автоматично (маршрути з `@ApiExcludeEndpoint` обхід не бачить).

- [x] **01-10. Видалення акаунта й ізоляція**
  - Що: `DELETE /me` з повторним паролем, очищення cookie; тестова фікстура `test/support/user-data.ts`, що вставляє по рядку в кожну таблицю користувача (profiles, goals, sessions, utterances, mistakes, mistake_patterns, words, hints, cards, exercises, session_reports, refresh_tokens).
  - Перевірка: integration `[TC-01-02]`: хибний пароль → 403 `INVALID_PASSWORD`, нічого не видалено; правильний → 204, у всіх 12 таблицях 0 рядків користувача, старий access-токен на `/api/me` → 401. `[TC-01-06]`: два користувачі з фікстурами; `GET /api/me` кожного повертає свої дані; видалення B не зачіпає жодного рядка A; logout B не відкликає токени A.
  - Відхилення: немає. Додано захисні тести: кожен FK на `users` має бути CASCADE і покритий фікстурою, FK між власними таблицями лише за явним allowlist (`mistakes.pattern_id`, `hints.utterance_id`, `hints.word_id` = SET NULL).

- [x] **01-11. Фронтенд: сесія й HTTP-клієнт**
  - Що: `src/shared/api/http.ts`, `src/shared/session/session-store.ts`, `src/shared/api/refresh.ts`, `src/features/auth/api/auth-api.ts`, `src/app/providers/AuthBootstrap/AuthBootstrap.tsx` (тихий refresh при старті, лоадер до відповіді); розширити `renderWithProviders` (початковий стан сесії).
  - Перевірка: unit `[TC-01-03]` (mock fetch): Bearer додається; 401 → один refresh → повтор запиту; два паралельні 401 дають один refresh; невдалий refresh → стан `anonymous`; токен ніде не пишеться в `localStorage`/`sessionStorage`.
  - Відхилення: у web додано залежності `@gototalk/shared` і `zod` (dev); `apiFetch` має опцію `auth: false` (вхід, реєстрація, вихід не запускають refresh); лічильник «покоління» в session-store не дає refresh воскресити сесію після виходу; помилка 5xx або мережі при старті веде в `anonymous` (екран повтору в backlog).

- [x] **01-12. Маршрути, вхід і реєстрація**
  - Що: `RequireAuth`, `RequireConsent`, `PublicOnly` (`src/app/router/guards/guards.tsx`); `LoginPage`, `RegisterPage` (`src/pages/login/`, `src/pages/register/`; Mantine + react-hook-form + zodResolver зі схемами shared; помилки з i18n за `code`); тексти в `uk.json`.
  - context7: react-hook-form, `@hookform/resolvers` (Zod 4), Mantine 9 forms inputs.
  - Перевірка: unit `[TC-01-03]`: анонім на `/words` → `/login`; автентифікований без згоди → `/consent`; реєстрація з паролем 7 символів показує помилку валідації без запиту; `[TC-01-05]` 401 при вході показує одне загальне повідомлення. `pnpm lint` без `i18next/no-literal-string`.
  - Відхилення: додано `react-hook-form`, `@hookform/resolvers`, `zod` повернуто в dependencies; у `eslint.config.js` до винятків `no-literal-string` додано `gap`, `ta`, `autoComplete` (не несуть тексту); гейти `RequireAuth`, `RequireConsent`, `RequireNoConsent`, `PublicOnly`; навігація після входу відбувається через редірект `PublicOnly`; `PasswordInput` Mantine 9.8 не виставляє `aria-invalid`, тож атрибут додано вручну; `ConsentPage` поки заглушка (01-13); у вікні 360 px не перевірялось (01-13/01-15).

- [x] **01-13. Екран згоди**
  - Що: `ConsentPage`: назви провайдерів з `GET /api/me/consent` через i18n, абзаци «аудіо не зберігається» і «дані можна видалити в профілі», кнопки «Погоджуюсь» (POST, далі `/`) і «Вийти».
  - Перевірка: unit `[TC-01-07]`: для `fake/fake` і `deepgram/gemini` рендеряться відповідні назви, є тексти про аудіо й видалення; після згоди перехід на головний екран `[TC-01-03]`. Playwright MCP 360×800: читабельно, без горизонтального скролу.
  - Відхилення: заголовок лишився ключем `pages.consent.title`; розкладку (justify/align/gap) перенесено в SCSS замість розширення винятків `no-literal-string`; для провайдера `fake` підпис «тестовий режим (дані нікуди не передаються)», вступ нейтральний («може передавати»). Перевірено в Edge (playwright-core) на 360x800 з `fake/fake`: без горизонтального скролу, без нижньої навігації, «Погоджуюсь» веде на головний екран; `deepgram/gemini` перевірено лише unit-тестом. Ручний `[TC-01-07]` лишається за вами (01-16).

- [x] **01-14. Вихід і видалення акаунта (тимчасово в профілі)**
  - Що: розділ «Акаунт» на `ProfilePage`: email, кнопка «Вийти», «Видалити акаунт» → Mantine Modal з полем пароля; після успіху очищення сесії й кешу Query, перехід на `/login`.
  - Перевірка: unit `[TC-01-03]`: вихід викликає `/api/auth/logout` і веде на `/login`; `[TC-01-02]` хибний пароль у модалці показує помилку й не виходить; успіх веде на `/login`.
  - Відхилення: `AccountSection` самодостатній для повторного використання в 02, діалог видалення винесено в `DeleteAccountDialog`; поки запит видалення в польоті, діалог не закривається (Esc, клік поза вікном, X вимкнено); розкладку кнопок у SCSS замість `Group` (правило `no-literal-string`); `aria-invalid` на `PasswordInput` виставляється вручну; `renderWithProviders` приймає необов'язковий `queryClient`. Перевірено в Edge на 360x800 (неправильний пароль, очікування запиту, видалення).

- [x] **01-15. e2e auth**
  - Що: `e2e/auth.spec.ts` (мобільний проєкт 360): реєстрація (унікальний email) → згода → головний екран; перезавантаження сторінки лишає користувача в застосунку (тихий refresh); вихід → вхід → головний екран; видалення акаунта → `/login`, повторний вхід дає помилку. `e2e/smoke.spec.ts` адаптувати (навігація тепер за входом: smoke логіниться через API-хелпер або перевіряє редірект на `/login`).
  - Перевірка: `pnpm test:e2e` зелений (Edge-канал локально) `[TC-01-03]`.
  - Відхилення: у `playwright.config.ts` `workers: 2` (паралельне argon2 і холодний Vite заморожували dev-сервери); фікстура `account` видаляє акаунт через API після закриття контексту; e2e працює на dev-БД (аварійний вихід лишає `e2e-%` користувачів, у backlog). Тест двох вкладок раз падав: reload під час тихого refresh обриває відповідь, і нова cookie губиться (сервер уже обернув токен); тест тепер чекає на стабілізацію вкладок перед reload, а сам ризик для продукту записано в backlog і потребує вашого рішення.

- [x] **01-17. Grace-період для щойно обернутого refresh-токена**
  - Що: у `RefreshTokenService.rotate` після невдалого атомарного `rotateActive` шукати рядок за хешем: невідомий або протермінований – `InvalidRefreshToken`; відкликаний і `now - revokedAt <= REFRESH_REUSE_GRACE_MS` (константа 60 с, експортована) – вставити новий токен для того самого користувача (токен-«сусід») без жодного відкликання й повернути його; відкликаний давніше – видалити всі токени користувача й кинути `TokenReused`. `revoke` (logout) видаляє рядок за хешем. Інтерфейс `RefreshTokensRepository`: `deleteByHash`, `deleteAllForUser` замість `revokeActiveByHash`/`revokeAllForUser`; реалізації Drizzle й in-memory. Міграції не потрібні (`revoked_at` лишається, ON DELETE CASCADE не чіпаємо). Оновити тести 01-06/01-08/01-10 під нову семантику; доки spec 01 і README (розділ Authentication); прибрати рядок про reload-гонку з `docs/backlog.md`.
  - Перевірка: unit `[TC-01-01]`: реплей у межах grace дає новий дійсний токен і не відкликає токен-наступник (обидва потім ротуються); реплей після grace дає `TokenReused` і видаляє всі токени користувача; після logout реплей дає `InvalidRefreshToken`, а токени інших сесій цілі; два паралельні `rotate` одного токена обидва успішні. Integration `[TC-01-02]`: два паралельні refresh однієї cookie дають 200 і 200, кожна з отриманих cookie далі ротується; реплей після grace (`revoked_at` зсунуто SQL у минуле) дає 401 і видаляє всі токени; після logout реплей cookie дає 401. e2e `[TC-01-03]`: перша відповідь `/api/auth/refresh` обривається на мережевому рівні після того, як сервер її виконав (`route.fetch()` + `route.abort()`), reload лишає користувача в застосунку.
  - Відхилення: міграцій немає (`revoked_at` ставить лише ротація; вихід і reuse видаляють рядки). e2e відтворює втрату cookie так: `route.fetch()` сам записує `Set-Cookie` у cookie-сховище, тож тест повертає застарілу cookie вручну; з `REFRESH_REUSE_GRACE_MS = 0` він падає, з 60 000 проходить. Тест двох вкладок тепер робить reload без очікування стабілізації. Гонка «findByHash, потім insert» без транзакції лишається в backlog.

- [ ] **01-16. Фінальна перевірка** **[Антон]**
  - Що: README (змінна `JWT_ACCESS_SECRET`, потік входу, демо-користувач із seed), прогін «Готово, коли» spec 01, `reviewer`.
  - Перевірка: зелені `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`; `reviewer` дає `REVIEW: PASS`.
  - Ручна дія: Антон перевіряє `[TC-01-07]` (екран згоди, бажано на Android через `adb reverse`), робить `git push` і PR, перевіряє зелений CI.

## Покриття spec 01

| «Готово, коли» | Задачі |
|---|---|
| Unit: argon2, ротація, відкликання [TC-01-01] | 05, 06 |
| Integration: register → login → refresh → logout, відкликаний токен 401, `DELETE /api/me` чистить усі таблиці [TC-01-02] | 02, 04, 08, 09, 10, 14 |
| e2e: реєстрація → згода → головний; вихід → вхід [TC-01-03] | 11, 12, 13, 14, 15 |
| Захищені ендпоінти без токена → 401 [TC-01-04] | 07, 09 |
| Однакова помилка входу [TC-01-05] | 08, 12 |
| Ізоляція користувачів [TC-01-06] | 10 |
| Ручний: екран згоди [TC-01-07] | 13, 16 |
| Згода перевіряється на бекенді (поведінка spec) | 09 (guard), застосування в 03 |
| Пункти «На потім» для 01 | 01, 02, 03 |
