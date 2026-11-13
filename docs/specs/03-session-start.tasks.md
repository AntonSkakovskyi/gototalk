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
- Web-фіча `features/session` (уже є в `WEB_FEATURES` ESLint). Не плутати з `useSession` зі `shared/session` (auth): деталі сесії читаються через `useQuery(sessionDetailsQueryOptions)` (обгортку `useSessionDetails` прибрано в 03-14, прохід B).
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

Початковий план; фактичні файли, перейменування й розбиття – у «Відхиленнях» задач нижче.

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
- [x] **03-01. Контракти shared.** `session.ts` + тест, межі `PlanSchema`, `ERROR_CODES`, `index.ts`; фіксація бази тестів. `[TC-03-01]`
  - Відхилення: `TOPIC_MAX`, `QUESTION_MAX`, `PLAN_QUESTIONS`, `TopicSchema` і `QuestionSchema` лежать у `plan-bounds.ts` (а не в `session.ts`), щоб уникнути циклу `session.ts` ↔ `llm.ts`; публічні експорти пакета без змін. Додано enum-схеми `FeedbackModeSchema`, `TopicSourceSchema`, `SessionStatusSchema`, `UtteranceRoleSchema`. База shared: 36 → 58 тестів (22 нових, усі `[TC-03-01]`).
- [x] **03-02. Промпт планувальника.** `packages/prompts` (`exports`, `session-plan.v1.md`, README), залежність api + lockfile, `prompt-loader.ts`, `session-plan-prompt.ts` (+тести), `goals` у `PlanSessionInput`. `[TC-03-04]` `[risk]`
  - Відхилення: `loadPrompt` валідує id за `^[a-z0-9-]+\.vN$` (traversal неможливий), помилка резолву зберігає `cause`; рендер рахує `{{input}}` у шаблоні до підстановки (користувацький `{{…}}` не ламає рендер) і підставляє дані функцією-replacer (`$&`, `$1` інертні) замість «кидає, якщо лишився `{{…}}`»; `fillInputPlaceholder` внутрішня, відхилення 0/2 плейсхолдерів тестується через `renderSessionPlanPrompt` з мокнутим `loadPrompt`; v1 правили на місці, бо результатів із ним ще не збережено; промпт стверджує, що `patterns` впорядковані від найчастішого, тож 03-05 (`plan-input.ts`) мусить так їх упорядкувати й обрізати до 3; після `pnpm --filter api build` завантажувач читає файл із `dist` через симлінк workspace без копіювання; рев'ю 03-02: 0 high, 2 medium (межі й англійська тема в промпті) і 3 low виправлено. Тестів api 274 → 290.
- [x] **03-03. Fake `planSession` за stubs.md 2.2.** `fake-session-plans.ts` (банк 5×5, шаблони питань мета/досвід/думка/порівняння + «What would you do differently next time?», питання під патерни, власна тема, власна сцена → перший пресет або `small_talk`), Fake викликає рендер, `fake-adapters.test.ts` (індекс за `previousTopics`, verb_tense → минулий час, власна тема, власна сцена). Закриває backlog «Fake planSession». `[TC-03-01]`
  - Відхилення: `LanguageModelPort.planSession` повертає `Promise<unknown>` (сира відповідь, валідацію робить викликач; решта методів порту переходить у 04); універсальні питання вбудовують тему в лапках, п'яте фіксоване; сцена = `scenes.find(isScenePreset) ?? 'small_talk'`; правило патерну діє й для власної теми; Fake рендерить промпт перед відповіддю (зламаний шаблон валить `planSession`), тести цього – з тегом `[TC-03-04]`; тести Fake винесено в `fake-language-model-plan.test.ts` (файл `fake-adapters.test.ts` перевищив би ~250 рядків); рядок backlog «Fake planSession» видалено.
- [x] **03-04. Міграція 0003.** Скіл `/db-migration`: SQL вище, journal, тестова БД з нуля, `pnpm db:migrate`, `pnpm db:pull`, `db-schema.test.ts` (CHECK, частковий індекс, вставка двох активних падає), рядок у `tech-decisions.md` розділ 3. `[risk]`
  - Відхилення: SQL з плану виправлено: `jsonb_typeof(plan -> 'questions') = 'array'` дає NULL, коли ключа немає, і CHECK пропускав об'єкт без `questions`, тому в міграції `COALESCE(jsonb_typeof(plan -> 'questions'), '') = 'array'` (знайшов новий тест). Виправлення міграції 0003 зроблено до коміту (вона ще ніде не опублікована), а на dev- і тестовій БД, де буга-версія вже була застосована, constraint `sessions_plan_check` одноразово перестворено тим самим SQL (DROP + ADD), визначення на обох БД перевірено `pg_get_constraintdef` і збігається з файлом; `pnpm db:migrate` повторно нічого не змінює. Антону після пулу гілки достатньо `pnpm db:migrate` (на БД без 0003 вона застосується одразу з виправленим SQL). `UPDATE`, що завершує зайві активні сесії перед унікальним індексом, автотестом не покритий (тестова БД мігрується порожньою); перевірено вручну на тимчасовій БД: користувачі з 3, 1 і 2 активними сесіями (в останнього однакові `started_at`) лишилися з однією, найновішою за `(started_at, id)`, решта `finished` з `ended_at`; завершену не чіпало. `db:pull` перевпорядкував `schema.ts` і `relations.ts` (семантично лише `plan`, індекс і CHECK). Нові тести схеми мають тег `[TC-00-01]` (як решта файлу), бо в `test-cases.md` немає TC-03 для схеми. Рев'ю: 0 high, 1 medium (покриття UPDATE) закрито цією нотаткою. Тестів api 290 → 322.
- [x] **03-05a. Валідований виклик моделі й активні цілі.** `validated-call.ts` (+тест: валідна, повтор, дві невалідні → помилка, лог без значень); фільтр зберігає `code` для 5xx (+тест); `GoalsRepository.listActive`/`GoalsService.listActive` (+інтеграційний тест), експорти `ProfileModule` (`ProfileService`, `GoalsService`). TDD. `[TC-03-01]` `[risk]`
  - Відхилення: фільтр зберігає код 5xx лише з allowlist `ERROR_CODES` (довільний непорожній рядок зламав би `[TC-00-07]`: коди драйвера, як `57P01`, не мають доходити до клієнта); тип логера `ValidationLogger { warn(context, message, loggerName) }` з контекстом третім аргументом (nestjs-pino трактує останній додатковий аргумент як контекст); `GoalsService.listActive` повертає DTO `Goal[]` (як `list`), заголовки з нього бере `plan-input.ts` у 05b; рев'ю 05a разом із 05b.
- [x] **03-05b. Планувальник.** `plan-input.ts` (+тест: рівень, сцени, цілі, топ-3 патерни від найчастішого, `previousTopics`, `customTopic`); `SessionPlannerService.plan` (+тест; помилка → 502 `LANGUAGE_MODEL_INVALID_RESPONSE`; профіль відсутній → 404), оновити `core-services.test.ts`. TDD. `[TC-03-01]` `[risk]`
  - Відхилення: задачу 03-05 розбито на 05a і 05b (~12 файлів і дві відповідальності в одній задачі); рев'ю `[risk]` 05a і 05b одним проходом після 05b.
  - Відхилення: метод перейменовано `planSession` → `plan` (не плутати з портом), тест-заглушка `[TC-00-04]` для планувальника знято разом із заглушкою; `buildPlanInput` приймає один об'єкт `{ profile, goals, weakAreas, request }` і обрізає патерни до 3 зі збереженням порядку; для власної теми `previousTopics` у вхід моделі йде порожнім (рішення b); `PlanSchema` валідує відповідь моделі й для власної теми (невалідний план = невалідна відповідь, навіть якщо тему потім перезаписано); фінальну перевірку `SessionPlanSchema` знято як мертву гілку (власну тему вже обмежила схема запиту контролера); відповідь 502 несе загальне повідомлення «Bad Gateway» і код `LANGUAGE_MODEL_INVALID_RESPONSE` (повідомлення помилки фільтр замінює); `ValidationLogger` спрощено до `warn(context, message)` (Nest `Logger` підходить, перевірено тестом на реальному `Logger`); профіль видаленого користувача дає 404 `PROFILE_NOT_FOUND`, не 401 (читання, 401 забезпечує `ConsentGuard` на маршрутах); тести `plan-input.ts` написано разом з реалізацією (чиста функція), тести сервісу спершу падали; помилка провайдера лишається 500 без коду (backlog для 04). Рев'ю 05a+05b: 0 high, 3 medium і 2 low виправлено, решта прийнято.
- [x] **03-06. API `POST /api/sessions/plan`.** `SessionsController`, `session.module.ts`, `@RequiresConsent()`, `test/sessions-plan.test.ts` (403 без згоди, 404 без профілю, план за сценою, «інша тема» за `previousTopics`, 4 теми → 400, власна тема → `custom`, без значень користувача в логах). `[TC-03-01]` `[TC-03-02]`
  - Відхилення: хелпери `registerUser`, `grantConsent`, `putProfile`, `tokenOfMissingUser`, `expectError` винесено в `test/support/api-client.ts` (використовують лише нові тести; перехід наявних тестів – рядок backlog); додатково перевірено, що `customTopic` довжиною рівно `TOPIC_MAX` приймається, а відповідь 502 не містить сирого тексту моделі.
- [x] **03-07. API старт.** `sessions.repository.ts` (транзакція: блок `users` → завершити активну → INSERT сесії з `plan` → INSERT репліки seq 1), `SessionsService.start` (+тест), `POST /api/sessions` з `@RequiresConsent()`, `test/sessions.test.ts`: 403 без згоди; 201 + активна + репліка assistant; `feedback_mode` збережено (`[TC-03-05]` на рівні API); попередня активна → finished; паралельні старти → одна активна; видалений користувач → 401. Закриває backlog «`@RequiresConsent` на старті» (маршрути реплік – рядок звужується до 04) і «FK → 401» для 03 (рядок звужується до 04–05). `[TC-03-02]` `[TC-03-05]` `[risk]`
  - Відхилення: репозиторій повертає одразу `SessionDetails` (один маппер `toSession`/`toSessionDetails` у `sessions.repository.ts`; у `profile` репозиторії повертають записи, а сервіси мапляться), сервіс лише переводить `SessionOwnerMissingError` у 401; `started_at` нової сесії й `ended_at` завершеної беруть `clock_timestamp()`, а не `now()` (час початку транзакції при конкурентних стартах порушував би порядок за `started_at`; знайшов reviewer), тест порядку імовірнісний і не червоніє при поверненні `now()`, тому гарантію дає лише код; конкурентність підтверджує детермінований тест: другий клієнт тримає `FOR NO KEY UPDATE` на `users`, старт чекає (`pg_stat_activity`, `wait_event_type='Lock'`), після `COMMIT` повертає 201; шлях «користувача видалено після гарда» покрито інтеграційним тестом `SessionsService.start(MISSING_USER_ID)` → 401; перша репліка `assistant` має `analysis_status = 'skipped'` (конвенція seed); `plan` не повертається клієнту; `SessionsService` не експортується з модуля. Backlog: рядок про `@RequiresConsent()` звужено до маршрутів запису/реплік (04), рядок про JWT – до 04–05. Тестів api 322 → 395.
- [x] **03-08. API список і деталі + seed.** `GET /api/sessions` (≤10, порядок, лише свої), `GET /api/sessions/:id` (репліки за seq; чужий/неіснуючий/не-uuid → 404, порядок перевірок задокументовано), видалений користувач (порожньо/404); `db/seed.sql`: `ON CONFLICT (user_id) DO UPDATE` для профілю, `ON CONFLICT (id) DO UPDATE` для цілей і `plan` засіяної сесії; двічі `pnpm db:seed` на dev-БД. `[TC-03-02]`. **Межа блоку API**: повний `pnpm test`, рев'ю 03-01…03-08 без `[risk]`.
  - Відхилення: мапери `toSession`/`toSessionDetails` лишилися в `sessions.repository.ts` (одне місце, без дублювання); `GET /api/sessions/:id` перевіряє uuid у сервісі до запиту (невалідний id → той самий 404, порядок задокументовано в Swagger і тесті); читання без `@RequiresConsent()` (користувач без згоди бачить свої сесії), видалений користувач: список `[]`, деталі 404 (перевірено реальним `DELETE FROM users` і токеном відсутнього користувача); порядок `started_at DESC, id DESC` перевірено тестом на однакових `started_at`; seed: `ON CONFLICT … DO UPDATE` для профілю, цілей і `plan` засіяної сесії, `pnpm db:seed` двічі на dev-БД: сцени демо-користувача `{work_meetings,small_talk}`, 2 активні цілі, у сесії `…0301` план із 5 питань, активних сесій 0. Тестів api 395 → 414.
  - Рев'ю межі API-блоку (03-03, 03-06, 03-08): 0 high; виправлено тест меж Fake (випадок без патернів і тема довжиною `TOPIC_MAX`), `planSession` Fake без зайвої обгортки, зайвий `slice`, крихку перевірку `plan` у `sessions-read.test.ts`, експорт `SessionPlannerService` без споживача; `DO UPDATE` у seed залишено навмисно (вимога запиту: повторний seed зводить демо-дані до кодів пресетів), у шапці seed це зазначено; `.parse` рядків БД у мапері сесій додано до рядка backlog про внутрішні `ZodError`; повний `pnpm test` на межі: shared 58, web 281, api 414.

Блок web:
- [x] **03-09. `shared/ui`.** Перенести `LoadError`, `SectionSkeleton` (+тести), ключі `common.loading`, `common.actions.retry`, `errors.generic` (прибрати `profile.errors.generic`, `auth.errors.generic` → `errors.generic`), оновити імпортерів у `features/profile`. Закриває backlog «створити `shared/ui`» і «`profile.errors.generic` дублює `auth.errors.generic`».
  - Відхилення: `LoadError` і `SectionSkeleton` перенесено `git mv` у `shared/ui/<Name>/` з тестами `[TC-03-03]`; спільні ключі `common.loading`, `common.actions.retry`, `errors.generic` замінили `profile.loading`, `profile.actions.retry`, `profile.errors.generic`, `auth.errors.generic` (усі використання в коді й тестах переведено; тексти без змін); `auth.loading` і `app.gate.*` не чіпали; з backlog видалено рядки про `shared/ui/` і дубль `errors.generic`.
- [x] **03-10. Web: api-шар і хуки.** `vite.config.ts` `unstubGlobals: true`, прибрати `import { vi }` з `mock-api.ts`; `session-api.ts`, `session-queries.ts`, `use-start-session.ts`, `use-session-proposal.ts` (стан `previousTopics`, `customTopic`, `feedbackMode`, ліміт 3), `session-errors.ts`, фікстури сесій (+тести). `[TC-03-03]`
  - Відхилення: `test.unstubGlobals: true` у `vite.config.ts`, `import { vi }` із `mock-api.ts` прибрано (ручні `afterEach` лишаються до 03-16); політику повторів «не повторювати 4xx» винесено в `shared/api/retry-policy.ts` (`retryUnlessClientError(maxRetries)`, використовують `profile-queries` і запит плану); запит плану має `staleTime: Infinity` без refetch на фокус/reconnect; метод хука названо `applyCustomTopic` (ім'я `use*` ламало б rules-of-hooks); `rerolls = shownTopics.length`; `start(onStarted)` викликає колбек для навігації, хук віддає `isStarting`/`startError`; у тестах замість застарілих `fetchQuery`/`ensureQueryData` – `query`/`getQueryData`. Відкрите для 03-12: план у кеші живе до `gcTime` (5 хв), тож повторний вхід на `/sessions/new` після старту не має віддавати старий план. Тестів web 281 → 319.
- [x] **03-11. Головний екран.** `SessionPage`: кнопка «Почати сесію» (`Link` на `/sessions/new`, `size="lg"`), `RecentSessions` (Skeleton, помилка з повтором, порожній стан, «Продовжити» для активної, дата через i18n), `uk.json`; додати `GET /api/sessions` у mock-маршрути наявних тестів, що рендерять `/`. Playwright MCP 360 px. `[TC-03-06]` `[UI]`
  - Відхилення: головна лишає h1 «Сесія» (на ньому тримаються тести й e2e), кнопка «Почати сесію» – `Button` як `Link` на `/sessions/new` (рендериться одразу, до завантаження списку); елемент списку – вся картка-посилання на `/sessions/:id`, «Продовжити» для активної – `Button component="span"` усередині посилання (кнопка в `<a>` невалідна); `td="none"`/`listStyleType` відхиляє правило i18next, тому дві малі `*.module.scss` із зоною дотику `2.75rem`; `EMPTY_SESSIONS_ROUTE` винесено в `shared/testing` (5 місць); `ConsentPage`/`LoginPage`/`OnboardingPage` тести не чіпали (послідовні `mockResolvedValueOnce`: зайвий `GET /api/sessions` дає лише стан помилки в списку). Playwright MCP 360x800 (демо-користувач): без горизонтального скролу (360/360), кнопка видима без прокрутки (328x50), засіяна сесія з датою й бейджем, картка 328x89; стани порожньо/помилка перевірено лише компонентними тестами; скріншот не зроблено (шлях поза дозволеним коренем), перевірка через вимірювання DOM.
- [x] **03-12. Пропозиція теми.** `/sessions/new`, `NewSessionPage`, `SessionProposal` (тема, 5 питань, «Інша тема» з лічильником і вимкненням після 3, `FeedbackModeControl` з типовим `immediate`, «Почати» → `/sessions/:id`, помилки 502/403 через i18n, `aria-live`). Playwright MCP 360 px. `[TC-03-03]` `[TC-03-05]` `[UI]` `[risk]`
  - Відхилення: маршрут `/sessions/new` у групі `RequireProfile` → `AppLayout`, після старту навігація з `replace`; свіжий план при повторному вході забезпечує `gcTime: 0` у `sessionPlanQueryOptions` замість власного таймера на розмонтування (рев'ю: ручний `setTimeout`-механізм мав гонки при ремонті маршруту й прибирав запити з активним спостерігачем), ціна рішення: повернення зі своєї теми до пропозиції робить новий запит із останніми `previousTopics` (кеш попередньої пропозиції не живе), тест відповідно перейменовано; StrictMode дає рівно один POST (тест); фокус після «Інша тема» переходить на заголовок теми (`tabIndex=-1`), після невдалого перегенерування – на «Повторити»; невдале перегенерування рахується використаним, повтор оновлює той самий ключ; `startError` скидається при новій темі, зміні режиму й своїй темі; кнопка «Почати» і помилка старту в липкій панелі над нижньою навігацією (`bottom: calc(var(--app-shell-footer-height) + env(safe-area-inset-bottom))`), без px-літералів; `FeedbackModeControl.module.scss` піднімає сегменти до `2.75rem` (було 33 px); `applyCustomTopic`/`clearCustomTopic` лишаються невикористаними до 03-13. Playwright MCP 360x800 (демо, «Почати» не натискали): «Почати» 313x50 повністю у в'юпорті над навігацією (682–732 при навігації з 744), без горизонтального скролу, остання позиція не ховається за панеллю (перевірено й на 360x560). Рев'ю: 0 high, 2 medium і 6 low виправлено.
- [x] **03-13. Власна тема.** `CustomTopicForm` (RHF + `zodResolver(TopicSchema)`, label, помилки через i18n, повернення до запропонованої теми), інтеграція в пропозицію. Playwright MCP 360 px. `[TC-03-03]` `[UI]`
  - Відхилення: `field-error-props.ts` перенесено з `features/profile/lib` у `shared/forms/` (потрібен двом фічам; імпорти profile оновлено); форма власної теми через хук `use-custom-topic-form.ts` (`register` у компоненті ловило `i18next/no-literal-string`, як у `GoalTitleForm`); схема `z.object({ topic: TopicSchema })`, помилка `too_big` → `tooLong`, решта → `required`; поле без `lang="en"` (тема може бути будь-якою мовою); «Своя тема» лишається доступною й при активній власній темі (можна замінити), «Інша тема» ховається, є «Повернутися до запропонованої теми» (новий запит пропозиції, фокус на заголовок); позначка «Власна тема» біля заголовка; фокус при відкритті форми в полі, після скасування/відправки на «Своя тема». Playwright MCP 360x800 (демо, «Почати» не натискали): валідація, «My cat» → 5 питань із шаблонів власної теми, повернення, без горизонтального скролу, кнопки/поля 50 px, липка «Почати» над навігацією.
- [x] **03-14. Сторінка після старту.** `/sessions/:id`, `DialogPage` + `SessionQuestion` (тема, режим, перше питання; Skeleton, 404 → повідомлення й посилання на головну, помилка з повтором); дані з кешу після старту без зайвого запиту. Playwright MCP 360 px. `[TC-03-03]` `[UI]`. **Межа блоку web**: повний `pnpm test`, рев'ю 03-09…03-14 без `[risk]`.
  - Відхилення: сторінка показує тему як єдиний h1 із підписом «Тема», бейдж статусу (`SessionStatusBadge`, спільний зі списком; ключі `session.home.status` → `session.status`), режим показу помилок і поточне питання = текст останньої репліки `assistant` за `seq` (`lib/current-question.ts`); `sessionDetailsQueryOptions` має `staleTime` 30 с (`DETAILS_STALE_TIME_MS`), щоб щойно запущена сесія з кешу не робила зайвий `GET`, і `retryUnlessClientError(1)`; 404 і не-uuid показують «Сесію не знайдено» як h1 (повторно використано `session.errors.notFound`), інші помилки – `LoadError` із повтором; посилання «На головну» (`common.actions.home`) у всіх станах; маршрут `sessions/:id` після `sessions/new`; тест повного потоку: пропозиція → «Почати» → сторінка з питанням, один `POST /api/sessions` і жодного `GET /api/sessions/:id`. Playwright MCP 360x800 (демо, нову сесію не стартували): засіяна завершена сесія, випадковий uuid й `not-a-uuid`, без горизонтального скролу (360/360), «На головну» 328x50.
  - Рев'ю межі web-блоку (03-09, 03-10, 03-11, 03-13, 03-14), прохід A: 0 high; виправлено: дублі i18n (`common.loading`, `common.actions.{retry,cancel}` замість 7 ключів, єдиний текст повтору «Спробувати ще раз»); після старту `resetQueries` списку (нова сесія першою й активною при поверненні) і інвалідація деталей інших сесій (`sessionKeys.allDetails()`, без чіпання кешу плану), `retry` для списку; `lang="en"` лише для запропонованої теми (`lib/topic-language.ts`), власна тема без `lang`; на сторінці сесії завжди один h1 (загальний у стані завантаження/помилки) і фокус на нього (`FocusedTitle`); липка панель без подвійного `env(safe-area-inset-bottom)`; спільний `shared/styles/_tokens.scss` (`$touch-target`; `@/` у sass не працює, relative `@use`); тест web 389 → 398. Прохід B (довжина функцій, власник фокусу, спільні тестові хелпери) – наступним комітом.
  - Прохід B: `SessionProposal` ≤ ~40 рядків (кнопка й помилка старту в `StartAction.tsx`, `PlanContent.tsx` з `TopicHeading` і `QuestionList`), стан вибору теми в `use-topic-selection.ts`; один власник фокусу: `topicChanged` + `use-focus-when.ts` ставлять фокус на заголовок теми після будь-якої зміни теми (перегенерація, власна тема, повернення), скасування форми повертає фокус на «Своя тема»; спільні тестові хелпери `shared/testing/session-mocks.ts` (`mockSessionApi`, типізовані `planRequests()`/`startRequests()`, приведення `as PlanSessionRequest` прибрано); тести опцій запитів перероблено на поведінкові; обгортку `useSessionDetails` видалено; тестів web 398 → 399.

Завершення:
- [x] **03-15. e2e.** `e2e/session.spec.ts`: `[TC-03-03]` (`signedInPage`, сцена `small_talk`: «Почати сесію» → «Weekend plans» + 5 питань → «Інша тема» → «My hometown» → своя тема → «Почати» → екран діалогу з першим питанням про свою тему); `[TC-03-05]` («В кінці» → старт → `GET /api/sessions/:id` з токеном → `feedbackMode = deferred`). Дві зелені прогони поспіль. `[e2e]`
  - Відхилення: `expectNoHorizontalScroll` винесено з `profile.spec.ts` у `e2e/support/layout.ts`, допоміжні `readSession`/`listSessions`/`sessionIdFromUrl` у `e2e/support/sessions.ts` (type guards, без `as`); `[TC-03-03]`: повний потік з перевіркою списку на головній після старту (нова сесія першою, «Триває», «Продовжити»); `[TC-03-05]`: два тести («В кінці» → `deferred`, типово → `immediate`, читання через `GET /api/sessions/:id`); додатковий тест `[TC-03-02]`: два старти поспіль лишають одну активну, стару завершеною. e2e 13 → 17, два послідовні зелені прогони (≈32 с), залишків `e2e-%` акаунтів і серверів на 3000/5173 немає. `pnpm exec eslint e2e` дає `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` (причину не знайдено), `pnpm lint` по репо чистий.
- [x] **03-16. Backlog-прибирання.** Прибрати 30 ручних `afterEach(vi.unstubAllGlobals)` (механічна зміна, виняток із ліміту ~8 файлів); px-літерали `BottomNav.module.scss` і `maw={120}`; TC-теги 404/401 у `ProfileService` тестах. Закриває рядки backlog 50, 54, 59.
  - Відхилення: прибрано `vi.unstubAllGlobals()` у 30 тестових файлах (решта операторів `afterEach` лишилась, повний web 399 → 405 тестів); `BottomNav`: `NavLink` замінено на `Link` з `aria-current`, обчисленим через `matchPath` (`NavLink` не дає перевизначити `aria-current`), вкладка «Сесія» активна на `/`, `/sessions/new`, `/sessions/:id` (`activePaths` у `tabs.ts`, тести `[TC-03-03]`), px-літерали замінено на `0.125rem` і `rem(120)`; тести 404/401 `ProfileService` перетеговано на `[TC-02-02]`; закрито три рядки backlog (теги `ProfileService`, `unstubGlobals`, px у BottomNav). `e2e/smoke.spec.ts` (3 тести) зелений.
- [x] **03-17. Документація.** `tech-decisions.md` (рішення 33: план у JSONB, одна активна сесія, згода на plan/start, stateless «інша тема»; 34: промпти без збірки, id = ім'я файлу, `validated-call`, 502 з кодом; розділ 3 – 0003; «Стан на»); `stubs.md` 2.2 (шаблони універсальних питань, правило патерну для власної теми, цілі ігноруються, `previousTopics` з тіла запиту); `backlog.md` (видалити закриті, звузити рядки 42/49, нові: решта методів порту → `unknown` у 04, звіт для автоматично завершеної сесії → 05); README (Sessions API, потік старту).
  - Відхилення: рішення 33 (старт сесії: план у JSONB, одна активна сесія, згода, stateless «Інша тема», довіра до показаного плану, виправлення CHECK через `COALESCE`, `gcTime: 0`) і 34 (промпти без збірки, id = ім'я файлу, `{{input}}`, Fake рендерить промпт, `requestValidated`, 502 з кодом); `stubs.md` 2.2 приведено до реалізації (шаблони питань скопійовано з коду); у backlog додано п'ять рядків (решта методів порту → `unknown`, автозавершена сесія для звіту, rate limit для `plan`, `eslint e2e`, імовірнісний тест порядку `started_at`) і оновлено рядок про JWT; README: розділ «Sessions».
- [ ] **03-18. Фінальна перевірка** **[Антон]**. Повні `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `reviewer` на всю гілку; Антон: ручний `[TC-03-06]` на телефоні, push і PR за правилом CLAUDE.md, CI.
  - Статус: автоматична частина виконана (`pnpm typecheck`, `pnpm lint`, `pnpm test`: shared 58, web 405, api 414; `pnpm test:e2e` 17/17; фінальне рев'ю всієї гілки: 0 high, виправлено 4 medium у документації й `encodeURIComponent` для id у `getSession`). Лишається за Антоном: ручний `[TC-03-06]` на телефоні (запуск одним дотиком), після пулу гілки `pnpm db:migrate` і `pnpm db:seed`, злиття PR (#4 зі spec 02 має злитися першим, бо гілка 03 створена від `feat/02-profile`).


## Покриття spec 03

| «Готово, коли» | Задачі |
|---|---|
| Unit: вхід планувальника, Zod відповіді [TC-03-01] | 01, 03, 05a, 05b, 06 |
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

