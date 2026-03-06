-- WHITEcode review system schema (Cloudflare D1)

CREATE TABLE IF NOT EXISTS profiles (
  slug TEXT PRIMARY KEY,
  owner_account TEXT NOT NULL UNIQUE,
  owner_display TEXT,
  owner_avatar TEXT,
  owner_bio TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  rating TEXT NOT NULL,
  reason TEXT NOT NULL,
  reviewer_account TEXT NOT NULL,
  reviewer_display TEXT,
  reviewer_avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(profile_slug, reviewer_account)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  review_id TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS blocked_accounts (
  account TEXT PRIMARY KEY,
  blocked INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS message_blocks (
  id TEXT PRIMARY KEY,
  profile_slug TEXT NOT NULL,
  account TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(profile_slug, account)
);

CREATE INDEX IF NOT EXISTS idx_reviews_profile_created ON reviews(profile_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_account);
CREATE INDEX IF NOT EXISTS idx_reports_profile_status ON reports(profile_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
