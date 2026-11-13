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

- [ ] **02-01. Контракти shared.** `profile.ts` + тест, `index.ts`, `ERROR_CODES`; `WORD_STATES` переноситься з api (backlog), `learner-model.types.ts` імпортує з shared. `[TC-02-01]`.
- [ ] **02-02. Спільні хелпери api.** `core/db/pg-errors.ts` (+тест), `users.repository.ts`, `requireUserId`, `me.controller.ts`. Поведінка auth не змінюється.
- [ ] **02-03. API профілю.** `ProfilesRepository` (upsert), `ProfileService`, `ProfileController`, модуль, `test/profile.test.ts`. `[TC-02-01]`, `[TC-02-02]`.
- [ ] **02-04. API цілей.** `GoalsRepository` (транзакція з блокуванням `users`), `GoalsService`, `GoalsController`, `test/goals.test.ts` (ізоляція користувачів, паралельні POST, 401 для видаленого). Закриває backlog «сервіси працюють з існуючим `users`». `[TC-02-01]`, `[TC-02-02]`.
- [ ] **02-05. Модель учня.** `LearnerModelRepository`, реальні `weakAreas`/`vocabularyStats` без заглушок, `GET /api/profile/learner-model`, оновити `core-services.test.ts`, Swagger-списки в `me.test.ts`. Backlog: `weakAreas` limit 3; прибрати `void arg;`. `[TC-02-05]`.
- [ ] **02-06. Web: api-шар, хуки, тест-інфраструктура.** `profile-api.ts`, `profile-queries.ts`, `use-update-profile.ts`, `use-goal-mutations.ts`, `use-complete-onboarding.ts`, `profile-errors.ts`, `mockApi` і фікстури в `shared/testing`, базові ключі `uk.json`. `[TC-02-02]`.
- [ ] **02-07. Онбординг.** `OnboardingWizard`, `LevelPicker`, `ScenePicker`, `GoalInputs`, `onboarding-form.ts`, `OnboardingPage`, маршрут `/onboarding`, `uk.json`. Playwright MCP 360 px. `[TC-02-03]`, `[TC-02-04]`.
- [ ] **02-08. Профіль: рівень, сцени, цілі.** `ProfileDetails`, `GoalsSection`, `ProfilePage`. `[TC-02-02]`, `[TC-02-03]`, `[TC-02-04]`.
- [ ] **02-09. Модель учня в профілі.** `LearnerModelSection`, `mistakeCategories.*` у `uk.json`. `[TC-02-05]`.
- [ ] **02-10. Гарди й редірект.** `RequireProfile`, `RequireNoProfile`, `from` після входу (backlog), оновлення наявних тестів на `mockApi`. `[TC-02-03]`.
- [ ] **02-11. e2e.** `e2e/profile.spec.ts`, фікстури, `auth.spec.ts`; `pnpm test:e2e`. `[TC-02-03]`.
- [ ] **02-12. Backlog: нижні вкладки на Mantine.**
- [ ] **02-13. Backlog: офлайн-старт.** 5xx/мережа при тихому refresh → екран з повтором.
- [ ] **02-14. Backlog: помилка виходу.** `logout()` не чистить сесію мовчки.
- [ ] **02-15. Документація рішень.** `docs/tech-decisions.md` (рішення 30), `db/seed.sql` і `docs/specs/stubs.md` (коди сцен), `docs/backlog.md`.
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
