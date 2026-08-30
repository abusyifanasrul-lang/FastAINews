import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db } from "../src/db.js";
import { publishToSocialDirect } from "../src/zernio.js";
import { uploadYoutube } from "../src/publisher.js";
import type { PublishResult } from "../src/publisher.js";

const { values } = parseArgs({ options: { "content-id": { type: "string" } } });
const contentId = Number(values["content-id"]);
if (!contentId || isNaN(contentId)) {
  console.error("Usage: --content-id=<number>");
  process.exit(1);
}

// DB row (optional — approve mungkin tanpa DB yang valid)
const c = db.prepare(
  "SELECT id, date, video_916_path, video_169_path, topic_title, script_text, caption, telegram_file_id FROM contents WHERE id = ?"
).get(contentId) as any;

const videoFileIdFromWorker = process.env.VIDEO_FILE_ID;
const videoFileIdFromDb = c?.telegram_file_id;
const videoFileId = videoFileIdFromWorker || videoFileIdFromDb;

// Resolve video: local path → Telegram download via file_id
let videoPath = c?.video_916_path ?? c?.video_169_path;
if (videoPath && existsSync(videoPath)) {
  console.log(`[publish] video lokal: ${videoPath}`);
} else if (videoFileId && process.env.BOT_TOKEN) {
  console.log(`[publish] download dari Telegram (file_id: ${videoFileId})...`);
  const fileResp = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: videoFileId }),
  });
  const fileJson = await fileResp.json() as any;
  if (!fileJson.ok || !fileJson.result?.file_path) {
    console.error("[publish] getFile gagal:", JSON.stringify(fileJson));
    process.exit(1);
  }
  const dlUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileJson.result.file_path}`;
  const dlResp = await fetch(dlUrl);
  if (!dlResp.ok) {
    console.error(`[publish] download gagal: ${dlResp.status}`);
    process.exit(1);
  }
  const buf = Buffer.from(await dlResp.arrayBuffer());
  const tmpPath = join(tmpdir(), `ainews-publish-${contentId}-${Date.now()}.mp4`);
  writeFileSync(tmpPath, buf);
  videoPath = tmpPath;
  console.log(`[publish] downloaded: ${tmpPath} (${buf.length} bytes)`);
} else {
  console.error(`No video available: no local file, no file_id (worker: ${videoFileIdFromWorker ?? "none"}, db: ${videoFileIdFromDb ?? "none"})`);
  process.exit(1);
}

// Caption & metadata dari DB atau fallback
const summary = (c?.script_text ?? c?.caption ?? "").slice(0, 1500);
const sources = c ? db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = ?").all(contentId) as any[] : [];
const srcLines = sources.map((s: any, i: number) => `${i + 1}. ${s.publisher ?? "Sumber"}: ${s.title}`).join("\n");
const caption = summary ? `${summary}\n\n📰 Sumber:\n${srcLines}\n\n#AI #BeritaAI #Teknologi` : `AI News ${c?.date ?? new Date().toISOString().slice(0,10)}\n\n#AI #BeritaAI #Teknologi`;
const date = c?.date ?? new Date().toISOString().slice(0, 10);
const topicLine = c?.topic_title ?? `Berita AI ${date}`;

const results: PublishResult[] = [];

// TikTok + IG via Zernio
try {
  const social = await publishToSocialDirect(videoPath, caption, date, c ? contentId : undefined);
  results.push(...social);
} catch (e) {
  console.error("[publish] zernio gagal:", (e as Error).message);
  results.push({ platform: "tiktok+instagram", ok: false, error: (e as Error).message });
}

// YouTube
try {
  const ytId = await uploadYoutube(videoPath, `${topicLine} | AI News ${date}`, caption, "public");
  results.push({ platform: "youtube", ok: true, externalId: ytId, url: `https://youtu.be/${ytId}` });
} catch (e) {
  console.error("[publish] youtube gagal:", (e as Error).message);
  results.push({ platform: "youtube", ok: false, error: (e as Error).message });
}

// Update DB status (jika row ada)
if (c) {
  const allOk = results.every(r => r.ok);
  db.prepare("UPDATE contents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    allOk ? "PUBLISHED" : "PUBLISH_FAILED",
    contentId
  );
}

console.log("\n=== HASIL PUBLISH ===");
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.platform}: ${r.url ?? r.error ?? "ok"}`);
}

const allOk = results.every(r => r.ok);
process.exit(allOk ? 0 : 1);
