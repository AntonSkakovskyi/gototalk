# GoToTalk: технічні рішення

**Стан на:** 2026-11-12. Рішення ухвалено з Антоном в опитуванні; переглядати лише за його згодою.

## 1. Як ведеться розробка

- Код пише Claude Code; Антон планує, коригує, відповідає на питання. Головне обмеження — ліміти плану Claude Pro.
- Процес: plan mode + офіційний плагін `feature-dev` + spec на сценарій у `docs/specs/` + TDD + Stop-хук «не завершувати з червоними тестами» + reviewer-сабагент на Sonnet. Spec Kit, Superpowers, agent teams і Ralph-цикли не використовуємо.
- Модель: `opusplan` (Opus у plan mode, Sonnet у виконанні). Детально — `docs/WORKFLOW.md`.
- Дозволи: `acceptEdits`, allowlist команд; заборонені `git push`, `drizzle-kit push`, читання `.env`. Агент комітить, push робить Антон.
- Git: приватний репозиторій на GitHub (публічний після захисту); гілка на сценарій, PR, CI (lint, typecheck, тести), `/code-review`.
- Порядок: спершу все на заглушках (Fake-адаптери), потім реальні сервіси, якщо лишиться час.

## 2. Ухвалені рішення

| № | Тема | Рішення |
|---|---|---|
| 1 | Схема БД | Схема лабораторної 7 — міграція 0001; зміни MVP — міграція 0002 |
| 2 | Реальні сервіси | Спершу заглушки, реальні STT і LLM — якщо дозволить час |
| 3 | Каркас | Власний: pnpm workspaces, `apps/api`, `apps/web`, `packages/shared`, `packages/prompts`; без Turborepo на старті. Зразок конфігів — github.com/akinurrahman/nestjs-react-monorepo-starter (лише підглядати) |
| 4 | Репозиторій | Приватний, потім публічний |
| 5 | Бекенд | NestJS 12 + Vitest |
| 6 | ORM | Drizzle, стабільна гілка 0.x (v1 — лише якщо на момент старту вийде фінальний реліз) |
| 7 | Міграції | Ручні SQL; `drizzle-kit pull` оновлює TS-схему; генерацію міграцій з TS не використовуємо |
| 8 | Postgres | 17, лише локально в Podman; хостинг — пізніше |
| 9 | Auth | Email + пароль (argon2), короткий access JWT, refresh-токен у httpOnly cookie, хеш у БД; без підтвердження email і відновлення пароля в прототипі |
| 10 | Контракти | Спільні Zod-схеми в `packages/shared` |
| 11 | Запис голосу | Пакетний: MediaRecorder → файл → бекенд → STT; потоковий режим пізніше через той самий порт |
| 12 | Пристрій | Android; емулятор Android Studio і/або телефон через USB |
| 13 | Перевірка STT | ~10 своїх записів зі свідомими помилками, коли дійде до реального STT |
| 14 | Аудіо в розробці | Прапорець `DEV_KEEP_AUDIO`, лише локально, поза репозиторієм |
| 15 | Провайдери AI | Лише безкоштовні тарифи: Deepgram (стартові кредити), Gemini Flash (безкоштовний тариф) для власної розробки |
| 16 | Помилки | Фіксована таксономія з 13 кодів (таблиця `mistake_categories`); строгий JSON від моделі + Zod |
| 17 | Час аналізу | Кожна репліка аналізується одразу; перемикач керує лише показом; без черг і стримінгу |
| 18 | Відтворюваність | `analysis_prompt_version` і `analysis_model` на кожній репліці; промпти — версіоновані файли |
| 19 | UI | Mantine 9 + CSS-модулі на SCSS; без Tailwind |
| 20 | i18n | react-i18next з першого дня, поки лише `uk.json` |
| 21 | Тести | TDD для домену; інтеграційні на тестовій БД; один e2e Playwright на сценарій |
| 22 | Телефон | `adb reverse` на localhost у розробці; пізніше можна загорнути PWA в Android-застосунок |
| 23 | Процес | `feature-dev` + spec-файли |
| 24 | Дозволи агента | Як у розділі 1 |
| 25 | Git | Гілка + PR на сценарій |
| 26 | GDPR у прототипі | Екран згоди перед першим записом + «видалити акаунт»; експорт і політика — MVP |
| 27 | Стан слова `active` | Система ставить його, коли збережене слово вжито в мовленні |
| 28 | Node.js | Node 26 LTS (Active LTS з 28.10.2026; Node 24 перейшов у Maintenance 20.10.2026). pnpm ставиться окремо, corepack не використовуємо |
| 29 | Структура коду | Гібрид Bulletproof React і мінімального FSD: шари `app → pages → features → shared`, межі перевіряє ESLint; api: інфраструктура (`core`, `common`, `integrations`) окремо від доменів (`modules`); деталі в розділі 6 |

## 3. Схема: що змінює 0002 відносно 0001

| Проблема в 0001 | Зміна в 0002 |
|---|---|
| Немає де зберігати refresh-токени | Таблиця `refresh_tokens` |
| `category` у патернах і теорії — вільний текст | Таблиця `mistake_categories` (13 кодів) і зовнішні ключі |
| Помилка втрачає категорію, якщо патерн видалено | `mistakes.category` NOT NULL |
| `start_pos/end_pos` без перевірки | CHECK; позиції в `text_verbatim` |
| Немає статусу аналізу, версії промпту й моделі | `utterances.analysis_status`, `analysis_prompt_version`, `analysis_model`, `analyzed_at` |
| Слова без дати додавання; `Word` і `word` — різні записи | `words.created_at`; унікальність за `lower(lemma)`; CHECK `times_used >= 0` |
| Немає стану «активне слово» | `words.state` приймає `active` |
| `interface_lang` приймає будь-що | CHECK `('uk','en')` |
| Бракує індексів на зовнішні ключі | `goals.user_id`, `hints.session_id`, `exercises.card_id` |

Разом 15 таблиць. Обидві міграції перевірено на чистому PostgreSQL.

## 4. Провайдери AI

| Роль | Кандидат | Застереження |
|---|---|---|
| Розпізнавання | Deepgram Nova-3, стартові кредити ($200 без картки за вторинними джерелами, перевірити на реєстрації) | Увімкнути збереження filler words |
| Мовна модель (розробка) | Gemini API, безкоштовний тариф Flash | Google може використовувати запити безкоштовного тарифу для покращення продуктів; годиться для власної розробки |
| Мовна модель (тест із друзями в ЄС) | Не обрано | В архівних умовах Gemini для користувачів у ЄЕЗ дозволено лише платні сервіси; платити не плануємо — підібрати іншого безкоштовного провайдера перед тестом |

## 5. Інструменти Claude Code

| Що | Навіщо | Установка (PowerShell, у корені репозиторію) |
|---|---|---|
| `typescript-lsp` (плагін) | Точна навігація й помилки TS у монорепо | `npm install -g typescript-language-server typescript`; `claude plugin install typescript-lsp@claude-plugins-official --scope project` |
| `context7` (плагін, MCP) | Актуальна документація NestJS 12, Drizzle, Mantine 9, Vite 8 | `claude plugin install context7@claude-plugins-official --scope project` |
| `playwright` (плагін, MCP) | Перевірка UI в браузері, e2e | `claude plugin install playwright@claude-plugins-official --scope project` |
| `feature-dev` (плагін) | Фази: дослідження → архітектура → реалізація → рев'ю | `claude plugin install feature-dev@claude-plugins-official --scope project` |
| `code-review` (плагін) | Рев'ю PR кількома агентами | `claude plugin install code-review@claude-plugins-official --scope project` |
| `security-guidance` (плагін) | Попередження про секрети, injection, XSS під час генерації (потрібні Python і pip) | `claude plugin install security-guidance@claude-plugins-official --scope project` |
| `reviewer` (сабагент проєкту) | Рев'ю diff перед комітом | Уже в `.claude/agents/reviewer.md` |
| Stop-хук | Не дає завершити задачу з червоними тестами | Уже в `.claude/settings.json` + `.claude/hooks/run-tests.ps1` |
| `/db-migration` (скіл проєкту) | Процедура зміни схеми | Уже в `.claude/skills/db-migration/SKILL.md` |

Більше плагінів не ставимо: кожен додає контекст до кожного запиту й виконує код із нашими правами.

## 6. Структура коду

Рішення 29. Web (`apps/web/src`): гібрид Bulletproof React і мінімального Feature-Sliced Design. Шари `app → pages → features → shared`, імпорти лише вниз, фіча не імпортує іншу фічу. Api (`apps/api/src`): пласкі доменні модулі NestJS у `modules/`, інфраструктура окремо в `core/`, `common/`, `integrations/`.

| Питання | Рішення і причина |
|---|---|
| Повний FSD (entities, widgets, Steiger) | Не беремо: для двох-трьох доменів і одного розробника зайві шари й інструмент лише множать папки. Беремо від FSD ідею односпрямованих шарів і розділення `pages` та `features` |
| Atomic design | Не беремо: атоми й молекули вже дає Mantine, свій поділ на atoms/molecules/organisms дублював би його й розмивав межі. Компонент однієї фічі лежить у `features/<f>/components/`, спільний для двох і більше фіч – у `shared/ui/` (створюється з першим таким компонентом) |
| Mantine як шар атомів | Власних обгорток над Button/Card не робимо; кастомізація через `theme.components` і `X.extend()` / `X.withProps()`. Тема одна: `app/theme/theme.ts` |
| Barrel-файли `index.ts` | Не використовуємо: вони сповільнюють Vite (dev-сервер і збирання підтягують зайві модулі), легко створюють цикли й ховають реальні залежності. Єдиний `index.ts` – справжній модуль `shared/i18n/index.ts` |
| Аліас `@/` | `@/*` → `apps/web/src/*` у `tsconfig.json`, у Vite 8 підхоплюється через `resolve.tsconfigPaths`. Між папками лише `@/`, відносні імпорти лише в межах однієї папки, ніколи `../../`. В імпортах web немає суфікса `.js` (бандлер резолвить сам; api лишається на ESM NodeNext із `.js`) |
| Контроль меж | `eslint-plugin-import-x` (резолвер `eslint-import-resolver-typescript`): `no-restricted-paths` для шарів і фіч, `no-cycle` для циклів, `no-restricted-syntax` для `../../`. Правила в `error`; тести й `shared/testing` з перевірки меж виключені |
| `shared/api → shared/session` | Залежність односпрямована. `shared/session` – лише клієнтський стан (сховище сесії, кеш запитів), без мережі. `refresh.ts` викликає API та оновлює сесію, тож лежить у `shared/api`; у попередній розкладці `auth/refresh.ts` і `auth/session-store.ts` створювали цикл `http ↔ session-store ↔ refresh` |
| Сторінки | Завжди в папці маршруту `pages/<route>/<Name>Page.tsx`, тонкі (для нового коду). Форми Login/Register/Consent винесемо у `features/auth` при наступній зміні цих сторінок (`docs/backlog.md`) |
| Іменування | Файли й папки компонентів PascalCase, решта kebab-case. Папка на компонент лише коли поруч є `.module.scss` або тест |
| Api: чому лише розділення, а не перебудова | Пласкі модулі «одна папка = одна доменна область» уже збігаються з рекомендованою документацією NestJS структурою, тож їх не чіпаємо. Додано лише розділення інфраструктури (`core`: config, db, logger, errors, health; `common`: спільні декоратори й pipe, як `@Public()`, потрібний і health, тому не в `modules/auth`; `integrations`: порти й Fake-адаптери по можливостях, SDK лише тут) і доменів (`modules`), та розбиття найбільшого модуля `auth` на `guards/`, `decorators/`, `persistence/`, `lib/` (підпапка лише за ≥2 файлів одного типу; корінь модуля тримає module, controller, service(s), errors) |
| Api: без гексагональних шарів `domain`/`mappers` | Не беремо: у модулях мало логіки, яка не залежить від Nest і Drizzle, а мапери й domain-типи подвоїли б кількість файлів без вигоди для одного розробника. Порти потрібні лише на межі із зовнішніми сервісами (STT, LLM) і лежать в `integrations/` |
| Api: без аліасу | В api імпорти відносні з `.js` (ESM NodeNext): аліас потребував би резолвера в рантаймі (tsx, Vitest, збирання) і не дає вигоди при неглибокій вкладеності (максимум `../../../`) |
| Api: контроль меж | Ті самі `eslint-plugin-import-x`: зона `no-restricted-paths` забороняє `core`, `common` і `integrations` імпортувати `modules`; SDK провайдерів дозволені лише в `integrations/**`. Правило в `error`. `apps/api/test/` (інтеграційні тести й `support/`) не реорганізовано |
| `packages/shared` | Розкладати за доменами, коли схем стане ~6+ (`docs/backlog.md`) |
