# 02. Онбординг і профіль: задачі

Специфікація: `docs/specs/02-profile.md`. Гілка: `feat/02-profile`.
Одна задача = один сабагент. Після задачі: зелені `pnpm typecheck`, `pnpm lint`, `pnpm test`, потім `reviewer`, відмітити чекбокс і зробити коміт (Conventional Commits).
Задачі з позначкою **[Антон]** потребують ручної дії.

## Правила для сабагентів (повторювати в кожному промпті)

1. Уся кодова база англійською: код, ідентифікатори, коментарі, назви тестів, Swagger, повідомлення винятків і логів, коміти. Українська лише в `uk.json` і користувацьких даних. `docs/`, `CLAUDE.md` і скіли лишаються українською.
2. Коментарів за замовчуванням немає. Коментар лише для неочевидного ЧОМУ: один короткий рядок англійською. Жодних нотаток про стан задачі.

## Стандарт якості

**Перед новим кодом знайди аналог у reference-реалізації й повтори її патерн**: backend `apps/api/src/modules/auth` і `modules/me`, `apps/api/test/support`; web `features/auth`, `pages/login`, `shared/api`, `shared/testing`. Відхилення від патерну тільки з причиною в плані.

*Структура.* Строго за розділом «Структура коду» в CLAUDE.md: шари web `app → pages → features → shared`; фіча не імпортує фічу (композиція на рівні `pages/`); сторінки тонкі; папка на компонент; без `index.ts`; `@/` між папками, без `../../`. Api: `modules/profile/`, підпапки `persistence/`, `lib/`, `testing/` лише коли файлів одного типу ≥2. Нові файли одразу в правильному місці.

*Backend.*
- Controller тонкий: `ZodBodyPipe` зі схемою з `packages/shared`, один виклик сервісу, повернення DTO. Без логіки й без Drizzle.
- Service містить доменні правила й кидає винятки з `code` із `ERROR_CODES` (нові коди додавай у shared). Repository (`persistence/`) тримає всі Drizzle-запити; рядок БД → DTO через одну функцію-маппер; час через `pgTimestampToDate`.
- Власність даних: кожен запит по цілі фільтрує за `user_id`; чужий і неіснуючий id дають однакову відповідь 404.
- Інваріанти атомарні: ліміт «до 3 активних цілей» перевіряється в тій самій транзакції/умовному INSERT, що й запис (не check-then-insert).
- Агрегати в SQL (`GROUP BY`, `LIMIT`), без завантаження всього й обробки в JS, без N+1.
- Сервіси працюють з існуючим рядком `users`: JWT живий до 15 хв після видалення акаунта, тож FK-помилка має давати 401, не 500.
- Константи й переліки (`LEVELS`, `GOAL_STATUSES`, `MAX_ACTIVE_GOALS`, ідентифікатори пресетів сцен, `WORD_STATES`) живуть в одному місці, `packages/shared`.

*Frontend.*
- Жодного fetch у компонентах. `features/profile/api/profile-api.ts` (клієнт), `profile-queries.ts` (фабрика query keys + `queryOptions`), мутації й логіка в `hooks/use-*.ts` з інвалідацією кешу. Компоненти презентаційні.
- Компонент до ~120 рядків JSX; більший розбивай на підкомпоненти або хуки. Props типізовані, без prop drilling глибше 2 рівнів.
- Форми: react-hook-form + `zodResolver` зі схемами shared; текст помилок через i18n-ключі, не сирі повідомлення Zod.
- Кожен запит має стани loading (Skeleton), error (з повтором) і empty (з поясненням). Спільні компоненти станів у `shared/ui/` лише якщо їх потребують ≥2 фічі.
- Доступність: `label` у полях, `aria-live` для помилок, зони дотику ≥44 px, без горизонтального скролу на 360 px, керування з клавіатури.
- Тексти лише через `uk.json` з впорядкованими ключами (`profile.onboarding.level.title`); речення не склеюються з частин.
- Стилі: спершу пропси Mantine; `*.module.scss` лише за потреби; без inline-об'єктів стилю, без `!important`, без магічних px.

*Запахи коду (жорсткі межі).* Функція ≤ ~40 рядків; параметрів ≤ 3 (далі об'єкт); вкладеність ≤ 3 (ранні return); файл ≤ ~250 рядків (інакше розділи за відповідальністю); дубль у третьому місці виноситься; жодних `any`, `@ts-ignore`, `eslint-disable` без одного рядка причини, `!` (non-null), `as`-кастів поза документованими межами; жодного закоментованого коду, TODO, `console.log`, мертвих експортів, невикористаних параметрів; без спекулятивних абстракцій (YAGNI); імена передають намір.

*Тести.* TDD для доменної логіки й сервісів: спершу тест, що падає. Тести перевіряють поведінку, а не реалізацію; без snapshot-ів; без sleep (час через інжектований годинник). Назва кожного тесту починається з `[TC-02-NN]`. Фікстури й фабрики перевикористовуй (`test/support/user-data.ts`, `shared/testing`). Наявні тести не послаблюй; кількість тестів не зменшується (база: api 193+, web 112+, shared 19+, e2e 8).

*Безпека й приватність.* Жодних секретів і ключів у коді чи логах; не читай `.env`; у логах немає вільного тексту користувача (цілі й сцени це користувацькі дані).

## Погоджені рішення

- **a. Формат `scenes`.** `text[]`; елемент це або код пресету з `SCENE_PRESETS = ['work_meetings','small_talk','interviews','daily_services','travel']`, або свій текст. `isScenePreset(value)` у shared відрізняє код від тексту. Українські назви пресетів у `uk.json` (`profile.scenes.presets.<code>`). Валідація: trim, 1–60 символів, унікальні, 1–6 елементів. Старі значення seed лишаються валідними як «свій текст»; `db/seed.sql` і `docs/specs/stubs.md` переводимо на коди. Відкинуто: jsonb з тегованими об'єктами (потрібна міграція), префікс `custom:` (штучний формат).
- **b. Відсутність профілю.** `GET /api/profile` → 404 `PROFILE_NOT_FOUND`. Гард `RequireProfile` (під `RequireConsent`): loading → лоадер, 404 → `/onboarding` зі `state.from`, інша помилка → екран з повтором. `/onboarding` лежить під `RequireAuth → RequireConsent → RequireNoProfile` поза `AppLayout`. Відкинуто: `200 null`, поле `hasProfile` у `Me`.
- **c. Цілі.** `active ↔ done` в обидва боки, реактивація перевіряє ліміт. 4-та активна → 409 `ACTIVE_GOALS_LIMIT`. Атомарність: транзакція з `SELECT 1 FROM users WHERE id=$1 FOR NO KEY UPDATE` (серіалізує записи цілей користувача й перевіряє існування → 401), далі `count` активних, далі INSERT/UPDATE. Відкинуто: умовний INSERT без блокування (не атомарний у READ COMMITTED).
- **d. Завершення онбордингу.** Фронтенд: `GET /api/goals` → `POST` лише тих заголовків, яких ще немає серед активних → `PUT /api/profile` останнім (наявність профілю = онбординг завершено). Повтор після збою не дублює цілі. Відкинуто: окремий `POST /api/onboarding` (поза переліком API spec).
- **e. `@RequiresConsent()` на профілі: ні.** Згода стосується передачі мовлення STT/LLM; профіль і цілі нікуди не передаються. Гард застосовується в 03.
- **f. Інше.** `goals.scene` і `interface_lang` у контрактах не виставляємо (YAGNI). Назви категорій моделі учня з `uk.json` (`mistakeCategories.<code>`). Читання для видаленого користувача: профіль 404, списки порожні; записи → 401.
- **Міграція 0003 не потрібна.** `level` і `status` уже мають CHECK, ліміт активних цілей CHECK-ом не виразити; CHECK на `scenes` дублював би Zod і ламав би фікстуру `insertUserData`.
- **Свідомі відхилення від reference.** У web з'являються `profile-queries.ts` і `hooks/use-*.ts` (у auth їх немає); auth не переписуємо. Тестовий хелпер `mockApi(routes)` у `shared/testing`: після `RequireProfile` кожен рендер `<App/>` робить додатковий `GET /api/profile`, черга `mockResolvedValueOnce` стає крихкою.

## Технічні рішення

| Метод | Тіло | Успіх | Помилки |
|---|---|---|---|
| `GET /api/profile` | – | 200 `Profile` | 404 `PROFILE_NOT_FOUND` |
| `PUT /api/profile` | `UpdateProfileRequest` | 200 `Profile` (upsert, `updated_at = now()`) | 400, 401 |
| `GET /api/goals` | – | 200 `Goal[]` | – |
| `POST /api/goals` | `CreateGoalRequest` | 201 `Goal` | 400, 401, 409 `ACTIVE_GOALS_LIMIT` |
| `PATCH /api/goals/:id` | `UpdateGoalRequest` | 200 `Goal` | 400, 404 `GOAL_NOT_FOUND`, 409 |
| `DELETE /api/goals/:id` | – | 204 | 404 `GOAL_NOT_FOUND` |
| `GET /api/profile/learner-model` | – | 200 `LearnerModel` | – |

- Контракти в `packages/shared/src/profile.ts`: `LEVELS`, `SCENE_PRESETS`, `isScenePreset`, `SceneSchema`/`ScenesSchema`, `GOAL_STATUSES`, `MAX_ACTIVE_GOALS`, `GoalTitleSchema` (trim 1–200), `ProfileSchema`, `UpdateProfileRequestSchema`, `GoalSchema`, `CreateGoalRequestSchema`, `UpdateGoalRequestSchema` (≥1 поле), `LearnerModelSchema { weakAreas, vocabulary }`, `WORD_STATES`; коди `PROFILE_NOT_FOUND`, `GOAL_NOT_FOUND`, `ACTIVE_GOALS_LIMIT` у `ERROR_CODES`.
- `:id` валідується як uuid; невалідний → 404 (не відрізняється від чужого).
- Learner model: `weakAreas` = `WHERE user_id AND frequency > 0 ORDER BY frequency DESC, last_seen_at DESC NULLS LAST, category LIMIT n`; лічильники слів `GROUP BY state`, відсутні стани 0. `weakAreas(userId, limit = 3)`, контролер передає 5.
- Api: `modules/profile/{profile,goals}.controller.ts`, `{profile,goals}.service.ts`, `learner-model.service.ts`, `persistence/{profiles,goals,learner-model}.repository.ts`; спільні `core/db/pg-errors.ts` (`isUniqueViolation`, `isForeignKeyViolation`) і `requireUserId` у `modules/auth/decorators/current-user.decorator.ts`.
- Web: `features/profile/{api,hooks,lib,components}`, `pages/onboarding/OnboardingPage`, `pages/profile/ProfilePage` (композиція з `features/auth/AccountSection`), `RequireProfile`/`RequireNoProfile` у `app/router/guards/`.

## Задачі

- [x] **02-01. Контракти shared.** `profile.ts` + тест, `index.ts`, `ERROR_CODES`; `WORD_STATES` переноситься з api (backlog), `learner-model.types.ts` імпортує з shared. `[TC-02-01]`.
  - Відхилення: додано `GoalStatusSchema`, `WordStateSchema`, тип `ScenePreset` (type guard `isScenePreset`); у `auth.test.ts` тест `ERROR_CODES` розширено новими кодами. Низькі зауваження рев'ю (тести `GoalSchema`/`ProfileSchema`, `MAX_ACTIVE_GOALS`, відсутній ключ у `vocabulary`) у backlog.
- [x] **02-02. Спільні хелпери api.** `core/db/pg-errors.ts` (+тест), `users.repository.ts`, `requireUserId`, `me.controller.ts`. Поведінка auth не змінюється.
  - Відхилення: `isForeignKeyViolation` до 02-03 без викликів у production-коді (використовують репозиторії 02-03/02-04); тест й реалізація написані разом, бо це пряме виокремлення.
- [x] **02-03. API профілю.** `ProfilesRepository` (upsert), `ProfileService`, `ProfileController`, модуль, `test/profile.test.ts`. `[TC-02-01]`, `[TC-02-02]`.
  - Відхилення: unit-тест сервісу на `vi.fn`-моках (як `auth.service.test.ts`), без `testing/`; `ProfileOwnerMissingError` лежить у `profiles.repository.ts`; Swagger-тіло використовує `LEVELS` зі shared. Низькі зауваження рев'ю – у backlog.
- [x] **02-04. API цілей.** `GoalsRepository` (транзакція з блокуванням `users`), `GoalsService`, `GoalsController`, `test/goals.test.ts` (ізоляція користувачів, паралельні POST, 401 для видаленого). Закриває backlog «сервіси працюють з існуючим `users`». `[TC-02-01]`, `[TC-02-02]`.
  - Відхилення: репозиторій дає `withLockedUser(userId, work)` з `GoalsUnitOfWork`, правило ліміту й мапінг 401/404/409 у сервісі; окремого `ActiveGoalsLimitError` немає (`ConflictException` кидається всередині транзакції); uuid `:id` перевіряється в сервісі, без pipe; `DELETE` для видаленого користувача дає 404 (не 401, у spec для DELETE лише 404); константи `GOAL_TITLE_MAX`, `MAX_SCENES`, `MAX_SCENE_LENGTH` у shared. Рядок backlog про JWT звужено до 03–05.
- [x] **02-05. Модель учня.** `LearnerModelRepository`, реальні `weakAreas`/`vocabularyStats` без заглушок, `GET /api/profile/learner-model`, оновити `core-services.test.ts`, Swagger-списки в `me.test.ts`. Backlog: `weakAreas` limit 3; прибрати `void arg;`. `[TC-02-05]`.
  - Відхилення: сервіс отримав `snapshot(userId, limit)` (один виклик із контролера); два кроки мапінгу (`toWeakArea` у репозиторії: рядок → доменний тип з `Date`, `toLearnerModel` у `learner-model.mapper.ts`: `Date` → ISO); маршрут у `ProfileController`; unit-тест сервісу написано після реалізації (пряма делегація).
- [x] **02-06. Web: api-шар, хуки, тест-інфраструктура.** `profile-api.ts`, `profile-queries.ts`, `use-update-profile.ts`, `use-goal-mutations.ts`, `use-complete-onboarding.ts`, `profile-errors.ts`, `mockApi` і фікстури в `shared/testing`, базові ключі `uk.json`. `[TC-02-02]`.
  - Відхилення: `queryClient.query` замість застарілого `fetchQuery` (TanStack Query 5.107); `useUpdateProfile` і `useCompleteOnboarding` кладуть результат PUT у кеш (`setQueryData`), щоб гард не бачив застарілий 404; `profileErrorKey` повертає `{ key, values? }` (`max` для ліміту з shared); `profileQueryOptions` не повторює 4xx; додано `shared/testing/{mock-api,query-wrapper}` і ключі `profile.levels.*`, `profile.scenes.presets.*`, `profile.goals.errors.*`. Заголовки кроків онбордингу йдуть у `profile.onboarding.*` (02-07).
- [x] **02-07. Онбординг.** `OnboardingWizard`, `LevelPicker`, `ScenePicker`, `GoalInputs`, `onboarding-form.ts`, `OnboardingPage`, маршрут `/onboarding`, `uk.json`. Playwright MCP 360 px. `[TC-02-03]`, `[TC-02-04]`.
  - Відхилення: одна спільна `onboardingSchema` з `trigger(step)` замість окремих схем кроків; сторінка бере `AuthLayout` з `features/auth` (композиція на рівні pages); `/onboarding` поки лише під `RequireConsent` (гарди профілю в 02-10); `state.from` перевіряється `onboarding-redirect.ts` (лише внутрішній шлях, не `/onboarding`); фокус переходить на новий крок; чернетка власної сцени додається при «Далі»; `size="lg"` для зон дотику ≥44 px. Перевірено в Playwright MCP на 360x800: без горизонтального скролу, довгі чипи переносяться. Ручний `[TC-02-06]` лишається за Антоном.
- [x] **02-08. Профіль: рівень, сцени, цілі.** `ProfileDetails`, `GoalsSection`, `ProfilePage`. `[TC-02-02]`, `[TC-02-03]`, `[TC-02-04]`.
  - Відхилення: редагування профілю inline (не Modal), фокус на fieldset рівня й назад на «Редагувати»; Modal лише для підтвердження видалення цілі (після видалення фокус на заголовку «Цілі»); лічильник `{{active}}` замість `{{count}}` (уникнення плюралізації i18next); `LevelPicker` приймає `hint`; у `eslint.config.js` до винятків `no-literal-string` додано `p`, `tt`, `align`, `spacing`, `justify`, `wrap`; «Відкрити знову» не вимикається на ліміті (показується 409 сервера). Перевірено в Playwright MCP на 360x800.
- [x] **02-09. Модель учня в профілі.** `LearnerModelSection`, `mistakeCategories.*` у `uk.json`. `[TC-02-05]`.
  - Відхилення: частота з українською плюралізацією (`_one/_few/_many/_other`); назви категорій у `uk.json` збігаються з `mistake_categories.title_uk`; блоки як `role=group` + `dl`; `ModelBlock` – спільний заголовок блоків. Перевірено в Playwright MCP на 360x800 (демо-користувач і порожній стан).
- [x] **02-10. Гарди й редірект.** `RequireProfile`, `RequireNoProfile`, `from` після входу (backlog), оновлення наявних тестів на `mockApi`. `[TC-02-03]`.
  - Відхилення: гарди профілю в `profile-guards.tsx`, екрани очікування й повтору в `GateScreens`; логіка `data`-first (невдалий фоновий refetch не викидає користувача); `RequireNoProfile` редіректить на безпечний `from`; валідація `from` винесена в `shared/router/safe-path.ts` (`onboarding-redirect.ts` видалено); `from` зберігається через згоду; `RequireAuth` пише `from` і після виходу (прийнято: наступний вхід на пристрої повертає на останню сторінку). Перевірено в Playwright MCP на 360x800.
- [x] **02-11. e2e.** `e2e/profile.spec.ts`, фікстури, `auth.spec.ts`; `pnpm test:e2e`. `[TC-02-03]`.
  - Відхилення: фікстури `consentedPage` (без профілю) і `signedInPage` (з профілем через PUT); хелпери `support/onboarding.ts`; тест виходу → входу тепер очікує повернення на `/profile` (рішення 02-10), окремий `[TC-01-03]` тест перевіряє вхід без `from` → `/`; e2e 13 (було 8), дві послідовні зелені прогони. Перевірку casts через `@gototalk/shared` пропущено: пакет недоступний з `e2e`.
- [x] **02-12. Backlog: нижні вкладки на Mantine.** `UnstyledButton component={NavLink}`, тест `BottomNav.test.tsx`; px-літерали в SCSS (рамка 2px, outline) успадковані з попередньої версії, на 360 px виміряно 4 вкладки по 90x55 px.
- [x] **02-13. Backlog: офлайн-старт.** 5xx/мережа при тихому refresh → екран з повтором (`GateError`, ключі `app.gate.*`); тест `falls back to anonymous when the refresh fails with a server error` замінено на протилежну поведінку, як вимагає задача; перевірено в Playwright MCP на 360x800.
- [x] **02-14. Backlog: помилка виходу.** `logout()` чистить сесію лише після 2xx або 4xx; мережева помилка й 5xx пробрасуються, `AccountSection` і `ConsentPage` показують `Alert`, повторне натискання «Вийти» є повтором (хук `use-logout.ts`). Старі тести «виходить попри помилку запиту» свідомо замінено протилежною поведінкою.
- [x] **02-15. Документація рішень.** `docs/tech-decisions.md` (рішення 30), `db/seed.sql` і `docs/specs/stubs.md` (коди сцен), `docs/backlog.md`.
  - Відхилення: у `tech-decisions.md` рішення розбито на 30 (сцени, відсутній профіль, цілі, завершення онбордингу), 31 (згода, відсутність міграції 0003), 32 (безпечний `from`, кеш після PUT); дату «Стан на» оновлено; у `stubs.md` додано правило для власної сцени (реалізація Fake в spec 03); з backlog видалено застарілий рядок про `from` після входу, решта рядків закритих пунктів уже була звужена або прибрана; тести seed читають лише хеш пароля, на рядки сцен не спираються.
- [ ] **02-16. README.** API профілю/цілей, онбординг у потоці.
- [ ] **02-17. Фінальна перевірка** **[Антон]**. Прогін «Готово, коли», `reviewer`; Антон: ручний `[TC-02-06]`, `git push`, PR, CI.

## Покриття spec 02

| «Готово, коли» | Задачі |
|---|---|
| Unit: валідація профілю [TC-02-01] | 01, 03, 04 |
| Integration: CRUD профілю й цілей, чужі цілі 404 [TC-02-02] | 03, 04, 06, 08 |
| e2e: онбординг → профіль → зміна рівня [TC-02-03] | 07, 08, 10, 11 |
| Форми на RHF + Zod зі shared, тексти в `uk.json` [TC-02-04] | 07, 08 |
| Learner-model: топ-5 і лічильники [TC-02-05] | 05, 09 |
| Ручний: 360 px [TC-02-06] | 07, 17 |
