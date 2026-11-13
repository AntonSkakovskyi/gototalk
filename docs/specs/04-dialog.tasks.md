# 04. Діалог із голосом: задачі

Специфікація: `docs/specs/04-dialog.md`, Fake: `docs/specs/stubs.md` (1, 2.1, 2.3, 2.4, 2.6, 3). Тест-кейси: `docs/specs/test-cases.md`. Гілки: `feat/04-dialog` (частина 04a), `feat/04-dialog-voice` (частина 04b).
Одна задача = один сабагент. Після задачі: зелені `pnpm typecheck` і `pnpm lint` (повний `pnpm test` на межах блоків і у фіналі), потім `reviewer` для `[risk]`, відмітити чекбокс і зробити коміт (Conventional Commits).
Позначки: `[risk]` рев'ю одразу; `[UI]` перевірка Playwright MCP на 360 px; `[e2e]` прогін `pnpm test:e2e`; **[Антон]** потребує ручної дії.

**Відхилення від запиту.** Окремий крок «записати tasks.md й зупинитись» пропущено: схвалення плану через ExitPlanMode не відбулось, але реалізацію замовлено прямою командою. tasks.md записано з плану й одразу почато частину 04a.

**База тестів (старт 04a, `main` після #5):** shared 58, web 405, api 414, e2e 17. Кількість тестів не зменшується.

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

*Тести.* TDD для доменної логіки й сервісів: спершу тест, що падає. Тести перевіряють поведінку, а не реалізацію; без snapshot-ів; без sleep (час через інжектований годинник). Назва кожного тесту починається з `[TC-04-NN]`. Фікстури й фабрики перевикористовуй (`test/support/user-data.ts`, `shared/testing`). Наявні тести не послаблюй; кількість тестів не зменшується (база записана нижче).

*Безпека й приватність.* Жодних секретів і ключів у коді чи логах; не читай `.env`; у логах немає вільного тексту користувача (цілі й сцени це користувацькі дані).
*Зміни для spec 04.*

- **Reference:** backend `modules/session` (сервіс, `sessions.repository.ts` з транзакцією й блокуванням, `session.errors.ts`), `integrations/language-model` (`requestValidated`, `prompt-loader`, `session-plan-prompt`); web `features/session`, `shared/ui`, `shared/testing` (`mock-api`, `session-mocks`, `query-wrapper`).
- **Аудіо:** лише в пам'яті (multer `memoryStorage`), ліміт розміру (`MAX_AUDIO_BYTES`) і тривалості (`MAX_RECORDING_SECONDS`, клієнт зупиняє запис; сервер обмежує розміром), білий список MIME + перевірка сигнатури файлу; на диск і в БД нічого, крім `DEV_KEEP_AUDIO=true` (лише `NODE_ENV=development`, абсолютний `DEV_AUDIO_DIR` поза репозиторієм); тіло запиту й аудіо не логуються.
- **Prompt injection:** користувацький текст (відповідь, власна тема, питання плану з клієнта, слово для перекладу) лише як JSON у єдиному `{{input}}` у блоці даних; промпт прямо каже ігнорувати інструкції в даних. Модель не може вийти за `mistake_categories` чи `text_verbatim`: такі помилки відкидаються поштучно, відповідь не падає.
- **Порт:** усі методи `LanguageModelPort` повертають `unknown` і проходять `requestValidated` зі схемою з shared.
- **Внутрішній `ZodError`** (відповідь LLM, рядок БД) – 500 з логом без значень; 400 `VALIDATION_ERROR` лише для тіла запиту.
- **Стан сесії** (репліка, `seq`, аналіз, завершення) змінюється в транзакції з блокуванням рядка сесії (`FOR UPDATE`); паралельні запити не дають дублікатів `seq`; відповідь у завершену сесію → 409 `SESSION_FINISHED`.
- **UI запису:** керування з клавіатури, `aria-live` для станів, помилки розрізняються не лише кольором (підкреслення + маркер, `[TC-04-14]`), зупинка всіх tracks при розмонтуванні й після стопу.


## Політика перевірок

Сабагент запускає лише зачеплене й залежне:
- тести, пов'язані зі зміненими файлами: `pnpm --filter <web|api> exec vitest related --run <змінені вихідні файли>` плюс нові тест-файли задачі; інтеграційні api: `pnpm --filter api exec vitest run --project integration test/<файл>.test.ts`;
- лінт змінених файлів: `pnpm exec eslint <файли>`;
- typecheck зачепленого пакета: `pnpm --filter <web|api> typecheck`;
- зміна `packages/shared` або `packages/prompts`: спершу збірка й тести пакета, потім typecheck обох застосунків і `vitest related` по файлах, що імпортують змінений контракт.
Повні `pnpm test`, `pnpm lint`, `pnpm test:e2e` і Playwright MCP сабагент не запускає (Playwright MCP лише в `[UI]`, лише для свого екрана на 360 px).
Оркестратор після кожної задачі: `pnpm typecheck && pnpm lint` на весь репо. Повний `pnpm test`: на межах блоків (після 03-08, після 03-14) і у фіналі. `pnpm test:e2e`: у задачах `[e2e]` і у фіналі. Рев'ю: кожна `[risk]` окремо; решту блоку `reviewer` дивиться разом на межі блоку.
Межі блоків (повний `pnpm test`): після 04-08, 04-15, 04-22 (04a); 04-26, 04-30 (04b).

## Погоджені рішення (з обґрунтуванням і відкинутим)

**a. Обробка відповіді – два синхронні кроки** (погоджено).
- Крок 1 `POST /api/sessions/:id/utterances` (JSON `{ text }` у 04a, multipart `audio` у 04b): попередня перевірка сесії без блокування (щоб не слати аудіо провайдеру даремно) → STT поза транзакцією (лише голос) → транзакція: `SELECT … FROM sessions WHERE id AND user_id FOR UPDATE`, `active` (інакше 409 `SESSION_FINISHED`), остання репліка `assistant` (інакше 409 `ANSWER_NOT_EXPECTED`: подвійна відправка, незавершений крок 2), `seq = max + 1`, INSERT `user` з `analysis_status = pending`, облік вжитих слів (рішення h). 201 `Utterance`.
- Крок 2 `POST /api/sessions/:id/utterances/:utteranceId/analysis`: ідемпотентний. Якщо аналіз уже `done`/`failed` і відповідь `assistant` (seq + 1) уже є або сесія завершена – повертає збережене без виклику моделі. Інакше паралельно (`Promise.allSettled`) лише відсутні частини: аналіз (якщо `pending`) і `nextTurn` (якщо немає відповіді, репліка остання й сесія `active`). Виклики моделі поза транзакцією; потім транзакція з `FOR UPDATE` на рядку сесії, повторна перевірка стану й запис лише того, чого ще немає (`UPDATE … WHERE analysis_status = 'pending'`, INSERT відповіді лише якщо `seq + 1` вільний). Паралельні виклики серіалізуються блокуванням на записі: другий бачить записане й повертає його, дублікатів немає. Уточнення до відповіді: блокування не тримається під час виклику моделі (інакше з'єднання пулу й транзакція висять секунди); ціна – за справжньої гонки модель може бути викликана двічі, рядки ні.
- Збої: дві невалідні відповіді аналізу → `failed` (термінальний, як у spec), `nextTurn` все одно зберігається. Недоступність моделі (`LanguageModelUnavailableError`) → записується те, що вдалося, потім 503 `LANGUAGE_MODEL_UNAVAILABLE`; репліка лишається `pending`, повтор кроку 2 доробляє решту (`[TC-04-08]`). Невалідний `nextTurn` двічі → 502 `LANGUAGE_MODEL_INVALID_RESPONSE`, повтор можливий.
- Клієнт: «Розпізнаю…» = крок 1 голосу, «Аналізую…» = крок 2 (справжні запити, `[TC-04-12]` чесний). На завантаженні сторінки, якщо остання репліка `user` без відповіді, клієнт сам викликає крок 2 (відновлення після закриття вкладки чи збою).
- Відкинуто: один синхронний POST (стани імітуються), фон у процесі з опитуванням (відновлення після рестарту, фонові помилки, флейки в тестах). Відхилення від формулювання CLAUDE.md «аналіз запускається одразу після транскрипції»: його запускає клієнт одразу після кроку 1; репліка, покинута між кроками, лишається `pending` до наступного відкриття (рядок backlog для 05: finish доаналізовує `pending`).

**b. Два PR послідовно** (погоджено). 04a – `feat/04-dialog` (~75 файлів): контракти, міграція 0004, промпти, Fake-аналіз/`nextTurn`/STT-адаптер, текстова відповідь, аналіз і патерни, слова → `active`, `is_false`, завершення, підсвічування, мінімальний екран після завершення, e2e `[TC-04-04]`, `[TC-04-11]`. 04b – `feat/04-dialog-voice` від гілки 04a (~40 файлів): multipart, приватність аудіо, запис голосу, підказки й слова, e2e `[TC-04-05]`, `[TC-04-12]`, ручні `[TC-04-06]`. PR 04b відкривається проти `main` після злиття 04a (до того – проти `feat/04-dialog`). Один tasks.md на обидві частини.

**c. Позиції – UTF-16 code units із вирівнюванням** (погоджено). Контракт (JSDoc `MistakeSchema` і промпт): 0-based offsets у `text_verbatim` в UTF-16 code units, `end` не включно, `text.slice(start, end) === original` на api і web. Позиції моделі – лише підказка: `alignMistakes(text, mistakes)` лишає помилку, якщо slice збігається; інакше шукає всі точні входження `original` і бере найближче до `start`; немає входжень → помилку відкинуто (у лог лише кількість). Потім сортування за `start`, перетин із попередньою → відкинуто. Web додатково захисно пропускає невалідні/перетинні діапазони. Відкинуто: строге відкидання (губить правильні помилки реальної моделі), code points (перетворення на обох боках без вигоди для англійського тексту).

**d. Кращі формулювання – міграція 0004** (погоджено): `utterances.better_phrasings jsonb NOT NULL DEFAULT '[]'` + CHECK масиву. Показ під транскриптом у `immediate`, у звіті/«В кінці» – з БД. Seed і `insertUserData` працюють завдяки DEFAULT.

**Мої рішення.**
- **e. Валідація відповіді аналізу двоярусна.** `requestValidated(AnalysisEnvelopeSchema)` перевіряє лише форму (`{ mistakes: unknown[] ≤ 30, better: unknown[] ≤ 5 }`; невалідна → повтор → `failed`); далі кожна помилка `MistakeSchema.safeParse` і кожне формулювання окремо, невалідні (чужа категорія, порожній `original`, довжини) відкидаються, потім `alignMistakes`, `better` обрізається до 2. Так вимога «чужа категорія не валить відповідь» виконується, а `[TC-04-01]` «лише валідний JSON» – на рівні конверта. Відкинуто: один строгий `AnalysisResultSchema` (одна погана помилка → `failed` усієї репліки). Межі в `MistakeSchema`: `original`/`suggestion` ≤ 200, пояснення ≤ 500.
- **f. Метадані аналізу.** `analyzeUtterance` повертає `{ output: unknown, promptVersion, model }`; Fake рендерить `error-analysis.v1` і дає `model = 'fake'`, тож `analysis_prompt_version = 'error-analysis.v1'` (ім'я промпту, рішення 34), а не `fake-v1` зі `stubs.md` (виправити `stubs.md` і seed). Відкинуто: сервіс знає id промпту (протікання деталей адаптера).
- **g. Патерни.** +1 за кожну збережену помилку категорії (`INSERT … ON CONFLICT (user_id, category) DO UPDATE SET frequency = frequency + EXCLUDED.frequency, last_seen_at = clock_timestamp() RETURNING id`, `pattern_id` у `mistakes`), у тій самій транзакції, що й помилки. Інваріант: `frequency` = кількість не-хибних помилок (плюс засіяне). `is_false`: `PATCH /api/sessions/:id/mistakes/:mistakeId { isFalse: true }`, транзакція: `UPDATE mistakes … WHERE is_false = false RETURNING category` (ідемпотентно), далі `frequency = GREATEST(frequency - 1, 0)` за `(user_id, category)`. Скасування позначки не робимо (YAGNI, spec не вимагає). Відкинуто: +1 на репліку (не узгоджується з декрементом на одну хибну помилку).
- **h. Слово → `active`.** Застосовується в транзакції кроку 1 (залежить лише від `text_clean`, не від успіху аналізу). Токенізація `text_clean`: `[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*`, нижній регістр, `’`→`'`; n-грами 1..4 токенів через пробіл; один `UPDATE words SET times_used = times_used + 1, last_used_at = clock_timestamp(), state = CASE WHEN state IN ('passive','partial') THEN 'active' ELSE state END WHERE user_id = $1 AND state <> 'active' AND lower(lemma) = ANY($2)` (індекс `uq_words_user_lemma`). Межі слів дає токенізація, без лематизації (`meetings` ≠ `meeting`; рядок backlog: леми від моделі). Відкинуто: завантаження словника в JS (правило «агрегати в SQL»), регулярки в SQL.
- **i. Наступне питання.** Залишок плану = питання `plan.questions`, тексту яких ще немає серед реплік `assistant` (точний збіг). Це узагальнює домовленість 03 «індекс = кількість assistant-реплік» і лишається правильним, якщо реальна модель вставить уточнення посеред плану. `NextTurnInput { topic, remainingQuestions, history }`; Fake: перше з `remainingQuestions` або уточнення за `stubs.md` 2.3. Сесія «вичерпана», коли `remainingQuestions` порожній: `SessionDetails.planRemaining` (0 для `plan = NULL`), UI показує «Питання плану закінчились» і виділяє «Завершити», уточнення тривають до завершення.
- **j. Завершення.** `POST /api/sessions/:id/finish` → 200 `Session`, ідемпотентно (`UPDATE … WHERE status = 'active'`; повторний дає збережений стан, `ended_at` не змінюється). 05 додасть звіт у той самий ендпоінт. Без згоди (у 04 нічого не передається; 05 додасть гард, бо викликає модель). UI: підтвердження в модалці → `/sessions/:id/report`.
- **k. Екран після завершення до 05:** `pages/report/ReportPage` – тема, кількість відповідей, тривалість і всі відповіді з підсвіченими помилками й кращими формулюваннями (той самий `Transcript`), тож режим «В кінці» показує помилки вже в 04. 05 додає самарі, «Детально», позначки слів. Без тексту-заглушки «буде пізніше». Завершена сесія на `/sessions/:id` – історія лише для читання + «До звіту».
- **l. Показ за режимом – на клієнті.** API завжди повертає помилки; `deferred` не рендерить підсвічування й формулювання в діалозі (`[TC-04-11]`), звіт показує все. Відкинуто: приховування на сервері (той самий ресурс для звіту).
- **m. Згода.** `@RequiresConsent()` на кроці 1, кроці 2 і підказках (дані йдуть провайдерам). `PATCH` помилки й `finish` без гарда. Видалений користувач: гард → 401; маршрути без гарда → 404 (сесію каскадно видалено). Закриває частину 04 у рядках backlog про `@RequiresConsent` і JWT.
- **n. Модулі api.** `analysis`: `MistakeAnalyzerService.analyze`, `lib/align-mistakes.ts`, `lib/pattern-increments.ts` (замінює `groupIntoPatterns`), `mistakes.controller/service/repository` (`is_false`). `dialogue`: `dialogue.controller.ts` (кроки 1–2, у 04b підказки), `answers.service.ts`, `turn.service.ts`, `next-turn.service.ts` (замінює заглушку `DialogueService`), `persistence/dialogue.repository.ts`, `dialogue.errors.ts`. `vocabulary` (новий): `lib/word-usage.ts`, `persistence/words.repository.ts` з методами, що приймають `DbExecutor` (БД або транзакцію). `session`: `finish`, `planRemaining`. Тип `Tx`/`DbExecutor` переноситься в `core/db/db.tokens.ts` (друге використання). `LearnerModelService.applyAnalysis` і `ApplyAnalysisInput` видаляються (запис іде в транзакціях кроків; закриває рядок backlog про заглушки).
- **o. Web.** Фіча `features/dialogue` (уже в `WEB_FEATURES`). Ресурс деталей сесії читають ≥2 фічі (session, dialogue, далі report), тому `getSession`, `sessionKeys`, `sessionDetailsQueryOptions` переїжджають у `shared/api/session-details.ts` (правило «≥2 фічі → shared», як `shared/ui`). `DialogPage` компонує `SessionOverview` (session: Skeleton, 404, тема) і `DialogueScreen` (dialogue). Мутації кроків оновлюють кеш `setQueryData` за `sessionKeys.details`, `finish` ще й інвалідує список. Відкинуто: діалог у `features/session` (фіча на ~60 файлів), дві `queryOptions` на один ключ.
- **p. Режими збою Fake.** `FAKE_STT_FAIL = unavailable`, `FAKE_LLM_FAIL = invalid_json | unavailable` (enum у `env.schema.ts`, порожнє = вимкнено); `stubs.md` оновлюється (`=1` → `unavailable`). Затримку для `[TC-04-12]` дає `page.route` у Playwright (стани прив'язані до справжніх запитів), окремої змінної немає.
- **q. Multipart (04b).** Поле `audio`, `FileInterceptor('audio', { storage: memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0 } })` (перевищення → 413, Nest не викликає обробник; код `AUDIO_TOO_LARGE`). Білий список базових MIME `audio/webm`, `audio/ogg`, `audio/mp4` (параметри `;codecs=` відкидаються) + сигнатура (`1A45DFA3` EBML, `OggS`, `ftyp` на зсуві 4) у `lib/audio-format.ts` → 415 `AUDIO_UNSUPPORTED`. Власна перевірка замість `FileTypeValidator`, бо він визначає webm як `video/webm`. Тіло: або файл, або JSON `{ text }`, інакше 400. `MAX_AUDIO_BYTES = 5 MiB` (opus 128 кбіт/с × 120 с ≈ 1,9 МБ), `MAX_RECORDING_SECONDS = 120`. Клієнт: перший підтримуваний з `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4` (`MediaRecorder.isTypeSupported`). `@types/multer` – devDependency api. STT отримує індекс = кількість `user`-реплік сесії. Збій STT → 503 `SPEECH_RECOGNITION_UNAVAILABLE`, нічого не записано; клієнт тримає Blob у пам'яті для «Надіслати ще раз», текст – у формі.
- **r. Підказки (04b).** `POST /api/sessions/:id/hints` `{ kind: 'phrase_start' } | { kind: 'translation', word (trim 1–60) }`, згода. Сервер бере поточне питання (остання `assistant`) і його номер. Транзакція: блок сесії; для перекладу `INSERT words (lemma, translation_uk, source 'hint', state 'new') ON CONFLICT (user_id, lower(lemma)) DO NOTHING`, потім SELECT (наявне слово не скидає стан); `hints.text` = фраза або `"{lemma} = {слово}"` (як seed), `utterance_id` = поточне питання. Невідоме слово → 200 `{ kind: 'translation', word: null }`, нічого не зберігається, UI показує текст з i18n, не `message` моделі. Підпис порту лишається union `HintRequest` (`phrase_start` отримує `question` і `questionNumber`), `stubs.md` 2.4 оновлюється (закриває рядок backlog).


## Технічні рішення (контракти)

`packages/shared/src/dialogue.ts` (+ `dialogue.test.ts`, `index.ts`):
- `ANSWER_TEXT_MAX = 1000`, `AnswerTextRequestSchema { text: trim 1–1000 }`; `ANALYSIS_STATUSES = ['pending','done','failed','skipped']`.
- `MistakeViewSchema { id, start, end, original, suggestion, category, explanationEn, translationUk, isFalse }`.
- `UtteranceSchema` (у `session.ts`) + `analysisStatus`, `mistakes: MistakeView[]`, `better: BetterPhrasing[]` (для `assistant` порожні); `text` = `text_verbatim`. `SessionDetailsSchema` + `planRemaining: int ≥ 0`.
- `TurnResultSchema { utterance: Utterance, reply: Utterance | null, planRemaining }`; `MarkMistakeRequestSchema { isFalse: z.literal(true) }`.
- `llm.ts`: JSDoc UTF-16 у `MistakeSchema`, межі довжин, `AnalysisEnvelopeSchema`, `TurnSchema.question` = `QuestionSchema`.
- 04b: `MAX_AUDIO_BYTES`, `MAX_RECORDING_SECONDS`, `AUDIO_MIME_TYPES`, `HintRequestSchema`, `HintResultSchema`, `HINT_WORD_MAX = 60`.
- `ERROR_CODES`: 04a `ANSWER_NOT_EXPECTED`, `SESSION_FINISHED`, `UTTERANCE_NOT_FOUND`, `MISTAKE_NOT_FOUND`, `LANGUAGE_MODEL_UNAVAILABLE`; 04b `SPEECH_RECOGNITION_UNAVAILABLE`, `AUDIO_TOO_LARGE`, `AUDIO_UNSUPPORTED`.

| Метод | Гард | Тіло | Успіх | Помилки |
|---|---|---|---|---|
| `POST /api/sessions/:id/utterances` | згода | JSON `{ text }` / multipart `audio` (04b) | 201 `Utterance` (pending) | 400, 401, 403, 404 `SESSION_NOT_FOUND`, 409 `SESSION_FINISHED`/`ANSWER_NOT_EXPECTED`, 413, 415, 503 `SPEECH_RECOGNITION_UNAVAILABLE` |
| `POST /api/sessions/:id/utterances/:utteranceId/analysis` | згода | – | 200 `TurnResult` | 401, 403, 404 `SESSION_NOT_FOUND`/`UTTERANCE_NOT_FOUND`, 502 `LANGUAGE_MODEL_INVALID_RESPONSE`, 503 `LANGUAGE_MODEL_UNAVAILABLE` |
| `PATCH /api/sessions/:id/mistakes/:mistakeId` | – | `{ isFalse: true }` | 200 `MistakeView` | 400, 401, 404 `MISTAKE_NOT_FOUND` |
| `POST /api/sessions/:id/finish` | – | – | 200 `Session` | 401, 404 |
| `POST /api/sessions/:id/hints` (04b) | згода | `HintRequest` | 200 `HintResult` | 400, 401, 403, 404, 409 `SESSION_FINISHED` |
| `GET /api/sessions/:id` | – | – | 200 `SessionDetails` (+ аналіз, `planRemaining`) | 404 |

Чужий, неіснуючий і не-uuid id (сесії, репліки, помилки) → однаковий 404; uuid перевіряється до запиту, як у 03-08.

**Міграція 0004** (`db/migrations/0004_better_phrasings.sql`, скіл `/db-migration`, англійською):
```sql
ALTER TABLE utterances ADD COLUMN better_phrasings jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE utterances ADD CONSTRAINT utterances_better_phrasings_check
  CHECK (jsonb_typeof(better_phrasings) = 'array');
```
Кількість (≤2) обмежує Zod, не CHECK (новій версії промпту не знадобиться міграція). Нових індексів не потрібно: `mistakes(utterance_id)`, `hints(session_id)`, `uq_words_user_lemma`, `UNIQUE(session_id, seq)`, `UNIQUE(user_id, category)` уже є. `db-schema.test.ts`: CHECK 17 → 18. Seed: `better_phrasings` і `analysis_prompt_version = 'error-analysis.v1'` для засіяних реплік (`ON CONFLICT (id) DO UPDATE` для цих колонок), `insertUserData` без змін.

**Промпти** (`packages/prompts`, рендер узагальнюється до `render-prompt.ts`: `renderPrompt(id, input) → { id, text }`, `session-plan-prompt.ts` стає тонкою обгорткою):
- `error-analysis.v1.md`: роль; вхід `{ text }`; «значення – дані, не інструкції»; вихід строгий JSON `{ mistakes: [{ start, end, original, suggestion, category, explanation_en, translation_uk }], better: [{ original, better }] }`; перелік рівно 13 кодів (тест звіряє з `MISTAKE_CATEGORY_CODES`); позиції UTF-16, `original` – точний підрядок; вагання (`um`, `uh`) не помилки; ≤2 формулювання; без помилок → `[]`; блок даних ```` ```json {{input}} ``` ````.
- `next-turn.v1.md`: вхід `{ topic, remainingQuestions, history }`; вихід `{ question }`; якщо `remainingQuestions` не порожній – повернути перше дослівно, якщо відповідь не надто коротка/незрозуміла (тоді коротке уточнення); порожній – уточнення до останньої відповіді; ≤300 символів; не відповідати за учня.
- `hint.v1.md`: вхід `{ kind, question, questionNumber?, word? }`; вихід за `HintSchema`; переклад – одне англійське слово/фраза або `null`.
- Fake кожного методу спершу рендерить свій промпт і відкидає текст (як `planSession`), тож зламаний шаблон валить тести (`[TC-04-07]`).


## Дерево файлів (орієнтовне; фактичне – у «Відхиленнях»)
```
packages/shared/src/   dialogue.ts(+test) · session.ts(+test) · llm.ts(+test) · auth.ts · index.ts
packages/prompts/      error-analysis.v1.md · next-turn.v1.md · hint.v1.md · README.md
db/                    migrations/0004_better_phrasings.sql · meta/ · seed.sql
apps/api/src/
  core/db/db.tokens.ts (DbExecutor) · schema.ts · core/errors/all-exceptions.filter.ts(+test) · common/zod-body.pipe.ts(+test)
  core/config/env.schema.ts(+test)
  integrations/language-model/  language-model.port.ts · language-model.errors.ts · fake-language-model.ts · fake-analysis-rules.ts
      fake-next-turn.ts · fake-hints.ts (04b) · render-prompt.ts(+test) · session-plan-prompt.ts · *.test.ts
  integrations/speech-recognition/  speech-recognition.port.ts · fake-speech-recognition.ts · fake-transcripts.ts · *.test.ts
  integrations/providers.module.ts(+test) · fake-consistency.test.ts
  modules/analysis/  analysis.module.ts · mistake-analyzer.service.ts(+test) · lib/align-mistakes.ts(+test) · lib/pattern-increments.ts(+test)
      mistakes.controller.ts · mistakes.service.ts · mistakes.repository.ts
  modules/dialogue/  dialogue.module.ts · dialogue.controller.ts · answers.service.ts(+test) · turn.service.ts(+test)
      next-turn.service.ts(+test) · lib/remaining-questions.ts(+test) · persistence/dialogue.repository.ts · dialogue.errors.ts
      lib/audio-format.ts(+test) · audio-retention.ts(+test) · hints.service.ts · persistence/hints.repository.ts (04b)
  modules/vocabulary/ vocabulary.module.ts · lib/word-usage.ts(+test) · persistence/words.repository.ts
  modules/session/   sessions.service.ts · sessions.controller.ts · sessions.repository.ts (planRemaining, finish, аналіз у деталях)
  modules/profile/   learner-model.service.ts · learner-model.types.ts (без applyAnalysis)
  core-services.test.ts
apps/api/test/  dialogue-answer · dialogue-analysis · mistakes · sessions-finish · dialogue-voice (04b) · audio-retention (04b) · hints (04b) · db-schema
apps/web/src/
  shared/api/session-details.ts(+test) · http.ts (FormData, 04b) · shared/testing/{test-fixtures, session-mocks, dialogue-mocks}.ts · shared/i18n/uk.json
  features/session/  components/SessionOverview/* (з SessionQuestion без CurrentQuestion/answerSoon), імпорти з shared/api
  features/dialogue/
    api/dialogue-api.ts(+test) · lib/{highlight-segments, dialogue-errors, recorder-mime(04b)}.ts(+tests)
    hooks/{use-answer-flow, use-mark-mistake, use-finish-session, use-audio-recorder(04b), use-hint(04b)}.ts(+tests)
    components/Transcript/{Transcript, MistakeDetails, BetterPhrasings, .module.scss, test}
    components/DialogueScreen/{DialogueScreen, TurnList, CurrentQuestion, ProcessingStatus, FinishAction, test}
    components/TextAnswerForm/{TextAnswerForm, test} · RecordButton/* · RecordingIndicator/* · MicPermissionHelp/* · HintPanel/* (04b)
  pages/dialog/DialogPage.tsx(+test) · pages/report/ReportPage.tsx(+test) · app/App.tsx
e2e/  dialog.spec.ts · voice.spec.ts (04b) · support/dialog.ts · playwright.config.ts (04b)
docs/ tech-decisions.md · stubs.md · backlog.md · README.md
```


## Задачі
Позначки: `[risk]` рев'ю одразу; `[UI]` Playwright MCP на 360 px; `[e2e]` прогін `pnpm test:e2e`; **[Антон]** ручна дія. Кожна ≤ ~8 файлів, TDD для домену.

### Частина 04a (`feat/04-dialog`)
Блок A – контракти, міграція, промпти:
- [x] **04-01. Контракти shared.** `dialogue.ts`(+тест), розширення `UtteranceSchema`/`SessionDetailsSchema`, `llm.ts` (JSDoc UTF-16, межі, `AnalysisEnvelopeSchema`, `TurnSchema`), коди помилок; мапер `sessions.repository.ts` повертає нові поля (помилки одним запитом `WHERE utterance_id IN`, `planRemaining`), web-фікстури `testSessionDetails`. Виняток із ліміту (~10 файлів): інакше typecheck червоний між задачами. `[TC-04-01]` `[risk]`
  - Відхилення: `ANALYSIS_STATUSES`, `AnalysisStatusSchema` і `MistakeViewSchema` лежать у `analysis-view.ts` (а не в `dialogue.ts`), щоб уникнути циклу `session.ts` ↔ `dialogue.ts`; `MistakeViewSchema` має `end > start` як `MistakeSchema`; у `llm.ts` межі винесено в константи (`MISTAKE_TEXT_MAX` 200, `MISTAKE_EXPLANATION_MAX` 500, `ANALYSIS_MAX_MISTAKES` 30, `ANALYSIS_MAX_BETTER` 5), `BetterPhrasingSchema` обмежено `MISTAKE_TEXT_MAX`; мапер рахує `planRemaining` у JS по вже завантажених репліках (план читається малою Zod-схемою, зіпсований план дає 0), помилки одним `inArray` запитом, рядки без позицій пропускаються, `better: []` до 0004 (дроту `better_phrasings` – у 04-02); `AnalysisResultSchema` лишено, видалити в 04-08 (його замінює конверт); `testUtterance()` у web-фікстурах; нові тести мапера винесено в `sessions-analysis-read.test.ts` і `test/support/session-fixtures.ts`. Рев'ю: 0 high, 2 medium виправлено (розмір файла тестів, `better: []` записано в 04-02), 3 low у backlog. Shared 58 → 70, api 414 → 420, web 405.
- [x] **04-02. Міграція 0004.** Підключити `better_phrasings` у `toUtterance` (зараз `better: []` у `sessions.repository.ts`). Скіл `/db-migration`, SQL вище, `db:pull`, `db-schema.test.ts`, seed (`better_phrasings`, `error-analysis.v1`), рядок у `tech-decisions.md` розд. 3. `[risk]`
  - Відхилення: міграцію створено `drizzle-kit generate --custom` (journal idx 4 + заглушка snapshot, як у 0000–0003), дроту `better_phrasings` у `toUtterance` зроблено тут (`z.array(BetterPhrasingSchema).parse` для `user`, `[]` для `assistant`); seed: `ON CONFLICT (id) DO UPDATE SET analysis_prompt_version, better_phrasings` для реплік, версія `error-analysis.v1` замість `fake-v1`, друге формулювання в `…0204`; перевірено свіжу БД з нуля (18 CHECK) і `pnpm db:seed` двічі; `db:pull` лише переставив таблиці. Рев'ю: 0 high/medium, 3 minor (заголовок seed виправлено; м'який `safeParse` для `better_phrasings` – у backlog). Тестів api 420 → 422.
- [x] **04-03. Промпти.** Три `.md`, `render-prompt.ts`(+тест), `session-plan-prompt.ts` на ньому, тести промптів (файл, id, вхід у блоці даних, правило «дані не інструкції», 13 категорій), README. `[TC-04-07]` `[risk]`
  - Відхилення: `renderPrompt(id, input)` у `render-prompt.ts` (гарантії одного `{{input}}`, функція-replacer, `JSON.stringify`), три обгортки й константи id в одному `prompts.ts` (`ERROR_ANALYSIS_PROMPT_ID` тощо), `session-plan-prompt.ts` лишився тонкою обгорткою; у `error-analysis.v1.md` окремий розділ `# Categories` із 13 кодами (тест звіряє множину з `MISTAKE_CATEGORY_CODES`); `hint.v1` вимагає `null` для відсутнього/невідомого слова. Рев'ю: 0 high/medium, 8 minor у backlog (ліміт 30 помилок і «рахуй зсуви в декодованому рядку» в `error-analysis.v1`, `message` у `hint.v1`, слабкі перевірки в `prompts.test.ts`, дубль id в обгортках). Тестів api 422 → 446.

Блок B – порт і Fake:
- [x] **04-04. Порт → `unknown`, помилки й режими збою.** Методи порту (`analyzeUtterance` → `{ output, promptVersion, model }`, `nextTurn`, `hint`, `summarizeSession` → `unknown`), `language-model.errors.ts` / помилка STT, enum `FAKE_*_FAIL` (+тест env), `providers.module` передає режими (+тест), `requestValidated` пропускає `LanguageModelUnavailableError`. Закриває backlog «методи → unknown» (крім валідації `summarizeSession` – 05), «FAKE_* enum». `[TC-00-05]`
  - Відхилення: `analyzeUtterance` повертає `AnalyzeUtteranceResponse { output, promptVersion, model }`; `NextTurnInput = { topic, remainingQuestions, history }` (рішення i), `HintRequest.phrase_start` отримав `questionNumber`; режими збою – enum у `env.schema.ts` (`FakeSttFailMode`, `FakeLlmFailMode`), `invalid_json` зачіпає лише `analyzeUtterance` (щоб після `failed` наступне питання ще працювало), `unavailable` – усі методи й `transcribe`; `SessionPlannerService.plan` мапить недоступність у 503 `LANGUAGE_MODEL_UNAVAILABLE` (інтеграційний тест у окремому `sessions-plan-unavailable.test.ts`, бо `sessions-plan.test.ts` уже ~260 рядків); тест «невідомий режим зупиняє запуск» не додано (unhandled rejection у vitest), покриває env-тест; валідацію `summarizeSession` зроблено в 05. Закриває backlog «методи порту → unknown» (крім summarize) і «FAKE_* enum». Тестів api 446 → 462.
- [x] **04-05. Fake `analyzeUtterance`** за `stubs.md` 2.1: 15 правил регістронезалежно, обчислені `suggestion` (go→went тощо), сортування й перетини, ≤2 формулювання, `translation_uk` у правилах, рендер промпту; `fake-language-model-analysis.test.ts`. Закриває backlog «регістронезалежні RegExp», «словник translation_uk». `[TC-04-01]`
  - Відхилення: правила в `fake-analysis-rules.ts`, рушій у `fake-analysis.ts`, форми дієслів у `fake-verb-forms.ts`, таблиця 34 позитивних випадків у `fake-analysis-rule-cases.ts` (дані, не тест); `suggest` правила отримує групи 1..3 кортежем (`noUncheckedIndexedAccess`); при однаковому `start` перемагає правило з меншим номером; правило 4 поглинає хвостове ` old` (`I have 30 years old` → `I am 30 years old`); правило 11 відмінює дієслово після `will` для he/she/it, `be` → am/is/are; правило 5 зберігає маркер часу у `suggestion` (`yesterday I went`), хоч колонка таблиці каже «I + минула форма»; правило 2 може поглинути правило 7 (`she make a photo` → лише `she make`), правило 8 не покриває `why you are` – записати в `stubs.md` у 04-22. Fake спершу рендерить `error-analysis.v1`. Тестів api 462 → 517.
- [ ] **04-06. Fake `nextTurn` і `transcribe`.** 2.3 (рендер `next-turn.v1`), 5 транскриптів, `clean` за правилом, індекс/лічильник/`reset()`, `unavailable`; `fake-consistency.test.ts` (розд. 3: категорії для 5 транскриптів, `slice === original`, коди в `mistake_categories`). Закриває backlog «Fake transcribe/analyze/nextTurn» (hint – 04-25). `[TC-04-01]` `[TC-00-05]`

Блок C – api відповіді й аналізу:
- [ ] **04-07. Внутрішній `ZodError` → 500.** `ZodBodyPipe` кидає `RequestValidationError` (→ 400 `VALIDATION_ERROR`), сирий `ZodError` → 500 `INTERNAL_ERROR` з логом шляхів і кодів; тести фільтра, пайпа, `error-format`. Закриває backlog «внутрішні ZodError» (і `.parse` рядків у `sessions.repository.ts`). `[risk]`
- [ ] **04-08. Аналіз: домен.** `align-mistakes.ts`, `pattern-increments.ts`, `MistakeAnalyzerService.analyze` (конверт → поштучна валідація → вирівнювання; `failed` після двох невалідних; `unavailable` прокидається; лог без значень), `DbExecutor` у `db.tokens.ts`, оновити `core-services.test.ts`. TDD. **Межа блоку**: повний `pnpm test`, рев'ю 04-04…04-06. `[TC-04-01]` `[risk]`
- [ ] **04-09. Слова → `active`.** `vocabulary` модуль, `word-usage.ts`(+тест: регістр, межі, апостроф, багатослівні, без лематизації), `words.repository.ts` `recordUsage(executor, userId, text)` (+інтеграційний тест), видалити `applyAnalysis`/`ApplyAnalysisInput`. Закриває backlog «заглушки applyAnalysis». `[TC-04-01]`
- [ ] **04-10. Наступне питання.** `remaining-questions.ts`(+тест), `NextTurnService` (вхід, `requestValidated(TurnSchema)`, 502), заміна заглушки `DialogueService`. `[TC-04-01]`
- [ ] **04-11. Крок 1: текстова відповідь.** `dialogue.controller.ts`, `answers.service.ts`(+тест), `dialogue.repository.ts` (блок сесії, 409-перевірки, `seq`, `recordUsage`), `dialogue.errors.ts`, модуль; `test/dialogue-answer.test.ts`: 201 pending, `text_verbatim = text_clean`, STT не викликано, 1000 → 201 і 1001 → 400, 403 без згоди, 404 чужа/не-uuid, 409 завершена, 409 подвійна, паралельні → один `seq`, слово passive → active, видалений користувач → 401. `[TC-04-03]` `[risk]`
- [ ] **04-12. Крок 2: аналіз і відповідь.** `turn.service.ts`(+тест), транзакція запису (помилки, патерни, `better_phrasings`, версія/модель/`analyzed_at`, відповідь `assistant`); `test/dialogue-analysis.test.ts`: помилки й патерни (+1 на помилку, `last_seen_at`), повторний виклик → те саме без нової репліки й без виклику моделі, паралельні виклики → одна відповідь, `invalid_json` → `failed` + відповідь є, `unavailable` → 503, репліка `pending`, повтор доробляє, у лозі немає тексту відповіді. `[TC-04-02]` `[TC-04-03]` `[TC-04-08]` `[risk]`

Блок D – `is_false` і завершення:
- [ ] **04-13. «Це не помилка».** `mistakes.controller/service/repository` у `analysis`; `test/mistakes.test.ts`: `is_false`, `frequency − 1`, не нижче 0, повтор не декрементує, чужа → 404. `[TC-04-09]` `[risk]`
- [ ] **04-14. Завершення.** `SessionsService.finish`, `POST :id/finish`; `test/sessions-finish.test.ts`: 200 finished, повтор не змінює `ended_at`, відповідь після → 409, чужа → 404. Звузити backlog-рядки JWT і `@RequiresConsent` до 05. `[TC-04-05]`
- [ ] **04-15. Межа api-блоку.** Swagger-описи нових маршрутів перевірено, повний `pnpm test`, рев'ю 04-07…04-14 без `[risk]`.

Блок E – web:
- [ ] **04-16. Дані діалогу.** `shared/api/session-details.ts` (перенос `getSession`, `sessionKeys`, `sessionDetailsQueryOptions`, оновити імпортерів), `dialogue-api.ts`(+тест), `dialogue-errors.ts`(+тест), `dialogue-mocks.ts` у `shared/testing`. `[TC-04-04]`
- [ ] **04-17. Хуки.** `use-answer-flow.ts` (стани `sending → analyzing → done | error`, відновлення `pending` на завантаженні, текст не губиться при помилці), `use-mark-mistake.ts`, `use-finish-session.ts` (+тести, `setQueryData`/інвалідація). `[TC-04-04]` `[risk]`
- [ ] **04-18. Підсвічування.** `highlight-segments.ts`(+тест: UTF-16, невалідні й перетинні пропускаються, `isFalse` не підсвічується), `Transcript` (кнопки-фрагменти з підкресленням і маркером, не лише колір), `MistakeDetails` (виправлення, пояснення `lang="en"`, переклад, категорія з `mistakeCategories.*`, «Це не помилка»), `BetterPhrasings`, тести. `[TC-04-04]` `[TC-04-14]` `[UI]`
- [ ] **04-19. Екран діалогу.** `DialogueScreen`, `TurnList`, `CurrentQuestion` (перенесено, без `answerSoon`), `ProcessingStatus` (`aria-live`), `TextAnswerForm` (RHF + Zod, лічильник 1000), «Питання плану закінчились», `deferred` без підсвічування, `SessionOverview`, `DialogPage`, `uk.json` (`dialogue.*`, прибрати `session.details.answerSoon` – закриває backlog). `[TC-04-04]` `[TC-04-11]` `[UI]`
- [ ] **04-20. Завершення й звіт-мінімум.** `FinishAction` (модалка підтвердження), маршрут `/sessions/:id/report`, `ReportPage` (кількість, тривалість, відповіді з помилками), завершена сесія лише для читання. `[TC-04-05]` `[UI]`

Блок F – завершення 04a:
- [ ] **04-21. e2e.** `e2e/dialog.spec.ts`: `[TC-04-04]` (написати відповідь з `I very like` → підсвічено → пояснення → «Це не помилка» → наступне питання плану), `[TC-04-11]` (`deferred` → без підсвічування; у звіті є), завершення → звіт. Два зелені прогони. `[e2e]`
- [ ] **04-22. Backlog і документація 04a.** `tech-decisions.md` (рішення 35: два кроки, позиції, патерни, слова, `better_phrasings`; розд. 3 – 0004; «Стан на»), `stubs.md` (1: `unavailable`, 2.1: версія промпту, 2.3: `remainingQuestions`), `backlog.md` (видалити закриті, нові: finish доаналізовує `pending` → 05, леми від моделі, ліміт ходів/rate limit кроків → деплой), README (Dialogue API). Фінал 04a: повні `typecheck`, `lint`, `test`, `test:e2e`, `reviewer` на гілку; **[Антон]**: ручний `[TC-04-14]`, `pnpm db:migrate`, push, PR, CI.

### Частина 04b (`feat/04-dialog-voice` від 04a)
- [ ] **04-23. Аудіо-контракти й формат.** Константи й схеми аудіо та підказок у shared(+тест), коди помилок, `@types/multer`, `lib/audio-format.ts`(+тест сигнатур), env: `DEV_KEEP_AUDIO` лише з `development` і абсолютним `DEV_AUDIO_DIR` (+тест). `[TC-04-13]`
- [ ] **04-24. Крок 1: голос.** `FileInterceptor` + `memoryStorage` + ліміти, розгалуження файл/JSON, MIME + сигнатура, попередня перевірка сесії, STT з індексом, 503 без запису, `audio-retention.ts`(+тест); `test/dialogue-voice.test.ts`: аудіо → `text_verbatim`/`text_clean` + крок 2 → помилки й патерни; `invalid_json` → `failed`; `FAKE_STT_FAIL` → 503, репліки й сесія без змін; 413, 415, файл + текст → 400; `test/audio-retention.test.ts`: вимкнено → тека порожня, у схемі немає `bytea`, увімкнено → файл є. `[TC-04-02]` `[TC-04-08]` `[TC-04-13]` `[risk]`
- [ ] **04-25. Fake `hint`.** 2.4: словник ~40 слів, фрази за `questionNumber mod 5`, невідоме → `null`, рендер `hint.v1`; `stubs.md` 2.4 – підпис union. Закриває backlog «Fake hint», «підпис hint». `[TC-04-01]`
- [ ] **04-26. API підказок.** `hints.service.ts`, `hints.repository.ts`, `words.repository.addFromHint`, маршрут у `dialogue.controller.ts`; `test/hints.test.ts`: запис у `hints` і слово `new`/`hint`, повторне слово без дубля й без скидання стану, невідоме → нічого, `phrase_start` збережено, 403 без згоди, завершена → 409. **Межа api-блоку 04b.** `[TC-04-10]` `[risk]`
- [ ] **04-27. Рекордер.** `http.ts` (FormData без `Content-Type`, +тест), `recorder-mime.ts`(+тест), `use-audio-recorder.ts`(+тест з фейковим `MediaRecorder`: старт/стоп, автостоп 2:00, таймер, рівень через `AnalyserNode`, зупинка tracks при стопі й розмонтуванні, відмова дозволу, відсутність `MediaRecorder`). `[TC-04-05]` `[risk]`
- [ ] **04-28. UI запису.** `RecordButton` (`aria-pressed`, ≥44 px, клавіатура), `RecordingIndicator` (час; рівень `aria-hidden`, стан у `aria-live`), `MicPermissionHelp` (пояснення й як увімкнути; форма тексту відкривається сама), голосова гілка `use-answer-flow` («Розпізнаю…» → «Аналізую…», Blob для повтору). `[TC-04-05]` `[TC-04-12]` `[UI]`
- [ ] **04-29. UI підказок.** `HintPanel`, `use-hint.ts`(+тест): початок фрази, переклад (форма слова, RHF + Zod), «немає в словнику», тести. `[TC-04-05]` `[UI]`
- [ ] **04-30. e2e голосу.** `playwright.config.ts`: `launchOptions.args` `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `permissions: ['microphone']`; `e2e/voice.spec.ts`: `[TC-04-05]` (запис → транскрипт №0 з підсвіченим `I very like` → пояснення → наступне питання → підказка-переклад «зустріч» → «Завершити» → звіт), `[TC-04-12]` (`page.route` затримує кроки → видно «Розпізнаю…», потім «Аналізую…»). Два зелені прогони. `[e2e]`
- [ ] **04-31. Документація 04b і фінал.** `tech-decisions.md` (рішення 36: аудіо, multipart, підказки), `stubs.md`, backlog, README; повні перевірки, `reviewer`; **[Антон]**: ручні `[TC-04-06]` (Android: дозвіл, запис, транскрипт) і `[TC-04-14]`, push, PR, CI.

## Покриття spec 04
| «Готово, коли» | Задачі |
|---|---|
| [TC-04-01] unit: позиції, патерни, active, Zod, узгодженість Fake | 01, 05, 06, 08, 09, 10, 25 |
| [TC-04-02] аудіо → репліка + помилки + патерни; `failed` | 12, 24 |
| [TC-04-03] текст без STT; >1000 → 400 | 11, 12 |
| [TC-04-04] e2e текст → підсвічення → пояснення → питання | 16–19, 21 |
| [TC-04-05] e2e голос, підказка, завершення | 14, 20, 27–30 |
| [TC-04-06] ручний Android | 31 |
| [TC-04-07] промпти | 03, 05, 06, 25 |
| [TC-04-08] збій STT/LLM не губить даних | 12, 24 |
| [TC-04-09] `is_false` і патерн | 13 |
| [TC-04-10] підказка → `hints` + слово new | 26 |
| [TC-04-11] e2e «В кінці» без підсвічування | 19, 21 |
| [TC-04-12] e2e «Розпізнаю…»/«Аналізую…» | 28, 30 |
| [TC-04-13] аудіо не зберігається | 23, 24 |
| [TC-04-14] ручний: не лише колір | 18, 22, 31 |


## Ризики
- **MediaRecorder на Android:** `audio/webm;codecs=opus` у Chrome Android є, Safari – `audio/mp4`; вибір через `isTypeSupported`, сервер приймає три контейнери. Мікрофон лише на localhost/HTTPS (`adb reverse`).
- **Фейковий мікрофон у Playwright/Edge:** прапорці Chromium працюють у каналі `msedge`; якщо `MediaRecorder` дасть порожній Blob – запасний варіант `--use-file-for-fake-audio-capture` із коротким WAV у `e2e/fixtures/`.
- **Гонки:** `seq` і подвійна відповідь – блок сесії + `UNIQUE(session_id, seq)`; детерміновані тести конкурентності як у 03-07 (друге з'єднання тримає блок).
- **Покинутий крок 2:** репліка `pending` до наступного відкриття; клієнт доробляє, 05 доаналізує на finish (backlog).
- **Перенос `sessionKeys` у shared** зачіпає ~10 імпортів і тестів `features/session` (04-16).
- **Зміна `UtteranceSchema`** ламає web-фікстури й e2e-хелпери, якщо не оновити їх у 04-01.
- **multer 2.x і Nest 12.5:** `limits.parts` за замовчуванням 1000; перевірити, що 413 приходить із нашим кодом (фільтр зберігає код для 4xx).
- **Оцінка:** 04a ~75 файлів (shared 8, prompts 4, db 4, api ~38, web ~25, e2e 2, docs 4), 04b ~40 (shared 3, api ~15, web ~17, e2e 3, docs 3).

