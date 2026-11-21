-- Additive migration for databases created before project environment and
-- dashboard background metadata were introduced. Safe to run more than once.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'development';

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS background_id TEXT NOT NULL DEFAULT 'untitled-blend';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_environment_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_environment_check
      CHECK (environment IN ('development','staging','production'));
  END IF;
END $$;
