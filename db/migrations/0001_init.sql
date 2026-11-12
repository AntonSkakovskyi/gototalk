-- Схема бази даних GoToTalk (PostgreSQL 13+). Використовується в лабораторних 7 і 9.
-- Видалення користувача каскадно видаляє всі його дані (вимога FR-18).

CREATE TABLE users (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email          text NOT NULL UNIQUE,
    password_hash  text NOT NULL,
    consent_at     timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    level           text NOT NULL CHECK (level IN ('A2', 'B1', 'B2', 'C1')),
    scenes          text[] NOT NULL DEFAULT '{}',
    interface_lang  text NOT NULL DEFAULT 'uk',
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goals (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       text NOT NULL,
    scene       text,
    status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE theory_links (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category  text NOT NULL,
    title     text NOT NULL,
    url       text NOT NULL
);

CREATE TABLE sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic          text NOT NULL,
    topic_source   text NOT NULL DEFAULT 'suggested' CHECK (topic_source IN ('suggested', 'custom')),
    feedback_mode  text NOT NULL DEFAULT 'immediate' CHECK (feedback_mode IN ('immediate', 'deferred')),
    status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz
);

CREATE TABLE utterances (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq           integer NOT NULL,
    role          text NOT NULL CHECK (role IN ('assistant', 'user')),
    text_verbatim text NOT NULL,
    text_clean    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);

CREATE TABLE mistake_patterns (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category       text NOT NULL,
    description    text,
    frequency      integer NOT NULL DEFAULT 0 CHECK (frequency >= 0),
    last_seen_at   timestamptz,
    theory_link_id uuid REFERENCES theory_links(id) ON DELETE SET NULL,
    UNIQUE (user_id, category)
);

CREATE TABLE mistakes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    utterance_id   uuid NOT NULL REFERENCES utterances(id) ON DELETE CASCADE,
    pattern_id     uuid REFERENCES mistake_patterns(id) ON DELETE SET NULL,
    original       text NOT NULL,
    suggestion     text,
    explanation_en text,
    translation_uk text,
    start_pos      integer,
    end_pos        integer,
    is_false       boolean NOT NULL DEFAULT false
);

CREATE TABLE words (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lemma           text NOT NULL,
    translation_uk  text,
    state           text NOT NULL DEFAULT 'new'
                    CHECK (state IN ('passive', 'partial', 'new')),
    source          text NOT NULL DEFAULT 'session'
                    CHECK (source IN ('hint', 'session', 'user')),
    times_used      integer NOT NULL DEFAULT 0,
    last_used_at    timestamptz,
    UNIQUE (user_id, lemma)
);

CREATE TABLE hints (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    utterance_id  uuid REFERENCES utterances(id) ON DELETE SET NULL,
    kind          text NOT NULL CHECK (kind IN ('phrase_start', 'translation')),
    text          text NOT NULL,
    word_id       uuid REFERENCES words(id) ON DELETE SET NULL
);

CREATE TABLE session_reports (
    session_id     uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    summary        text NOT NULL,
    deep_analysis  jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cards (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    word_id        uuid NOT NULL UNIQUE REFERENCES words(id) ON DELETE CASCADE,
    front          text NOT NULL,
    back           text NOT NULL,
    due_at         timestamptz NOT NULL DEFAULT now(),
    interval_days  integer NOT NULL DEFAULT 1 CHECK (interval_days > 0)
);

CREATE TABLE exercises (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    kind         text NOT NULL DEFAULT 'fill_blank' CHECK (kind IN ('fill_blank')),
    prompt       text NOT NULL,
    expected     text NOT NULL,
    answer       text,
    is_correct   boolean,
    answered_at  timestamptz
);

-- Індекси під запити планувальника сесій, словника й повторення карток
CREATE INDEX idx_patterns_user_freq  ON mistake_patterns (user_id, frequency DESC);
CREATE INDEX idx_words_user_state    ON words (user_id, state);
CREATE INDEX idx_sessions_user_start ON sessions (user_id, started_at DESC);
CREATE INDEX idx_mistakes_utterance  ON mistakes (utterance_id);
CREATE INDEX idx_cards_due           ON cards (due_at);
