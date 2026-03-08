-- D1 / SQLite schema for reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_name TEXT NOT NULL,
  author_role TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO reviews (author_name, author_role, rating, content, is_visible)
VALUES (
  'Przykładowy klient',
  'Właściciel serwera',
  5,
  'Współpraca przebiegła świetnie, wszystko działa jak trzeba.',
  1
);
