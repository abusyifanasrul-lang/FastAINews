import { runPipeline } from "./pipeline.js";
import { sendPreview } from "./telegram.js";
import { getContentByDate, updateContentStatus, db } from "./db.js";
import { generateTtsChunks } from "./tts.js";
import { renderVideos } from "./video.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/** Scheduler harian: 08:00 WITA = 08:00 UTC+8 = 00:00 UTC */
const DAILY_HOUR_UTC = 0; // 08.00 WITA

function nextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(DAILY_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleNext() {
  const ms = nextRun();
  console.log(`[scheduler] next run dalam ${Math.round(ms / 3600_000)} jam`);
  setTimeout(async () => {
    try {
      await dailyJob();
    } catch (e) {
      console.error("[daily] gagal:", e);
    } finally {
      scheduleNext();
    }
  }, ms);
}

async function dailyJob() {
  const date = new Date().toISOString().slice(0, 10);
  const existing = getContentByDate(date);
  if (existing) {
    console.log(`[daily] konten ${date} sudah ada (${existing.status}) — skip`);
    return;
  }

  const result = await runPipeline();
  if (result.skipped) {
    console.log("[daily] tidak ada berita — hari di-skip");
    return;
  }

  // TTS + render sebelum preview — video path harus ada di DB untuk approve workflow
  const row = getContentByDate(date);
  if (!row || !row.script_text) {
    console.log("[daily] naskah belum siap — preview ditunda");
    return;
  }

  const outDir = join(process.cwd(), "content", date);
  mkdirSync(outDir, { recursive: true });
  console.log(`[daily] TTS...`);
  const { audioPath } = await generateTtsChunks(row.script_text, outDir, "voiceover.mp3");
  db.prepare("UPDATE contents SET audio_path = ? WHERE id = ?").run(audioPath, row.id);
  console.log(`[daily] render video...`);
  const v = await renderVideos(date);
  db.prepare("UPDATE contents SET video_916_path = ? WHERE id = ?")
    .run(v.shorts, row.id);
  console.log(`[daily] video ready: ${v.shorts}`);

  await sendPreview(row.id);
  updateContentStatus(row.id, "PENDING_REVIEW");
}

// jika dijalankan langsung, mulai scheduler
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[scheduler] mulai...");
  scheduleNext();
}
