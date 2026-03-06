-- Minimal schema: only reviews table

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_user_display TEXT NOT NULL,
  review TEXT NOT NULL,
  rating INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
