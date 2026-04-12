-- Migration: 004_image_messages
-- Description: Add image fields to messages table

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_public_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(10) DEFAULT 'text';
