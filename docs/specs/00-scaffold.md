# 00. Каркас проєкту

Гілка: `feat/00-scaffold`. Мета: порожній, але робочий монорепо, у якому все наступне лише додається.

Вимоги (лаба 6): BR-3, BR-7, FR-19, NFR-4, NFR-8, NFR-9, NFR-12, NFR-14, NFR-15.

Назва кожного тесту починається з ID тест-кейса, наприклад `[TC-00-03] ...`; перелік тест-кейсів у `docs/specs/test-cases.md`.

## Структура

```
apps/
  api/        NestJS 12 (ESM), Vitest, Drizzle
  web/        React 19 + Vite 8, Mantine 9, vite-plugin-pwa
packages/
  shared/     Zod-схеми й типи контрактів API
  prompts/    промпти до мовної моделі (поки порожньо + README)
db/migrations/ 0001_init.sql, 0002_mvp_adjustments.sql (перенести туди, де їх застосовує drizzle-kit)
docs/
compose.yaml
.env.example
```

## Що зробити

1. pnpm workspaces, TypeScript strict зі спільним `tsconfig.base.json`, ESLint + Prettier, скрипти з CLAUDE.md (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `db:migrate`, `db:pull`).
2. `compose.yaml` для Podman: Postgres 17, named volume, порт 5432; друга БД `gototalk_test` для інтеграційних тестів (init-скрипт).
3. Drizzle: перенести 0001 і 0002 як кастомні SQL-міграції drizzle-kit (перевір через context7, як drizzle-kit застосовує ручні SQL-міграції у стабільній гілці), застосувати, `drizzle-kit pull` → TS-схема в `apps/api/src/db/schema.ts`. Перевірити, що 15 таблиць і всі CHECK на місці.
4. NestJS: модуль конфігурації з валідацією env через Zod, глобальний фільтр помилок (єдиний формат `{ error: { code, message } }`), логер Pino, health-ендпоінт `GET /api/health` (перевіряє з'єднання з БД), Swagger на `/api/docs`.
5. Порти: інтерфейси `SpeechRecognitionPort` і `LanguageModelPort` + Fake-адаптери, вибір через `STT_PROVIDER` / `LLM_PROVIDER`.
   Назви сервісів ядра (щоб діаграма класів лабораторної 7 відповідала коду): `LearnerModelService` у модулі profile (`weakAreas`, `vocabularyStats`, `applyAnalysis`), `SessionPlannerService` у session (`planSession`), `MistakeAnalyzerService` в analysis (`analyzeUtterance`, групування помилок у патерни). Метод `nextQuestion` з лабораторної 7 реалізується як `nextTurn` у dialogue. Назви методів портів беруться зі специфікацій 03–05. Сервіси залежать лише від портів і `LearnerModelService`, не від SDK провайдерів.
6. Web: Vite + Mantine (тема в `theme.ts`, SCSS-модулі працюють), React Router, TanStack Query, i18next з `uk.json`, мобільний layout із нижньою навігацією (поки порожні вкладки), проксі `/api` на бекенд, PWA-маніфест і service worker (vite-plugin-pwa).
7. CI на GitHub Actions: install, lint, typecheck, test (з Postgres як service).
8. `.gitignore` (включно з `.env`, папкою dev-аудіо), `.env.example`, README з командами запуску на Windows.

## Готово, коли

- `podman compose up -d` + `pnpm db:migrate` створюють 15 таблиць на чистій БД.
- `pnpm dev` піднімає обидва застосунки; `http://localhost:5173` показує мобільний layout українською; `/api/health` повертає ok.
- На емуляторі Android після `adb reverse tcp:5173 tcp:5173` застосунок відкривається, і його можна встановити як PWA.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` зелені (є хоча б по одному тесту на api і web).
- Unit-тест: Fake-адаптери повертають детерміновані відповіді.
