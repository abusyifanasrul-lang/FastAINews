-- Skema SQLite — AInews Bot v1.1 (desain teknis section 6)

CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,           -- YYYY-MM-DD (1 konten/hari)
  status TEXT NOT NULL DEFAULT 'DRAFT',-- DRAFT|PENDING_REVIEW|REVISION|APPROVED|PUBLISHING|PUBLISHED|REJECTED|SKIPPED|FAILED
  topic_title TEXT,
  script_text TEXT,
  caption TEXT,
  audio_path TEXT,
  video_169_path TEXT,
  video_916_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES contents(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT,
  published_at TEXT,
  image_path TEXT
);

CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES contents(id),
  version INTEGER NOT NULL,
  note TEXT,                            -- catatan revisi dari reviewer
  script_text TEXT,
  video_169_path TEXT,
  video_916_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL REFERENCES contents(id),
  platform TEXT NOT NULL,               -- youtube|tiktok|instagram
  status TEXT NOT NULL,                 -- PENDING|SUCCESS|FAILED
  external_id TEXT,
  url TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topic_hashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  embedding TEXT NOT NULL,              -- JSON array float
  similarity_checked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sources_content ON sources(content_id);
CREATE INDEX IF NOT EXISTS idx_revisions_content ON revisions(content_id);
CREATE INDEX IF NOT EXISTS idx_publications_content ON publications(content_id);
