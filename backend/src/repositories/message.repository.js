const pool = require("../config/db");
const { encrypt, decrypt, isEnabled } = require("../utils/encryption");

function decryptMessage(message) {
  if (message.is_deleted || !message.content) return message;

  if (isEnabled() && message.iv && message.auth_tag) {
    return {
      ...message,
      content: decrypt(message.encrypted_content || message.content, message.iv, message.auth_tag),
    };
  }
  return message;
}

async function createMessage({ conversationId, senderId, content, replyToId, expiresAt }) {
  const encrypted = encrypt(content);

  const { rows } = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, encrypted_content, iv, auth_tag, reply_to_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      conversationId,
      senderId,
      isEnabled() ? "" : content,
      isEnabled() ? encrypted.content : null,
      encrypted.iv,
      encrypted.authTag,
      replyToId || null,
      expiresAt || null,
    ]
  );

  const message = rows[0];
  message.content = content;

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
       rm.encrypted_content AS reply_to_encrypted_content,
       rm.iv AS reply_to_iv,
       rm.auth_tag AS reply_to_auth_tag,
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

  return rows.map((row) => {
    const msg = decryptMessage(row);

    if (row.reply_to_content !== null || row.reply_to_encrypted_content) {
      if (isEnabled() && row.reply_to_iv && row.reply_to_auth_tag) {
        msg.reply_to_content = decrypt(
          row.reply_to_encrypted_content || row.reply_to_content,
          row.reply_to_iv,
          row.reply_to_auth_tag
        );
      }
    }

    delete msg.encrypted_content;
    delete msg.iv;
    delete msg.auth_tag;
    delete msg.reply_to_encrypted_content;
    delete msg.reply_to_iv;
    delete msg.reply_to_auth_tag;
    delete msg.search_vector;

    return msg;
  });
}

async function findById(messageId) {
  const { rows } = await pool.query(`SELECT * FROM messages WHERE id = $1`, [
    messageId,
  ]);
  if (!rows[0]) return null;
  return decryptMessage(rows[0]);
}

async function softDelete(messageId) {
  const { rows } = await pool.query(
    `UPDATE messages SET is_deleted = true, content = '', encrypted_content = NULL, iv = NULL, auth_tag = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [messageId]
  );
  return rows[0];
}

async function deleteExpiredMessages() {
  const { rowCount } = await pool.query(
    `DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  return rowCount;
}

async function searchMessages(query, userId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       m.content,
       m.encrypted_content,
       m.iv,
       m.auth_tag,
       m.created_at,
       m.is_deleted,
       u.username AS sender_username,
       ts_headline('english', m.content, plainto_tsquery('english', $1),
         'StartSel=<<, StopSel=>>') AS headline
     FROM messages m
     JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = $2
     JOIN users u ON u.id = m.sender_id
     WHERE m.search_vector @@ plainto_tsquery('english', $1)
       AND m.is_deleted = false
     ORDER BY ts_rank(m.search_vector, plainto_tsquery('english', $1)) DESC
     LIMIT $3`,
    [query, userId, limit]
  );

  return rows.map((row) => {
    const msg = decryptMessage(row);
    delete msg.encrypted_content;
    delete msg.iv;
    delete msg.auth_tag;
    delete msg.search_vector;
    return msg;
  });
}

module.exports = {
  createMessage,
  getMessages,
  findById,
  softDelete,
  deleteExpiredMessages,
  searchMessages,
};
