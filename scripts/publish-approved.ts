import { parseArgs } from "node:util";
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

const c = db.prepare(
  "SELECT id, date, video_916_path, video_169_path, topic_title, script_text, caption FROM contents WHERE id = ?"
).get(contentId) as any;

if (!c) {
  console.error(`Content ${contentId} not found in DB`);
  process.exit(1);
}

const videoPath = c.video_916_path ?? c.video_169_path;
if (!videoPath) {
  console.error(`No video path for content ${contentId}`);
  process.exit(1);
}

const summary = (c.script_text ?? c.caption ?? "").slice(0, 1500);
const sources = db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = ?").all(contentId) as any[];
const srcLines = sources.map((s: any, i: number) => `${i + 1}. ${s.publisher ?? "Sumber"}: ${s.title}`).join("\n");
const caption = `${summary}\n\n📰 Sumber:\n${srcLines}\n\n#AI #BeritaAI #Teknologi`;
const date = c.date ?? new Date().toISOString().slice(0, 10);
const topicLine = c.topic_title ?? `Berita AI ${date}`;

const results: PublishResult[] = [];

// TikTok + IG via Zernio
try {
  const social = await publishToSocialDirect(videoPath, caption, date, contentId);
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

// Update DB status
const allOk = results.every(r => r.ok);
db.prepare("UPDATE contents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
  allOk ? "PUBLISHED" : "PUBLISH_FAILED",
  contentId
);

console.log("\n=== HASIL PUBLISH ===");
for (const r of results) {
  console.log(`${r.ok ? "✅" : "❌"} ${r.platform}: ${r.url ?? r.error ?? "ok"}`);
}

process.exit(allOk ? 0 : 1);
