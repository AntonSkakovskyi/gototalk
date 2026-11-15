CREATE TABLE session_words (
    session_id uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    word_id    uuid NOT NULL REFERENCES words (id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, word_id)
);
--> statement-breakpoint
CREATE INDEX idx_session_words_word ON session_words (word_id);
--> statement-breakpoint
CREATE INDEX idx_words_user_created ON words (user_id, created_at DESC, id DESC);
--> statement-breakpoint
INSERT INTO session_words (session_id, word_id)
SELECT DISTINCT session_id, word_id FROM hints WHERE word_id IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE session_reports
    ADD COLUMN prompt_version text,
    ADD COLUMN model text;
