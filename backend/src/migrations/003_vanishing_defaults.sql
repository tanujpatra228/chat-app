-- Migration: 003_vanishing_defaults
-- Description: Set vanishing mode defaults to enabled with 12 hours

ALTER TABLE conversations
  ALTER COLUMN vanishing_mode SET DEFAULT true,
  ALTER COLUMN vanishing_duration_hours SET DEFAULT 12;

-- Enable vanishing on existing conversations that haven't been explicitly configured
UPDATE conversations
  SET vanishing_mode = true, vanishing_duration_hours = 12
  WHERE vanishing_mode = false AND vanishing_duration_hours = 24;
