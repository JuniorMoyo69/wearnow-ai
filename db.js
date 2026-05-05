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
    CREATE TABLE IF NOT EXISTS gallery (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id      TEXT,
      user_name       VARCHAR(255),
      user_photo      TEXT,
      clothing_photo  TEXT,
      generated_image TEXT,
      timestamp       TIMESTAMPTZ DEFAULT NOW(),
      ai_enabled      BOOLEAN DEFAULT FALSE
    );
  `);
  await pool.query(`
    ALTER TABLE gallery ADD COLUMN IF NOT EXISTS session_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_gallery_session ON gallery(session_id);
    CREATE INDEX IF NOT EXISTS idx_gallery_time    ON gallery(timestamp DESC);
  `);
}

// ── Gallery ───────────────────────────────────

async function createGalleryEntry({ sessionId, userName, userPhoto, clothingPhoto, generatedImage, aiEnabled }) {
  const { rows } = await pool.query(
    `INSERT INTO gallery (session_id, user_name, user_photo, clothing_photo, generated_image, ai_enabled)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [sessionId ?? null, userName, userPhoto, clothingPhoto, generatedImage ?? null, aiEnabled]
  );
  return rows[0];
}

async function getUserHistory(sessionId) {
  const { rows } = await pool.query(
    'SELECT * FROM gallery WHERE session_id = $1 ORDER BY timestamp DESC LIMIT 50',
    [sessionId]
  );
  return rows;
}

module.exports = { init, createGalleryEntry, getUserHistory };
