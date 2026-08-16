import { runPipeline } from "./pipeline.js";
import { sendPreview } from "./telegram.js";
import { getContentByDate, updateContentStatus } from "./db.js";

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

  // tunggu sampai naskah siap, lalu kirim preview
  const row = getContentByDate(date);
  if (row && row.status === "NASKAH_READY") {
    await sendPreview(row.id);
    updateContentStatus(row.id, "PENDING_REVIEW");
  } else {
    console.log("[daily] naskah belum siap — preview ditunda");
  }
}

// jika dijalankan langsung, mulai scheduler
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[scheduler] mulai...");
  scheduleNext();
}
