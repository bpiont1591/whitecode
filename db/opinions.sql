-- D1 / SQLite schema for opinions
DROP TABLE IF EXISTS opinions;

CREATE TABLE opinions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  atmosfera TEXT NOT NULL,
  przebieg TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_opinions_created_at ON opinions(created_at DESC);

-- Test opinion visible immediately on website
INSERT INTO opinions (user_id, user_tag, rating, atmosfera, przebieg, text)
VALUES (
  '123456789012345678',
  'Testowy Klient',
  5,
  'Bardzo dobra komunikacja',
  'Szybko, terminowo i profesjonalnie',
  'Współpraca przebiegła świetnie. Polecam WH!TEcode!'
);
