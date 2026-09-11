// Runner publish long-form: GDrive → ffprobe → upload YouTube chunked + chapters.
// LARANGAN: tidak ada fallback Telegram file_id (limit bot 50MB, video long 500MB-1.5GB).
import "dotenv/config";
import { parseArgs } from "node:util";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseGdriveId } from "../src/long/gdrive.js";
import { chaptersToDescription, type Chapter } from "../src/long/storyboard.js";
import { uploadYoutube } from "../src/publisher.js";
import { db, getLongContentByDate } from "../src/db.js";

const { values } = parseArgs({ options: { date: { type: "string" }, "gdrive-url": { type: "string" } } });
const date = (values.date ?? "").trim();
const gdriveUrl = (values["gdrive-url"] ?? "").trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error("--date harus YYYY-MM-DD"); process.exit(1); }
if (!gdriveUrl) { console.error("--gdrive-url wajib"); process.exit(1); }

async function tgSend(text: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const chat = process.env.OWNER_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000) }),
  }).catch(() => {});
}

function fail(id: number, msg: string): never {
  db.prepare("UPDATE long_contents SET status='FAILED', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  void tgSend(`❌ Publish long ${date} GAGAL: ${msg.slice(0, 300)}`);
  console.error(`[publish-long] ${msg}`);
  process.exit(1);
}

async function run(): Promise<void> {
  const row = getLongContentByDate(date);
  if (!row) { console.error(`[publish-long] edisi ${date} tidak ada di DB`); process.exit(1); }
  if (row.status === "PUBLISHING") {
    await tgSend(`⏳ Long ${date} sedang diproses runner lain — dispatch ganda ditolak.`);
    console.log("[publish-long] guard: sudah PUBLISHING, tolak");
    process.exit(0);
  }
  if (row.status === "PUBLISHED") {
    await tgSend(`✅ Long ${date} sudah terbit: https://youtu.be/${row.youtube_id}`);
    console.log("[publish-long] sudah PUBLISHED, skip");
    process.exit(0);
  }

  let fileId: string;
  try { fileId = parseGdriveId(gdriveUrl); }
  catch (e) { fail(row.id, (e as Error).message); }

  db.prepare("UPDATE long_contents SET gdrive_url=?, status='PUBLISHING', updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(gdriveUrl, row.id);
  console.log(`[publish-long] ${date} → PUBLISHING (file ${fileId!})`);

  // download via gdown stream ke disk (bukan ke memori)
  const tmpPath = join(tmpdir(), `long-${date}-${Date.now()}.mp4`);
  try {
    console.log("[publish-long] download GDrive via gdown...");
    execFileSync("gdown", ["--fuzzy", `https://drive.google.com/uc?id=${fileId!}`, "-O", tmpPath], { stdio: "inherit" });
  } catch {
    fail(row.id, "gdown gagal — cek link share (Anyone with link → Viewer) dan pastikan itu FILE bukan folder.");
  }
  if (!existsSync(tmpPath)) fail(row.id, "File unduhan tidak ada setelah gdown.");

  // verifikasi integritas + durasi riil
  let durationSec = 0;
  try {
    durationSec = parseFloat(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmpPath]).toString().trim(),
    );
  } catch { fail(row.id, "ffprobe gagal — file bukan video valid."); }
  if (!durationSec || isNaN(durationSec)) fail(row.id, "Durasi video tak terbaca — file korup.");
  console.log(`[publish-long] durasi riil: ${durationSec.toFixed(1)} dtk`);
  const shortWarn = durationSec < 480 ? "\n⚠️ <8 mnt — mid-roll berisiko ditolak YouTube." : "";

  // chapters dari storyboard.json bila ada
  let chapters: Chapter[] = [{ title: "Intro", startSec: 0 }];
  try {
    if (row.storyboard_path && existsSync(row.storyboard_path)) {
      const sb = JSON.parse((await import("node:fs")).readFileSync(row.storyboard_path, "utf8"));
      if (Array.isArray(sb.chapters) && sb.chapters.length >= 3) chapters = sb.chapters;
    }
  } catch { console.warn("[publish-long] storyboard tak terbaca — chapters default"); }

  const title = `${row.topic_title ?? `Deep-dive AI ${date}`} | AI News ${date}`;
  const descBase = `${row.topic_title ?? ""}\n\nDeep-dive berita AI 3 hari terakhir.\n\n#AI #Teknologi #BeritaAI #ArtificialIntelligence`;
  const description = chaptersToDescription(descBase, chapters);

  let ytId: string;
  try {
    ytId = await uploadYoutube(tmpPath, title, description, "public");
  } catch (e) {
    const m = (e as Error).message;
    const hint = m.includes("invalid_grant") ? " Re-auth: npx tsx scripts/auth-google.ts" : "";
    fail(row.id, m + hint);
  }
  try { unlinkSync(tmpPath); } catch {}

  db.prepare("UPDATE long_contents SET gdrive_url=?, youtube_id=?, duration_sec=?, status='PUBLISHED', updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(gdriveUrl, ytId!, durationSec, row.id);
  await tgSend(`✅ Long ${date} TERBIT: https://youtu.be/${ytId}${shortWarn}\n⏱ Durasi: ${(durationSec / 60).toFixed(1)} mnt | Chapters: ${chapters.length}`);
  console.log(`[publish-long] PUBLISHED https://youtu.be/${ytId}`);
}

await run();
