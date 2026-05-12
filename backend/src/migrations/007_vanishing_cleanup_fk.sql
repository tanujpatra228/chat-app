-- Migration 007: Fix reply_to_id FK so physical deletion of expired parent messages
-- does not violate foreign key constraints. ON DELETE SET NULL preserves child
-- messages (the reply) while clearing the dangling reference.

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;

ALTER TABLE messages
  ADD CONSTRAINT messages_reply_to_id_fkey
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
