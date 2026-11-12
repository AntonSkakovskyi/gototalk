# GoToTalk: старт проєкту

Частина А виконує людина (один раз). Частина Б — перший запит до Claude Code.

## А. Підготовка (PowerShell, Windows 11)

```powershell
# 1. Середовище
node -v                                          # очікуємо v26.x (Active LTS)
npm install -g --allow-scripts=pnpm pnpm@latest  # corepack у Node 26 немає
pnpm -v
podman machine init; podman machine start # якщо машина ще не створена
podman compose version                    # якщо "looking up compose provider failed":
pip install podman-compose
claude --version                          # оновлення: claude update
Get-ChildItem Env:ANTHROPIC_API_KEY       # має бути порожньо, інакше Claude Code платить за API, а не з підписки Pro

# 2. Репозиторій
mkdir gototalk; cd gototalk
git init -b main
# розпакувати сюди вміст цього пакета (CLAUDE.md, KICKOFF.md, docs/, db/, .claude/)
git add -A; git commit -m "chore: project brief, specs and Claude Code config"
# створити приватний репозиторій на GitHub і зробити git push

# 3. Плагіни Claude Code (лише офіційний маркетплейс, область — проєкт)
npm install -g typescript-language-server typescript
claude plugin install typescript-lsp@claude-plugins-official --scope project
claude plugin install context7@claude-plugins-official --scope project
claude plugin install playwright@claude-plugins-official --scope project
claude plugin install feature-dev@claude-plugins-official --scope project
claude plugin install code-review@claude-plugins-official --scope project
claude plugin install security-guidance@claude-plugins-official --scope project   # потрібні Python і pip
claude plugin list
```

Якщо маркетплейсу `claude-plugins-official` немає: у сесії Claude Code виконати `/plugin marketplace add anthropics/claude-plugins-official`.

### Перевірка в сесії Claude Code (відкрити `claude` у корені репозиторію)

| Що | Як перевірити |
|---|---|
| Модель | `/model` показує `opusplan` |
| MCP | `/mcp` — context7 і playwright у стані connected |
| Плагіни | після `/` в автодоповненні є `/feature-dev`, `/code-review` |
| Сабагент | майстер `/agents` прибрано з Claude Code; запит «Які сабагенти доступні в цьому проєкті?» — у відповіді має бути `reviewer` |
| Скіл | `/db-migration` є в автодоповненні |
| Хук | `/hooks` показує Stop-хук; повноцінно перевіряється після каркаса: зламати тест і попросити завершити задачу |
| Ліміти | `/usage` — поточне використання 5-годинного й тижневого ліміту |

## Б. Перший запит до Claude Code

Увімкнути plan mode (Shift+Tab, доки не з'явиться plan mode) і вставити:

```
Прочитай CLAUDE.md, docs/product.md, docs/tech-decisions.md і docs/specs/00-scaffold.md.
Склади план каркаса за специфікацією 00 і розбий його на задачі в docs/specs/00-scaffold.tasks.md
(чекбокси, кожна задача — до ~1 години роботи, з критерієм перевірки).
Для API NestJS 12, Drizzle, Mantine 9, Vite 8 і vite-plugin-pwa використовуй context7.
Якщо щось у специфікації неоднозначне — спитай до початку реалізації.
```

Після погодження плану: вийти з plan mode, створити гілку `feat/00-scaffold` і виконувати задачі з tasks.md по одній (деталі — `docs/WORKFLOW.md`).

## Порядок специфікацій

| № | Специфікація | Залежить від |
|---|---|---|
| 00 | `docs/specs/00-scaffold.md` — каркас, БД, порти, CI | — |
| 01 | `docs/specs/01-auth-consent.md` — вхід, згода, видалення | 00 |
| 02 | `docs/specs/02-profile.md` — сценарій 1 | 01 |
| 03 | `docs/specs/03-session-start.md` — сценарій 2 | 02 |
| 04 | `docs/specs/04-dialog.md` — сценарій 3 | 03 |
| 05 | `docs/specs/05-report.md` — сценарій 4 | 04 |
| — | Реальні Deepgram і Gemini, тест на ~10 записах | 04, якщо є час |
