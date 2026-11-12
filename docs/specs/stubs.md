# Fake-адаптери: поведінка заглушок

Специфікація поведінки `FakeSpeechRecognition` і `FakeLanguageModel`. Код пише сесія в `gototalk`. Заглушки детерміновані: той самий вхід дає той самий вихід, тому на них будуються тести й демонстрація без ключів.

Вимоги (лаба 6): BR-7, NFR-4, NFR-6, NFR-12, FR-4, FR-5, FR-6, FR-7, FR-10, FR-11.

Усі коди категорій беруться лише з таблиці `mistake_categories` (0002): `articles`, `verb_tense`, `subject_verb_agreement`, `missing_be`, `prepositions`, `word_order`, `question_form`, `plural_countable`, `conditionals`, `collocation`, `word_choice`, `l1_calque`, `other`. Для `analysis_model` заглушка повертає `fake`, для `analysis_prompt_version` – `fake-v1`.

## 1. FakeSpeechRecognition

`transcribe(audio, mime) → { verbatim, clean }`. Вміст аудіо ігнорується. Відповідь береться з набору нижче за індексом `(кількість user-реплік у сесії) mod 5`; сесія в `transcribe` не відома, тому індекс передає викликач, а за його відсутності береться внутрішній лічильник адаптера (поведінка для тестів: лічильник скидається методом `reset()`).

`clean` = `verbatim` без вагань (`um`, `uh`, `er`, `well,`) і без коми після них, з одним пробілом між словами й великою літерою на початку.

| № | verbatim | Помилки, які знайде FakeLanguageModel |
|---|---|---|
| 0 | Um, yesterday I go to the office and, uh, I have a meeting with my team. I very like my job. | verb_tense, word_order |
| 1 | Well, I am agree that remote work is good. Uh, I work with small team since 2 years. | l1_calque, articles, prepositions |
| 2 | My sister, um, she work in a big company. She busy every day. | subject_verb_agreement, missing_be |
| 3 | I have 25 years and, uh, I live in Kyiv. It depends of the weather, um, if I will have time, I travel. | l1_calque, prepositions, conditionals |
| 4 | Um, we have a meeting in Monday and I need more informations. Uh, I am boring because it is long. | prepositions, plural_countable, word_choice |

Режим збою `FAKE_STT_FAIL=1`: `transcribe` кидає помилку, щоб перевірити повідомлення «Не вдалося розпізнати мовлення, спробуйте ще раз» і те, що введені дані сесії не губляться (NFR-6).

## 2. FakeLanguageModel

Загальне: усі відповіді відповідають Zod-схемам з `packages/shared`. Мова пояснень: `explanation_en` англійською, `translation_uk` українською.

### 2.1 analyzeUtterance(text)

Заглушка застосовує до `text_verbatim` правила з таблиці (регістронезалежні регулярні вирази). Позиції `start`/`end` рахуються в `text_verbatim` (0-based, `end` не включно). Знайдені збіги сортуються за `start`; збіг, що перетинається з попереднім, відкидається. Якщо збігів немає, повертається порожній список. Правила працюють на довільному тексті, тому текстова відповідь (spec 04, п. 2a) аналізується так само, як голосова.

| № | Шаблон (приклад) | Категорія | suggestion | explanation_en | translation_uk |
|---|---|---|---|---|---|
| 1 | `I am agree` | l1_calque | `I agree` | "Agree" is a verb, so it does not need "am". | «Agree» – це дієслово, «am» не потрібне. |
| 2 | `(he|she|it) go/have/do/work/like/want/live/make/play/need` без `-s` | subject_verb_agreement | форма на `-s` (go→goes, have→has, do→does) | With he/she/it the present simple verb takes -s. | З he/she/it дієслово в теперішньому часі має закінчення -s. |
| 3 | `since 2 years`, `since three months` | prepositions | `for 2 years` | Use "for" with a period of time and "since" with a starting point. | «For» – для тривалості, «since» – для моменту початку. |
| 4 | `I have 25 years` | l1_calque | `I am 25 years old` | In English age is expressed with "to be", not "to have". | Вік виражається дієсловом «be», а не «have». |
| 5 | `(yesterday|last week|last month|last year|last night),? I go/see/meet/work/visit/buy/make/take/do/have/want/like/play/watch` | verb_tense | `I` + минула форма (go→went, see→saw, meet→met, buy→bought, make→made, take→took, do→did, have→had, інші +ed) | Use the past simple for finished actions with a past time marker. | Для завершених дій з маркером минулого вживається Past Simple. |
| 6 | `informations`, `advices` | plural_countable | `information`, `advice` | "Information" and "advice" are uncountable and have no plural. | «Information» і «advice» – незлічувані, множини не мають. |
| 7 | `make a photo`, `make photos` | collocation | `take a photo` | We "take" photos, we do not "make" them. | Фото «беруть» (take), а не «роблять» (make). |
| 8 | `why you think/want/like/need/say` | question_form | `why do you think` | In questions add "do" before the subject. | У питаннях перед підметом потрібне допоміжне «do». |
| 9 | `I very like/love/enjoy` | word_order | `I really like` | "Very" does not go before a verb; use "really" or "very much" after the object. | «Very» не ставиться перед дієсловом; вживайте «really» або «very much». |
| 10 | `(I|he|she|it|we|they) busy/tired/ready/late/happy/hungry/interested` без `be` | missing_be | `I am busy` / `she is busy` / `we are busy` | An adjective after the subject needs the verb "be". | Після підмета перед прикметником потрібне дієслово «be». |
| 11 | `if (I|you|he|she|it|we|they) will + дієслово` | conditionals | `if I have` | After "if" in a real condition use the present simple, not "will". | Після «if» у реальній умові вживається Present Simple, а не «will». |
| 12 | `depends of`, `depend of` | prepositions | `depends on` | The verb "depend" takes the preposition "on". | Дієслово «depend» вживається з прийменником «on». |
| 13 | `in Monday`…`in Sunday` | prepositions | `on Monday` | Use "on" with days of the week. | З днями тижня вживається «on». |
| 14 | `(with|in|on|at|for) small/big/new/large/good/nice + team/project/company/office/job` без артикля | articles | `with a small team` | A singular countable noun needs an article. | Злічуваному іменнику в однині потрібен артикль. |
| 15 | `I am boring`, `I was boring` | word_choice | `I am bored` | "Boring" describes a thing that causes the feeling; "bored" describes how you feel. | «Boring» – те, що викликає нудьгу; «bored» – як почувається людина. |

Для кожної відповіді з помилками заглушка додає до 2 кращих формулювань `{ original, better }`: речення, у яких є помилки, із застосованими `suggestion`.

### 2.2 planSession(profile, patterns, previousTopics)

Банк тем за сценою профілю (5 тем × 5 питань). Тема береться за індексом `(кількість раніше запропонованих тем) mod 5` у першій сцені профілю; `Інша тема` бере наступну. Питання англійською.

| Сцена | Теми (за порядком) |
|---|---|
| робота й мітинги | My last project at work; A difficult meeting; Planning a week; Working with a team; A skill I want to learn |
| small talk | Weekend plans; My hometown; Favourite food; A film I watched; Weather and seasons |
| співбесіди | Why I want this job; My strengths; A challenge I solved; My career goals; Questions for the interviewer |
| побут і сервіси | At the doctor; Renting a flat; Ordering food; A problem with an order; Using public transport |
| подорожі | My last trip; Booking a hotel; A dream destination; Getting lost in a city; Travel plans |

Кожна тема має 5 питань: перші чотири універсальні (мета, досвід, думка, порівняння), п’яте – узагальнююче («What would you do differently next time?»). Якщо в `patterns` є елементи, питання №1 замінюється питанням, що провокує найчастіший патерн:

| Категорія | Питання, що провокує патерн |
|---|---|
| verb_tense | Tell me what you did yesterday at work. |
| articles | Describe your office or your room in detail. |
| prepositions | When and where do you usually meet your friends? |
| subject_verb_agreement | What does your best friend do every day? |
| question_form | Ask me three questions about my job. |
| інші | Tell me about a typical day in your life. |

Власна тема (`topic_source = custom`): тема лишається як введена, питання за шаблоном: `What is the first thing that comes to mind when you think about "{topic}"?`, `Why did you choose to talk about "{topic}"?`, `Tell me about your experience with "{topic}".`, `What do you find most difficult about "{topic}"?`, `How do you see "{topic}" in the future?`.

### 2.3 nextTurn(plan, history)

Повертає наступне непоставлене питання плану; коли питання вичерпано, питання-уточнення за шаблоном: `Can you tell me more about "{останнє слово відповіді}"?` (останнє слово довше за 3 літери, без розділових знаків).

### 2.4 hint(kind, input)

- `phrase_start`: початок фрази за темою питання: `I think that…`, `In my opinion…`, `One thing I remember is…`, `Last time I…`, `For me, the most important thing is…` (за номером питання mod 5).
- `translation`: словник UA→EN із ~40 слів: зустріч – meeting; термін – deadline; розклад – schedule; колега – colleague; співбесіда – interview; квиток – ticket; бронювання – booking; готель – hotel; лікар – doctor; квартира – flat; орендувати – rent; замовлення – order; проблема – problem; проєкт – project; команда – team; досвід – experience; навичка – skill; вміти – be able to; звільнитися – quit; зарплата – salary; відпустка – holiday; подорож – trip; погода – weather; вихідні – weekend; сніданок – breakfast; вечеря – dinner; зупинка – stop; потяг – train; літак – plane; аеропорт – airport; валіза – suitcase; допомога – help; рішення – decision; відповідь – answer; питання – question; вибачте – sorry; будь ласка – please; дякую – thank you; відгук – feedback. Невідоме слово: відповідь `{ word: null, message: "Немає в словнику заглушки" }`, нове слово не зберігається.

### 2.5 summarizeSession(session)

Шаблон: `Ви відповіли {N} разів за {M} хв. Найчастіші помилки: {cat1}, {cat2}, {cat3}. Зосередьтеся на категорії «{cat1}» у наступній сесії.` Без помилок: `Ви відповіли {N} разів за {M} хв. Помилок не знайдено, так тримати.` Назви категорій беруться з `title_uk`. Глибокий розбір (`deep_analysis`): помилки сесії, згруповані за категоріями, з посиланнями на `theory_links`.

### 2.6 Режими збою

Змінна `FAKE_LLM_FAIL`: `invalid_json` – заглушка повертає невалідну відповідь (перевірка повтору й `analysis_status = failed` після двох спроб); `unavailable` – кидає помилку недоступності сервісу (NFR-6). Без змінної – нормальна робота.

## 3. Перевірка узгодженості

Для кожної з 5 заготовлених відповідей `FakeSpeechRecognition` модульний тест перевіряє, що `FakeLanguageModel.analyzeUtterance` знаходить очікувані категорії з таблиці розділу 1, а позиції `start`/`end` збігаються з підрядком `text_verbatim`, рівним `original`. Для всіх категорій у правилах тест перевіряє наявність коду в `mistake_categories`.
