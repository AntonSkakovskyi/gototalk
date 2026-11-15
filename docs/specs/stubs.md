# Fake-адаптери: поведінка заглушок

Специфікація поведінки `FakeSpeechRecognition` і `FakeLanguageModel`. Код пише сесія в `gototalk`. Заглушки детерміновані: той самий вхід дає той самий вихід, тому на них будуються тести й демонстрація без ключів.

Вимоги (лаба 6): BR-7, NFR-4, NFR-6, NFR-12, FR-4, FR-5, FR-6, FR-7, FR-10, FR-11.

Усі коди категорій беруться лише з таблиці `mistake_categories` (0002): `articles`, `verb_tense`, `subject_verb_agreement`, `missing_be`, `prepositions`, `word_order`, `question_form`, `plural_countable`, `conditionals`, `collocation`, `word_choice`, `l1_calque`, `other`. Для `analysis_model` заглушка повертає `fake`, для `analysis_prompt_version` – ідентифікатор промпту аналізу `error-analysis.v1` (ім'я файлу без `.md`, як у `packages/prompts`).

## 1. FakeSpeechRecognition

`transcribe(audio, mime, index?) → { verbatim, clean }`. Вміст аудіо ігнорується. `mime` – базовий тип, який визначив сервер за білим списком і сигнатурою файлу (`audio/webm`, `audio/ogg` або `audio/mp4`, без `;codecs=`); справжній адаптер отримує саме його. Відповідь береться з набору нижче за індексом `(кількість user-реплік у сесії до цієї відповіді) mod 5` (перша голосова відповідь сесії має індекс 0); сесія в `transcribe` не відома, тому індекс передає викликач (`DialogueRepository.answerIndexFor` перед викликом STT), а справжній адаптер його ігнорує. Явний цілий `index` не рухає внутрішній лічильник; без індексу (або з нецілим) береться внутрішній лічильник адаптера, який по колу йде від 0 до 4. Лише для тестів клас має метод `reset()`, що скидає лічильник (у порту його немає).

| № | verbatim | Помилки, які знайде FakeLanguageModel |
|---|---|---|
| 0 | Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job. | verb_tense, word_order |
| 1 | Well, I am agree that remote work is good. Uh, I work with small team since 2 years. | l1_calque, articles, prepositions |
| 2 | My sister, um, she work in a big company. She busy every day. | subject_verb_agreement, missing_be |
| 3 | I have 25 years and, uh, I live in Kyiv. It depends of the weather, um, if I will have time, I travel. | l1_calque, prepositions, conditionals |
| 4 | Um, we have a meeting in Monday and I need more informations. Uh, I am boring because it is long. | prepositions, plural_countable, word_choice |

`clean` обчислює чиста функція `cleanTranscript`: вагання `um`, `uh`, `er` (цілі слова, регістр неважливий) прибираються разом із комами до й після них; вступне `well,` на початку тексту або речення прибирається (`well` в інших місцях лишається); пробіли стискаються до одного, пробіл перед `. ? ! ,` зникає, перша літера велика. Тому в №3 зникає й кома перед `if`. Точні `clean` для п'яти транскриптів (зафіксовані тестом `fake-speech-recognition.test.ts`):

| № | clean |
|---|---|
| 0 | Yesterday I go to the office and I have a meeting with my team. I very like my job. |
| 1 | I am agree that remote work is good. I work with small team since 2 years. |
| 2 | My sister she work in a big company. She busy every day. |
| 3 | I have 25 years and I live in Kyiv. It depends of the weather if I will have time, I travel. |
| 4 | We have a meeting in Monday and I need more informations. I am boring because it is long. |

Режим збою `FAKE_STT_FAIL=unavailable` (єдине допустиме значення, порожнє – вимкнено): `transcribe` кидає `SpeechRecognitionUnavailableError`, яку крок голосу `POST /api/sessions/:id/utterances` (multipart `audio`) відображає в 503 `SPEECH_RECOGNITION_UNAVAILABLE`: репліку не записано, сесія без змін; клієнт показує повідомлення «Сервіс розпізнавання мовлення зараз недоступний» (`dialogue.errors.speechUnavailable`), тримає Blob у пам’яті для «Надіслати ще раз» і відкриває текстову форму, тож дані не губляться (NFR-6). На текстову відповідь режим не діє (STT не викликається).

## 2. FakeLanguageModel

Загальне: усі відповіді відповідають Zod-схемам з `packages/shared`. Мова пояснень: `explanation_en` англійською, `translation_uk` українською.

### 2.1 analyzeUtterance(text)

Заглушка застосовує до `text_verbatim` правила з таблиці (регістронезалежні регулярні вирази, прапорці `gi`). Позиції `start`/`end` рахуються в `text_verbatim` (0-based, UTF-16 code units, `end` не включно). Знайдені збіги сортуються за `start`, при однаковому `start` перемагає правило з меншим номером; збіг, що перетинається з попереднім, відкидається. Результат обмежений 30 помилками (`ANALYSIS_MAX_MISTAKES`). Якщо збігів немає, повертається порожній список. `suggestion` обчислюється з реального збігу (дієслово відмінюється за словом із тексту, регістр прийменників зберігається), а не береться з таблиці дослівно; приклади в колонці `suggestion` показують лише вигляд. Правила лежать у `fake-analysis-rules.ts`, форми дієслів – у `fake-verb-forms.ts`. Правила працюють на довільному тексті, тому текстова відповідь (spec 04, п. 2a) аналізується так само, як голосова.

| № | Шаблон (приклад) | Категорія | suggestion | explanation_en | translation_uk |
|---|---|---|---|---|---|
| 1 | `I am agree` | l1_calque | `I agree` | "Agree" is a verb, so it does not need "am". | «Agree» – це дієслово, «am» не потрібне. |
| 2 | `(he|she|it) go/have/do/work/like/want/live/make/play/need` без `-s`; не позначається після `did`, `does`, `do`, `can`, `could`, `will`, `would`, `should`, `must`, `let`, `let's`, `make`, `to`, `help` | subject_verb_agreement | форма на `-s` (go→goes, have→has, do→does) | With he/she/it the present simple verb takes -s. | З he/she/it дієслово в теперішньому часі має закінчення -s. |
| 3 | `since 2 years`, `since three months` | prepositions | `for 2 years` | Use "for" with a period of time and "since" with a starting point. | «For» – для тривалості, «since» – для моменту початку. |
| 4 | `I have 25 years` (хвостове ` old` поглинається: `I have 30 years old` → `I am 30 years old`); не позначається перед `of`, `in`, `at`, `with`, `as`, `on`, `ago`, `experience`, `before` | l1_calque | `I am 25 years old` | In English age is expressed with "to be", not "to have". | Вік виражається дієсловом «be», а не «have». |
| 5 | `(yesterday|last week|last month|last year|last night),? I go/see/meet/work/visit/buy/make/take/do/have/want/like/play/watch` | verb_tense | маркер часу + `I` + минула форма (`yesterday I went`; go→went, see→saw, meet→met, buy→bought, make→made, take→took, do→did, have→had, інші +ed / +d) | Use the past simple for finished actions with a past time marker. | Для завершених дій з маркером минулого вживається Past Simple. |
| 6 | `informations`, `advices` | plural_countable | `information`, `advice` | "Information" and "advice" are uncountable and have no plural. | «Information» і «advice» – незлічувані, множини не мають. |
| 7 | `make a photo`, `make photos` | collocation | `take a photo` | We "take" photos, we do not "make" them. | Фото «беруть» (take), а не «роблять» (make). |
| 8 | `why you think/want/like/need/say` (лише ці п'ять дієслів; `why you are` не покривається) | question_form | `why do you think` | In questions add "do" before the subject. | У питаннях перед підметом потрібне допоміжне «do». |
| 9 | `I very like/love/enjoy` | word_order | `I really like` | "Very" does not go before a verb; use "really" or "very much" after the object. | «Very» не ставиться перед дієсловом; вживайте «really» або «very much». |
| 10 | `(I|he|she|it|we|they) busy/tired/ready/late/happy/hungry/interested` без `be` | missing_be | `I am busy` / `she is busy` / `we are busy` | An adjective after the subject needs the verb "be". | Після підмета перед прикметником потрібне дієслово «be». |
| 11 | `if (I|you|he|she|it|we|they) will + дієслово` | conditionals | `if I have` (після `will` дієслово відмінюється: he/she/it → `-s`, `be` → am/is/are) | After "if" in a real condition use the present simple, not "will". | Після «if» у реальній умові вживається Present Simple, а не «will». |
| 12 | `depends of`, `depend of` | prepositions | `depends on` | The verb "depend" takes the preposition "on". | Дієслово «depend» вживається з прийменником «on». |
| 13 | `in Monday`…`in Sunday` | prepositions | `on Monday` | Use "on" with days of the week. | З днями тижня вживається «on». |
| 14 | `(with|in|on|at|for) small/big/new/large/good/nice + team/project/company/office/job` без артикля | articles | `with a small team` | A singular countable noun needs an article. | Злічуваному іменнику в однині потрібен артикль. |
| 15 | `I am boring`, `I was boring` | word_choice | `I am bored` | "Boring" describes a thing that causes the feeling; "bored" describes how you feel. | «Boring» – те, що викликає нудьгу; «bored» – як почувається людина. |

Для кожної відповіді з помилками заглушка додає до 2 кращих формулювань `{ original, better }`: речення (до `.`, `?`, `!`), у яких є помилки, із застосованими `suggestion`; речення довше за 200 символів (оригінал чи виправлене) пропускається.

Особливості правил (зафіксовані тестами). Правило 2 може поглинути правило 7: `she make a photo` дає лише `she make` (правило 7 перетинається й відкидається). Правило 5 зберігає маркер часу в `suggestion`, хоч початковий задум казав «`I` + минула форма». Правило 8 не покриває `why you are`.

### 2.2 planSession(input)

Вхід `input`: `level`, `scenes`, `goals` (заголовки активних цілей), `patterns` (коди категорій, від найчастішої), `previousTopics` (теми, які клієнт уже показав, ≤ 3), `customTopic` (необов’язково). Fake спершу рендерить промпт `session-plan.v1` (як це зробить реальний адаптер) і відкидає текст, тож зламаний шаблон промпту валить виклик, а потім повертає детерміновану відповідь `{ topic, questions }`; `topicSource` додає викликач. `level` і `goals` Fake ігнорує (їх використовує лише промпт).

Банк тем за сценою профілю (5 тем × 5 питань). Тема береться за індексом `previousTopics.length mod 5` у першій сцені профілю, тож той самий запит дає ту саму тему; `Інша тема` (клієнт додає показану тему до `previousTopics`) бере наступну. Питання англійською. Ключі банку – коди пресетів сцен із `SCENE_PRESETS` (`packages/shared`); у `profiles.scenes` зберігаються саме коди або вільний текст.

| Сцена (код) | Теми (за порядком) |
|---|---|
| `work_meetings` | My last project at work; A difficult meeting; Planning a week; Working with a team; A skill I want to learn |
| `small_talk` | Weekend plans; My hometown; Favourite food; A film I watched; Weather and seasons |
| `interviews` | Why I want this job; My strengths; A challenge I solved; My career goals; Questions for the interviewer |
| `daily_services` | At the doctor; Renting a flat; Ordering food; A problem with an order; Using public transport |
| `travel` | My last trip; Booking a hotel; A dream destination; Getting lost in a city; Travel plans |

Власна сцена (вільний текст, якого немає серед пресетів): береться перша сцена-пресет профілю, а якщо пресетів у профілі немає – `small_talk`.

Кожна тема має 5 питань: перші чотири універсальні (мета, досвід, думка, порівняння), п’яте – узагальнююче й без теми. Тема береться в лапки: `What is your main goal when you talk about "{topic}"?`, `Tell me about your own experience with "{topic}".`, `What do you think is the most important part of "{topic}"?`, `How is "{topic}" different from what you did before?`, `What would you do differently next time?`. Якщо в `patterns` є елементи, питання №1 замінюється питанням, що провокує найчастіший патерн (`patterns[0]`):

| Категорія | Питання, що провокує патерн |
|---|---|
| verb_tense | Tell me what you did yesterday at work. |
| articles | Describe your office or your room in detail. |
| prepositions | When and where do you usually meet your friends? |
| subject_verb_agreement | What does your best friend do every day? |
| question_form | Ask me three questions about my job. |
| інші | Tell me about a typical day in your life. |

Власна тема (`customTopic`, `topic_source = custom`): тема лишається як введена (після trim), `previousTopics` ігнорується, питання за шаблоном: `What is the first thing that comes to mind when you think about "{topic}"?`, `Why did you choose to talk about "{topic}"?`, `Tell me about your experience with "{topic}".`, `What do you find most difficult about "{topic}"?`, `How do you see "{topic}" in the future?`. Правило патерну діє й для власної теми: якщо `patterns` не порожній, питання №1 так само замінюється.

### 2.3 nextTurn(input)

Вхід `input`: `{ topic, remainingQuestions, history }`, де `remainingQuestions` – питання плану, тексту яких ще немає серед реплік `assistant` (порівняння після trim, стискання пробілів і нижнього регістру; рахує сервіс), `history` – останні 12 записів `{ role, text }`. Fake спершу рендерить промпт `next-turn.v1` і відкидає текст, потім повертає `{ question }`: перше з `remainingQuestions`; якщо їх немає – уточнення `Can you tell me more about "{слово}"?`, де слово – останнє слово останньої `user`-репліки довше за 3 літери (токен `[p{L}p{N}]+` з апострофом чи дефісом усередині, без розділових знаків; обрізається, щоб питання вклалось у 300 символів). Якщо такого слова немає, питання `Can you tell me more about that?` (без лапок).

### 2.4 hint(input)

Підпис порту: `hint(input: HintInput)`, де `HintInput` – union `{ kind: 'phrase_start', question, questionNumber } | { kind: 'translation', word }` (окремий від `HintRequest` у `packages/shared`, що описує тіло HTTP-запиту). Сервіс (`HintsService`) бере питання з БД: `question` – текст останньої репліки `assistant`, `questionNumber` – кількість реплік `assistant` у сесії (нумерація з 1). Fake спершу рендерить промпт `hint.v1` і відкидає текст, потім повертає відповідь за `HintSchema` (`translation` без `message`). Пошук слова в словнику без урахування регістру, після trim і стискання пробілів. Відповідь проходить `HintSchema` у `requestValidated` (один повтор, далі 502 `LANGUAGE_MODEL_INVALID_RESPONSE`; недоступність → 503): `phrase_start.text` після trim 1–200 символів; `translation.word` після trim 1–60 символів, лише англійська форма (`[A-Za-z][A-Za-z' -]*`) або `null`; `kind` відповіді має збігатися з `kind` запиту. Поле `message` у `HintSchema` лишається опційним, Fake його не ставить, застосунок не читає (`docs/backlog.md`).

- `phrase_start`: початок фрази не залежить від тексту питання (Fake лише передає його в промпт): `I think that…`, `In my opinion…`, `One thing I remember is…`, `Last time I…`, `For me, the most important thing is…` (за `questionNumber` mod 5: 0 – перший початок, 1 – другий і так далі). Оскільки `questionNumber` рахується з 1, перше питання сесії отримує другий початок (`In my opinion…`), п'яте – перший.
- `translation`: словник UA→EN із ~40 слів: зустріч – meeting; термін – deadline; розклад – schedule; колега – colleague; співбесіда – interview; квиток – ticket; бронювання – booking; готель – hotel; лікар – doctor; квартира – flat; орендувати – rent; замовлення – order; проблема – problem; проєкт – project; команда – team; досвід – experience; навичка – skill; вміти – be able to; звільнитися – quit; зарплата – salary; відпустка – holiday; подорож – trip; погода – weather; вихідні – weekend; сніданок – breakfast; вечеря – dinner; зупинка – stop; потяг – train; літак – plane; аеропорт – airport; валіза – suitcase; допомога – help; рішення – decision; відповідь – answer; питання – question; вибачте – sorry; будь ласка – please; дякую – thank you; відгук – feedback. Невідоме слово: відповідь `{ kind: 'translation', word: null }` без `message` (текст «немає в словнику» показує UI з i18n), нове слово не зберігається.

### 2.5 summarizeSession(input)

Вхід `input` (`SummarizeSessionInput`): `answers` (кількість відповідей), `minutes` (тривалість у хвилинах, `max(1, round(секунди / 60))` рахує сервіс) і `categories` – не більше `TOP_CATEGORIES_LIMIT` (3) елементів `{ code, title, count, examples }` від найчастішої категорії (без `is_false`; порядок і обрізання роблять SQL і `buildSummaryInput`). `title` Fake бере зі входу, а не з довідника: сервіс передає `title_uk`. `count` і `examples` Fake ігнорує (їх використовує лише промпт).

Fake спершу рендерить промпт `session-summary.v1` (як це зробить реальний адаптер) і відкидає текст, тож зламаний шаблон промпту валить виклик; потім повертає `{ output: { summary }, promptVersion: 'session-summary.v1', model: 'fake' }`, де `summary` відповідає `SummarySchema` (1–600 символів).

Шаблони (`{N}` – `answers`, `{M}` – `minutes`, `{cat…}` – `title` категорій за порядком входу):

| Категорій | Текст |
|---|---|
| 0 | `Ви відповіли {N} {раз} за {M} хв. Помилок не знайдено, так тримати.` |
| 1 | `Ви відповіли {N} {раз} за {M} хв. Найчастіша помилка: {cat1}. Зосередьтеся на категорії «{cat1}» у наступній сесії.` |
| 2–3 | `Ви відповіли {N} {раз} за {M} хв. Найчастіші помилки: {cat1}, {cat2}, {cat3}. Зосередьтеся на категорії «{cat1}» у наступній сесії.` |

Форма «раз» залежить від `N` і береться з `Intl.PluralRules('uk')`: 1 → «раз», 2–4 → «рази», 5 і далі та 11–14 → «разів», 21 → «раз», 22 → «рази».

Якщо текст довший за 600 символів (дуже довгі назви), кожна назва скорочується до 50 символів (49 символів і «…»), а речення лишається тим самим шаблоном; назви до 50 символів не змінюються.

Новий звіт не заповнює `session_reports.deep_analysis` (`NULL`): у `session_reports` зберігаються лише `summary`, `prompt_version` і `model`, а категорії з кількістю, посилання на `theory_links` і слова сесії сервер рахує з БД при кожному читанні `GET /api/sessions/:id/report`; групи відповідей у «Детально» клієнт будує з деталей сесії (`GET /api/sessions/:id`). Текст самарі – знімок на момент генерації: пізніша позначка «Це не помилка» його не змінює, хоча категорії й групи у звіті оновлюються одразу.

### 2.6 Режими збою

Змінна `FAKE_LLM_FAIL` (enum, порожнє – вимкнено):

- `invalid_json` зачіпає лише `analyzeUtterance`: метод повертає `{ mistakes: "broken" }` (конверт не проходить перевірку, після двох спроб `analysis_status = failed`). `nextTurn` лишається робочим, тож після `failed` діалог триває. `summarizeSession` режим не зачіпає: самарі завжди коректне (відповіді з `failed` у звіт потрапляють без помилок).
- `unavailable` зачіпає кожен метод `FakeLanguageModel` (`analyzeUtterance`, `planSession`, `nextTurn`, `hint`, `summarizeSession`): кидається `LanguageModelUnavailableError` (NFR-6). Те саме для розпізнавання робить `FAKE_STT_FAIL=unavailable`, що зачіпає `transcribe` (`SpeechRecognitionUnavailableError`).

Відображення в HTTP: `LanguageModelUnavailableError` → 503 `LANGUAGE_MODEL_UNAVAILABLE` (`POST /api/sessions/plan`, `POST /api/sessions/:id/hints` і крок аналізу `POST /api/sessions/:id/utterances/:utteranceId/analysis`; на кроці аналізу спершу записується те, що вдалося, репліка лишається `pending`, повтор доробляє решту). Звіт сесії 503 не дає: недоступність під час генерації самарі (і під час доаналізу реплік `pending`, який передує самарі) дає `summary.status = 'unavailable'` у відповіді `GET /api/sessions/:id/report` (200 з агрегатами й словами), рядок `session_reports` не створюється, а наступне читання повторює спробу; `POST /api/sessions/:id/finish` у цьому разі теж 200. Дві невалідні відповіді → 502 `LANGUAGE_MODEL_INVALID_RESPONSE` (для аналізу натомість `failed`, для самарі звіту – `summary.status = 'unavailable'`); `SpeechRecognitionUnavailableError` → 503 `SPEECH_RECOGNITION_UNAVAILABLE` (крок голосу, нічого не записано). Без змінної – нормальна робота.

## 3. Перевірка узгодженості

Для кожної з 5 заготовлених відповідей `FakeSpeechRecognition` модульний тест перевіряє, що `FakeLanguageModel.analyzeUtterance` знаходить очікувані категорії з таблиці розділу 1, а позиції `start`/`end` збігаються з підрядком `text_verbatim`, рівним `original`. Для всіх категорій у правилах тест перевіряє наявність коду в `mistake_categories`. Для `summarizeSession` тест перевіряє шаблони (0, 1, 2–3 категорії, множину «раз», скорочення довгих назв), детермінованість і відповідність `SummarySchema`.
