-- Migration: 008_conversation_background
-- Description: Add background image fields to conversations

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS background_image_url TEXT,
  ADD COLUMN IF NOT EXISTS background_image_public_id TEXT;
