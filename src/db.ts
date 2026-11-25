import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "content", "ainews.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// schema.sql: di dev = ./src/schema.sql, di dist = ../../src/schema.sql
const schemaPath = existsSync(join(__dirname, "schema.sql"))
  ? join(__dirname, "schema.sql")
  : join(process.cwd(), "src", "schema.sql");
const schema = readFileSync(schemaPath, "utf8");
db.exec(schema);

// migrasi: tambah kolom image_path jika belum ada (schema lama)
try {
  db.prepare("SELECT image_path FROM sources LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE sources ADD COLUMN image_path TEXT");
}

// migrasi: tambah kolom telegram_file_id jika belum ada
try {
  db.prepare("SELECT telegram_file_id FROM contents LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE contents ADD COLUMN telegram_file_id TEXT");
}

// migrasi: pastikan tabel news_archive tersedia pada DB lama
db.exec(`
  CREATE TABLE IF NOT EXISTS news_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_date TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    publisher TEXT,
    published_at TEXT,
    image_path TEXT,
    is_short_picked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_news_archive_date ON news_archive(fetched_date);
  CREATE INDEX IF NOT EXISTS idx_news_archive_pub ON news_archive(published_at);
`);

export function upsertContent(content: {
  date: string;
  status?: string;
  topicTitle?: string;
  scriptText?: string;
  caption?: string;
}) {
  const existing = db
    .prepare("SELECT id FROM contents WHERE date = ?")
    .get(content.date) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE contents SET status=?, topic_title=?, script_text=?, caption=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      content.status ?? "DRAFT",
      content.topicTitle ?? null,
      content.scriptText ?? null,
      content.caption ?? null,
      existing.id
    );
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO contents (date, status, topic_title, script_text, caption) VALUES (?,?,?,?,?)`
    )
    .run(
      content.date,
      content.status ?? "DRAFT",
      content.topicTitle ?? null,
      content.scriptText ?? null,
      content.caption ?? null
    );
  return Number(info.lastInsertRowid);
}

export function addSources(contentId: number, sources: { title: string; url: string; publisher?: string; publishedAt?: string; imagePath?: string }[]) {
  // idempotent: hapus sumber lama dulu
  db.prepare("DELETE FROM sources WHERE content_id = ?").run(contentId);
  const stmt = db.prepare(
    `INSERT INTO sources (content_id, title, url, publisher, published_at, image_path) VALUES (?,?,?,?,?,?)`
  );
  for (const s of sources) stmt.run(contentId, s.title, s.url, s.publisher ?? null, s.publishedAt ?? null, s.imagePath ?? null);
}

export interface ContentRow {
  id: number;
  date: string;
  status: string;
  topic_title: string | null;
  script_text: string | null;
  caption: string | null;
  audio_path: string | null;
  video_169_path: string | null;
  video_916_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceRow {
  id: number;
  content_id: number;
  title: string;
  url: string;
  publisher: string | null;
  published_at: string | null;
  image_path: string | null;
}

export function getContentByDate(date: string): ContentRow | undefined {
  return db.prepare("SELECT * FROM contents WHERE date = ?").get(date) as ContentRow | undefined;
}

export function getContentById(id: number): (ContentRow & { telegram_file_id?: string | null }) | undefined {
  return db.prepare("SELECT * FROM contents WHERE id = ?").get(id) as any;
}

export function getContentWithSources(date: string): (ContentRow & { sources: SourceRow[] }) | null {
  const c = getContentByDate(date);
  if (!c) return null;
  const sources = db.prepare("SELECT * FROM sources WHERE content_id = ?").all(c.id) as SourceRow[];
  return { ...c, sources };
}

export function updateContentStatus(id: number, status: string) {
  db.prepare("UPDATE contents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
}

export function addRevision(contentId: number, note: string | null, scriptText: string | null, video169: string | null, video916: string | null) {
  const { version } = db
    .prepare("SELECT COALESCE(MAX(version),0) AS version FROM revisions WHERE content_id=?")
    .get(contentId) as { version: number };
  db.prepare(
    `INSERT INTO revisions (content_id, version, note, script_text, video_169_path, video_916_path) VALUES (?,?,?,?,?,?)`
  ).run(contentId, version + 1, note, scriptText, video169, video916);
  return version + 1;
}

export function getRevisionCount(contentId: number): number {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM revisions WHERE content_id=?")
    .get(contentId) as { n: number };
  return n;
}

export function listRecentContent(limit = 7) {
  return db.prepare("SELECT * FROM contents ORDER BY date DESC LIMIT ?").all(limit);
}

export interface LongContentRow {
  id: number;
  date: string;
  topic_title: string | null;
  script_text: string | null;
  storyboard_path: string | null;
  gdrive_url: string | null;
  youtube_id: string | null;
  duration_sec: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function upsertLongContent(data: {
  date: string;
  topicTitle?: string;
  scriptText?: string;
  storyboardPath?: string;
  status?: string;
}): number {
  const existing = db.prepare("SELECT id FROM long_contents WHERE date = ?").get(data.date) as { id: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE long_contents 
      SET topic_title = COALESCE(?, topic_title),
          script_text = COALESCE(?, script_text),
          storyboard_path = COALESCE(?, storyboard_path),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.topicTitle ?? null, data.scriptText ?? null, data.storyboardPath ?? null, data.status ?? null, existing.id);
    return existing.id;
  }
  const info = db.prepare(`
    INSERT INTO long_contents (date, topic_title, script_text, storyboard_path, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.date, data.topicTitle ?? null, data.scriptText ?? null, data.storyboardPath ?? null, data.status ?? "DRAFT");
  return Number(info.lastInsertRowid);
}

export function getLongContentByDate(date: string): LongContentRow | undefined {
  return db.prepare("SELECT * FROM long_contents WHERE date = ?").get(date) as LongContentRow | undefined;
}

export function autoSkipStalledLongContents(beforeDate: string, maxDays = 3): LongContentRow[] {
  const rows = db.prepare(`
    SELECT * FROM long_contents 
    WHERE date < ? AND status IN ('READY_FOR_ASSETS', 'PUBLISHING')
    ORDER BY date ASC
  `).all(beforeDate) as LongContentRow[];

  const skipped: LongContentRow[] = [];
  const curTime = new Date(beforeDate).getTime();

  for (const row of rows) {
    const rowDate = new Date(row.date).getTime();
    const daysDiff = Math.round((curTime - rowDate) / (1000 * 3600 * 24));

    if (row.status === "READY_FOR_ASSETS" && daysDiff >= maxDays) {
      db.prepare("UPDATE long_contents SET status='SKIPPED', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
      skipped.push({ ...row, status: "SKIPPED" });
    } else if (row.status === "PUBLISHING") {
      const rawTime = row.updated_at || row.created_at;
      const lastUtc = new Date(rawTime.includes("Z") ? rawTime : rawTime.replace(" ", "T") + "Z").getTime();
      const hoursSince = (Date.now() - lastUtc) / (1000 * 3600);
      if (hoursSince >= 6) {
        db.prepare("UPDATE long_contents SET status='SKIPPED', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
        skipped.push({ ...row, status: "SKIPPED" });
      }
    }
  }

  return skipped;
}

export function getLatestPastLongContent(beforeDate: string): LongContentRow | undefined {
  return db.prepare(`
    SELECT * FROM long_contents 
    WHERE date < ? AND status NOT IN ('FAILED', 'SKIPPED')
    ORDER BY date DESC 
    LIMIT 1
  `).get(beforeDate) as LongContentRow | undefined;
}

export function getPastLongSources(beforeDate: string, lookbackDays = 14): { titles: string[]; urls: string[] } {
  const rows = db.prepare(`
    SELECT date, topic_title, storyboard_path FROM long_contents 
    WHERE date < ? AND date >= date(?, '-' || ? || ' days') AND status NOT IN ('FAILED', 'SKIPPED')
    ORDER BY date DESC
  `).all(beforeDate, beforeDate, lookbackDays) as { date: string; topic_title: string | null; storyboard_path: string | null }[];

  const titles: string[] = [];
  const urls: string[] = [];

  for (const row of rows) {
    if (row.topic_title) titles.push(row.topic_title);
    if (row.storyboard_path && existsSync(row.storyboard_path)) {
      try {
        const sb = JSON.parse(readFileSync(row.storyboard_path, "utf-8"));
        if (Array.isArray(sb.sources)) {
          for (const s of sb.sources) {
            if (s.title) titles.push(s.title);
            if (s.url) urls.push(s.url);
          }
        }
      } catch (err) {
        console.warn(`[db] gagal membaca storyboard ${row.storyboard_path}:`, (err as Error).message);
      }
    }
  }

  return { titles, urls };
}

export function updateLongContentStatus(id: number, status: string) {
  db.prepare("UPDATE long_contents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
}

export function updateLongContentPublishResult(id: number, gdriveUrl: string, youtubeId: string, durationSec: number) {
  db.prepare(`
    UPDATE long_contents 
    SET gdrive_url = ?, youtube_id = ?, duration_sec = ?, status = 'PUBLISHED', updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(gdriveUrl, youtubeId, durationSec, id);
}

export interface NewsArchiveRow {
  id: number;
  fetched_date: string;
  title: string;
  url: string;
  publisher: string | null;
  published_at: string | null;
  image_path: string | null;
  is_short_picked: number;
}

export function saveNewsArchive(
  fetchedDate: string,
  items: { title: string; url: string; publisher?: string; publishedAt?: string; imagePath?: string | null; isShortPicked?: boolean }[],
) {
  const stmt = db.prepare(`
    INSERT INTO news_archive (fetched_date, title, url, publisher, published_at, image_path, is_short_picked)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      fetched_date = COALESCE(news_archive.fetched_date, excluded.fetched_date),
      publisher = COALESCE(excluded.publisher, news_archive.publisher),
      published_at = COALESCE(excluded.published_at, news_archive.published_at),
      image_path = COALESCE(excluded.image_path, news_archive.image_path),
      is_short_picked = MAX(news_archive.is_short_picked, excluded.is_short_picked)
  `);
  const tx = db.transaction(() => {
    for (const it of items) {
      if (!it.title || !it.url) continue;
      stmt.run(
        fetchedDate,
        it.title,
        it.url,
        it.publisher ?? null,
        it.publishedAt ?? null,
        it.imagePath ?? null,
        it.isShortPicked ? 1 : 0,
      );
    }
  });
  tx();
}

export function getArchivedNewsForLong(days = 4, beforeDate?: string): NewsArchiveRow[] {
  const ref = beforeDate ?? new Date().toISOString().slice(0, 10);
  return db.prepare(`
    SELECT * FROM news_archive
    WHERE fetched_date <= ? AND fetched_date >= date(?, '-' || ? || ' days')
    ORDER BY published_at DESC, fetched_date DESC
  `).all(ref, ref, days) as NewsArchiveRow[];
}

export function getRecentContentsForLong(limitDays = 3, beforeDate?: string): { content: ContentRow; sources: SourceRow[] }[] {
  const lookback = limitDays + 2;
  const contents = beforeDate
    ? db.prepare(`
        SELECT * FROM contents 
        WHERE date <= ? AND date >= date(?, '-' || ? || ' days') AND script_text IS NOT NULL AND status != 'SKIPPED'
        ORDER BY date DESC
      `).all(beforeDate, beforeDate, lookback) as ContentRow[]
    : db.prepare(`
        SELECT * FROM contents 
        WHERE script_text IS NOT NULL AND status != 'SKIPPED'
        ORDER BY date DESC 
        LIMIT ?
      `).all(limitDays) as ContentRow[];

  return contents.map(c => ({
    content: c,
    sources: db.prepare("SELECT * FROM sources WHERE content_id = ?").all(c.id) as SourceRow[]
  }));
}

