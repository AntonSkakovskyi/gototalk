# GoToTalk — правила для Claude Code

PWA-тренер говоріння англійською для україномовних користувачів (рівень від A2). Користувач відповідає голосом, бачить дослівний транскрипт із підсвіченими помилками, система веде модель учня: патерни помилок і слова зі станами new / partial / passive / active.

Документи (читай перед роботою над відповідною частиною):
- `docs/product.md` — що будуємо, хід сесії, обсяг MVP.
- `docs/tech-decisions.md` — ухвалені технічні рішення. Не переглядай їх без погодження.
- `docs/specs/NN-*.md` — специфікації сценаріїв із критеріями готовності.
- `docs/archive/KICKOFF.md` — порядок старту проєкту (архів).

## Стек (не змінювати без погодження)
- Node 26 LTS (Active LTS з 28.10.2026), pnpm (встановлений окремо, без corepack), pnpm workspaces, TypeScript strict.
- `apps/api`: NestJS 12 (ESM), Vitest, Drizzle ORM (стабільна гілка), PostgreSQL 17.
- `apps/web`: React 19 + Vite 8 + vite-plugin-pwa, Mantine 9 + CSS-модулі на SCSS (`*.module.scss`), TanStack Query, React Router, react-hook-form + Zod, react-i18next. Tailwind не використовуємо.
- `packages/shared`: Zod-схеми й типи — єдине джерело контрактів API для фронту й бекенду.
- `packages/prompts`: промпти до мовної моделі, версіоновані файли (`error-analysis.v1.md`).
- Для API бібліотек (NestJS 12, Drizzle, Mantine 9, Vite 8, vite-plugin-pwa) використовуй context7, а не пам'ять. У запити до context7 не вставляй приватний код чи дані користувачів.

## Середовище
- Windows 11, PowerShell. Контейнери: Podman (`podman compose`), не Docker. Postgres — named volume, не bind-mount. Хост із контейнера: `host.containers.internal`.
- Android (емулятор Android Studio або телефон через USB): `adb reverse tcp:5173 tcp:5173`, відкривати `http://localhost:5173`. Мікрофон працює лише на HTTPS або localhost. Бекенд доступний фронту через проксі Vite `/api`, окремий порт на пристрій не прокидаємо.

## Команди
`pnpm dev` · `pnpm test` · `pnpm test:e2e` · `pnpm lint` · `pnpm typecheck` · `podman compose up -d` · `pnpm db:migrate` · `pnpm db:pull`

## База даних
- Джерело правди — SQL-міграції: 0001 (схема лабораторної 7) і 0002 (зміни MVP), далі нові. Нових таблиць без погодження не вигадувати.
- Міграції пишуться ВРУЧНУ в SQL (кастомні міграції drizzle-kit). Після міграції: `pnpm db:pull` оновлює TS-схему. Не генерувати міграції з TS-схеми (губляться CHECK). Процедура — скіл `/db-migration`.
- Заборонено: `drizzle-kit push`, редагувати чи видаляти вже застосовані міграції, DROP/TRUNCATE поза міграцією.
- Видалення користувача = каскадне видалення (вже в схемі). Не ламати ON DELETE CASCADE.

## Архітектура
- Порти й адаптери (`apps/api/src/integrations/`): `SpeechRecognitionPort` і `LanguageModelPort` — лише через інтерфейси. Доменний код не імпортує SDK провайдерів.
- Для кожного порту є Fake-адаптер (детерміновані відповіді). Тести й режим без ключів працюють на ньому. Адаптер обирається змінною env (`STT_PROVIDER=fake|deepgram`, `LLM_PROVIDER=fake|gemini`).
- Модуль NestJS (`apps/api/src/modules/`) = доменна область (перелік – у розділі «Структура коду»).
- Запис голосу пакетний: MediaRecorder → файл → `POST` на бекенд → STT. Без WebSocket і стримінгу.
- Аналіз кожної репліки запускається одразу після транскрипції; режим фідбеку (`immediate`/`deferred`) керує лише показом.
- Відповідь мовної моделі — строгий JSON, перевірка Zod, один повтор при невалідній відповіді. Категорії помилок лише з таблиці `mistake_categories`. Зберігай `analysis_prompt_version` і `analysis_model` на репліці.
- Позиції помилок (`start_pos`, `end_pos`) рахуються в `utterances.text_verbatim`.

## Інтерфейс
- Мобільний в'юпорт (360–412 px) — основний; десктоп має просто не ламатися.
- Стандартні елементи — компоненти Mantine; власні стилі лише в `*.module.scss`. Тема Mantine — одна, у `apps/web/src/app/theme/theme.ts`.
- Мова інтерфейсу українська; жодного тексту прямо в JSX, лише через i18n (`shared/i18n/uk/*.json`).
- Пояснення помилок: основне англійською, короткий переклад українською.

## Структура коду
Web (`apps/web/src`):
- Шари `app → pages → features → entities → shared`, імпорти лише вниз. Фіча не імпортує іншу фічу, сутність – іншу сутність. Сутність `entities/session` (сесія, репліка й агрегат помилок) має сегменти `api/ lib/ hooks/ components/ testing/`. Усередині `shared` залежність `api → auth-session` односпрямована: `shared/auth-session` – лише клієнтський стан без мережі, тому `refresh.ts` лежить у `shared/api`.
- Підобласть фічі: самодостатня частина, що імпортує з решти фічі лише `api/` і кореневий `lib/`, при ≥ 6 файлах переїжджає в підпапку з тими самими сегментами (`features/dialogue/recording`, `features/dialogue/hint`). Підобласті не імпортують одна одну.
- Новий компонент: потрібен одній фічі → `features/<f>/components/<Name>/`; двом і більше фічам → `shared/ui/`. Компонент, який імпортується поза своєю папкою, має власну папку; приватні підкомпоненти лежать у папці батька. Самотній файл без `.module.scss` і тесту лишається файлом.
- Mantine – наша бібліотека атомів. Власного шару atoms/molecules і обгорток над Button/Card тощо не робимо; кастомізація через `theme.components` + `X.extend()` / `X.withProps()`.
- Тестові хелпери лежать у `testing/` свого зрізу; `shared/testing` імпортує лише `shared` і `@gototalk/shared`.
- Сторінка завжди в папці маршруту `pages/<route>/<Name>Page.tsx` (home, dialogue, report, …) і тонка: форми й логіка живуть у `features`.
- Без barrel-файлів `index.ts` (єдиний `index.ts` – справжній модуль `shared/i18n/index.ts`).
- Імпорти між папками через `@/` (→ `apps/web/src`), відносні лише в межах однієї папки, ніколи `../../`. Суфікса `.js` в імпортах web немає.
- Іменування: файли й папки компонентів PascalCase, усе інше kebab-case.
- Межі шарів, цикли й `../../` перевіряє ESLint (`eslint-plugin-import-x`), порушення дають помилку.
- Єдиний виняток: `*.test.*` і `testing/**` можуть імпортувати `@/app/**` (тести – корінь композиції: рендерять `App`, роутер і тему), решта меж діє і для тестів; у production-коді винятків немає.

Api (`apps/api/src`): `core/`, `common/`, `integrations/`, `modules/`; у корені лише `main.ts`, `configure-app.ts`, `app.module.ts` та їхні тести.
- Модуль NestJS = доменна область у `modules/<name>/`: auth (разом із `/me`), profile, learner-model, session, dialogue, hint, analysis, vocabulary, report. Нові модулі додаємо в цей список, коли вони з'являються. Самодостатня підобласть із власним контролером стає окремим модулем Nest (hint, learner-model). Ендпоінт `POST /sessions/:id/finish` живе в `report` (`SessionFinishController`).
- Корінь модуля – його публічний API: module, контролери, сервіси, errors, типи й публічні чисті хелпери; `auth/decorators/` теж публічна. Підпапки (`persistence/`, `lib/`, `guards/`, `testing/`, підобласті на кшталт `audio/`) приватні – їх не імпортують інші модулі. Усі репозиторії лежать у `persistence/`, навіть якщо він один; правила «≥2 файлів» немає.
- Хелпери блокувань лишаються чистими функціями в корені модуля, транзакційні записи із залежностями – методи експортованих сервісів (`VocabularyWriter`, `AnalysisWriter`).
- Граф модулів (`auth` ← усі; `profile`, `learner-model`, `vocabulary` → `auth`; `session` → `profile`, `learner-model`; `analysis`, `hint` → `session`, `vocabulary`; `dialogue`, `report` → `session`, `analysis`, `vocabulary`) задано `API_MODULE_DEPS` в `eslint.config.js`, зони `import-x/no-restricted-paths` генеруються з нього; `import-x/no-cycle` – помилка.
- `core/` – інфраструктура застосунку (config, db, logger, errors, health). `common/{pipes,decorators,pagination,errors,swagger}` – спільні декоратори, pipe й утиліти, потрібні кільком модулям і core (наприклад `@Public()`: його потребує health, тому він не може лежати в `modules/auth`). Swagger-схеми запитів і відповідей беруться з Zod через `ApiZodBody`/`ApiZodQuery`/`ApiZodResponse` (`common/swagger`). `integrations/` – `adapters.module.ts` (`AdaptersModule`), порти й Fake-адаптери по можливостях (`speech-recognition/{fake}`, `language-model/{prompts,fake,testing}`), SDK провайдерів лише тут. `core`, `common` і `integrations` не імпортують `modules`.
- `packages/shared/src` згруповано за доменами (common, auth, profile, session, analysis, dialogue, report, vocabulary); єдина точка входу – `index.ts`. Схеми лише для API (вивід моделі, транскрипт) живуть в API.
- Тестові дублі модуля лежать у `testing/`. Інтеграційні тести – в `apps/api/test/integration/<module>/`, спільні хелпери – в `apps/api/test/support/`, `global-setup.ts` лишається. Файл тестів ≲ 400 рядків.
- Імпорти відносні з суфіксом `.js` (ESM NodeNext), аліасу в api немає.
- Межі перевіряє ESLint (`import-x/no-restricted-paths`), порушення дають помилку.

## Мова коду й коментарі
- Уся кодова база англійською: код, ідентифікатори, коментарі, назви тестів (`describe`/`it`), опис Swagger, повідомлення винятків і логів, вивід CLI-скриптів, метадані пакетів, README, повідомлення комітів. Українська лише в i18n-ресурсах (`shared/i18n/uk/*.json`) і в користувацьких даних (`translation_uk`, українські зразки відповідей Fake-адаптера, очікувані українські підписи UI в тестах). `docs/` (разом з `docs/archive/KICKOFF.md`), `CLAUDE.md` і скіли в `.claude/skills/` лишаються українською. Застосовані міграції (`db/migrations/0000`–`0002`) не редагуємо навіть заради коментарів; нові міграції пишемо англійською.
- Коментарів за замовчуванням немає. Коментар лише для неочевидного ЧОМУ (обмеження, особливість платформи, обхідний шлях, причина безпеки): один короткий рядок англійською. Не коментувати те, що видно з коду, не залишати нотаток про стан задачі («скелет, реалізація в spec 04»): це місце tasks.md.
- JSDoc лише там, де він фіксує контракт, якого не передають типи (наприклад, «positions are offsets in `text_verbatim`»).
- У промптах сабагентам завжди додавай ці два правила.

## Якість і готовність задачі
- TDD для доменної логіки й сервісів (Vitest): спершу тест, потім код.
- Інтеграційні тести API — на окремій тестовій БД у Podman. Один e2e Playwright на сценарій (мобільний в'юпорт).
- Задача не завершена, поки `pnpm typecheck`, `pnpm lint` і `pnpm test` не зелені (це перевіряє Stop-хук).
- Зміни, що зачіпають більше 3 файлів, — спершу план (plan mode).
- Після реалізації задачі — рев'ю сабагентом `reviewer`, потім коміт.
- UI-зміни перевіряй через Playwright MCP на мобільному в'юпорті.

## Робочий процес
- Кожен сценарій: spec → план (plan mode) → `docs/specs/NN-*.tasks.md` → задачі по одній → рев'ю → PR.
- Одна задача з tasks.md = одна коротка сесія. Після задачі — оновити чекбокс у tasks.md і закомітити.
- Якщо специфікація неоднозначна або суперечить цьому файлу — спитай, не вигадуй.

## Git
- Одна гілка на сценарій (`feat/NN-name`), злиття через PR із CI. У `main` напряму не комітити.
- Агент комітить сам (Conventional Commits). Після завершення сценарію агент пушить свою гілку `feat/NN-*` і створює PR (`gh pr create`). Пуш у `main`, force-push і злиття PR робить лише людина.

## Безпека й приватність
- Секрети лише в `.env` (у `.gitignore`); `.env.example` без значень. Не читати й не виводити `.env`. Жодних ключів у фронтенді чи логах.
- Аудіо не зберігається. Виняток — `DEV_KEEP_AUDIO=true` лише в локальній розробці, папка поза репозиторієм.
- Перед першим записом — екран згоди (`users.consent_at`) з переліком сервісів, куди йде мовлення.
- Паролі — argon2. Refresh-токени зберігаються лише як хеш.
