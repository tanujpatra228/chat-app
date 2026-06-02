const { pool } = require("../config/db");
const { encrypt, decrypt, isEnabled } = require("../utils/encryption");

function mediaLabel(messageType) {
  if (messageType === "image") return "📷 Photo";
  if (messageType === "video") return "🎥 Video";
  if (messageType === "audio") return "🎵 Audio";
  return "";
}

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

async function createMessage({ conversationId, senderId, content, replyToId, expiresAt, messageType, nudgeType, imageUrl, imagePublicId, mediaResourceType, mediaDurationSeconds }) {
  const encrypted = content ? encrypt(content) : { content: null, iv: null, authTag: null };

  const { rows } = await pool.query(
    `INSERT INTO messages (
       conversation_id, sender_id, content, encrypted_content, iv, auth_tag,
       reply_to_id, expires_at, message_type, nudge_type,
       image_url, image_public_id, media_resource_type, media_duration_seconds
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      conversationId,
      senderId,
      content && isEnabled() ? "" : (content || ""),
      content && isEnabled() ? encrypted.content : null,
      encrypted.iv,
      encrypted.authTag,
      replyToId || null,
      expiresAt || null,
      messageType || "text",
      nudgeType || null,
      imageUrl || null,
      imagePublicId || null,
      mediaResourceType || "image",
      mediaDurationSeconds || null,
    ]
  );

  const message = rows[0];
  message.content = content;

  if (replyToId) {
    const { rows: replyRows } = await pool.query(
      `SELECT rm.content, rm.encrypted_content, rm.iv, rm.auth_tag, rm.message_type, rm.sender_id, ru.username AS sender_username
       FROM messages rm
       JOIN users ru ON ru.id = rm.sender_id
       WHERE rm.id = $1`,
      [replyToId]
    );
    if (replyRows[0]) {
      const r = replyRows[0];
      let replyContent = r.content;
      if (isEnabled() && r.iv && r.auth_tag) {
        replyContent = decrypt(r.encrypted_content || r.content, r.iv, r.auth_tag);
      }
      message.reply_to_content = replyContent || mediaLabel(r.message_type);
      message.reply_to_sender_id = r.sender_id;
      message.reply_to_sender_username = r.sender_username;
    }
  }

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
       rm.message_type AS reply_to_message_type,
       rm.sender_id AS reply_to_sender_id,
       ru.username AS reply_to_sender_username
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN messages rm ON rm.id = m.reply_to_id
     LEFT JOIN users ru ON ru.id = rm.sender_id
     WHERE m.conversation_id = $1 ${cursorClause}
       AND (m.expires_at IS NULL OR m.expires_at > NOW())
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
      if (!msg.reply_to_content && row.reply_to_message_type) {
        msg.reply_to_content = mediaLabel(row.reply_to_message_type);
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

async function editMessage(messageId, newContent) {
  const encrypted = encrypt(newContent);

  const { rows } = await pool.query(
    `UPDATE messages
     SET content = $2, encrypted_content = $3, iv = $4, auth_tag = $5,
         is_edited = true, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      messageId,
      isEnabled() ? "" : newContent,
      isEnabled() ? encrypted.content : null,
      encrypted.iv,
      encrypted.authTag,
    ]
  );

  const message = rows[0];
  if (message) message.content = newContent;
  return message;
}

async function softDelete(messageId) {
  const { rows } = await pool.query(
    `UPDATE messages SET is_deleted = true, content = '', encrypted_content = NULL, iv = NULL, auth_tag = NULL, image_url = NULL, image_public_id = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [messageId]
  );
  return rows[0];
}

async function updateLinkPreview(messageId, preview) {
  const { rows } = await pool.query(
    `UPDATE messages
     SET link_url = $2, link_title = $3, link_description = $4, link_image = $5
     WHERE id = $1
     RETURNING id, conversation_id, link_url, link_title, link_description, link_image`,
    [
      messageId,
      preview.url,
      preview.title,
      preview.description,
      preview.image,
    ]
  );
  return rows[0];
}

async function getExpiredMediaItems(batchSize = 100) {
  const { rows } = await pool.query(
    `SELECT image_public_id, media_resource_type
     FROM messages
     WHERE expires_at IS NOT NULL AND expires_at < NOW()
       AND image_public_id IS NOT NULL
     LIMIT $1`,
    [batchSize]
  );
  return rows.map((r) => ({
    publicId: r.image_public_id,
    resourceType: r.media_resource_type || "image",
  }));
}

// Backwards-compat alias
async function getExpiredImagePublicIds(batchSize = 100) {
  const items = await getExpiredMediaItems(batchSize);
  return items.map((i) => i.publicId);
}

async function deleteExpiredMessages(batchSize = 100) {
  const { rows } = await pool.query(
    `DELETE FROM messages
     WHERE id IN (
       SELECT id FROM messages
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       LIMIT $1
     )
     RETURNING id, conversation_id`,
    [batchSize]
  );
  return rows;
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
  editMessage,
  updateLinkPreview,
  softDelete,
  getExpiredMediaItems,
  getExpiredImagePublicIds,
  deleteExpiredMessages,
  searchMessages,
};
