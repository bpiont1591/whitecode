-- Optional: initialize D1 manually with this schema
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_user_display TEXT NOT NULL,
  form_name TEXT NOT NULL,
  form_contact TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  webhook_status TEXT NOT NULL DEFAULT 'pending',
  webhook_error TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_user_display TEXT NOT NULL,
  review TEXT NOT NULL,
  webhook_status TEXT NOT NULL DEFAULT 'pending',
  webhook_error TEXT
);
