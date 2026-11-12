-- 0002_mvp_adjustments.sql
-- Зміни до схеми лабораторної 7 (0001) під технічні рішення від 2026-11-12.
-- Схема 0001 лишається як є (на ній побудовано лабораторну); MVP = 0001 + 0002.
-- Застосовується на порожній БД одразу після 0001.

BEGIN;

-- 1. Refresh-токени (рішення 9: access JWT + refresh у httpOnly cookie, з можливістю відкликання)
CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,            -- зберігаємо лише хеш, не сам токен
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- 2. Фіксована таксономія помилок (рішення 16)
CREATE TABLE mistake_categories (
    code      text PRIMARY KEY,
    title_uk  text NOT NULL,
    title_en  text NOT NULL
);

INSERT INTO mistake_categories (code, title_uk, title_en) VALUES
    ('articles',               'Артиклі',                          'Articles'),
    ('verb_tense',             'Часи дієслів',                     'Verb tenses'),
    ('subject_verb_agreement', 'Узгодження підмета й присудка',    'Subject–verb agreement'),
    ('missing_be',             'Пропущене дієслово be',            'Missing "be"'),
    ('prepositions',           'Прийменники',                      'Prepositions'),
    ('word_order',             'Порядок слів',                     'Word order'),
    ('question_form',          'Побудова питань',                  'Question formation'),
    ('plural_countable',       'Множина й злічуваність',           'Plurals and countability'),
    ('conditionals',           'Умовні речення',                   'Conditionals'),
    ('collocation',            'Сполучуваність слів',              'Collocations'),
    ('word_choice',            'Вибір слова',                      'Word choice'),
    ('l1_calque',              'Калька з української',             'Calque from Ukrainian'),
    ('other',                  'Інше',                             'Other');

ALTER TABLE mistake_patterns
    ADD CONSTRAINT fk_patterns_category
    FOREIGN KEY (category) REFERENCES mistake_categories (code);

ALTER TABLE theory_links
    ADD CONSTRAINT fk_theory_links_category
    FOREIGN KEY (category) REFERENCES mistake_categories (code);

-- 3. Помилка зберігає категорію сама (раніше категорія губилася, якщо патерн видалено: pattern_id ON DELETE SET NULL)
ALTER TABLE mistakes
    ADD COLUMN category text NOT NULL REFERENCES mistake_categories (code),
    ADD CONSTRAINT chk_mistakes_span
        CHECK (start_pos IS NULL OR end_pos IS NULL OR (start_pos >= 0 AND end_pos > start_pos));
COMMENT ON COLUMN mistakes.start_pos IS 'Позиція в utterances.text_verbatim (символи, 0-based)';

-- 4. Статус аналізу репліки + версія промпту й модель (рішення 17 і 18)
ALTER TABLE utterances
    ADD COLUMN analysis_status text NOT NULL DEFAULT 'pending'
        CHECK (analysis_status IN ('pending', 'done', 'failed', 'skipped')),
    ADD COLUMN analysis_prompt_version text,
    ADD COLUMN analysis_model text,
    ADD COLUMN analyzed_at timestamptz;

-- 5. Слова: дата додавання (для дашборда), лічильник не від'ємний, унікальність без урахування регістру
ALTER TABLE words
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
    ADD CONSTRAINT chk_words_times_used CHECK (times_used >= 0),
    DROP CONSTRAINT words_user_id_lemma_key;
CREATE UNIQUE INDEX uq_words_user_lemma ON words (user_id, lower(lemma));

-- 6. Мова інтерфейсу лише з підтримуваних
ALTER TABLE profiles
    ADD CONSTRAINT chk_profiles_interface_lang CHECK (interface_lang IN ('uk', 'en'));

-- 7. Індекси на зовнішні ключі, яких бракувало
CREATE INDEX idx_goals_user      ON goals (user_id);
CREATE INDEX idx_hints_session   ON hints (session_id);
CREATE INDEX idx_exercises_card  ON exercises (card_id);

-- 8. Стан 'active' для слів: ставить система, коли збережене слово вжито в мовленні
--    (головна метрика продукту — перехід із пасивного словника в активний)
ALTER TABLE words
    DROP CONSTRAINT words_state_check,
    ADD CONSTRAINT words_state_check CHECK (state IN ('new', 'partial', 'passive', 'active'));

COMMIT;
