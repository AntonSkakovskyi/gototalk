ALTER TABLE utterances ADD COLUMN better_phrasings jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE utterances ADD CONSTRAINT utterances_better_phrasings_check
  CHECK (jsonb_typeof(better_phrasings) = 'array');
