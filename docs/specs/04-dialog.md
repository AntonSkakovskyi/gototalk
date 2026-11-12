# 04. Сценарій 3: діалог із голосом

Гілка: `feat/04-dialog`. Найважливіший сценарій. Таблиці: `utterances`, `mistakes`, `mistake_patterns`, `mistake_categories`, `hints`, `words`.

## Поведінка

1. Екран показує поточне питання (текст) і велику кнопку запису.
2. Запис: дотик → старт (MediaRecorder), індикатор часу й рівня звуку; дотик → стоп. Максимум 2 хв. Перший запис запитує дозвіл на мікрофон; відмову пояснити й показати, як увімкнути.
3. Файл відправляється `POST /api/sessions/:id/utterances` (multipart). Стани в інтерфейсі: «Розпізнаю…» → «Аналізую…».
4. Бекенд: `SpeechRecognitionPort.transcribe(audio)` → `text_verbatim` (з ваганнями й помилками) і `text_clean` → зберегти репліку `user` (`analysis_status = pending`).
5. Паралельно:
   - аналіз: `LanguageModelPort.analyzeUtterance(...)` → строгий JSON: список помилок `{ start, end, original, suggestion, category, explanation_en, translation_uk }` + кращі формулювання; Zod-валідація, один повтор, далі `analysis_status = failed`;
   - наступне питання: з плану або уточнення до сказаного (`LanguageModelPort.nextTurn(...)`).
6. Збереження: `mistakes` (з `category`), оновлення `mistake_patterns` (`frequency + 1`, `last_seen_at`) у тій самій транзакції; `analysis_prompt_version`, `analysis_model`, `analyzed_at`; `analysis_status = done`.
7. Показ:
   - `immediate`: транскрипт відповіді з підсвіченими фрагментами (за позиціями в `text_verbatim`); дотик до фрагмента → виправлення, пояснення англійською, переклад українською; кнопка «Це не помилка» → `is_false = true`;
   - `deferred`: транскрипт без підсвічування; помилки — у звіті.
   - Потім наступне питання від AI.
8. «Підказка»: два види — початок фрази (`phrase_start`) і переклад слова (`translation`, користувач вводить слово українською). Зберігається в `hints`; перекладене слово додається в `words` (`source = hint`, `state = new`).
9. Якщо слово зі словника користувача (не `active`) трапилось у його `text_clean` → `times_used + 1`, `last_used_at`; якщо стан був `passive` або `partial` → `active`.
10. «Завершити сесію» → `status = finished`, `ended_at` → перехід до звіту (05).

## Порти

- `SpeechRecognitionPort.transcribe(audio: Buffer, mime: string) → { verbatim, clean, words?[] }`. Fake: повертає заздалегідь заданий текст зі свідомими помилками.
- `LanguageModelPort.analyzeUtterance`, `nextTurn`, `hint`. Fake: детерміновані відповіді, узгоджені з Fake-транскриптом.
- Реальні адаптери (Deepgram з filler words, Gemini) — окрема задача наприкінці, якщо буде час.

## Готово, коли

- Unit: зіставлення позицій помилок із текстом (включно з невалідними позиціями від моделі — відкинути помилку, не падати); оновлення патернів; правило переходу слова в `active`; Zod-валідація відповіді аналізу.
- Інтеграційні: завантаження аудіо → репліка + помилки + оновлені патерни (Fake-адаптери); `failed` після двох невалідних відповідей.
- e2e (Playwright з фейковим мікрофоном Chromium: `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`): запис → транскрипт із підсвіченою помилкою → пояснення → наступне питання; підказка; завершення сесії.
- Перевірка на емуляторі Android вручну: запис, дозвіл мікрофона, відображення.
- Промпти: `packages/prompts/error-analysis.v1.md`, `next-turn.v1.md`, `hint.v1.md`.
