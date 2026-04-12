-- Migration: 002_phase3_features
-- Description: Add vanishing mode columns, encryption columns, and full-text search

-- Vanishing mode on conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS vanishing_mode BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vanishing_duration_hours INTEGER DEFAULT 24;

-- Encryption columns on messages (IV + auth tag stored separately)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
  ADD COLUMN IF NOT EXISTS iv VARCHAR(32),
  ADD COLUMN IF NOT EXISTS auth_tag VARCHAR(32);

-- Full-text search on messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(search_vector);

-- Function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_update ON messages;
CREATE TRIGGER messages_search_update
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_search_vector_trigger();

-- Backfill existing messages
UPDATE messages SET search_vector = to_tsvector('english', COALESCE(content, ''))
  WHERE search_vector IS NULL;
