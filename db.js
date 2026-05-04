const { Pool } = require('pg');

// Strip all query params — SSL is configured via pool-level ssl option below.
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/\?.*$/, '')
  : undefined;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username   VARCHAR(255) NOT NULL,
      email      VARCHAR(255) NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID,
      user_name       VARCHAR(255),
      user_photo      TEXT,
      clothing_photo  TEXT,
      generated_image TEXT,
      timestamp       TIMESTAMPTZ DEFAULT NOW(),
      ai_enabled      BOOLEAN DEFAULT FALSE
    );
  `);
  // Add user_id and indexes to existing tables if not already present
  await pool.query(`
    ALTER TABLE gallery ADD COLUMN IF NOT EXISTS user_id UUID;
    CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);
    CREATE INDEX IF NOT EXISTS idx_gallery_user  ON gallery(user_id);
    CREATE INDEX IF NOT EXISTS idx_gallery_time  ON gallery(timestamp DESC);
  `);
}

// ── Users ─────────────────────────────────────

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser({ username, email, password }) {
  const { rows } = await pool.query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
    [username, email, password]
  );
  return rows[0];
}

// ── Gallery ───────────────────────────────────

async function getGallery() {
  const { rows } = await pool.query('SELECT * FROM gallery ORDER BY timestamp DESC');
  return rows;
}

async function createGalleryEntry({ userId, userName, userPhoto, clothingPhoto, generatedImage, aiEnabled }) {
  const { rows } = await pool.query(
    `INSERT INTO gallery (user_id, user_name, user_photo, clothing_photo, generated_image, ai_enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId ?? null, userName, userPhoto, clothingPhoto, generatedImage ?? null, aiEnabled]
  );
  return rows[0];
}

async function getUserHistory(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM gallery WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50',
    [userId]
  );
  return rows;
}

async function deleteGalleryEntry(id) {
  const { rows } = await pool.query('DELETE FROM gallery WHERE id = $1 RETURNING *', [id]);
  return rows[0] || null;
}

module.exports = { init, findUserByEmail, findUserById, createUser, getGallery, createGalleryEntry, getUserHistory, deleteGalleryEntry };
