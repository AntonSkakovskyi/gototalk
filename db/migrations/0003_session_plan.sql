ALTER TABLE sessions ADD COLUMN plan jsonb;
--> statement-breakpoint
ALTER TABLE sessions ADD CONSTRAINT sessions_plan_check
  CHECK (plan IS NULL OR (jsonb_typeof(plan) = 'object' AND COALESCE(jsonb_typeof(plan -> 'questions'), '') = 'array'));
--> statement-breakpoint
-- Keep only the newest active session per user so the unique index can be built on existing data
UPDATE sessions s SET status = 'finished', ended_at = COALESCE(s.ended_at, now())
WHERE s.status = 'active' AND EXISTS (
  SELECT 1 FROM sessions n WHERE n.user_id = s.user_id AND n.status = 'active'
    AND (n.started_at, n.id) > (s.started_at, s.id));
--> statement-breakpoint
CREATE UNIQUE INDEX sessions_one_active_per_user ON sessions (user_id) WHERE status = 'active';
