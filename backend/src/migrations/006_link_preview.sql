-- Migration: 006_link_preview
-- Description: Add link preview fields to messages

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS link_title TEXT,
  ADD COLUMN IF NOT EXISTS link_description TEXT,
  ADD COLUMN IF NOT EXISTS link_image TEXT;
