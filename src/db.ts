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
