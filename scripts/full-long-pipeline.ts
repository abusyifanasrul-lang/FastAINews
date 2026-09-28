// Runner kurasi long-form: RSS 72 jam → naskah deep-dive → storyboard → artefak.
// Output: content/long/YYYY-MM-DD/{script.md,storyboard.json,STORYBOARD.md,meta.json}
import "dotenv/config";
import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { curateLongNews } from "../src/long/curator.js";
import { generateLongScript, generateLongStoryboard } from "../src/long/llm-long.js";
import { splitBeats, validateChapters, buildStoryboardMd, extractPromptsText, extractNarrationsText, extractParagraphsText, type Chapter } from "../src/long/storyboard.js";
import { stripMidroll } from "../src/long/validate.js";
import { upsertLongContent, getLongContentByDate, getLatestPastLongContent } from "../src/db.js";

// Helper waktu: default tanggal mengacu ke WITA (UTC+8)
const defaultDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
const { values } = parseArgs({ options: { date: { type: "string" }, force: { type: "boolean" } } });
const date = (values.date ?? defaultDate).trim();
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

  // Throttle Interlock Guard (hanya berlaku pada run otomatis / tanpa flag --force)
  if (!force) {
    const latestPast = getLatestPastLongContent(date);
    if (latestPast) {
      // 1. Jika edisi sebelumnya masih belum selesai dirakit/dipublish
      if (["READY_FOR_ASSETS", "PUBLISHING"].includes(latestPast.status)) {
        console.log(
          `[long] THROTTLE INTERLOCK: Edisi sebelumnya (${latestPast.date}) masih berstatus '${latestPast.status}' (belum selesai dipublish). Menunda kurasi baru dan menggeser 24 jam ke jadwal berikutnya.`
        );
        return;
      }

      // 2. Jika edisi sebelumnya sudah PUBLISHED:
      if (latestPast.status === "PUBLISHED") {
        const rawTime = latestPast.updated_at || latestPast.created_at;
        const lastPublishUtc = new Date(rawTime.includes("Z") ? rawTime : rawTime.replace(" ", "T") + "Z").getTime();
        const hoursSincePublish = (Date.now() - lastPublishUtc) / (1000 * 3600);

        // Aturan A: Minimal jeda 1 hari (24 jam) pasca-publish
        if (hoursSincePublish < 24) {
          console.log(
            `[long] THROTTLE INTERLOCK: Video edisi ${latestPast.date} baru dipublish ${hoursSincePublish.toFixed(1)} jam yang lalu (< 24 jam). Memberikan jeda minimal 24 jam pasca-publish (geser 24 jam berikutnya).`
          );
          return;
        }

        // Aturan B: Jika publish tepat waktu, secara default siklus eksekusi tetap per 3 hari
        const daysSinceLastCurate = Math.round(
          (new Date(date).getTime() - new Date(latestPast.date).getTime()) / (1000 * 3600 * 24)
        );
        if (daysSinceLastCurate < 3) {
          console.log(
            `[long] THROTTLE INTERLOCK: Baru ${daysSinceLastCurate} hari sejak kurasi edisi ${latestPast.date}. Siklus default adalah per 3 hari. Menunggu siklus berikutnya.`
          );
          return;
        }

        console.log(
          `[long] THROTTLE INTERLOCK PASS: Jeda publish ${hoursSincePublish.toFixed(1)} jam (>= 24 jam) dan selisih kurasi ${daysSinceLastCurate} hari (>= 3 hari). Melanjutkan kurasi edisi ${date}...`
        );
      }
    }
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
  const { hints: fullHints, stats: sbStats } = await generateLongStoryboard(labeled, imgMeta);
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
  const rawPrompts = extractPromptsText(beats);
  writeFileSync(join(dir, "prompts.txt"), rawPrompts, "utf8");
  const rawParagraphs = extractParagraphsText(clean);
  writeFileSync(join(dir, "paragraphs.txt"), rawParagraphs, "utf8");
  const parasCount = rawParagraphs.split("\n").filter(Boolean).length;
  const rawNarrations = extractNarrationsText(beats);
  writeFileSync(join(dir, "narrations.txt"), rawNarrations, "utf8");
  writeFileSync(join(dir, "meta.json"), JSON.stringify({
    date, topicTitle, status: "READY_FOR_ASSETS",
    beats: beats.length, estTotalSec: totalSec, midrollAtSec,
    t2vCount, i2vCount, staticCount,
    images: imgPaths.length, sources: items.length,
    paragraphs: parasCount,
    // Revisi 6 (P1 observabilitas): jejak Stage-2 agar rasio LLM vs fallback bisa divonis
    // per edisi — bedakan budget-skip vs breaker-skip vs fallback-batch vs pad-parsial.
    storyboardBatchesExecuted: sbStats.batchesExecuted,
    storyboardTotalBatches: sbStats.totalBatches,
    storyboardLlmOkBatches: sbStats.llmOkBatches,
    storyboardFallbackBatches: sbStats.fallbackBatches,
    storyboardPartialBatches: sbStats.partialBatches,
    storyboardBudgetHit: sbStats.budgetHit,
    storyboardBreakerHit: sbStats.breakerHit,
  }, null, 2));

  upsertLongContent({ date, topicTitle, scriptText: clean, storyboardPath: relStoryboardPath, status: "READY_FOR_ASSETS" });

  const warnImg = imgPaths.length === 0 ? "\n⚠️ 0 gambar terdownload — producer pakai T2V semua." : "";
  const warnDur = totalSec < 480 ? `\n⚠️ Estimasi ${Math.round(totalSec)} dtk <8 mnt — tambah segmen agar lolos mid-roll.` : "";
  await tgSend(
    `🎬 Long-form ${date} READY_FOR_ASSETS\n📌 ${topicTitle}\n📝 ${beats.length} adegan visual (~${Math.round(totalSec / 60)} mnt) dari ${parasCount} paragraf naskah\n📂 ${relStoryboardPath}\n📄 prompts.txt: ${beats.length} baris prompt gambar (1376x768 .jpg)\n🎙️ paragraphs.txt: ${parasCount} paragraf TTS (01.mp3 .. ${String(parasCount).padStart(2, "0")}.mp3)\n\nAlur produksi:\n1. Generate ${beats.length} gambar (.jpg 1K) dari prompts.txt\n2. Generate ${parasCount} audio TTS dari paragraphs.txt\n3. Masukkan gambar & audio ke asset.zip & upload ke GDrive\n4. Trigger perakitan: /assemble_long ${date} <link_gdrive>${warnImg}${warnDur}`,
  );
  console.log(`[long] edisi ${date} READY_FOR_ASSETS (${beats.length} adegan visual, ${parasCount} paragraf, ~${Math.round(totalSec)} dtk, prompts.txt & paragraphs.txt tersimpan)`);
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
