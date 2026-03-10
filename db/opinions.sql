-- D1 / SQLite schema for opinions (safe to run multiple times)
CREATE TABLE IF NOT EXISTS opinions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  atmosfera TEXT NOT NULL,
  przebieg TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_opinions_created_at ON opinions(created_at DESC);

-- Test opinion added only when table is empty
INSERT INTO opinions (user_id, user_tag, rating, atmosfera, przebieg, text)
SELECT
  '123456789012345678',
  'Testowy Klient',
  5,
  'Bardzo dobra komunikacja',
  'Szybko, terminowo i profesjonalnie',
  'Współpraca przebiegła świetnie. Polecam WH!TEcode!'
WHERE NOT EXISTS (SELECT 1 FROM opinions);
