# 03. Старт сесії: задачі

Специфікація: `docs/specs/03-session-start.md`, Fake: `docs/specs/stubs.md` 2.2. Гілка: `feat/03-session-start`.
Одна задача = один сабагент. Після задачі: зелені `pnpm typecheck` і `pnpm lint` (повний `pnpm test` на межах блоків і у фіналі), потім `reviewer` для `[risk]`, відмітити чекбокс і зробити коміт (Conventional Commits).
Позначки: `[risk]` рев'ю одразу; `[UI]` перевірка Playwright MCP на 360 px; `[e2e]` прогін `pnpm test:e2e`; **[Антон]** потребує ручної дії.

**Відхилення від запиту (гілка).** PR spec 02 (#4) ще не злитий у `main`, тож гілку створено від `feat/02-profile`, а не від `main`: 03 залежить від профілю, цілей, гардів і `shared/testing`. PR 03 відкривається проти `main` (diff скорочується після злиття #4); якщо #4 ще не злитий на момент PR, база `feat/02-profile`. Незакомічені зміни Антона (`.claude/settings.json`, `CLAUDE.md`, чекбокс 02-17) не комітяться; усі `git add` лише за явними шляхами.

## Правила для сабагентів (повторювати в кожному промпті)

1. Уся кодова база англійською: код, ідентифікатори, коментарі, назви тестів, Swagger, повідомлення винятків і логів, коміти. Українська лише в `uk.json` і користувацьких даних. `docs/`, `CLAUDE.md` і скіли лишаються українською.
2. Коментарів за замовчуванням немає. Коментар лише для неочевидного ЧОМУ: один короткий рядок англійською. Жодних нотаток про стан задачі.


## Стандарт якості

**Перед новим кодом знайди аналог у reference-реалізації й повтори її патерн**: backend `apps/api/src/modules/profile` (контролери, сервіси, `persistence/`, `withLockedUser`, `core/db/pg-errors`) і `modules/auth`; web `features/profile` (`api/`, `*-queries.ts`, `hooks/`, `components/`), `app/router/guards`, `shared/testing` (`mock-api`, `query-wrapper`). Відхилення від патерну тільки з причиною у «Відхиленнях» задачі.

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
*Зміни для spec 03 (рев'ю 02, LLM).*

- Reference-реалізації: backend `modules/profile` (контролери, сервіси, `persistence/`, `withLockedUser`, `core/db/pg-errors`), `modules/auth`; web `features/profile` (api, `*-queries.ts`, hooks, components), `app/router/guards`, `shared/testing` (`mock-api`, `query-wrapper`).
- Префікс тестів `[TC-03-NN]`; кількість тестів не зменшується (база: shared 36, web 278, api 274, e2e 13).
- Нові пункти з рев'ю 02:
  - без px-літералів у SCSS і пропсах: `rem()` або змінні Mantine (рев'ю 02-12);
  - i18n-ключі не дублюються між фічами: спільні в `common.*` / `errors.*` (рев'ю 02-06, 02-08);
  - unit-тести сервісів, що мапляться на 404/401, тегуються тим TC, який описує поведінку (рев'ю 02-03);
  - Vitest-глобалі через `unstubGlobals: true` у конфігу, без ручного `afterEach(vi.unstubAllGlobals)` (рев'ю 02-06);
  - тести перевіряють і граничні значення констант зі shared (рев'ю 02-01);
  - порядок перевірок uuid і тіла (400 проти 404) документується й покривається тестом (рев'ю 02-04).
- LLM:
  - відповідь моделі завжди проходить Zod-схему з shared (`safeParse`, не `parse`);
  - при невалідній відповіді один повтор, потім помилка з кодом (`LANGUAGE_MODEL_INVALID_RESPONSE`, 502), не 500 без коду;
  - у лог не потрапляє текст користувача (власна тема, цілі, власні сцени, питання моделі) – лише шляхи й коди Zod-issues;
  - промпт лише з версіонованого файлу `packages/prompts`, користувацькі дані в блоці даних (JSON), не склеюються з інструкціями.


## Погоджені рішення

**a. Решта питань плану: JSONB `sessions.plan`** (погоджено). Міграція 0003: `plan jsonb NULL` + CHECK. Зберігаються всі 5 питань `{ "questions": [...] }`; питання 1 ще й як репліка `assistant` seq 1. Наслідки для 04: `nextTurn` бере `plan.questions[кількість assistant-реплік]` або уточнення; `utterances` містить лише сказане, `seq` суцільний, уточнення вставляються природно; історія, аналіз і звіт не фільтрують «незадані» рядки. NULL дозволено: засіяна завершена сесія й фікстура `insertUserData` без плану. Відкинуто: наперед створені репліки (незадані питання в історії й звіті, немає колонки «не задано» без міграції, `seq` не дає вставити уточнення).

**b. «Інша тема» без стану.** `POST /api/sessions/plan` приймає `{ previousTopics: string[] (≤ MAX_TOPIC_REROLLS = 3), customTopic? }`; клієнт накопичує теми, які вже показав. Ліміт – Zod `.max(3)` на сервері (400 `VALIDATION_ERROR`), кнопка на фронті вимикається після 3. Обхід (порожній список щоразу) не захищаємо: це UX-ліміт, не безпека; rate limiting – у backlog «деплой». Детермінізм Fake: індекс теми = `previousTopics.length mod 5` у першій сцені-пресеті, тож той самий запит дає ту саму тему. Реальна модель отримує `previousTopics` у промпті як «не повторювати». При `customTopic` поле `previousTopics` ігнорується. Старт: клієнт повертає показаний план `{ topic, topicSource, questions, feedbackMode }`, сервер валідує Zod і зберігає. Довіра клієнту прийнятна, бо це власні дані користувача. Відкинуто: повторна генерація на старті (реальна модель дала б інший план, ніж показано), підписаний токен плану (зайва складність).

**c. Цілі в `PlanSessionInput`:** нове поле `goals: string[]` (заголовки активних цілей, ≤3, порядок `created_at`). Fake їх ігнорує (у `stubs.md` 2.2 цілей немає, допишемо це явно); промпт їх використовує. Заголовки цілей, власні сцени й власна тема – користувацький текст, у лог не потрапляють.

**d. `packages/prompts`:** пакет без збірки. `package.json`: `"exports": { "./*.md": "./*.md" }`, `"files": ["*.md"]`; api отримує залежність `"@gototalk/prompts": "workspace:*"` (`pnpm install`, оновлюється lockfile). Завантажувач `integrations/language-model/prompt-loader.ts`: `createRequire(import.meta.url).resolve('@gototalk/prompts/session-plan.v1.md')` + `readFileSync`, кеш у пам'яті. Шлях однаково працює в tsx/Vitest і в `dist` після `nest build`, бо резолвиться через симлінк workspace, без копіювання. Ідентифікатор версії = ім'я файлу `session-plan.v1`, як у README пакета (`error-analysis.v1`) і `analysis_prompt_version`; формат `session-plan@v1` не беремо, щоб не мати двох конвенцій. Рендер `session-plan-prompt.ts`: `renderSessionPlanPrompt(input) → { id: 'session-plan.v1', text }`. Шаблон має один плейсхолдер `{{input}}`, у нього підставляється `JSON.stringify(input)` у блоці даних (менша поверхня для prompt injection); рендер кидає помилку, якщо лишився `{{…}}`. «Використовується адаптером»: `FakeLanguageModel.planSession` спершу рендерить промпт, як зробить реальний адаптер, текст відкидає й повертає банк. Тож відсутній або зламаний шаблон валить unit, integration і e2e навіть без ключів. `[TC-03-04]`: тест рендера (файл знайдено, id, вхід у тексті, є правило про провокацію патерну, немає `{{`). Альтернатива: лише тест рендера, Fake його не викликає (менш чесно щодо «використовується»). Реальний Gemini не вводимо.

**e. Старт повертає** 201 `SessionDetails` = `Session` + `utterances: [{ id, seq: 1, role: 'assistant', text }]`. `GET /api/sessions/:id` повертає ту саму форму (репліки за `seq`), тож екран діалогу переживає перезавантаження. План (`questions`) назовні не віддаємо. Фронт веде на `/sessions/:id`: сторінка з темою й першим питанням; запис і діалог буде в spec 04.

**f. Останні сесії:** `GET /api/sessions` → 10 (`RECENT_SESSIONS_LIMIT` у shared) за `started_at DESC, id DESC`, без пагінації й без query-параметрів (YAGNI, «останні»). Елемент: тема, дата, статус, режим. Активна має «Продовжити» → `/sessions/:id`; завершена теж веде на `/sessions/:id` (звіт буде в 05). Порожній стан: пояснення й заклик почати першу сесію. Використовується наявний індекс `idx_sessions_user_start`.

**g. Одна активна сесія; старт завершує попередню** (погоджено). Транзакція: `SELECT 1 FROM users WHERE id=$1 FOR NO KEY UPDATE` (серіалізує старти користувача; відсутній рядок → 401, закриває backlog «FK → 401» для 03), далі `UPDATE sessions SET status='finished', ended_at=now() WHERE user_id=$1 AND status='active'`, далі INSERT сесії, далі INSERT репліки seq 1. Страховка в БД: частковий унікальний індекс у 0003. Ризик для 05: сесія, завершена автоматично, не проходить через «Завершити» (звіт має генеруватися ліниво або на завершенні в обох шляхах; записати в backlog для 05).

**Згода.** `@RequiresConsent()` на `POST /api/sessions/plan` і `POST /api/sessions`: на plan рівень, сцени, цілі й власна тема йдуть до LLM-провайдера, а саме цю передачу покриває згода (рішення 31). `GET` (список, деталі) без гарда, бо нічого не передається, як профіль у рішенні 31. На фронті маршрути й так під `RequireConsent`.

**Пропозиція на окремому маршруті `/sessions/new`** (погоджено). Один дотик на «Почати сесію» відкриває `/sessions/new`, де одразу Skeleton, потім план (`[TC-03-06]`). «Назад» на Android повертає на головну.

**Інші мої рішення.**
- Власна тема у Fake: тема як введена, питання за шаблоном `stubs.md`; правило патерну (питання 1 замінюється) діє й тут, бо spec вимагає його без винятків. `stubs.md` уточнюється.
- Для власної теми сервіс сам ставить `topic = customTopic` (trim) і `topicSource = 'custom'`, не довіряючи моделі повторити тему.
- Без профілю `POST /plan` → 404 `PROFILE_NOT_FOUND` (через наявний `ProfileService.get`).
- Невалідна відповідь моделі двічі → 502 `LANGUAGE_MODEL_INVALID_RESPONSE`. Фільтр зараз для ≥500 бере код зі статусу (`BAD_GATEWAY`), тож у 03-05 фільтр зберігає явний `code` і для 5xx (повідомлення лишається загальним, лог лишається). Недоступність провайдера (`FAKE_LLM_FAIL=unavailable`) – у 04 за backlog.
- Порт: `planSession(input: PlanSessionInput): Promise<unknown>` з JSDoc «сира відповідь моделі, викликач валідує `PlanSchema`». Решта методів порту переходять на `unknown` у 04 разом зі своєю валідацією (рядок у backlog).
- Валідація з повтором – `integrations/language-model/validated-call.ts`: `requestValidated(schema, call, logger)`. Використовує `safeParse` (жодного `ZodError` у фільтр, тобто не 400). Лог `warn` з `{ attempt, issues: [{ path, code }] }` без значень. Після другої невдачі кидає `LanguageModelInvalidResponseError`. Знадобиться в 04 одразу, тому не спекулятивно.
- `ProfileModule` експортує ще `ProfileService` і `GoalsService`; новий `GoalsRepository.listActive(userId)` (WHERE у SQL) і `GoalsService.listActive`.
- Репозиторій сесій один, тож він лежить у корені модуля (`sessions.repository.ts`, правило «підпапка лише за ≥2»). Блокування `users` повторює `withLockedUser` (друге місце; виносимо в `core/db` на третьому).
- Web-фіча `features/session` (уже є в `WEB_FEATURES` ESLint). Хук деталей називається `useSessionDetails`, щоб не плутати з `useSession` зі `shared/session` (auth).
- План у web – `useQuery` з ключем = тілом запиту (`staleTime: Infinity`, без refetch на фокус, `retry` лише для не-4xx): StrictMode не дублює POST, повернення до попередньої теми з кешу. Старт – `useMutation`: `setQueryData(details)` + інвалідація списку, навігація в компоненті.
- Перемикач режиму – `SegmentedControl`, типовий `immediate`, у профілі не запам'ятовується.


## Технічні рішення (контракти)

`packages/shared/src/session.ts` (+ `session.test.ts`, експорт в `index.ts`):
- `FEEDBACK_MODES = ['immediate','deferred']`, `TOPIC_SOURCES = ['suggested','custom']`, `SESSION_STATUSES = ['active','finished']`, `UTTERANCE_ROLES = ['assistant','user']` + схеми-enum.
- `TOPIC_MAX = 120`, `QUESTION_MAX = 300`, `MAX_TOPIC_REROLLS = 3`, `RECENT_SESSIONS_LIMIT = 10`, `PLAN_QUESTIONS = 5`.
- `TopicSchema` (trim 1–`TOPIC_MAX`); у `llm.ts` `PlanSchema` отримує межі (`TopicSchema`, питання trim 1–`QUESTION_MAX`), тож межі діють і на відповідь моделі.
- `PlanSessionRequestSchema { previousTopics: TopicSchema[] .max(3) .default([]), customTopic?: TopicSchema }`.
- `SessionPlanSchema = PlanSchema + { topicSource }` (відповідь `/plan`).
- `StartSessionRequestSchema { topic, topicSource, questions (length 5), feedbackMode .default('immediate') }`.
- `SessionSchema { id, topic, topicSource, feedbackMode, status, startedAt, endedAt|null }`, `SessionListSchema`, `UtteranceSchema { id, seq, role, text }`, `SessionDetailsSchema = Session + { utterances }`.
- `ERROR_CODES`: + `SESSION_NOT_FOUND`, `LANGUAGE_MODEL_INVALID_RESPONSE`.

| Метод | Гард | Тіло | Успіх | Помилки |
|---|---|---|---|---|
| `POST /api/sessions/plan` | згода | `PlanSessionRequest` | 200 `SessionPlan` | 400, 401, 403 `CONSENT_REQUIRED`, 404 `PROFILE_NOT_FOUND`, 502 `LANGUAGE_MODEL_INVALID_RESPONSE` |
| `POST /api/sessions` | згода | `StartSessionRequest` | 201 `SessionDetails` | 400, 401 (зокрема видалений користувач), 403 |
| `GET /api/sessions` | – | – | 200 `Session[]` (≤10) | 401 |
| `GET /api/sessions/:id` | – | – | 200 `SessionDetails` | 404 `SESSION_NOT_FOUND` (чужий, неіснуючий, не-uuid) |

Видалений користувач: список порожній, деталі 404, записи 401.

**Міграція 0003** (`db/migrations/0003_session_plan.sql`, через `/db-migration`, англійською):
```sql
ALTER TABLE sessions ADD COLUMN plan jsonb;
ALTER TABLE sessions ADD CONSTRAINT sessions_plan_check
  CHECK (plan IS NULL OR (jsonb_typeof(plan) = 'object' AND jsonb_typeof(plan -> 'questions') = 'array'));
-- Keep only the newest active session per user so the unique index can be built on existing data
UPDATE sessions s SET status = 'finished', ended_at = COALESCE(s.ended_at, now())
WHERE s.status = 'active' AND EXISTS (
  SELECT 1 FROM sessions n WHERE n.user_id = s.user_id AND n.status = 'active'
    AND (n.started_at, n.id) > (s.started_at, s.id));
CREATE UNIQUE INDEX sessions_one_active_per_user ON sessions (user_id) WHERE status = 'active';
```
Транзакцію перевірити за поведінкою мігратора drizzle (скіл, крок 3). Після: `pnpm db:pull` (`schema.ts` отримує `plan` і індекс), `db-schema.test.ts`: CHECK 16 → 17, перевірка індексу й CHECK. `insertUserData` не змінюється (одна активна сесія без плану валідна). Seed: див. 03-08.


## Дерево файлів

```
packages/shared/src/  session.ts (+test) · llm.ts (межі PlanSchema) · auth.ts (ERROR_CODES) · index.ts
packages/prompts/     package.json (exports, files) · session-plan.v1.md · README.md
db/migrations/        0003_session_plan.sql · meta/ (journal, snapshot)
db/seed.sql           upsert профілю, цілей, plan засіяної сесії
apps/api/
  package.json        + @gototalk/prompts
  src/core/errors/all-exceptions.filter.ts (+test)   явний code для 5xx
  src/core/db/schema.ts                              db:pull
  src/integrations/language-model/
    language-model.port.ts       goals у PlanSessionInput; planSession → unknown
    fake-language-model.ts       planSession за stubs.md
    fake-session-plans.ts        банк тем, шаблони питань, питання під патерни
    prompt-loader.ts (+test) · session-plan-prompt.ts (+test) · validated-call.ts (+test)
  src/integrations/fake-adapters.test.ts
  src/modules/profile/  profile.module.ts (exports) · goals.service.ts · persistence/goals.repository.ts (listActive)
  src/modules/session/
    session.module.ts · sessions.controller.ts · sessions.service.ts (+test)
    session-planner.service.ts (+test) · plan-input.ts (+test) · sessions.repository.ts · session.errors.ts
  src/core-services.test.ts
  test/sessions-plan.test.ts · test/sessions.test.ts · test/db-schema.test.ts
apps/web/
  vite.config.ts      test.unstubGlobals: true
  src/shared/ui/LoadError/{LoadError.tsx,.test.tsx} · SectionSkeleton/{SectionSkeleton.tsx,.test.tsx}
  src/shared/i18n/uk.json         common.*, errors.*, session.*
  src/shared/testing/test-fixtures.ts (сесії) · mock-api.ts (без import vi)
  src/features/session/
    api/session-api.ts (+test) · api/session-queries.ts (+test)
    hooks/use-session-proposal.ts (+test) · hooks/use-start-session.ts (+test) · lib/session-errors.ts (+test)
    components/RecentSessions/{RecentSessions.tsx, SessionListItem.tsx, RecentSessions.test.tsx}
    components/SessionProposal/{SessionProposal.tsx, ProposalPlan.tsx, FeedbackModeControl.tsx, SessionProposal.test.tsx}
    components/CustomTopicForm/{CustomTopicForm.tsx, CustomTopicForm.test.tsx}
    components/SessionQuestion/{SessionQuestion.tsx, SessionQuestion.test.tsx}
  src/pages/session/SessionPage.tsx (головна, h1 «Сесія» лишається)
  src/pages/new-session/NewSessionPage.tsx (+test) · src/pages/dialog/DialogPage.tsx (+test)
  src/app/App.tsx (маршрути /sessions/new, /sessions/:id)
  src/features/profile/**         імпорти з shared/ui, ключі common.*/errors.*
e2e/session.spec.ts · e2e/support/ (хелпер за потреби)
docs/  tech-decisions.md · stubs.md · backlog.md · README.md
```

## Політика перевірок

Сабагент запускає лише зачеплене й залежне:
- тести, пов'язані зі зміненими файлами: `pnpm --filter <web|api> exec vitest related --run <змінені вихідні файли>` плюс нові тест-файли задачі; інтеграційні api: `pnpm --filter api exec vitest run --project integration test/<файл>.test.ts`;
- лінт змінених файлів: `pnpm exec eslint <файли>`;
- typecheck зачепленого пакета: `pnpm --filter <web|api> typecheck`;
- зміна `packages/shared` або `packages/prompts`: спершу збірка й тести пакета, потім typecheck обох застосунків і `vitest related` по файлах, що імпортують змінений контракт.
Повні `pnpm test`, `pnpm lint`, `pnpm test:e2e` і Playwright MCP сабагент не запускає (Playwright MCP лише в `[UI]`, лише для свого екрана на 360 px).
Оркестратор після кожної задачі: `pnpm typecheck && pnpm lint` на весь репо. Повний `pnpm test`: на межах блоків (після 03-08, після 03-14) і у фіналі. `pnpm test:e2e`: у задачах `[e2e]` і у фіналі. Рев'ю: кожна `[risk]` окремо; решту блоку `reviewer` дивиться разом на межі блоку.

## Задачі

Блок shared/integrations/API:
- [ ] **03-01. Контракти shared.** `session.ts` + тест, межі `PlanSchema`, `ERROR_CODES`, `index.ts`; фіксація бази тестів. `[TC-03-01]`
- [ ] **03-02. Промпт планувальника.** `packages/prompts` (`exports`, `session-plan.v1.md`, README), залежність api + lockfile, `prompt-loader.ts`, `session-plan-prompt.ts` (+тести), `goals` у `PlanSessionInput`. `[TC-03-04]` `[risk]`
- [ ] **03-03. Fake `planSession` за stubs.md 2.2.** `fake-session-plans.ts` (банк 5×5, шаблони питань мета/досвід/думка/порівняння + «What would you do differently next time?», питання під патерни, власна тема, власна сцена → перший пресет або `small_talk`), Fake викликає рендер, `fake-adapters.test.ts` (індекс за `previousTopics`, verb_tense → минулий час, власна тема, власна сцена). Закриває backlog «Fake planSession». `[TC-03-01]`
- [ ] **03-04. Міграція 0003.** Скіл `/db-migration`: SQL вище, journal, тестова БД з нуля, `pnpm db:migrate`, `pnpm db:pull`, `db-schema.test.ts` (CHECK, частковий індекс, вставка двох активних падає), рядок у `tech-decisions.md` розділ 3. `[risk]`
- [ ] **03-05. Планувальник.** `validated-call.ts` (+тест: валідна, повтор, дві невалідні → помилка, лог без значень); фільтр зберігає `code` для 5xx (+тест); `GoalsRepository.listActive`/`GoalsService.listActive`, експорти `ProfileModule`; `plan-input.ts` (+тест: рівень, сцени, цілі, топ-3 патерни, `previousTopics`, `customTopic`); `SessionPlannerService.plan` (+тест, оновити `core-services.test.ts`). TDD. `[TC-03-01]` `[risk]`
- [ ] **03-06. API `POST /api/sessions/plan`.** `SessionsController`, `session.module.ts`, `@RequiresConsent()`, `test/sessions-plan.test.ts` (403 без згоди, 404 без профілю, план за сценою, «інша тема» за `previousTopics`, 4 теми → 400, власна тема → `custom`, без значень користувача в логах). `[TC-03-01]` `[TC-03-02]`
- [ ] **03-07. API старт.** `sessions.repository.ts` (транзакція: блок `users` → завершити активну → INSERT сесії з `plan` → INSERT репліки seq 1), `SessionsService.start` (+тест), `POST /api/sessions` з `@RequiresConsent()`, `test/sessions.test.ts`: 403 без згоди; 201 + активна + репліка assistant; `feedback_mode` збережено (`[TC-03-05]` на рівні API); попередня активна → finished; паралельні старти → одна активна; видалений користувач → 401. Закриває backlog «`@RequiresConsent` на старті» (маршрути реплік – рядок звужується до 04) і «FK → 401» для 03 (рядок звужується до 04–05). `[TC-03-02]` `[TC-03-05]` `[risk]`
- [ ] **03-08. API список і деталі + seed.** `GET /api/sessions` (≤10, порядок, лише свої), `GET /api/sessions/:id` (репліки за seq; чужий/неіснуючий/не-uuid → 404, порядок перевірок задокументовано), видалений користувач (порожньо/404); `db/seed.sql`: `ON CONFLICT (user_id) DO UPDATE` для профілю, `ON CONFLICT (id) DO UPDATE` для цілей і `plan` засіяної сесії; двічі `pnpm db:seed` на dev-БД. `[TC-03-02]`. **Межа блоку API**: повний `pnpm test`, рев'ю 03-01…03-08 без `[risk]`.

Блок web:
- [ ] **03-09. `shared/ui`.** Перенести `LoadError`, `SectionSkeleton` (+тести), ключі `common.loading`, `common.actions.retry`, `errors.generic` (прибрати `profile.errors.generic`, `auth.errors.generic` → `errors.generic`), оновити імпортерів у `features/profile`. Закриває backlog «створити `shared/ui`» і «`profile.errors.generic` дублює `auth.errors.generic`».
- [ ] **03-10. Web: api-шар і хуки.** `vite.config.ts` `unstubGlobals: true`, прибрати `import { vi }` з `mock-api.ts`; `session-api.ts`, `session-queries.ts`, `use-start-session.ts`, `use-session-proposal.ts` (стан `previousTopics`, `customTopic`, `feedbackMode`, ліміт 3), `session-errors.ts`, фікстури сесій (+тести). `[TC-03-03]`
- [ ] **03-11. Головний екран.** `SessionPage`: кнопка «Почати сесію» (`Link` на `/sessions/new`, `size="lg"`), `RecentSessions` (Skeleton, помилка з повтором, порожній стан, «Продовжити» для активної, дата через i18n), `uk.json`; додати `GET /api/sessions` у mock-маршрути наявних тестів, що рендерять `/`. Playwright MCP 360 px. `[TC-03-06]` `[UI]`
- [ ] **03-12. Пропозиція теми.** `/sessions/new`, `NewSessionPage`, `SessionProposal` (тема, 5 питань, «Інша тема» з лічильником і вимкненням після 3, `FeedbackModeControl` з типовим `immediate`, «Почати» → `/sessions/:id`, помилки 502/403 через i18n, `aria-live`). Playwright MCP 360 px. `[TC-03-03]` `[TC-03-05]` `[UI]` `[risk]`
- [ ] **03-13. Власна тема.** `CustomTopicForm` (RHF + `zodResolver(TopicSchema)`, label, помилки через i18n, повернення до запропонованої теми), інтеграція в пропозицію. Playwright MCP 360 px. `[TC-03-03]` `[UI]`
- [ ] **03-14. Сторінка після старту.** `/sessions/:id`, `DialogPage` + `SessionQuestion` (тема, режим, перше питання; Skeleton, 404 → повідомлення й посилання на головну, помилка з повтором); дані з кешу після старту без зайвого запиту. Playwright MCP 360 px. `[TC-03-03]` `[UI]`. **Межа блоку web**: повний `pnpm test`, рев'ю 03-09…03-14 без `[risk]`.

Завершення:
- [ ] **03-15. e2e.** `e2e/session.spec.ts`: `[TC-03-03]` (`signedInPage`, сцена `small_talk`: «Почати сесію» → «Weekend plans» + 5 питань → «Інша тема» → «My hometown» → своя тема → «Почати» → екран діалогу з першим питанням про свою тему); `[TC-03-05]` («В кінці» → старт → `GET /api/sessions/:id` з токеном → `feedbackMode = deferred`). Дві зелені прогони поспіль. `[e2e]`
- [ ] **03-16. Backlog-прибирання.** Прибрати 30 ручних `afterEach(vi.unstubAllGlobals)` (механічна зміна, виняток із ліміту ~8 файлів); px-літерали `BottomNav.module.scss` і `maw={120}`; TC-теги 404/401 у `ProfileService` тестах. Закриває рядки backlog 50, 54, 59.
- [ ] **03-17. Документація.** `tech-decisions.md` (рішення 33: план у JSONB, одна активна сесія, згода на plan/start, stateless «інша тема»; 34: промпти без збірки, id = ім'я файлу, `validated-call`, 502 з кодом; розділ 3 – 0003; «Стан на»); `stubs.md` 2.2 (шаблони універсальних питань, правило патерну для власної теми, цілі ігноруються, `previousTopics` з тіла запиту); `backlog.md` (видалити закриті, звузити рядки 42/49, нові: решта методів порту → `unknown` у 04, звіт для автоматично завершеної сесії → 05); README (Sessions API, потік старту).
- [ ] **03-18. Фінальна перевірка** **[Антон]**. Повні `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `reviewer` на всю гілку; Антон: ручний `[TC-03-06]` на телефоні, push і PR за правилом CLAUDE.md, CI.


## Покриття spec 03

| «Готово, коли» | Задачі |
|---|---|
| Unit: вхід планувальника, Zod відповіді [TC-03-01] | 01, 03, 05, 06 |
| Integration: старт без згоди 403, зі згодою сесія + питання [TC-03-02] | 06, 07, 08 |
| e2e: інша й власна тема → діалог [TC-03-03] | 10, 12, 13, 14, 15 |
| Промпт `session-plan.v1.md` [TC-03-04] | 02, 03 |
| e2e: режим фідбеку зберігається [TC-03-05] | 07, 12, 15 |
| Ручний: один дотик [TC-03-06] | 11, 18 |

## Ризики

- PR spec 02 не злитий у `main` (локально `main` = 01): перевірка в кроці 0.
- Фільтр помилок для 5xx зараз переписує код: без зміни в 03-05 502 прийде як `BAD_GATEWAY`.
- Головна починає робити `GET /api/sessions`: ~10 наявних тестів, що рендерять `/`, потребують маршруту в `mockApi` (03-11), інакше з'являться неочікувані стани помилки.
- `createRequire().resolve` для `.md` через `exports` – перевірити в Vitest, `nest start --watch` і `dist` (03-02); запасний варіант – шлях відносно пакета через `package.json` resolve.
- Міграція на dev-БД з кількома активними сесіями (старі e2e-користувачі): `UPDATE` перед індексом це покриває.
- Автозавершення сесії оминає «Завершити» зі spec 04/05 (звіт): рядок backlog.
- e2e на dev-БД; Fake детермінований, тож тексти тем стабільні.

