const pool = require("../config/db");

async function findConversationBetween(userOneId, userTwoId) {
  const { rows } = await pool.query(
    `SELECT cp1.conversation_id
     FROM conversation_participants cp1
     JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
     WHERE cp1.user_id = $1 AND cp2.user_id = $2`,
    [userOneId, userTwoId]
  );
  return rows[0]?.conversation_id || null;
}

async function createConversation(userOneId, userTwoId) {
  const client = await require("../config/db").connect();
  try {
    await client.query("BEGIN");

    const { rows: convRows } = await client.query(
      `INSERT INTO conversations DEFAULT VALUES RETURNING id, created_at, updated_at`
    );
    const conversation = convRows[0];

    await client.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [conversation.id, userOneId, userTwoId]
    );

    await client.query("COMMIT");
    return conversation;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getUserConversations(userId) {
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.created_at,
       c.updated_at,
       u.id AS other_user_id,
       u.username AS other_username,
       u.display_name AS other_display_name,
       u.avatar_url AS other_avatar_url,
       u.is_online AS other_is_online,
       u.last_seen AS other_last_seen,
       m.id AS last_message_id,
       m.content AS last_message_content,
       m.sender_id AS last_message_sender_id,
       m.created_at AS last_message_at,
       m.is_deleted AS last_message_is_deleted,
       (
         SELECT COUNT(*)::int FROM messages msg
         WHERE msg.conversation_id = c.id
           AND msg.created_at > COALESCE(
             (SELECT cp_inner.last_read_message_id FROM conversation_participants cp_inner
              WHERE cp_inner.conversation_id = c.id AND cp_inner.user_id = $1),
             '1970-01-01'::timestamptz
           )
           AND msg.sender_id != $1
           AND msg.is_deleted = false
       ) AS unread_count
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
     JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != $1
     JOIN users u ON u.id = cp2.user_id
     LEFT JOIN LATERAL (
       SELECT * FROM messages
       WHERE conversation_id = c.id AND is_deleted = false
       ORDER BY created_at DESC LIMIT 1
     ) m ON true
     ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
    [userId]
  );
  return rows;
}

async function findById(conversationId) {
  const { rows } = await pool.query(
    `SELECT id, created_at, updated_at FROM conversations WHERE id = $1`,
    [conversationId]
  );
  return rows[0] || null;
}

async function isParticipant(conversationId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

async function getParticipantIds(conversationId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
    [conversationId]
  );
  return rows.map((r) => r.user_id);
}

async function updateLastReadMessage(conversationId, userId, messageId) {
  await pool.query(
    `UPDATE conversation_participants
     SET last_read_message_id = $3
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId, messageId]
  );
}

module.exports = {
  findConversationBetween,
  createConversation,
  getUserConversations,
  findById,
  isParticipant,
  getParticipantIds,
  updateLastReadMessage,
};
