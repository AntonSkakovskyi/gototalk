# Рефакторинг структури v2

Гілки: чотири послідовні, кожна від `main` після злиття попередньої (див. «PR-розбиття»). Задачі: `docs/specs/refactor-structure-v2.tasks.md`. Попередня ітерація: `docs/specs/refactor-structure.md` (v1, виконано).

## Мета
MVP (spec 00–05) готовий. Перед реальними адаптерами Deepgram і Gemini наводимо лад: межі модулів, розкладка файлів, дублювання, непослідовність. Аудит v2 показав, що v1 розклав файли за шарами, але не закрив межі між модулями: 17 імпортів із приватних `persistence/` і `lib/` чужих модулів, тестовий шар web змішаний із доменом, ESLint цього не бачить.

## Незмінні обмеження
- Нуль зміни поведінки й HTTP-контрактів: шляхи ендпоінтів, коди помилок, формати відповідей, БД і міграції незмінні.
- Наявні тести не слабшають, їхня кількість не зменшується (видалення явно застарілих – лише з поясненням у tasks). Базу записує задача 00.
- Переміщення лише через `git mv`; імпорти виправляються в тому самому коміті. Кожен коміт зелений: `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Без barrel-файлів у застосунках, без Nx, без повного FSD (`widgets`, `processes`, сегменти `model/ui`), без обгорток над Mantine.
- Нові залежності лише за погодженням власника. Цей план нових залежностей не потребує.
- Не чіпаємо `db/migrations/*`, `db/seed.sql`, історичні `docs/specs/00–05*` (крім оновлення шляхів, де вказано в задачах), `docs/specs/test-cases.md`.
- Шляхи від `import.meta.url` (`app-config.module.ts` → `.env`, `password-hasher.test.ts` → `seed.sql`, `schemas.test.ts` → міграція 0002) перераховуються під нову глибину.

## Аудит: що підтверджено, уточнено, знайдено нового
Скорочений підсумок; докази (файл:рядок) наведено в задачах, де відповідний пункт розв'язується.

| Код | Статус | Суть |
|---|---|---|
| A1 | уточнено | 17 міжмодульних імпортів у приватні `persistence/`/`lib/`; нові: `analysis → session/lock-session`, `analysis → session/mistake-view`; `lockSession` і `lockActiveSession` дублюють одне одного |
| A2 | уточнено | DI-граф ациклічний, цикл лише файловий (`session → report → analysis → session`); `POST :id/finish` переїжджає в report |
| A3 | підтверджено | `me` не окремий домен; `hint` і `learner-model` самодостатні й мають власні контролери |
| A4 | підтверджено | `integrations/language-model/` = 29 файлів одним шаром |
| A5 | підтверджено | 28 `@Api*` декораторів, 12 ручних схем, схем відповідей немає |
| A6 | підтверджено | `common/` 11 файлів одним шаром |
| A7 | уточнено | `core-services.test.ts` не мертвий (DI-smoke `[TC-00-04]`): зливається в `app.module.test.ts` |
| A8 | нове | ESLint для API без `no-cycle` і без правил «модуль → модуль» |
| P1 | уточнено | 30 файлів `packages/shared` одним рівнем; `ERROR_CODES` в `auth.ts`; API-only схеми в `llm.ts`; `BetterPhrasingSchema` і `PlanSchema` – контракт, лишаються |
| P2 | уточнено | у шаблонах лише `{{input}}`; рендер лишається в API |
| W1 | підтверджено + нове | `shared/api/session-details` імпортують 4 фічі й 2 сторінки; `shared/testing/answer-flow-setup.tsx` імпортує фічу (порушення шару, ESLint виключає `shared/testing/**`) |
| W3 | уточнено | усі 7 компонентів уже в папках; розходиться текст CLAUDE.md; 3 підкомпоненти імпортуються поза папкою батька |
| W4 | уточнено | `dialogue`: підобласті `recording/` і `hint/`; `profile` не ділимо |
| W5 | підтверджено | `pages/dialog` ↔ `features/dialogue`, `pages/session` = index-маршрут |
| W6 | уточнено | `uk.json` 491 рядок; типізація ключів зачепить ~44 динамічні `t()` |
| W7, W8 | нове | захардкоджений список фіч з неіснуючими `history`, `cards`; дубль query-string пагінації |
| R1–R3 | уточнено | backlog: рядки 9–14 виконані, ~10 закриваються рефакторингом; `KICKOFF.md` → archive; хук `run-tests.ps1` уже в робочому дереві |

## Цільові структури

### packages/shared/src
```
index.ts                         єдиний публічний вхід (export * з файлів нижче); subpath exports не вводимо
common/errors.ts (+test)         ← errors.ts + ERROR_CODES/ErrorCode з auth.ts
common/health.ts (+test)         ← health.ts
common/pagination.ts (+test)     ← pagination.ts
common/providers.ts              нове: STT_PROVIDERS, LLM_PROVIDERS (дедуп з env.schema.ts)
auth/auth.ts (+test)             ← auth.ts (без ERROR_CODES)
profile/profile.ts (+test)       ← profile.ts
session/session.ts (+tests)      ← session.ts
session/plan.ts                  ← plan-bounds.ts + PlanSchema з llm.ts
analysis/analysis-view.ts        ← analysis-view.ts
analysis/mistake-categories.ts   ← mistake-categories.ts
analysis/better-phrasing.ts      ← BetterPhrasingSchema з llm.ts
dialogue/dialogue.ts, audio.ts, hint.ts (+tests)
report/report.ts (+test)
vocabulary/words.ts (+test)
```
Решта `llm.ts` (+ `llm.test.ts`) переїжджає в API (нижче). `schemas.test.ts` розподіляється по доменних тестах.

### packages/prompts
Розкладка без змін. Реєстр і перевірка лежать в API.

### apps/api/src
```
main.ts, configure-app.ts, app.module.ts, app.module.test.ts (+ DI-smoke із core-services.test.ts)
core/                            без змін
common/
  pipes/       zod-body.pipe.ts, zod-query.pipe.ts (+tests)
  decorators/  public.decorator.ts
  pagination/  keyset-cursor.ts, keyset-page.ts (+tests)
  errors/      language-model-http-errors.ts (+test)
  swagger/     api-zod.decorators.ts (+test): ApiZodBody, ApiZodQuery, ApiZodResponse
integrations/
  adapters.module.ts (+test)     ← providers.module.ts (клас AdaptersModule)
  fake-consistency.test.ts       лишається
  speech-recognition/
    speech-recognition.port.ts, speech-recognition.errors.ts, transcript.ts (TranscriptSchema ← shared/llm.ts)
    clean-transcript.ts (+test)
    fake/  fake-speech-recognition.ts (+test), fake-transcripts.ts, STT-кейси з fake-adapters.test.ts і fake-fail-modes.test.ts
  language-model/
    language-model.port.ts
    language-model.errors.ts      + LanguageModelInvalidResponseError з validated-call.ts
    validated-call.ts (+test)
    model-output.ts (+test)       ← Mistake/AnalysisEnvelope/Turn/Hint/Summary + ANALYSIS_MAX_* з shared/llm.ts
    prompts/  prompt-registry.ts (← prompts.ts + session-plan-prompt.ts), load-prompt.ts (← prompt-loader.ts), render-prompt.ts (+tests)
    fake/     fake-language-model.ts + тести, fake-analysis*.ts, fake-hints.ts, fake-next-turn.ts, fake-session-plans.ts, fake-summary.ts, fake-verb-forms.ts
    fake/testing/  fake-analysis-rule-cases.ts
    testing/       analysis-result-schema.ts ← integrations/testing/
modules/   (корінь модуля = публічний API; підпапки приватні)
  auth/          + me.controller.ts, me.service.ts ← me/ (MeModule зникає, маршрути /me ті самі)
  profile/       profile.*, goals.*, persistence/{goals,profiles}.repository
  learner-model/ нове: module, controller (GET profile/learner-model), service(+t), types, mapper, persistence/
  vocabulary/    + word-view.ts (публічний мапер), + vocabulary-writer.service.ts (нове)
  session/       session.errors.ts (+SessionNotFoundError/SessionFinishedError/toSessionHttpError), session-lock.ts, mistake-view.ts,
                 plan-questions.ts; sessions.service.ts (−finish, +findDetails), sessions.controller.ts (−POST :id/finish);
                 lib/ (plan-input, session-view); persistence/sessions.repository.ts
  analysis/      analysis-writer.service.ts ← persistence/analysis-writer.ts
  hint/          нове: module, hints.controller, hints.service(+t), persistence/hints.repository
  dialogue/      module, controller, errors, answers/turn/next-turn services; audio/; lib/; persistence/; testing/
  report/        + session-finish.controller.ts (POST sessions/:id/finish, @ApiTags('sessions')), + session-finish.service.ts
```
DAG модулів (дозволені імпорти): `auth` ← усі; `profile`, `learner-model`, `vocabulary` → `auth`; `session` → `profile`, `learner-model`; `analysis` → `session`, `vocabulary`; `hint` → `session`, `vocabulary`; `dialogue` → `session`, `analysis`, `vocabulary`; `report` → `session`, `analysis`, `vocabulary`.

### apps/api/test
`test/integration/<module>/…` за мапінгом у tasks.md (розділ «Таблиця переміщень: api/test»); `global-setup.ts` і `support/` лишаються. `vitest.config.ts`: integration `include: ['test/integration/**/*.test.ts']`.

### apps/web/src
```
app/        без змін + app/testing/guard-test-helpers.tsx
pages/      home/HomePage ← session/SessionPage; dialogue/DialoguePage ← dialog/DialogPage; report/testing/report-page-setup.ts
features/
  dialogue/  api/, components/, hooks/, lib/ (+turn-cache.ts ← details-cache.ts), recording/, hint/, testing/
  profile/   testing/ ← тестові хелпери з components/*
  report/    testing/
  session/   components/SessionListItem/ ← RecentSessions/SessionListItem; testing/
  vocabulary/ testing/; api/words-api використовує shared/api/page-query
  auth/      без змін
entities/session/   api/, lib/, hooks/, components/, testing/ (← shared/api, shared/hooks, shared/router, shared/ui)
shared/
  api/ (+page-query.ts), auth-session/ ← session/, forms/, hooks/use-focus-when.ts, router/safe-path.ts, styles/, ui/{LoadError,LoadMoreFooter,SectionSkeleton}
  i18n/ index.ts, languages.ts, resources.ts, i18next.d.ts, uk/*.json ← uk.json
  testing/ LocationProbe, mock-api, query-wrapper, test-utils, deferred.ts, http-responses.ts, fixtures/*
```
e2e: `dialog.spec.ts` → `dialogue.spec.ts`, `support/dialog.ts` → `support/dialogue.ts`; `translateHint` → `support/dialogue.ts`.

## Правила (потрапляють у CLAUDE.md у PR4)
**Api**
- Корінь модуля = публічний API (module, controllers, services, errors, types, публічні чисті хелпери); `auth/decorators/` теж публічний. Підпапки (`persistence/`, `lib/`, `guards/`, `testing/`, підобласті на кшталт `audio/`) приватні: з іншого модуля не імпортуються.
- Усі repositories лежать у `persistence/`, навіть єдиний. Правило «підпапка лише за ≥2 файлів» скасовується.
- Беззалежнісні транзакційні хелпери (lock) лишаються чистими функціями в корені модуля; транзакційні записи із залежностями – методи експортованих сервісів.
- Самодостатня підобласть із власним контролером стає окремим модулем Nest.
- Межі між модулями задає DAG вище; ESLint генерує зони з `readdirSync` і мапи `API_MODULE_DEPS`; `import-x/no-cycle` для API.

**Web**
- Шари `app → pages → features → entities → shared`, імпорти лише вниз; сутність не імпортує іншу сутність; фіча не імпортує іншу фічу.
- Фіча з самодостатньою підобластю (імпортує з решти фічі лише `api/` і кореневі `lib/`, ≥6 файлів) виносить її в підпапку з тими самими сегментами; підобласті одна одну не імпортують.
- Компонент, який імпортують поза його папкою, має власну папку; приватні підкомпоненти лежать у папці батька.
- Тестові хелпери лежать у `testing/` свого зрізу; `shared/testing` під перевіркою меж (лише `shared` і `@gototalk/shared`).

**Тести**: файл ≲ 400 рядків; інтеграційні api в `test/integration/<module>/`.

## Свідомо НЕ робимо
Nx; повний FSD (widgets/processes, сегменти `model/ui`, Steiger); обгортки над Mantine; barrel у застосунках; subpath exports `packages/shared`; `@nestjs/event-emitter`; DI-сервіс для `lockSession`; поділ `features/profile`; розбиття тест-файлів 300–400 рядків; зміну URL, кодів і відповідей; поведінкові пункти backlog (rate limit, леми тощо); TS-пакет `prompts` із білдом.

## Ухвалені рішення (власник погодив рекомендовані варіанти)
1. **W1 – шар `entities/` з єдиною сутністю `session`** (агрегат session + utterance + mistake, дзеркало API `/sessions/:id/...`). Відкинуто: дві сутності з дозволом `utterance → session` (зайве дрібнення сьогодні); `shared/domain/` (лишає змішування в `shared`).
2. **A2 – оркестрація «finish + звіт» у report** (`SessionFinishService` + `SessionFinishController` на тому самому `POST /sessions/:id/finish`). Відкинуто: `@nestjs/event-emitter` (нова залежність, прихований зв'язок, finish чекає на звіт синхронно); інверсія через токен-порт session (потребує глобального модуля).
3. **P1/P2 – у shared лишаємо контракт** (`BetterPhrasingSchema`, `PlanSchema`), API-only схеми переїжджають в API, завантаження й рендер промптів лишаються в API; тест реєстру: кожен id резолвиться, кожен `.md` пакета зареєстровано, рівно один `{{input}}`. Відкинуто: TS-пакет `prompts` з білдом.
4. **PR-розбиття – чотири гілки.** Відкинуто: три гілки (api ≈ 215 файлів у першій, важке рев'ю).

## PR-розбиття
1. `refactor/structure-v2` – тулінг + packages + api/src (≈ 150 файлів).
2. `refactor/structure-v2-api-tests` – api/test (≈ 65).
3. `refactor/structure-v2-web` – web + e2e (≈ 190).
4. `refactor/structure-v2-docs` – правила в `error`, документи, backlog (≈ 12).
Кожну наступну гілку створюємо від `main` після злиття попередньої. Злиття PR робить людина.

## Обсяг і ризики
≈ 410 файлів (≈ 70 % – `git mv` + імпорти), 55 задач (00–54). Ризики з позначкою `[risk]` у tasks:
- **DI:** нові `HintModule`, `LearnerModelModule`, злиття `MeModule` в auth, `VocabularyWriter`, `SessionFinish*`: помилки видно лише в рантаймі. Зменшуємо DI-smoke «резолвить усі controllers і providers» (задача 03, першою в PR1) + `pnpm dev`.
- **Маршрути:** два контролери з префіксом `sessions` у різних модулях; перевірка e2e + тест `/api/docs-json`.
- **Swagger:** `z.toJSONSchema` для `coerce/default/refine/transform` (`io: 'input'` для body/query, `'output'` для відповідей); `ApiZodResponse` лише збагачує документацію.
- **Рантайм-шлях промптів:** `require.resolve('@gototalk/prompts/<id>.md')` з нового `prompts/load-prompt.ts`; шляхи `import.meta.url` у тестах після зміни глибини.
- **ESLint-зони:** генерація з `readdirSync` і `basePath` на Windows; нові правила спершу `warn`.
- **i18n-типізація:** ~20 місць зі `string`-ключами; помилка лише в typecheck, не в рантаймі.
- **Хук `run-tests.ps1`:** `-match 'vitest'` спрацьовує й на вічно запущеному Vitest у VS Code, тож хук може мовчки нічого не перевіряти (зафіксовано в коментарі-«чому»).
- Спільна тестова БД: повні `pnpm test` не паралелити з іншим процесом тестів.

## Готово, коли
- Структура збігається з наведеною; `git log --follow` показує історію переміщених файлів.
- ESLint: усі нові правила в `error`; тимчасові порушення (імпорт `persistence/` чужого модуля, `features → features`, `shared → entities`, цикл) дають помилку, і це перевірено.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` зелені; кількість тестів за пакетами не менша за базу задачі 00.
- `pnpm build`, `pnpm test:e2e` зелені; `pnpm db:pull` не дає diff; `pnpm dev` стартує без помилок DI, `/api/health` і `/api/docs-json` відповідають.
- Оновлені CLAUDE.md («Структура коду»), `docs/tech-decisions.md` (доповнення рішення 29 «Структура v2»), README, `.claude/agents/reviewer.md`, `docs/backlog.md` (тріаж), таблиці «старий шлях → новий» для всіх тестів.
