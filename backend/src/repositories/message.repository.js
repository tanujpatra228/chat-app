const pool = require("../config/db");

async function createMessage({ conversationId, senderId, content, replyToId }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, reply_to_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, senderId, content, replyToId || null]
  );

  const message = rows[0];

  // Update conversation's updated_at
  await pool.query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  );

  return message;
}

async function getMessages(conversationId, { limit, cursor }) {
  const params = [conversationId, limit];
  let cursorClause = "";

  if (cursor) {
    cursorClause = "AND m.created_at < $3";
    params.push(cursor);
  }

  const { rows } = await pool.query(
    `SELECT
       m.*,
       u.username AS sender_username,
       u.display_name AS sender_display_name,
       u.avatar_url AS sender_avatar_url,
       rm.content AS reply_to_content,
       rm.sender_id AS reply_to_sender_id,
       ru.username AS reply_to_sender_username
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.conversation_id = $1 ${cursorClause}
     ORDER BY m.created_at DESC
     LIMIT $2`,
    params
  );

  return rows;
}

async function findById(messageId) {
  const { rows } = await pool.query(`SELECT * FROM messages WHERE id = $1`, [
    messageId,
  ]);
  return rows[0] || null;
}

async function softDelete(messageId) {
  const { rows } = await pool.query(
    `UPDATE messages SET is_deleted = true, content = '', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [messageId]
  );
  return rows[0];
}

module.exports = {
  createMessage,
  getMessages,
  findById,
  softDelete,
};
