-- Migration: 005_message_edit
-- Description: Add edit tracking to messages

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
