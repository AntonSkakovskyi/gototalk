# GoToTalk

A PWA speaking trainer for Ukrainian-speaking learners of English (level A2 and above): the user answers by voice, sees a verbatim transcript with highlighted mistakes, and the system maintains a learner model (error patterns and words with the states new / partial / passive / active).

## Requirements

- Node 26 (`.node-version`)
- pnpm (version in `packageManager` of the root `package.json`), installed separately, without corepack
- Podman with `podman compose` (Docker is not used)
- For e2e locally: Microsoft Edge (see below)
- For Android: Android Studio (emulator) or a phone over USB, `adb`

## Quick start (PowerShell)

```powershell
Copy-Item .env.example .env
# Fill in every variable in .env that has no value in .env.example (POSTGRES_*, DATABASE_URL, TEST_DATABASE_URL, JWT_ACCESS_SECRET)
pnpm install
podman compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:5173`. `pnpm dev` builds `packages/shared` and starts the api (port 3000) and web (port 5173) together; web proxies `/api` to the backend. Backend check: `http://localhost:3000/api/health`, Swagger: `http://localhost:3000/api/docs`.

The `.env` file is not committed to git. The `gototalk_test` database for integration tests is created by the `db/init` script when the container starts for the first time.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

- `pnpm test` includes the API integration tests, so `podman compose up -d` must be running and `TEST_DATABASE_URL` must be set; Vitest applies migrations to the test database itself (globalSetup), while `pnpm db:migrate` is needed for the dev database.
- `pnpm test:e2e` (Playwright, mobile viewport 360×800) needs the database up: `/api/health` checks the connection to it. Playwright starts the apps itself (or reuses an already running `pnpm dev`). Locally the tests run in the installed Edge; another channel can be set with the `PW_CHANNEL` variable. CI uses Playwright Chromium: `pnpm exec playwright install --with-deps chromium`.

## Authentication

Email and password sign-up (no email confirmation). The API issues a 15-minute access JWT, kept only in the memory of the frontend, and a 30-day refresh token in the `gtt_refresh` cookie (HttpOnly, Secure, SameSite=Strict, `Path=/api/auth`); only its SHA-256 hash is stored in `refresh_tokens`. A refresh rotates the token. Presenting a rotated token again within 60 seconds (a reload or a second tab while the new cookie was lost) is not treated as theft: it yields another new token and revokes nothing. A later replay deletes all refresh tokens of that user, and logout deletes the presented token. After the first sign-in the consent screen must be accepted before any recording (`users.consent_at`). The account can be deleted from the profile (password required); the cascade removes the user's data.

- `JWT_ACCESS_SECRET` is required (at least 32 characters). Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- `pnpm db:seed` creates the demo user `demo@gototalk.local` with the password `demo-password-1` (local development only). The demo user already has a profile (level B1, scenes `work_meetings` and `small_talk`, two goals), so it skips onboarding.
- `pnpm test:e2e` runs against the dev database and removes the accounts it creates (`e2e-<uuid>@example.test`); after a killed run, remove leftovers with `DELETE FROM users WHERE email LIKE 'e2e-%@example.test'`.

## Profile and onboarding

After consent, a user without a profile is redirected to `/onboarding` (level, then scenes, then goals) and returns to the page they requested once it is finished. The profile page edits level, scenes and goals and shows the learner model (top error patterns and word counts by state). If the silent token refresh fails on startup (network or server error), the app shows a retry screen instead of the login page.

Scenes are stored as an array of strings: either a preset code (`work_meetings`, `small_talk`, `interviews`, `daily_services`, `travel`) or custom free text.

Profile endpoints are protected by the access JWT and do not require consent (see Swagger for the schemas):

| Method and path                  | Description                                                               |
| -------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/profile`               | Current profile; `404 PROFILE_NOT_FOUND` if it does not exist yet         |
| `PUT /api/profile`               | Create or replace the profile (level, scenes)                             |
| `GET /api/goals`                 | Goals of the user                                                         |
| `POST /api/goals`                | Create a goal; at most 3 active goals, otherwise `409 ACTIVE_GOALS_LIMIT` |
| `PATCH /api/goals/:id`           | Update a goal                                                             |
| `DELETE /api/goals/:id`          | Delete a goal                                                             |
| `GET /api/profile/learner-model` | Top 5 error patterns and word counts by state                             |

Foreign and unknown goal ids both return `404 GOAL_NOT_FOUND`.

## Sessions

Starting a session: the home page (`/`) has a "Start session" button that opens `/sessions/new`. The page proposes a topic and five questions built from the profile (level, scenes, active goals and the most frequent error patterns). The user can ask for another topic (up to 3 times), enter their own topic, and choose the feedback mode (`immediate` by default, or `deferred`). "Start" creates the session and opens `/sessions/:id`, which shows the topic and the dialogue (see Dialogue below). The home page lists the 10 most recent sessions; an active one has a "Continue" action.

A user has at most one active session: starting a new one finishes the previous one in the same transaction (the user row is locked with `FOR NO KEY UPDATE`, and the partial unique index `sessions_one_active_per_user` is the backstop). All five planned questions are stored in `sessions.plan` (JSONB, never returned by the API); the first question is also saved as the first assistant utterance.

Sessions endpoints are protected by the access JWT (see Swagger for the schemas):

| Method and path           | Consent      | Description                                                                                                                                                                                                                                                      |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/sessions/plan` | required     | Proposes `{ topic, topicSource, questions }`; nothing is stored. Body: `previousTopics` (at most 3, otherwise `400 VALIDATION_ERROR`) and optional `customTopic`. Errors: `403 CONSENT_REQUIRED`, `404 PROFILE_NOT_FOUND`, `502 LANGUAGE_MODEL_INVALID_RESPONSE` |
| `POST /api/sessions`      | required     | Starts a session from the plan the user was shown (topic, topicSource, five questions, feedbackMode); `201` with the session and its first utterance. Errors: `400`, `401`, `403 CONSENT_REQUIRED`                                                               |
| `GET /api/sessions`       | not required | The 10 most recent sessions, newest first                                                                                                                                                                                                                        |
| `GET /api/sessions/:id`   | not required | A session with its utterances ordered by `seq`; a foreign, unknown or malformed id gives `404 SESSION_NOT_FOUND`                                                                                                                                                 |

The planning request sends the level, scenes, goals and custom topic to the language model, which is why consent is required for `plan` and start but not for reads.

The planning prompt is `packages/prompts/session-plan.v1.md`. The package has no build step: the api resolves the file through `createRequire().resolve('@gototalk/prompts/session-plan.v1.md')`, which works from both source and `dist`. The prompt id is the file name without `.md`, and the learner data is inserted as JSON at the single `{{input}}` placeholder. The model response must pass the Zod schema; an invalid response is retried once and then returns `502 LANGUAGE_MODEL_INVALID_RESPONSE`.

Migration 0003 adds `sessions.plan` and the one-active-session index; apply it with `pnpm db:migrate`. `pnpm db:seed` upserts the demo profile and goals and fills the plan of the seeded demo session, so it can be re-run.

With `LLM_PROVIDER=fake` the planner is deterministic: the topic is taken from a bank of five topics per scene preset by the number of previous topics, and the first question is replaced by a question that provokes the user's most frequent error pattern. A custom topic is used as typed, with template questions.

## Dialogue

The dialogue screen (`/sessions/:id`) shows the current question, takes a voice answer (the record button comes first) or a typed one ("Write instead" opens the text form, which then stays open between turns), highlights the mistakes in the verbatim transcript (with the explanation in English, a short Ukrainian translation and a "Not a mistake" action), shows up to two better phrasings and asks the next question. The feedback mode only changes what the client shows: the API always returns the mistakes, and `deferred` hides the highlighting in the dialogue but not in the report. "Finish" asks for confirmation and opens `/sessions/:id/report`, a minimal report with the topic, the number of answers, the duration and all answers with their highlighted mistakes. A hint panel offers a phrase starter for the current question and the English translation of a Ukrainian word (a translated word is saved to the vocabulary as `new`).

An answer is processed in two requests, so each state the user sees is a real request:

1. `POST /api/sessions/:id/utterances` stores the answer as a `pending` user utterance (a typed answer makes no model call; a voice answer is transcribed first) and records the use of saved words.
2. `POST /api/sessions/:id/utterances/:utteranceId/analysis` analyses the answer and creates the next question.

Step 2 is idempotent: it does only what is still missing (the analysis while the utterance is `pending`, the next question while there is none), so a repeated or parallel call returns the stored result and creates no duplicates. The models are called outside any transaction; the result is written under a lock on the session row with a re-check. If the language model is unavailable, whatever succeeded is stored first, then `503 LANGUAGE_MODEL_UNAVAILABLE` is returned, the utterance stays `pending` and a repeat completes the rest. Two invalid analysis responses in a row make the utterance `failed` (terminal) and the call still returns `200` with the next question; two invalid next-question responses give `502 LANGUAGE_MODEL_INVALID_RESPONSE`. When the page loads, the client calls step 2 itself for an answer that has no reply yet.

| Method and path                                           | Consent      | Description                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/sessions/:id/utterances`                       | required     | Either JSON `{ text }` (1 to 1000 characters after trimming) or multipart with one audio file in the field `audio` (see Voice answers). `201` with the pending utterance. Errors: `400 VALIDATION_ERROR`, `401`, `403 CONSENT_REQUIRED`, `404 SESSION_NOT_FOUND`, `409 SESSION_FINISHED`, `409 ANSWER_NOT_EXPECTED` (the last utterance is not an assistant question), `413 AUDIO_TOO_LARGE`, `415 AUDIO_UNSUPPORTED`, `503 SPEECH_RECOGNITION_UNAVAILABLE` |
| `POST /api/sessions/:id/utterances/:utteranceId/analysis` | required     | No body. `200` with `{ utterance, reply, planRemaining }`; `reply` is `null` when no next question was created (for example, the session was finished before it). Errors: `401`, `403 CONSENT_REQUIRED`, `404 SESSION_NOT_FOUND` or `UTTERANCE_NOT_FOUND`, `502 LANGUAGE_MODEL_INVALID_RESPONSE`, `503 LANGUAGE_MODEL_UNAVAILABLE`                |
| `PATCH /api/sessions/:id/mistakes/:mistakeId`             | not required | Body `{ isFalse: true }`; `200` with the mistake. Repeating it changes nothing. Errors: `400`, `401`, `404 MISTAKE_NOT_FOUND`                                                                                                                                                        |
| `POST /api/sessions/:id/hints`                            | required     | Body `{ kind: "phrase_start" }` or `{ kind: "translation", word }` (1 to 60 characters after trimming). `200` with `{ kind: "phrase_start", text }` or `{ kind: "translation", word }`, where `word` is `null` for an unknown word. Errors: `400 VALIDATION_ERROR`, `401`, `403 CONSENT_REQUIRED`, `404 SESSION_NOT_FOUND`, `409 SESSION_FINISHED` or `ANSWER_NOT_EXPECTED`, `502 LANGUAGE_MODEL_INVALID_RESPONSE`, `503 LANGUAGE_MODEL_UNAVAILABLE` |
| `POST /api/sessions/:id/finish`                           | not required | `200` with the session; finishing a finished session returns it unchanged (`ended_at` is kept). Errors: `401`, `404 SESSION_NOT_FOUND`                                                                                                                                               |

Consent is required only on the two answer steps and on hints, which send data to the providers. A foreign, unknown or malformed id gives the same `404`; for a deleted user a route with the consent guard gives `401` and the others `404`. A request body that fails validation gives `400 VALIDATION_ERROR`, while an internal schema failure (a corrupted row, a bad model response) gives `500 INTERNAL_ERROR`.

Voice answers: the client records with `MediaRecorder` (the first supported of `audio/webm;codecs=opus`, `audio/ogg;codecs=opus`, `audio/mp4`), stops automatically after 120 seconds (`MAX_RECORDING_SECONDS`, a client-side limit) and sends the recording as multipart `audio`. The server keeps the file in memory only (never on disk or in the database) and accepts it when it is at most 5 MiB (`MAX_AUDIO_BYTES`), its base MIME type is `audio/webm`, `audio/ogg` or `audio/mp4` (the `;codecs=` parameter is ignored) and the file signature matches that type. Sending a file together with a text field, extra fields or no body gives `400 VALIDATION_ERROR`; a file over the limit gives `413 AUDIO_TOO_LARGE`; an unsupported type or signature gives `415 AUDIO_UNSUPPORTED`. The session is checked first (404, 409), then the format, then the speech recognition runs outside the transaction; if it fails the api returns `503 SPEECH_RECOGNITION_UNAVAILABLE` and stores nothing, so the client can resend the same recording or type the answer. The recognised text goes through the same steps as a typed answer (`text_verbatim` is the transcript with fillers, `text_clean` has them removed). Audio, the request body and the transcript are never logged. Only the server-side size is limited; the real duration is not checked yet (`docs/backlog.md`).

With `NODE_ENV=development` you can keep a copy of every accepted recording for debugging: set `DEV_KEEP_AUDIO=true` and `DEV_AUDIO_DIR` to an absolute path outside the repository (the api refuses to start with `DEV_KEEP_AUDIO=true` in any other environment or without the directory). The copy is written after the answer is stored, named `<utteranceId>.webm|ogg|m4a`; a failed write is logged without the path and does not fail the request. Copies are not cleaned up automatically.

Hints: the question comes from the last assistant utterance, and `phrase_start` returns a sentence starter for it. A `translation` hint saves the translated word as a vocabulary word (`source = hint`, `state = new`) and stores the hint with the current question; an existing word is left unchanged and an unknown word stores nothing. The model response is checked before saving: a phrase of 1 to 200 characters, or an English word of 1 to 60 characters (letters, spaces, apostrophes and hyphens) or `null`, and its kind must match the request; otherwise the api returns `502`. If the question changes while the model is running (for example, the user answered in another tab), the hint is not saved and the api returns `409 ANSWER_NOT_EXPECTED`.

Mistake positions (`start`, `end`) are UTF-16 offsets in `utterances.text_verbatim`, `end` exclusive, so `text.slice(start, end)` equals `original`. The model's positions are only a hint: the api keeps a mistake whose slice matches, otherwise moves it to the nearest exact occurrence of `original`, and drops it when there is none or when it overlaps the previous one. The analysis response is validated in two tiers: the envelope (`{ mistakes, better }`, at most 30 and 5 items) is retried once, then each item is checked on its own and invalid items are dropped; at most two `better` phrasings are kept. Each analysed utterance stores `analysis_prompt_version` (the prompt id, for example `error-analysis.v1`) and `analysis_model`. A saved mistake adds 1 to the user's pattern for its category; "Not a mistake" subtracts 1 (not below 0, only once per mistake). A saved word that appears in the cleaned answer (single words and phrases of up to 4 words, no lemmatisation) becomes `active`.

Prompts live in `packages/prompts` (the id is the file name without `.md`): `error-analysis.v1` (mistakes and better phrasings), `next-turn.v1` (the next question from the remaining planned questions and the history) and `hint.v1` (a phrase starter or a word translation, used by the hints endpoint). Migration 0004 adds `utterances.better_phrasings` (JSONB array, default `[]`); apply it with `pnpm db:migrate`.

With `STT_PROVIDER=fake` and `LLM_PROVIDER=fake` the adapters are deterministic and need no keys (the real providers are not implemented yet and are rejected at startup). The fake analysis finds mistakes with 15 case-insensitive rules (see `docs/specs/stubs.md`), and the fake next-turn returns the first remaining planned question or a follow-up about the last long word of the answer. Failure modes for tests and demos are set in `.env`:

- `FAKE_LLM_FAIL=invalid_json`: the analysis response is invalid, so the utterance becomes `failed` while the next question still works.
- `FAKE_LLM_FAIL=unavailable`: every language model call fails, which gives `503 LANGUAGE_MODEL_UNAVAILABLE` (this also applies to `POST /api/sessions/plan`).
- `FAKE_STT_FAIL=unavailable`: speech recognition fails, so a voice answer gives `503 SPEECH_RECOGNITION_UNAVAILABLE` and nothing is stored (typed answers are not affected).

The fake speech recognition ignores the audio and returns one of five canned transcripts by the number of the user's earlier answers in the session (the first voice answer always gives the same one), so any non-empty recording works. The fake hints return a phrase starter by the question number (counted from 1) modulo 5 and translate words from a dictionary of about 40 Ukrainian words (for example "зустріч" gives "meeting").

### Trying voice locally

With `pnpm dev` running, open `http://localhost:5173` in a Chromium browser (the microphone works on `localhost`) and record an answer. To avoid a real microphone and the permission prompt, start the browser with the flags the e2e tests use (`playwright.config.ts`): `--use-fake-ui-for-media-stream` (grants the permission) and `--use-fake-device-for-media-stream` (a synthetic audio source). `pnpm test:e2e` runs the voice scenarios (`e2e/voice.spec.ts`) in Microsoft Edge locally, or in Playwright Chromium when `CI` is set.

On Android (the manual check `[TC-04-06]`), run `adb reverse tcp:5173 tcp:5173`, open `http://localhost:5173` in Chrome, allow the microphone and record an answer (see Android and PWA below).

## Android and PWA

The browser microphone works only over HTTPS or on `localhost`, so the app is opened through `localhost` with a forwarded port:

```powershell
adb reverse tcp:5173 tcp:5173
```

Then open `http://localhost:5173` in Chrome on the emulator or phone (`pnpm dev` must be running on the PC). No separate port is needed for the backend: the frontend reaches it through the Vite `/api` proxy. To install the PWA, use the browser menu: "Install app" / "Add to home screen".

Vite listens on `127.0.0.1` (see `server.host` in `apps/web/vite.config.ts`): on Windows the default `localhost` is bound only to IPv6 `[::1]` while `adb reverse` connects over IPv4, and Chrome shows `ERR_EMPTY_RESPONSE` or a black screen. If the page is empty after a port change or an emulator restart, run `adb reverse tcp:5173 tcp:5173` again.

## Repository structure

```
apps/api         NestJS 12 (ESM), Vitest, Drizzle ORM
apps/web         React 19 + Vite 8, Mantine 9, vite-plugin-pwa
packages/shared  Zod schemas and types of the API contracts
packages/prompts Versioned prompts for the language model
db/              SQL migrations (db/migrations), Postgres init scripts (db/init), seed.sql
e2e/             Playwright tests
docs/            product, technical decisions, specifications
```

Web (`apps/web/src`) is split into layers that import only downward: `app → pages → features → shared`. Cross-folder imports use the `@/` alias (→ `apps/web/src`); ESLint (`eslint-plugin-import-x`) enforces the boundaries.

```
app/       App, layout (AppLayout, BottomNav), providers (AuthBootstrap), router guards, Mantine theme
pages/     one folder per route: login, register, consent, onboarding, session, new-session, dialog, report, words, history, profile
features/  one folder per domain, e.g. auth/{api,lib,components}
shared/    api (HTTP client, refresh), session (client state), i18n, testing
```

Api (`apps/api/src`) keeps infrastructure apart from domain modules; imports are relative with a `.js` suffix (ESM). `core`, `common` and `integrations` never import `modules`, which ESLint enforces.

```
core/          config, db (schema, relations), logger, errors, health
common/        decorators and pipes shared by several modules and core (@Public, ZodBodyPipe)
integrations/  ports with fake adapters per capability (speech-recognition, language-model); provider SDKs only here
modules/       one folder per domain: auth (guards, decorators, persistence, lib), me, profile, session, dialogue, analysis, vocabulary
```

## Database and migrations

The source of truth is the SQL migrations in `db/migrations` (drizzle-kit, custom migrations). They are written by hand and applied with `pnpm db:migrate`; afterwards `pnpm db:pull` updates the TS schema `apps/api/src/core/db/schema.ts` (do not edit it manually). Forbidden: `drizzle-kit push`, editing already applied migrations, `podman compose down -v`. The full procedure is the `/db-migration` skill (`.claude/skills/db-migration/SKILL.md`).

## Documentation

- [docs/product.md](docs/product.md): what we are building, session flow, MVP scope
- [docs/tech-decisions.md](docs/tech-decisions.md): accepted technical decisions
- [docs/specs](docs/specs): scenario specifications and test cases
- [CLAUDE.md](CLAUDE.md): rules for working with Claude Code
