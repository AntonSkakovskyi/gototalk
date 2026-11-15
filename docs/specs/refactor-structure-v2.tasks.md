# Рефакторинг структури v2: задачі

Специфікація: `docs/specs/refactor-structure-v2.md`. Гілки: чотири послідовні (`refactor/structure-v2` → `…-api-tests` → `…-web` → `…-docs`), кожна від `main` після злиття попередньої. Одна задача = один зелений коміт = одна сесія. Після задачі: відмітити чекбокс і закомітити (Conventional Commits, англійською, `refactor(<scope>): …`).
Позначки: `[risk]` рев'ю `reviewer` одразу (межі модулів, DI, рантайм-шляхи промптів, ESLint-зони); `[e2e]` прогін `pnpm test:e2e`; **[Антон]** потребує ручної дії.
Рядки в списках файлів: `старе → нове`; `+test` означає, що тест переїжджає разом із файлом. Правки лише імпортів у файлах-споживачах не рахуються до «≤ ~10 файлів» задачі.

**База тестів (задача 00, зафіксовано 2026-11-15 на `refactor/structure-v2`):** shared 115 (10 файлів), web 965 (125 файлів), api 1124 (116 файлів, unit + integration), e2e 24 (перший прогін мав одне нестабільне падіння `TC-01-03` на «холодному» старті, повторний зелений). Кількість тестів за пакетами не зменшується; нові тести (DI-smoke, реєстр промптів, `/api/docs-json`, ApiZod) лише збільшують її.

## Правила для сабагентів (повторювати в кожному промпті)

1. Уся кодова база англійською: код, ідентифікатори, коментарі, назви тестів, Swagger, повідомлення винятків і логів, коміти. Українська лише в `uk.json` і користувацьких даних. `docs/`, `CLAUDE.md` і скіли лишаються українською.
2. Коментарів за замовчуванням немає. Коментар лише для неочевидного ЧОМУ: один короткий рядок англійською. Жодних нотаток про стан задачі.

## Стандарт якості

*Головне: нуль зміни поведінки.* Задача лише переміщує файли, виправляє імпорти й (де сказано) виділяє існуючу логіку в нове місце. Не змінюються: URL, коди й тіла помилок, форми відповідей, SQL, міграції, DI-токени, назви експортів (окрім явно названих у задачі), тексти `uk.json`, поведінка UI. Якщо під час переміщення знайдено баг, його не виправляємо в цьому коміті: рядок у `docs/backlog.md`.

*Переміщення.* Лише `git mv`; виправлення імпортів у тому самому коміті (інакше `git log --follow` губить історію). Перейменування й зміна вмісту файлу – окремі коміти, якщо їх можна розділити. Перед комітом `git status` не містить `D` + `??` пар для переміщених файлів (мають бути `R`).

*Структура.* Строго за розділом «Цільові структури» й «Правила» зі `refactor-structure-v2.md`. Корінь api-модуля – публічний API; підпапки приватні. Web: `app → pages → features → entities → shared`. Без `index.ts`-barrel. Імпорти web між папками лише `@/`, api відносні з `.js`. Нові файли одразу в правильному місці.

*Новий код (лише там, де задача його вводить).* Reference: `modules/profile` і `modules/auth` (контролери, сервіси, `persistence/`), `common/pipes` (pipe-зразок). Нові класи: `VocabularyWriter`, `SessionFinishService`, `SessionFinishController`, `ApiZod*` декоратори, реєстр промптів, генератор зон ESLint. Для них:
- функція ≤ ~40 рядків; параметрів ≤ 3 (далі об'єкт); вкладеність ≤ 3; файл ≤ ~250 рядків;
- жодних `any`, `@ts-ignore`, `eslint-disable` без причини в один рядок, `!`, `as`-кастів поза документованими межами; жодного закоментованого коду, TODO, `console.log`, мертвих експортів;
- DI через конструктор з `@Inject(...)` за патерном сусідніх сервісів;
- TDD: спершу тест, який падає (DI-smoke, реєстр промптів, `docs-json`, `ApiZod*`, `SessionFinishService`).

*Тести.* Наявні тести не слабшають і не видаляються; назви `it` і теги `[TC-NN-NN]` не змінюються; переміщений тест проходить без правки тіла (лише шляхи/імпорти). Розбиття файлу зберігає кількість `it` (порівняти `grep -c "it(" `до й після). Шляхи від `import.meta.url` перераховуються й перевіряються запуском тесту. Нові тести: назва починається з `[TC-NN-NN]` найближчого сценарію, якщо він є; інакше без тегу.

*Безпека й приватність.* Не читати й не виводити `.env`; у логах немає вільного тексту користувача; нових залежностей немає.

## Політика перевірок

Сабагент запускає лише зачеплене й залежне:
- `pnpm --filter <web|api|@gototalk/shared> exec vitest related --run <змінені вихідні файли>` плюс нові/переміщені тест-файли задачі; інтеграційні api: `pnpm --filter api exec vitest run --project integration <шлях до файлу>`;
- лінт змінених файлів: `pnpm exec eslint <файли>`;
- typecheck зачепленого пакета: `pnpm --filter <web|api> typecheck`;
- зміна `packages/shared` або `packages/prompts`: спершу збірка й тести пакета (`pnpm build:shared`), потім typecheck обох застосунків і `vitest related` по файлах-споживачах.
Повні `pnpm test`, `pnpm lint`, `pnpm test:e2e` і Playwright MCP сабагент не запускає.

### Після кожної задачі (сабагент; швидко)
- `pnpm --filter <пакет> typecheck` для кожного зачепленого пакета (при зміні `packages/shared` спершу `pnpm build:shared`, потім typecheck web і api);
- `pnpm exec eslint <змінені й переміщені файли>`;
- `pnpm --filter <пакет> exec vitest related --run <змінені вихідні файли>` + переміщені/нові тест-файли; для api-інтеграційних – лише файли задачі через `--project integration`;
- для задач, що чіпають DI/модулі (03, 11, 13–19): ще `pnpm --filter api exec vitest run src/app.module.test.ts` (DI-smoke).
Оркестратор після звіту: `git status` (лише `R`/`M`/`A` очікуваних файлів), коміт, чекбокс. Повного `pnpm test` після задачі немає.

### Після пачки (оркестратор)
`pnpm typecheck && pnpm lint && pnpm test` (повний; жоден інший процес vitest не працює). Для пачок з api-модулями ще `pnpm dev` (лог Nest без помилок DI/маршрутів) + `curl` до зачеплених ендпоінтів, потім зупинити dev-сервер. Потім `reviewer` на diff пачки (`git diff <перший коміт пачки>^..HEAD`) зі «Стандартом якості» як чеклистом; `reviewer` тестів не запускає. Високі й середні знахідки – один прохід сабагента окремим комітом `refactor(...)`/`test(...)`; низькі – у `docs/backlog.md`.
Якщо повний прогін пачки червоний: знайти коміт, що зламав (`git rebase --exec "<цільова команда тестів>" <перший коміт пачки>^` або прогін коміт за комітом), виправити в межах цієї задачі fixup-комітом (`git commit --fixup=<sha>`; `git rebase -i --autosquash` не використовувати, лишити fixup-коміт із повідомленням `fix(<scope>): …`). Не більше двох ітерацій, далі зупинитись і описати.
Після перевірки пачки додати рядок `Пачка <назва>: перевірено (<кількість тестів>)`.

### Негайне рев'ю (не чекаючи кінця пачки)
Задачі 13, 19, 22: `reviewer` одразу після задачі. Решта `[risk]` – у рев'ю пачки.

### Пачки
| PR | Пачка | Задачі |
|---|---|---|
| 1 | Тулінг | 00–03 |
| 1 | shared | 04–07 |
| 1 | integrations і common | 08–12 |
| 1 | модулі: session, vocabulary, analysis | 13–15 |
| 1 | нові модулі: hint, learner-model, me→auth | 16–18 |
| 1 | finish, turn, audio | 19–21 |
| 1 | Swagger і правила | 22–24 |
| 2 | тести: core, auth, profile, session | 25–28 |
| 2 | тести: dialogue, analysis, report, vocabulary | 29–32 |
| 2 | розбиття й таблиця | 33–34 |
| 3 | shared web і фікстури | 35–36 |
| 3 | entities, моки, хелпери | 37–42 |
| 3 | dialogue-підобласті, сторінки, e2e, page-query | 43–46 |
| 3 | i18n і правила | 47–49 |
| 4 | документи | 50–54 (лише `pnpm lint` і перевірка посилань; тести не запускати) |

Пачки статуси перевірки:
- Пачка модулі session, vocabulary, analysis: перевірено (shared 91, web 965, api 1155; `pnpm dev` без помилок DI, curl: план, старт, підказки, відповідь, завершення, слова; ESLint debt 22 warn; рев'ю задачі 13 і пачки PASS, низькі знахідки в backlog)
- Пачка integrations і common: перевірено (shared 91, web 965, api 1152; `pnpm dev` без помилок DI, health ok, `POST /api/sessions/plan` з Fake рендерить план; рев'ю PASS, лише низькі знахідки в backlog)
- Пачка shared: перевірено (shared 91, web 965, api 1149; сума shared + api 1240 = база; рев'ю PASS, форматування виправлено, низькі знахідки в backlog)
- Пачка Тулінг: перевірено (shared 115, web 965, api 1125; рев'ю PASS, знахідки виправлено окремим комітом)

**Після кожного PR (на його останній задачі):** `pnpm build`, `pnpm test:e2e`, `pnpm dev` + `GET /api/health` і `GET /api/docs-json`, `pnpm db:pull` без diff у `apps/api/src/core/db/`, порівняння кількості тестів із базою задачі 00, рев'ю `reviewer` усього diff гілки, Playwright MCP на 390 px для PR3 (login → старт → відповідь → підказка → завершення → звіт).
Сабагенти й `reviewer` запускаються на передньому плані.

---

# PR 1: тулінг, packages, api/src (гілка `refactor/structure-v2`)

## Тулінг

- [x] **00. Базова лінія й tasks**
  - Записати фактичні кількості тестів: `pnpm --filter @gototalk/shared test`, `pnpm --filter web test`, `pnpm --filter api test` (unit + integration), `pnpm test:e2e`. Вписати числа в розділ «База тестів» цього файлу.
  - Файли: `docs/specs/refactor-structure-v2.tasks.md`.
  - Коміт: `docs: record structure v2 test baseline`

- [x] **01. Хук `run-tests.ps1` (R3)**
  - `.claude/hooks/run-tests.ps1`: блок «пропустити, якщо вже запущено vitest» (`-match 'vitest'`) уже в робочому дереві; закомітити як є. Додати коментар-«чому» одним рядком: вічно запущений Vitest у VS Code змушує хук пропускати перевірку, тож перед PR запускати `pnpm test` вручну.
  - Перевірка: ручний запуск хука з PowerShell (без запущеного vitest → тести виконуються).
  - Коміт: `chore(hooks): skip the test hook while another vitest process runs`

- [x] **02. ESLint: генерація списків і нові правила (`warn`) `[risk]`**
  - `eslint.config.js`:
    - Список фіч, сутностей і api-модулів генерується з `readdirSync` (прибрати захардкоджені `history`, `cards`; W7). Ім'я мапи: `API_MODULE_DEPS` (DAG зі spec: `auth` ← усі; `profile`, `learner-model`, `vocabulary` → `auth`; `session` → `profile`, `learner-model`; `analysis`, `hint` → `session`, `vocabulary`; `dialogue`, `report` → `session`, `analysis`, `vocabulary`).
    - Api (`apps/api/src/**`, лише вихідні файли, `test/` поза зонами): `import-x/no-restricted-paths` – приватність підпапок модуля для інших модулів (зона `from: modules/<m>/{persistence,lib,guards,testing,audio}`, `except` власний модуль) і DAG; `import-x/no-cycle` – усе `warn`.
    - Web: зони `entities` (`shared ↛ entities`, `entities ↛ features|pages|app`, `entities/<a> ↛ entities/<b>`; `features ↛ pages|app`), підобласті фіч (`features/<f>/<sub> ↛ features/<f>/<other-sub>`) – `warn`; `shared/testing/**` прибрати з винятків меж (`warn`).
    - Прибрати виняток `*.test.*` для web-меж; порушення в тестах мають показуватись.
  - Перевірка: тимчасові порушення (приватний імпорт чужого модуля, `shared → entities`, цикл) дають `warn`; відкотити. `pnpm lint` не падає (лише `warn`). Зафіксувати кількість `warn` як «борг», що має дійти до 0 у задачах 24 і 49.
  - Борг `warn` після задачі: 35 (api приватні підпапки 19, api DAG 3, web тести 13); має дійти до 0 у задачах 24 і 49.
  - Відхилення: рівень задається на правило, тому нові зони живуть під другою реєстрацією плагіна `import-x-debt`; у задачах 24 і 49 злити назад у `import-x/no-restricted-paths` як `error`. `me` поза DAG: його імпорти дають warn до задачі 18.
  - Коміт: `build(lint): generate boundary lists and add module and entity zones as warnings`

- [x] **03. DI-smoke `[risk]`**
  - `src/core-services.test.ts` → злити в `src/app.module.test.ts` (`git mv` неможливий для злиття; зберегти `[TC-00-04]` і всі його перевірки), розширити: тест резолвить кожен controller і provider із `AppModule` (`moduleRef.get(token, { strict: false })` по списку з `DiscoveryService`/`Reflect.getMetadata('controllers'|'providers')` модулів). Перед написанням: context7 по `@nestjs/testing`/`DiscoveryService` NestJS 12.
  - Старий файл видалити в цьому коміті (його єдиний кейс переїхав; кількість `it` не зменшується).
  - Перевірка: тест падає, якщо тимчасово прибрати provider з модуля (перевірити й відкотити).
  - Коміт: `test(api): resolve every controller and provider in the app module smoke test`

## packages/shared

- [x] **04. `common/`: errors, health, pagination, providers (A6/P1/r.26)**
  - `errors.ts` → `common/errors.ts`; `ERROR_CODES`/`ErrorCode` з `auth.ts` → `common/errors.ts`; `health.ts` → `common/health.ts`; `pagination.ts` (+test) → `common/pagination.ts`.
  - Нове: `common/providers.ts` (`STT_PROVIDERS = ['fake','deepgram']`, `LLM_PROVIDERS = ['fake','gemini']`); `auth.ts:31-32` і `apps/api/src/core/config/env.schema.ts:74,80` використовують його (закриває backlog r.26).
  - Тести для `errors`/`health` – із `schemas.test.ts` у `common/errors.test.ts`, `common/health.test.ts` (кількість `it` збережена).
  - `index.ts` оновити.
  - Перевірка: `pnpm build:shared`, typecheck обох застосунків.
  - Коміт: `refactor(shared): group common schemas and dedupe provider lists`

- [x] **05. Домени: auth, profile, session, analysis, dialogue, report, vocabulary**
  - `auth.ts` (+test) → `auth/auth.ts`; `profile.ts` (+test) → `profile/profile.ts`; `session.ts` (+test) → `session/session.ts`; `plan-bounds.ts` → `session/plan.ts`; `analysis-view.ts` → `analysis/analysis-view.ts`; `mistake-categories.ts` → `analysis/mistake-categories.ts`; `dialogue.ts` (+test), `audio.ts` (+test), `hint.ts` → `dialogue/`; `report.ts` (+test) → `report/report.ts`; `words.ts` (+test) → `vocabulary/words.ts`.
  - `index.ts`: `export *` з нових шляхів; експорти без змін.
  - Перевірка: `pnpm build:shared`; typecheck web і api; `import.meta.url`-шляхи в `schemas.test.ts` (міграція 0002) перерахувати.
  - Коміт: `refactor(shared): group schemas by domain`

- [x] **06. `llm.ts` розділити: контракт у shared, API-схеми в api `[risk]`**
  - У shared лишаються: `BetterPhrasingSchema` → `analysis/better-phrasing.ts`; `PlanSchema` → `session/plan.ts` (разом із `plan-bounds`).
  - В API: `TranscriptSchema` → `apps/api/src/integrations/speech-recognition/transcript.ts`; `MistakeSchema`, `AnalysisEnvelopeSchema`, `TurnSchema`, `HintSchema`, `SummarySchema`, `ANALYSIS_MAX_*`, `MISTAKE_TEXT_MAX`, `MISTAKE_EXPLANATION_MAX` → `apps/api/src/integrations/language-model/model-output.ts`; `llm.test.ts` → розділити на `model-output.test.ts` (api) і тести контракту (`better-phrasing`, `plan`) у shared.
  - Імпорти в api (`@gototalk/shared` → відносні `.js`) і у web (`BetterPhrasing` лишається з shared).
  - Перевірка: `pnpm build:shared`, typecheck обох; `grep -rn "SummarySchema\|TranscriptSchema" apps/web` порожньо; кількість тестів shared + api не менша (перенесені `it` лічити сумарно).
  - Відхилення: ліміт 200 для `BetterPhrasingSchema` тепер константа `BETTER_PHRASING_TEXT_MAX` (не експортована) у shared, `MISTAKE_TEXT_MAX = 200` лишився в api; окремого `plan.test.ts` немає (у `llm.test.ts` не було самостійного тесту плану); змішані тести TC-00-05 лишились цілими в `model-output.test.ts`, бо розбиття змінило б їхні назви. Сума `it(` shared + api: 1028 до й після.
  - Коміт: `refactor(shared): move model output and transcript schemas to the api`

- [x] **07. Розбиття `session.test.ts`, чистка `schemas.test.ts` (r.50)**
  - `session/session.test.ts` (345 рядків) → `session.test.ts` + `session-plan.test.ts` за `describe` (план сесії окремо); `schemas.test.ts` розподілено в задачах 04–06, залишок (якщо є) – у доменні файли; файл видалити, коли порожній.
  - `index.ts` лишається єдиним входом, перевірити `package.json` `exports` (єдина точка `.`).
  - Перевірка: кількість `it` у shared до/після однакова (`pnpm --filter @gototalk/shared test` – число з задачі 00 + нічого не втрачено).
  - Коміт: `test(shared): split the session schema tests by concern`

## apps/api/src: integrations і common

- [x] **08. `integrations`: errors, speech-recognition/fake**
  - `LanguageModelInvalidResponseError`: `language-model/validated-call.ts` → `language-model/language-model.errors.ts` (імпорти в `validated-call.ts`, `report-generator.service.ts`, `turn.service.ts`, `hints.service.ts`, `mistake-analyzer.service.ts`, `session-planner.service.ts`, тести).
  - `speech-recognition/fake-speech-recognition.ts` (+test), `fake-transcripts.ts` → `speech-recognition/fake/`.
  - `integrations/fake-adapters.test.ts` (8 кейсів) і `fake-fail-modes.test.ts` (7): STT-кейси → `speech-recognition/fake/fake-speech-recognition.adapter.test.ts`; LLM-кейси лишаються до задачі 10.
  - Коміт: `refactor(api): group speech recognition fakes and move the invalid-response error`

- [x] **09. `language-model/prompts/` + реєстр `[risk]`**
  - `prompts.ts` + `session-plan-prompt.ts` (+tests) → `prompts/prompt-registry.ts` (один реєстр: `PROMPT_IDS`, рендер за id; публічний API експортів зберегти або мапити 1:1); `prompt-loader.ts` (+test) → `prompts/load-prompt.ts`; `render-prompt.ts` (+test) → `prompts/render-prompt.ts`.
  - Рантайм: `require.resolve('@gototalk/prompts/${id}.md')` у `load-prompt.ts` працює з нової глибини; перевірити запуском `pnpm dev` + `POST /api/sessions` з Fake (план сесії рендериться).
  - Новий тест `prompts/prompt-registry.test.ts` (TDD): кожен id із реєстру резолвиться; кожен `.md` у `packages/prompts` зареєстровано; у кожному шаблоні рівно один `{{input}}`.
  - Коміт: `refactor(api): move prompt loading and rendering into prompts with a registry test`

- [x] **10. `language-model/fake/` і `testing/`**
  - `fake-language-model.ts`, `fake-analysis.ts`, `fake-analysis-rules.ts`, `fake-hints.ts`, `fake-next-turn.ts`, `fake-session-plans.ts`, `fake-summary.ts`, `fake-verb-forms.ts` і їхні тести (`fake-analysis.test.ts`, `fake-analysis-rules.test.ts`, `fake-summary.test.ts`, `fake-language-model-{analysis,hint,next-turn,plan,summary}.test.ts`) → `language-model/fake/`.
  - `fake-analysis-rule-cases.ts` → `language-model/fake/testing/`; `integrations/testing/analysis-result-schema.ts` → `language-model/testing/` (r.55: підключення до `AnalysisEnvelopeSchema` + `MistakeSchema` – окремо, лише якщо без зміни поведінки тесту).
  - LLM-кейси `fake-adapters.test.ts` і `fake-fail-modes.test.ts` → `language-model/fake/fake-language-model.adapter.test.ts`; після цього обидва старі файли видалити (кількість `it` 8 + 7 збережена).
  - Коміт: `refactor(api): group language model fakes and test helpers`

- [x] **11. `providers.module` → `adapters.module`**
  - `integrations/providers.module.ts` (+test) → `integrations/adapters.module.ts` (+test); клас `ProvidersModule` → `AdaptersModule`; імпорт в `app.module.ts`. Токени `LANGUAGE_MODEL_PORT`, `SPEECH_RECOGNITION_PORT`, `@Global()` не змінюються. `fake-consistency.test.ts` лишається в `integrations/`.
  - Перевірка: DI-smoke (задача 03) зелений; `pnpm dev`.
  - Коміт: `refactor(api): rename the providers module to adapters`

- [x] **12. `common/` підпапки (A6)**
  - `zod-body.pipe.ts`, `zod-query.pipe.ts` (+tests) → `common/pipes/`; `public.decorator.ts` → `common/decorators/`; `keyset-cursor.ts`, `keyset-page.ts` (+tests) → `common/pagination/`; `language-model-http-errors.ts` (+test) → `common/errors/`.
  - Імпорти в `core/`, `modules/`, `integrations/`, `apps/api/test/*` (відносні, глибина змінюється).
  - Коміт: `refactor(api): group common into pipes, decorators, pagination and errors`

## apps/api/src: модулі

- [x] **13. `session`: lock, errors, views `[risk]` (A1, r.62)**
  - `session/persistence/lock-session.ts` → `session/session-lock.ts`; логіка `dialogue/persistence/lock-active-session.ts` (обгортка, що кидає `SessionNotFoundError`/`SessionFinishedError`) об'єднується з `lockSession` у `session-lock.ts` як друга експортована функція (`lockActiveSession`); файл у dialogue видалити. Сигнатури й повідомлення винятків без змін.
  - `SessionNotFoundError`, `SessionFinishedError`, `toSessionHttpError` з `dialogue/dialogue.errors.ts` → `session/session.errors.ts`; у `dialogue.errors.ts` лишається `AnswerNotExpected…` + композиція (`toDialogueHttpError` викликає `toSessionHttpError`); `hints.service.ts` використовує той самий маппер.
  - `session/lib/mistake-view.ts` → `session/mistake-view.ts`; `session/lib/plan-questions.ts` (+test) → `session/plan-questions.ts`.
  - `session/sessions.repository.ts` → `session/persistence/sessions.repository.ts`; `session/plan-input.ts` (+test) → `session/lib/plan-input.ts`.
  - Споживачі: `dialogue`, `analysis`, `report` імпортують лише кореневі файли `session/`.
  - Перевірка: `pnpm dev`; інтеграційні `sessions*`, `dialogue-answer*`, `dialogue-analysis*`, `report-*` (`--project integration`); lint `warn` для приватних імпортів із `session/` зникли.
  - Коміт: `refactor(api): expose session lock, errors and views from the module root`

- [x] **14. `vocabulary`: `VocabularyWriter`, `word-view` `[risk]` (A1)**
  - `vocabulary/persistence/word-view.ts` → `vocabulary/word-view.ts` (публічний мапер; `toWord`, `WORD_COLUMNS` для `report.repository`).
  - Нове `vocabulary/vocabulary-writer.service.ts` (`VocabularyWriter`, експорт `VocabularyModule`): методи, які сьогодні викликаються з чужих модулів напряму з репозиторіїв/`lib` – `addFromHint(tx, …)` (для `hints.repository`) і `saveSessionWords(tx, …)` (для `analysis-writer`, делегує до `words.repository`, `session-words.repository` і `lib/session-word-candidates`). Тіло методів = перенесений наявний код 1:1.
  - `hints.repository` і `analysis-writer` викликають `VocabularyWriter` замість імпорту `vocabulary/persistence/*` і `vocabulary/lib/*`.
  - TDD: unit-тест `vocabulary-writer.service.test.ts` для делегування (спершу падає).
  - Перевірка: інтеграційні `hints*`, `dialogue-analysis-words`, `session-words`, `vocabulary-usage`, `words-*`; DI-smoke.
  - Відхилення: `addFromHint(tx, userId, sessionId, word)` сам робить `sessionWords.link`; зв'язок тепер створюється до вставки підказки (в тій самій транзакції; кінцевий стан той самий). `HintsRepository.resolve` приймає `(tx, { userId, sessionId, record })`. `VocabularyWriter` без `@Inject` (як сусідні сервіси vocabulary).
  - Коміт: `refactor(api): route cross-module word writes through VocabularyWriter`

- [x] **15. `analysis`: `AnalysisWriter` як сервіс (A1)**
  - `analysis/persistence/analysis-writer.ts` → `analysis/analysis-writer.service.ts` (клас `AnalysisWriter`, `@Injectable()`, експорт з `AnalysisModule`); `TurnService`/`turn.repository` і `pending-analysis.repository` отримують його через DI, а не імпортом файлу з `persistence/`. Транзакція (`tx`) передається параметром, як зараз.
  - Якщо `new AnalysisWriter(...)` створюється вручну в інтеграційних тестах, оновити створення (перелік у `grep -rn "AnalysisWriter" apps/api`).
  - Перевірка: інтеграційні `dialogue-analysis*`, `pending-analysis`, `dialogue-answer*`; DI-smoke.
  - Коміт: `refactor(api): make AnalysisWriter an exported service of the analysis module`

- [x] **16. Новий модуль `hint` `[risk]` (A3)**
  - `dialogue/hints.controller.ts`, `hints.service.ts` (+test) → `modules/hint/`; `dialogue/persistence/hints.repository.ts` → `modules/hint/persistence/`; новий `modules/hint/hint.module.ts` (imports: `SessionModule`, `VocabularyModule`; без `DialogueModule`); `DialogueModule` більше не декларує hints; `AppModule` імпортує `HintModule`.
  - URL `POST /sessions/:id/hint` і Swagger-теги без змін.
  - Перевірка: інтеграційні `hints*`; `pnpm dev` + `curl` підказки; DI-smoke; `grep` – `hint/` не імпортує `dialogue/`.
  - Відхилення: фактичний маршрут `sessions/:id/hints` (множина), `@ApiTags('dialogue')` без змін; `AnswerNotExpectedError` переїхав у `session/session.errors.ts`, `toSessionHttpError` мапить його (409 `ANSWER_NOT_EXPECTED`), псевдонім `toDialogueHttpError` прибрано; `HintModule` імпортує лише `VocabularyModule` (session-залежності – файлові імпорти кореня, `LanguageModelPort` і `DRIZZLE` глобальні).
  - Коміт: `refactor(api): extract hints from dialogue into the hint module`

- [x] **17. Новий модуль `learner-model` `[risk]` (A3)**
  - `profile/learner-model.{service,types,mapper}.ts` (+`learner-model.service.test.ts`) → `modules/learner-model/`; `profile/persistence/learner-model.repository.ts` → `modules/learner-model/persistence/`; `GET profile/learner-model` з `profile.controller.ts` → `learner-model.controller.ts` (`@Controller('profile')`, URL і Swagger без змін); `learner-model.module.ts` (imports: `AuthModule` через `@Global`), `SessionModule` імпортує `LearnerModelModule`; `session-planner.service.ts` і `plan-input.ts` – імпорт з `learner-model/` кореня.
  - Перевірка: інтеграційні `learner-model`, `profile`, `sessions-plan*`; DI-smoke; `curl` `/api/profile/learner-model`.
  - Коміт: `refactor(api): extract the learner model from profile into its own module`

- [ ] **18. `me` → `auth` `[risk]` (A3)**
  - `modules/me/me.controller.ts`, `me.service.ts` → `modules/auth/`; `me.module.ts` видалити, контролер і сервіс реєструються в `AuthModule`; імпорти `auth/persistence/users.repository`, `auth/lib/password-hasher`, `auth/lib/refresh-cookie` стають відносними всередині модуля; `AppModule` без `MeModule`.
  - Маршрути `/api/me*` без змін; зберегти порядок `@Public()`/guard-ів.
  - Перевірка: інтеграційні `me`, `delete-account`, `auth*`; DI-smoke; `pnpm dev`.
  - Коміт: `refactor(api): fold the me module into auth`

- [ ] **19. `report`: `SessionFinishService` + контролер `[risk]` (A2)**
  - TDD: `report/session-finish.service.test.ts` (кейси `finish`/`ensureReport` перенесені з `sessions.service.test.ts` без зміни очікувань: finish повертає `Session`, збій звіту лише лог `Report generation failed on finish: <name>`).
  - `SessionsService.finish`, `ensureReport` → `report/session-finish.service.ts` (`SessionFinishService`; залежить від `SessionsService.finishSession`/репозиторного методу через публічний API `session/` та `ReportGeneratorService`); у `SessionsService` лишається доменне `finish` без звіту (метод перейменувати лише якщо потрібно для уникнення колізії; зафіксувати в коміті).
  - `sessions.controller.ts`: `POST :id/finish` (з `@RequiresConsent()` і Swagger-декораторами, `@ApiTags('sessions')`) → `report/session-finish.controller.ts` (`@Controller('sessions')`); `SessionModule` більше не імпортує `ReportModule`; `ReportModule` імпортує `SessionModule`.
  - Перевірка: інтеграційні `sessions-finish*`, `report-finish`; `e2e` `report.spec`/`session.spec`; `pnpm dev` + `curl POST /api/sessions/<id>/finish`; `/api/docs-json` містить `POST /api/sessions/{id}/finish` у тегу `sessions`; цикл `session ↔ report` зник (`no-cycle` без `warn`).
  - Коміт: `refactor(api): move session finishing orchestration into the report module`

- [ ] **20. `TurnService` → `SessionsService.findDetails` (r.62)**
  - `sessions.service.ts`: експортувати `findDetails(userId, id)` (обгортка над репозиторієм без зміни семантики: `SessionDetails | null`); `turn.service.ts` викликає його замість імпорту `sessions.repository` з `session/persistence/`.
  - Коміт: `refactor(api): read session details through SessionsService in the turn service`

- [ ] **21. `dialogue/audio/`**
  - `dialogue/audio-retention.ts`, `audio-upload.ts` (+tests), `lib/audio-format.ts` (+test) → `dialogue/audio/`.
  - Імпорти в `dialogue.controller.ts`, `answers.service.ts` тощо.
  - Коміт: `refactor(api): group dialogue audio helpers`

## apps/api/src: Swagger і правила

- [ ] **22. `ApiZodBody` / `ApiZodQuery` `[risk]` (A5)**
  - Context7 (Zod 4): `z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' })`.
  - TDD: `common/swagger/api-zod.decorators.test.ts` – декоратор додає у метадані `@nestjs/swagger` схему body/query, згенеровану з Zod-схеми shared; `z.coerce`, `.default`, `.refine`, `.transform` не ламають генерацію.
  - Замінити 12 ручних `@ApiBody({ schema: {…} })` і відповідні `@ApiQuery` у 10 контролерах на `ApiZodBody(Schema)`/`ApiZodQuery(Schema)`; прибрати імпорти констант shared, потрібних лише для Swagger (`TOPIC_MAX` тощо; 6 контролерів).
  - Новий інтеграційний тест `test/openapi.test.ts` (у задачі 25 переїде в `test/integration/core/`): `GET /api/docs-json` – кожен маршрут із тілом/запитом має схему; перелік шляхів і методів дорівнює еталону, знятому до рефакторингу (знімок списку `paths` зберегти як константу в тесті).
  - Перевірка: HTTP-контракт не змінюється (e2e, інтеграційні тести валідації 400).
  - Коміт: `refactor(api): generate swagger request schemas from zod`

- [ ] **23. `ApiZodResponse`**
  - `ApiZodResponse(Schema, status?)` (`io: 'output'`); замінити текстові `description: 'SessionPlan { topic, … }'` схемами відповідей для ендпоінтів, чиї схеми є в shared; решта без змін. HTTP не змінюється.
  - Тест: `/api/docs-json` – у відповідях зазначених маршрутів є `schema` (додати до `openapi.test.ts`).
  - Коміт: `refactor(api): document response schemas from zod`

- [ ] **24. API-правила в `error`, PR1 завершено**
  - `eslint.config.js`: api-зони приватності модулів, DAG і `import-x/no-cycle` → `error`. Лишається `warn` для web (до задачі 49). `test/` поза зонами.
  - Перевірка тимчасовими порушеннями: імпорт `modules/session/persistence/…` з `report`, імпорт `modules/dialogue` з `session`, цикл між двома файлами: кожне дає помилку lint; відкотити.
  - Фінальна перевірка PR1 (див. «Політика перевірок»): `pnpm build`, `pnpm test:e2e`, `pnpm dev`, DI, `docs-json`, `pnpm db:pull` без diff, кількості тестів.
  - Коміт: `refactor(api): enforce module boundaries and import cycles as errors`

---

# PR 2: api/test (гілка `refactor/structure-v2-api-tests`)

Усі файли переїжджають за таблицею «api/test» нижче; відносні імпорти `../src/…` → `../../../src/…`, `./support/…` → `../../support/…`. `global-setup.ts` і `support/` не рухаються. Перевірка кожної задачі: `pnpm --filter api exec vitest run --project integration test/integration/<module>` + typecheck + lint.

- [ ] **25. `integration/core/` + `vitest.config.ts`**
  - `db-schema`, `error-format`, `health`, `mistake-categories`, `user-data-fixture`, `reset-user-data`, `openapi` → `test/integration/core/`.
  - `apps/api/vitest.config.ts`: integration `include: ['test/integration/**/*.test.ts']`; unit-проєкт лишається (`src/**`, `test/support/**`).
  - Коміт: `refactor(api-test): move core integration tests`

- [ ] **26. `integration/auth/`** – `auth`, `auth-guard`, `drizzle-refresh-tokens.repository`, `me`, `delete-account`.
  - Коміт: `refactor(api-test): move auth integration tests`

- [ ] **27. `integration/profile/`, `learner-model/`, `hint/`** – `profile`, `goals` → `profile/`; `learner-model` → `learner-model/`; `hints`, `hints-access`, `hints-failures` → `hint/`.
  - Коміт: `refactor(api-test): move profile, learner-model and hint integration tests`

- [ ] **28. `integration/session/`** – `sessions`, `sessions-plan`, `sessions-plan-unavailable`, `sessions-read`, `sessions-history`, `sessions-analysis-read`.
  - Коміт: `refactor(api-test): move session integration tests`

- [ ] **29. `integration/dialogue/` (відповіді й голос)** – `dialogue-answer`, `dialogue-answer-locking`, `dialogue-voice`, `dialogue-voice-access`, `dialogue-voice-errors`, `dialogue-voice-logging`, `audio-retention`.
  - Коміт: `refactor(api-test): move dialogue answer and voice integration tests`

- [ ] **30. `integration/dialogue/` (аналіз) і `analysis/`** – `dialogue-analysis`, `-access`, `-failures`, `-idempotency`, `-locking`, `-words` → `dialogue/`; `mistakes`, `mistakes-access`, `patterns-repository`, `pending-analysis` → `analysis/`.
  - Коміт: `refactor(api-test): move dialogue analysis and analysis integration tests`

- [ ] **31. `integration/report/`** – `report-aggregates`, `report-aggregates-session`, `report-finish`, `report-read`, `report-read-access`, `report-store`, `report-unavailable`, `sessions-finish`, `sessions-finish-locking`.
  - Коміт: `refactor(api-test): move report and finish integration tests`

- [ ] **32. `integration/vocabulary/`** – `session-words`, `vocabulary-usage`, `words-list`, `words-mark`.
  - Коміт: `refactor(api-test): move vocabulary integration tests`

- [ ] **33. Розбиття довгих тестів (A7, r.54, r.60, r.67)**
  - `integration/auth/auth.test.ts` (449) → `auth.test.ts` + `auth-refresh.test.ts` (за `describe`: реєстрація/логін vs refresh/logout); `integration/profile/goals.test.ts` (432) → `goals.test.ts` + `goals-limit.test.ts`; `integration/core/db-schema.test.ts` (402) → `db-schema.test.ts` + `db-schema-constraints.test.ts`; `src/core/errors/all-exceptions.filter.test.ts` (413) → `all-exceptions.filter.test.ts` + `all-exceptions.filter.zod.test.ts` (кейси `RequestValidationError`/сирого `ZodError`); `integration/dialogue/dialogue-answer.test.ts` (327) → `-validation` і `-access`.
  - Точні межі за `describe`; допоміжні константи – у `test/support/` лише якщо використовуються обома половинами. `grep -c "it(" ` до й після однаковий.
  - Лише розбиття: теми з r.60/62/67 про недетермінованість і додаткові тести – окремо, поза цим рефакторингом.
  - Коміт: `test(api): split the longest integration and unit tests by concern`

- [ ] **34. Таблиця «старий шлях → новий» і перевірка PR2**
  - Звірити таблицю нижче з `git diff -M --name-status main HEAD -- apps/api/test`; виправити розбіжності. Фінальна перевірка PR (повний набір), кількість тестів = база задачі 00.
  - Коміт: `docs: record api test move table`

### Таблиця переміщень: api/test (план; звірити в задачі 34)

Шляхи від `apps/api/test`. Кожна пара – `git mv`.

| Старий шлях | Новий шлях |
|---|---|
| `db-schema.test.ts` | `integration/core/db-schema.test.ts` (+ `db-schema-constraints.test.ts`) |
| `error-format.test.ts` | `integration/core/error-format.test.ts` |
| `health.test.ts` | `integration/core/health.test.ts` |
| `mistake-categories.test.ts` | `integration/core/mistake-categories.test.ts` |
| `user-data-fixture.test.ts` | `integration/core/user-data-fixture.test.ts` |
| `reset-user-data.test.ts` | `integration/core/reset-user-data.test.ts` |
| (нове, задача 22) `openapi.test.ts` | `integration/core/openapi.test.ts` |
| `auth.test.ts` | `integration/auth/auth.test.ts` (+ `auth-refresh.test.ts`) |
| `auth-guard.test.ts` | `integration/auth/auth-guard.test.ts` |
| `drizzle-refresh-tokens.repository.test.ts` | `integration/auth/drizzle-refresh-tokens.repository.test.ts` |
| `me.test.ts` | `integration/auth/me.test.ts` |
| `delete-account.test.ts` | `integration/auth/delete-account.test.ts` |
| `profile.test.ts` | `integration/profile/profile.test.ts` |
| `goals.test.ts` | `integration/profile/goals.test.ts` (+ `goals-limit.test.ts`) |
| `learner-model.test.ts` | `integration/learner-model/learner-model.test.ts` |
| `hints.test.ts` | `integration/hint/hints.test.ts` |
| `hints-access.test.ts` | `integration/hint/hints-access.test.ts` |
| `hints-failures.test.ts` | `integration/hint/hints-failures.test.ts` |
| `sessions.test.ts` | `integration/session/sessions.test.ts` |
| `sessions-plan.test.ts` | `integration/session/sessions-plan.test.ts` |
| `sessions-plan-unavailable.test.ts` | `integration/session/sessions-plan-unavailable.test.ts` |
| `sessions-read.test.ts` | `integration/session/sessions-read.test.ts` |
| `sessions-history.test.ts` | `integration/session/sessions-history.test.ts` |
| `sessions-analysis-read.test.ts` | `integration/session/sessions-analysis-read.test.ts` |
| `dialogue-answer.test.ts` | `integration/dialogue/dialogue-answer.test.ts` (+ `-validation`, `-access`) |
| `dialogue-answer-locking.test.ts` | `integration/dialogue/dialogue-answer-locking.test.ts` |
| `dialogue-voice.test.ts` | `integration/dialogue/dialogue-voice.test.ts` |
| `dialogue-voice-access.test.ts` | `integration/dialogue/dialogue-voice-access.test.ts` |
| `dialogue-voice-errors.test.ts` | `integration/dialogue/dialogue-voice-errors.test.ts` |
| `dialogue-voice-logging.test.ts` | `integration/dialogue/dialogue-voice-logging.test.ts` |
| `audio-retention.test.ts` | `integration/dialogue/audio-retention.test.ts` |
| `dialogue-analysis.test.ts` | `integration/dialogue/dialogue-analysis.test.ts` |
| `dialogue-analysis-access.test.ts` | `integration/dialogue/dialogue-analysis-access.test.ts` |
| `dialogue-analysis-failures.test.ts` | `integration/dialogue/dialogue-analysis-failures.test.ts` |
| `dialogue-analysis-idempotency.test.ts` | `integration/dialogue/dialogue-analysis-idempotency.test.ts` |
| `dialogue-analysis-locking.test.ts` | `integration/dialogue/dialogue-analysis-locking.test.ts` |
| `dialogue-analysis-words.test.ts` | `integration/dialogue/dialogue-analysis-words.test.ts` |
| `mistakes.test.ts` | `integration/analysis/mistakes.test.ts` |
| `mistakes-access.test.ts` | `integration/analysis/mistakes-access.test.ts` |
| `patterns-repository.test.ts` | `integration/analysis/patterns-repository.test.ts` |
| `pending-analysis.test.ts` | `integration/analysis/pending-analysis.test.ts` |
| `report-aggregates.test.ts` | `integration/report/report-aggregates.test.ts` |
| `report-aggregates-session.test.ts` | `integration/report/report-aggregates-session.test.ts` |
| `report-finish.test.ts` | `integration/report/report-finish.test.ts` |
| `report-read.test.ts` | `integration/report/report-read.test.ts` |
| `report-read-access.test.ts` | `integration/report/report-read-access.test.ts` |
| `report-store.test.ts` | `integration/report/report-store.test.ts` |
| `report-unavailable.test.ts` | `integration/report/report-unavailable.test.ts` |
| `sessions-finish.test.ts` | `integration/report/sessions-finish.test.ts` |
| `sessions-finish-locking.test.ts` | `integration/report/sessions-finish-locking.test.ts` |
| `session-words.test.ts` | `integration/vocabulary/session-words.test.ts` |
| `vocabulary-usage.test.ts` | `integration/vocabulary/vocabulary-usage.test.ts` |
| `words-list.test.ts` | `integration/vocabulary/words-list.test.ts` |
| `words-mark.test.ts` | `integration/vocabulary/words-mark.test.ts` |
| `global-setup.ts`, `support/*` | без змін |

---

# PR 3: web і e2e (гілка `refactor/structure-v2-web`)

Шляхи нижче від `apps/web/src`, якщо не вказано інше.

- [ ] **35. `shared/session` → `shared/auth-session` (W1)**
  - `shared/session/{session-store,query-cache}.ts` (+tests) → `shared/auth-session/`; імпорти (`@/shared/session/…` → `@/shared/auth-session/…`) у `shared/api/*`, `app/*`, `features/auth`, `main.tsx`, `vitest.setup.ts`, `test-utils.tsx`; ESLint-зона `shared/session ↛ shared/api` → `shared/auth-session ↛ shared/api`. Експорти й назви без змін.
  - Коміт: `refactor(web): rename shared session store to auth-session`

- [ ] **36. `shared/testing`: розщеплення `test-fixtures.ts` (W1)**
  - `shared/testing/test-fixtures.ts` (240 рядків) → `shared/testing/http-responses.ts` (`jsonResponse`, `errorResponse`), `shared/testing/fixtures/{auth,profile,session,words,report}.ts` (фабрики DTO, імпорт лише з `@gototalk/shared`), `shared/testing/deferred.ts` (`deferred()` з dialogue-моків, r.65); `test-fixtures.test.ts` розбити за файлами. Імпорти в ~100 тестах: `@/shared/testing/test-fixtures` → нові шляхи (механічно, codemod-скриптом у scratchpad із перевіркою `tsc`).
  - Коміт: `refactor(web): split test fixtures into http responses and per-domain factories`

- [ ] **37. `entities/session`: api і lib `[risk]` (W1)**
  - `shared/api/session-details.ts` (+test), `mistakes.ts` (+test), `mistake-errors.ts` (+test), `details-cache.ts` (+test) → `entities/session/api/` (перші два) і `entities/session/lib/` (останні два); `shared/router/session-paths.ts` (+test) → `entities/session/lib/session-paths.ts`.
  - ESLint: зони `entities` стають активними (`warn` з задачі 02): `entities ↛ features|pages|app`.
  - Перевірка: усі споживачі (4 фічі, 2 сторінки, ~30 імпортів) компілюються; `pnpm --filter web test`.
  - Коміт: `refactor(web): move session details api and cache helpers into entities/session`

- [ ] **38. `entities/session/hooks`**
  - `shared/hooks/use-mark-mistake.ts` (+test), `use-update-details.ts` → `entities/session/hooks/`; `shared/hooks/use-focus-when.ts` лишається в `shared/`.
  - Коміт: `refactor(web): move session entity hooks into entities/session`

- [ ] **39. `entities/session/components` `[risk]` (W1/W3)**
  - Папки цілком: `shared/ui/AnswerCard`, `PastQuestion`, `BetterPhrasings`, `ReplaceArrow`, `AnswerTranscript` (+scss, +tests, `highlight-segments`), `MistakeDetails` → `entities/session/components/<Name>/`.
  - W3: `TranscriptText.tsx` → `components/TranscriptText/TranscriptText.tsx`, `Correction.tsx` + `.module.scss` → `components/Correction/` (власні папки, бо імпортуються поза папкою батька).
  - `shared/ui/` лишається з `LoadError`, `LoadMoreFooter`, `SectionSkeleton`.
  - Коміт: `refactor(web): move session transcript components into entities/session`

- [ ] **40. Доменні моки з `shared/testing` у `testing/` зрізів (W1, r.65)**
  - `shared/testing/dialogue-mocks.ts`, `answer-flow-setup.tsx` → `features/dialogue/testing/`; `session-mocks.ts` → `features/session/testing/session-mocks.ts`; `report-mocks.ts` → `features/report/testing/`; `words-mocks.ts` → `features/vocabulary/testing/`; частину `dialogue-mocks`, потрібну сутності (`markMistakeOk` тощо) → `entities/session/testing/session-entity-mocks.ts`.
  - `shared/testing/**` після цього не імпортує `features`/`entities`; зона `shared ↛ features|entities` на тестах → працює.
  - Коміт: `refactor(web): move domain test mocks next to their slices`

- [ ] **41. Тестові хелпери поруч із компонентами (W2)**
  - `pages/report/report-page-setup.ts` → `pages/report/testing/`; `features/dialogue/components/DialogueScreen/dialogue-screen-test-helpers.tsx` → `features/dialogue/testing/`; `features/profile/components/GoalsSection/goals-test-helpers.tsx`, `OnboardingWizard/wizard-test-helpers.tsx` → `features/profile/testing/`; `features/report/components/DeepAnalysis/deep-analysis-fixtures.ts` → `features/report/testing/`; `app/router/guards/guard-test-helpers.tsx` → `app/testing/`.
  - Коміт: `refactor(web): collect component test helpers in testing folders`

- [ ] **42. `SessionListItem` у власну папку (W3)**
  - `features/session/components/RecentSessions/SessionListItem.tsx` + `.module.scss` → `components/SessionListItem/` (імпортують `RecentSessions` і `SessionHistory`).
  - Коміт: `refactor(web): give shared session list item its own folder`

- [ ] **43. `features/dialogue/recording/` (W4)**
  - `components/{RecordButton,RecordingIndicator,MicPermissionHelp}` (+tests) → `recording/components/`; `hooks/use-audio-recorder*.ts` (+3 тести) → `recording/hooks/`; `lib/{audio-level,recorder-mime,recording-session,mic-help,format-elapsed}` (+tests) → `recording/lib/`; `testing/{fake-media,recorder-harness}.ts` → `recording/testing/`.
  - `mic-help.ts` імпортує хук `use-audio-recorder` (lib → hooks): розв'язати переносом спільного типу/константи в `recording/lib/` без зміни поведінки.
  - Підобласті не імпортують одна одну (зона з задачі 02).
  - Коміт: `refactor(web): extract the recording area of the dialogue feature`

- [ ] **44. `features/dialogue/hint/` і `turn-cache` (W4)**
  - `components/HintPanel/*` (HintPanel, HintOutcome, WordHintForm, тест) → `hint/components/HintPanel/`; `hooks/use-hint.ts` (+test) → `hint/hooks/`; `lib/hint-form.ts` (+test) → `hint/lib/`.
  - `features/dialogue/lib/details-cache.ts` (+test) → `lib/turn-cache.ts` (+test) (колізія назв із `entities/session/lib/details-cache.ts`); експорти й імена функцій без змін.
  - Коміт: `refactor(web): extract the hint area and rename the dialogue turn cache`

- [ ] **45. Сторінки `home`/`dialogue` і e2e (W5, r.79) `[e2e]`**
  - `pages/session/SessionPage.tsx` (+test) → `pages/home/HomePage.tsx` (+test) (компонент `HomePage`); `pages/dialog/DialogPage.tsx` (+test) → `pages/dialogue/DialoguePage.tsx` (+test); оновити `app/App.tsx`, `App.test.tsx`.
  - `e2e/dialog.spec.ts` → `e2e/dialogue.spec.ts`; `e2e/support/dialog.ts` → `e2e/support/dialogue.ts`; `translateHint` з `report.spec.ts`/`voice.spec.ts` → `support/dialogue.ts`.
  - Перевірка: `pnpm test:e2e` (усі сценарії); Playwright MCP 390 px: головна й діалог.
  - Коміт: `refactor(web): align page names with routes and dedupe the e2e hint helper`

- [ ] **46. `shared/api/page-query.ts` (W8, r.78)**
  - Нове `shared/api/page-query.ts` (`pageQueryString({ cursor, limit })`) + тест; `features/session/api/session-api.ts` (`listHistory`) і `features/vocabulary/api/words-api.ts` (`listWords`) використовують його; вихідний рядок запиту ідентичний (перевірити наявними тестами API-клієнтів).
  - Коміт: `refactor(web): share the cursor page query builder`

- [ ] **47. `uk.json` → `uk/*.json` (W6)**
  - `shared/i18n/uk.json` → `shared/i18n/uk/{app,common,errors,auth,profile,session,dialogue,transcript,report,vocabulary,mistakeCategories,nav,pages}.json` (13 верхніх ключів; значення без змін); нове `shared/i18n/resources.ts` (збирає об'єкт `{ uk: { translation: {...} } }`, структура ідентична попередньому JSON); `shared/i18n/index.ts` імпортує `resources.ts`.
  - Перевірка: `i18n.test.ts` + порівняння: скрипт у scratchpad порівнює результат злиття з вмістом старого `uk.json` з `main` (deep equal, ключі в тому ж порядку) – має бути ідентичний; `pnpm --filter web build`.
  - Коміт: `refactor(web): split the uk translation into per-area json files`

- [ ] **48. Типізація ключів i18n `[risk]` (W6)**
  - Context7 (react-i18next 18): `CustomTypeOptions { defaultNS, resources }`; `shared/i18n/i18next.d.ts`.
  - ~20 місць зі `string`-ключами (`dialogue-errors.ts`, `session-errors.ts`, `profile-errors.ts`, `report-errors.ts`, `word-errors.ts`, `mistake-errors.ts`, `use-error-text.ts` та ін.) типізувати ключем (`TranslationKey` або `Record<…, TranslationKey>`); без зміни поведінки.
  - Перевірка: `pnpm typecheck`; негативна перевірка: тимчасовий неіснуючий ключ дає помилку typecheck (відкотити).
  - Коміт: `refactor(web): type translation keys from the uk resources`

- [ ] **49. Web-правила в `error`, PR3 завершено**
  - `eslint.config.js`: зони `entities`, підобласті фіч, `shared/testing`, `no-cycle` → `error`. Перевірка тимчасовими порушеннями: `shared → entities`, `entities/a → entities/b`, `features/dialogue/recording → features/dialogue/hint`, `shared/testing → features`; кожне дає помилку; відкотити.
  - Фінальна перевірка PR3 (повний набір, Playwright MCP 390 px: login → старт → відповідь → підказка → завершення → звіт).
  - Таблиця «старий шлях → новий» для тестів web (`git diff -M --name-status main HEAD -- apps/web e2e`) додається в задачі 54.
  - Коміт: `refactor(web): enforce layer, entity and slice boundaries as errors`

---

# PR 4: документи (гілка `refactor/structure-v2-docs`)

- [ ] **50. `CLAUDE.md`: «Структура коду»**
  - Переписати розділ за правилами spec v2: шари web з `entities`, правила підобластей, `testing/`, компонент-папка («імпортується поза папкою → власна папка»), api: корінь = публічний API, `persistence/` для всіх repositories, `auth/decorators/` публічний, відмова від «≥2 файлів», `apps/api/test/integration/<module>/`; перелік модулів API (auth, profile, learner-model, session, dialogue, hint, analysis, vocabulary, report); `ProvidersModule` → `AdaptersModule`; прибрати «`apps/api/test/` не реорганізуємо»; «Модуль NestJS = доменна область… cards» узгодити з кодом.
  - Коміт: `docs: update code structure rules in CLAUDE.md for v2`

- [ ] **51. `docs/tech-decisions.md`**
  - Доповнення рішення 29 (§6) таблицею «Структура v2»: чому `entities/session` (а не дві сутності), чому «finish» у report, чому промпти лишаються в API, чому приватні підпапки модулів і відмова від «≥2 файлів», чому `test/integration/<module>/`, що свідомо не робимо.
  - Коміт: `docs: record structure v2 decisions`

- [ ] **52. README, WORKFLOW, reviewer, KICKOFF (R2)**
  - `README.md` – дерево структури; `docs/WORKFLOW.md` – шляхи; `.claude/agents/reviewer.md` – перевірка меж модулів і шарів за новими правилами; `.claude/skills/db-migration/SKILL.md` – шляхи, якщо змінились; `KICKOFF.md` прочитати перед переносом (унікальне перенести в `docs/product.md`/`tech-decisions.md`), потім `git mv KICKOFF.md docs/archive/KICKOFF.md`; посилання в `CLAUDE.md` оновити.
  - Коміт: `docs: refresh README, workflow and reviewer rules, archive kickoff`

- [ ] **53. `docs/backlog.md`: тріаж (R1)**
  - Видалити закриті рядки (таблиця нижче), перелічити їх у цьому файлі; решту згрупувати за областями (безпека/деплой, тести, UX, мовна модель) без зміни змісту; оновити застарілі шляхи в рядках, що лишаються.
  - Коміт: `docs: triage backlog after structure v2`

- [ ] **54. Таблиця «старий шлях → новий» для всіх тестів (R5, лаба 9)**
  - Побудувати з git: `git diff -M --name-status main HEAD` по `apps/api/src`, `apps/api/test`, `apps/web/src`, `packages/shared/src`, `e2e` для файлів `*.test.*` і `*.spec.*`; додати таблиці нижче (api/src, shared, web, e2e); для файлів, що розбиті або об'єднані, вказати «старий → нові». Кількості тестів: до / після за пакетами.
  - Коміт: `docs: record test file move tables for structure v2`

## Тріаж backlog (R1)

Рядки `docs/backlog.md` (номер = рядок файлу до тріажу).

| Рядок | Дія | Де закривається |
|---|---|---|
| 9–14 | уже виконані (`set-cookie` у REDACT, `assertTestDatabaseUrl`, `_journal.json`, `COLLATE "C"`, кирилиця в `.env.example`): видалити | – |
| 26 | закрито: `STT_PROVIDERS`/`LLM_PROVIDERS` у shared | задача 04 |
| 50 | закрито: розбиття `session.test.ts` | задача 07 |
| 54 | частково: розбиття `all-exceptions.filter.test.ts`; решта (sanitize `ZodError`, pino-серіалізатор, regex) лишається | задача 33 |
| 55 | частково: `analysis-result-schema.ts` переїхав у `language-model/testing/`; уніфікація констант «кращі ≤ 2» лишається | задача 10 |
| 60 | частково: розбиття `dialogue-answer.test.ts`; недетермінованість, rollback-тест лишаються | задача 33 |
| 62 | частково: дубль `lockSession`/`lockActiveSession` і `TurnService` → чужий репозиторій; решта про `is_false` тести лишається | задачі 13, 20 |
| 65 | закрито: доменні моки в `testing/` зрізів, `deferred()` у `shared/testing` | задачі 36, 40 |
| 67 | частково: розбиття `dialogue-answer.test.ts`; коментарі й `void body` лишаються | задача 33 |
| 78 | закрито: `pageQueryString` у `shared/api` | задача 46 |
| 79 | частково: `translateHint` у `support/dialogue.ts`; `aria-labelledby` для `sessionWords` лишається | задача 45 |
| нові | рядки, знайдені під час рефакторингу (баги, відкладені пункти) | у момент знахідки |

## Таблиці переміщень (заповнюються в задачі 54)

Формат як у `refactor-structure.tasks.md`: «Старий шлях | Новий шлях», шляхи від кореня відповідного пакета; розбиті файли «старий → нові». Таблиця api/test вже наведена в PR 2 і лише звіряється.

### api/src і packages/shared

| Старий шлях | Новий шлях |
|---|---|
| _(заповнити з `git diff -M` у задачі 54)_ | |

### web і e2e

| Старий шлях | Новий шлях |
|---|---|
| _(заповнити з `git diff -M` у задачі 54)_ | |
