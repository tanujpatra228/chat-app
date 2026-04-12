const pool = require("../config/db");

async function createUser({ email, username, passwordHash, displayName }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, username, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, display_name, avatar_url, created_at`,
    [email, username, passwordHash, displayName || null]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, username, password_hash, display_name, avatar_url, is_online, last_seen, created_at
     FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, username, display_name, avatar_url, is_online, last_seen, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByIdWithEmail(id) {
  const { rows } = await pool.query(
    `SELECT id, email, username, display_name, avatar_url, is_online, last_seen, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function searchByUsername(query, currentUserId) {
  const { rows } = await pool.query(
    `SELECT id, username, display_name, avatar_url, is_online, last_seen
     FROM users
     WHERE username ILIKE $1 AND id != $2
     LIMIT 20`,
    [`%${query}%`, currentUserId]
  );
  return rows;
}

async function setOnlineStatus(userId, isOnline) {
  const updateFields = isOnline
    ? "is_online = true"
    : "is_online = false, last_seen = NOW()";

  await pool.query(
    `UPDATE users SET ${updateFields}, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  findByIdWithEmail,
  searchByUsername,
  setOnlineStatus,
};
