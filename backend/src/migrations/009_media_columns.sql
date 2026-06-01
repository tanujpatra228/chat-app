-- Migration: 009_media_columns
-- Description: Add resource_type and duration tracking for video/audio messages

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_resource_type VARCHAR(10) DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER;

-- Backfill existing image messages
UPDATE messages SET media_resource_type = 'image' WHERE message_type = 'image';
