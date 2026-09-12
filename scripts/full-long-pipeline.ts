// Runner kurasi long-form: RSS 72 jam → naskah deep-dive → storyboard → artefak.
// Output: content/long/YYYY-MM-DD/{script.md,storyboard.json,STORYBOARD.md,meta.json}
import "dotenv/config";
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { curateLongNews } from "../src/long/curator.js";
import { generateLongScript, generateLongStoryboard } from "../src/long/llm-long.js";
import { splitBeats, validateChapters, buildStoryboardMd, type Chapter } from "../src/long/storyboard.js";
import { stripMidroll } from "../src/long/validate.js";
import { upsertLongContent, getLongContentByDate } from "../src/db.js";

const { values } = parseArgs({ options: { date: { type: "string" }, force: { type: "boolean" } } });
const date = (values.date ?? new Date().toISOString().slice(0, 10)).trim();
const force = values.force ?? false;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error("--date harus YYYY-MM-DD"); process.exit(1); }

async function tgSend(text: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const chat = process.env.OWNER_CHAT_ID;
  if (!token || !chat) { console.warn("[long] BOT_TOKEN/OWNER_CHAT_ID kosong — notif dilewati"); return; }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000) }),
  }).catch((e) => console.warn("[long] notif gagal:", (e as Error).message));
}

async function run(): Promise<void> {
  const existing = getLongContentByDate(date);
  if (!force && existing && ["READY_FOR_ASSETS", "PUBLISHING", "PUBLISHED"].includes(existing.status)) {
    console.log(`[long] edisi ${date} sudah ${existing.status} — skip`);
    return;
  }

  console.log(`[long] 1/4 kurasi 72 jam utk ${date}...`);
  const { items, images } = await curateLongNews(72, date);
  const dir = join(process.cwd(), "content", "long", date);
  mkdirSync(join(dir, "images"), { recursive: true });

  if (items.length < 3) {
    console.log("[long] berita sepi (<3) → meta skipped, exit 0");
    writeFileSync(join(dir, "meta.json"), JSON.stringify({ date, skipped: true, items: items.length }, null, 2));
    upsertLongContent({ date, status: "DRAFT" });
    await tgSend(`📰 Long-form ${date}: berita sepi (${items.length} item) — edisi dilewati.`);
    return;
  }

  console.log(`[long] 2/4 naskah (${items.length} topik)...`);
  const { script, topicTitle } = await generateLongScript(items);
  const { clean, atChar } = stripMidroll(script);
  const imgPaths = images.filter((x): x is string => !!x);

  // Pass 1: beats kasar utk estimasi total → chapters final proporsional
  const pass1 = splitBeats(clean, [], [{ title: "Intro", startSec: 0 }], []);
  const totalEst = pass1.reduce((a, b) => a + b.estSec, 0);
  const midrollAtSec = atChar != null && clean.length > 0 
    ? Math.round((atChar / clean.length) * totalEst) 
    : Math.round(totalEst * 0.5); // auto-fallback jika marker tidak ditemukan

  const chapters: Chapter[] = [
    { title: "Intro & Tesis Utama", startSec: 0 },
    { title: "Konteks 72 Jam Terakhir", startSec: Math.round(totalEst * 0.12) },
    { title: "Deep-Dive Berita AI", startSec: Math.round(totalEst * 0.35) },
    { title: "Analisis & Prediksi Industri", startSec: Math.round(totalEst * 0.72) },
    { title: "Peluang & Penutup", startSec: Math.round(totalEst * 0.88) },
  ];
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].startSec - chapters[i - 1].startSec < 10) chapters[i].startSec = chapters[i - 1].startSec + 10;
  }
  validateChapters(chapters, totalEst);

  console.log("[long] 3/4 storyboard visual per beat via LLM...");
  // imgMeta paralel dengan items (index sama dengan images), agar LLM bisa
  // memilih gambar sumber yang benar-benar relevan dengan isi beat.
  const imgMeta = images
    .map((p, i) => (p ? { path: p, title: items[i]?.title ?? "", publisher: items[i]?.publisher ?? "" } : null))
    .filter((x): x is { path: string; title: string; publisher: string } => !!x);
  const labeled = pass1.map((b) => ({
    text: b.text,
    chapter: [...chapters].reverse().find((c) => c.startSec <= b.startSec)?.title ?? "Intro & Tesis Utama",
  }));
  const fullHints = await generateLongStoryboard(labeled, imgMeta);
  const beats = splitBeats(clean, fullHints, chapters, imgPaths);
  for (const b of beats) {
    b.chapter = [...chapters].reverse().find((c) => c.startSec <= b.startSec)?.title ?? "Intro & Tesis Utama";
  }
  const totalSec = Math.round(beats.reduce((a, b) => a + b.estSec, 0) * 10) / 10;
  validateChapters(chapters, totalSec);

  console.log("[long] 4/4 tulis artefak...");
  const storyboard = {
    date, title: topicTitle, chapters, beats, midrollAtSec, estTotalSec: totalSec,
    sources: items.map((s) => ({ title: s.title, url: s.url, publisher: s.publisher })),
  };
  const relStoryboardPath = `content/long/${date}/storyboard.json`;
  const t2vCount = beats.filter((b) => b.visual === "T2V_GENERATION").length;
  const i2vCount = beats.filter((b) => b.visual === "I2V_ANIMATE_IMAGE").length;
  const staticCount = beats.filter((b) => b.visual === "STATIC_IMAGE_MOTION").length;

  writeFileSync(join(dir, "script.md"), `# ${topicTitle}\n\n${clean}\n`);
  writeFileSync(join(dir, "storyboard.json"), JSON.stringify(storyboard, null, 2));
  writeFileSync(join(dir, "STORYBOARD.md"), buildStoryboardMd(topicTitle, date, chapters, beats, totalSec, midrollAtSec));
  writeFileSync(join(dir, "meta.json"), JSON.stringify({
    date, topicTitle, status: "READY_FOR_ASSETS",
    beats: beats.length, estTotalSec: totalSec, midrollAtSec,
    t2vCount, i2vCount, staticCount,
    images: imgPaths.length, sources: items.length,
  }, null, 2));

  upsertLongContent({ date, topicTitle, scriptText: clean, storyboardPath: relStoryboardPath, status: "READY_FOR_ASSETS" });

  const warnImg = imgPaths.length === 0 ? "\n⚠️ 0 gambar terdownload — producer pakai T2V semua." : "";
  const warnDur = totalSec < 480 ? `\n⚠️ Estimasi ${Math.round(totalSec)} dtk <8 mnt — tambah segmen agar lolos mid-roll.` : "";
  await tgSend(
    `🎬 Long-form ${date} READY_FOR_ASSETS\n📌 ${topicTitle}\n📝 ${beats.length} beats (${t2vCount} AI video, ${i2vCount} I2V, ${staticCount} gambar), ~${Math.round(totalSec / 60)} mnt (${Math.round(totalSec)}s)\n📂 ${relStoryboardPath}${warnImg}${warnDur}\n\nProduksi di laptop: voice clone per beat (<1000 char) → T2V 10 dtk → rakit → upload GDrive → /publish_long ${date} <url>`,
  );
  console.log(`[long] edisi ${date} READY_FOR_ASSETS (${beats.length} beats, ~${Math.round(totalSec)} dtk, ${t2vCount} T2V)`);
}

try {
  await run();
} catch (e) {
  const err = e as Error;
  const msg = `Long pipeline ${date} GAGAL:\n${err.message}`;
  console.error("[long]", msg, err.stack);
  try { upsertLongContent({ date, status: "FAILED" }); } catch {}
  await tgSend(`🚨 ${msg}`);
  process.exit(1);
}
