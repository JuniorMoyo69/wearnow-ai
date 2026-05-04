const { Pool } = require('pg');

// Strip ?sslmode=... from the URL so the pool-level ssl config takes full control.
// Newer pg versions treat sslmode=require/prefer/verify-ca as verify-full, which
// conflicts with rejectUnauthorized: false and breaks Neon connections on Render.
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '').replace(/&$/, '')
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
      user_name       VARCHAR(255),
      user_photo      TEXT,
      clothing_photo  TEXT,
      generated_image TEXT,
      timestamp       TIMESTAMPTZ DEFAULT NOW(),
      ai_enabled      BOOLEAN DEFAULT FALSE
    );
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

async function createGalleryEntry({ userName, userPhoto, clothingPhoto, generatedImage, aiEnabled }) {
  const { rows } = await pool.query(
    `INSERT INTO gallery (user_name, user_photo, clothing_photo, generated_image, ai_enabled)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userName, userPhoto, clothingPhoto, generatedImage ?? null, aiEnabled]
  );
  return rows[0];
}

async function deleteGalleryEntry(id) {
  const { rows } = await pool.query('DELETE FROM gallery WHERE id = $1 RETURNING *', [id]);
  return rows[0] || null;
}

module.exports = { init, findUserByEmail, findUserById, createUser, getGallery, createGalleryEntry, deleteGalleryEntry };
