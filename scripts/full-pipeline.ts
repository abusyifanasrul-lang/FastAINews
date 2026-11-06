import { parseArgs } from "node:util";
import { runPipeline, runRevision } from "../src/pipeline.js";
import { generateTtsChunks } from "../src/tts.js";
import { renderVideos } from "../src/video.js";
import { getContentByDate, getContentWithSources, updateContentStatus, getContentById } from "../src/db.js";
import { sendPreview, sendAlert, sendPublishReport } from "../src/telegram.js";
import { PIPELINE_CONFIG } from "../src/config.js";
import { join } from "node:path";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";

const date = new Date().toISOString().slice(0, 10);

// Revisi path: --content-id + --revision-note (flags dulu, fallback ke env
// dari workflow). Tanpa ini argumen workflow diabaikan dan revisi selalu
// membuat konten baru dari nol.
const { values: cliArgs } = parseArgs({
  options: { "content-id": { type: "string" }, "revision-note": { type: "string" } },
});
const revIdRaw = cliArgs["content-id"] ?? process.env.CONTENT_ID ?? "";
const revNoteRaw = cliArgs["revision-note"] ?? process.env.REVISION_NOTE ?? "";
const revId = revIdRaw.trim() === "" ? NaN : Number(revIdRaw.trim());
const revNote = revNoteRaw.trim();

async function runRevisionPath(id: number, note: string) {
  console.log(`[pipeline] revisi #${id}...`);
  try {
    const { version } = await runRevision(id, note);
    console.log(`Preview revisi v${version} terkirim → PENDING_REVIEW`);
  } catch (e) {
    // jangan macet di REVISION_PENDING — tandai gagal eksplisit
    try { updateContentStatus(id, "REVISION_FAILED"); } catch {}
    throw e;
  }
}

async function run() {
  if (revIdRaw.trim() !== "" || revNote !== "") {
    if (!Number.isInteger(revId)) throw new Error(`--content-id tidak valid: "${revIdRaw}"`);
    if (!revNote) throw new Error("--revision-note kosong (wajib untuk revisi)");
    await runRevisionPath(revId, revNote);
    return;
  }
  // 1. riset + naskah (LLM)
  console.log("[pipeline] 1/4 riset + naskah...");
  const result = await runPipeline({ hours: 48 });
  if (result.skipped) {
    console.log("Tidak ada berita → skip");
    process.exit(0);
  }
  const contentId = result.id!;
  console.log(`Konten #${contentId} — ${result.topicTitle}`);

  // 2. TTS
  console.log("[pipeline] 2/4 TTS...");
  const c = getContentByDate(date);
  if (!c?.script_text) throw new Error("naskah kosong");
  const outDir = join(process.cwd(), "content", date);
  mkdirSync(outDir, { recursive: true });
  const { audioPath, durationSec } = await generateTtsChunks(c.script_text, outDir, "voiceover.mp3");
  console.log("TTS:", audioPath, `(${durationSec.toFixed(1)}s)`);
  if (durationSec > 120 || durationSec < 20) {
    throw new Error(`[pipeline] Durasi audio tidak wajar (${durationSec.toFixed(1)}s). Target 45-90s, batas aman 20-120s. Abort render.`);
  }

  // 3. render video (shorts 9:16 only — master on-demand)
  console.log("[pipeline] 3/4 render...");
  const v = await renderVideos(date);
  console.log("Video:", v.shorts);

  // 4. kompres + potong ke durasi audio
  console.log("[pipeline] 4/4 kompres + trim ke audio...");
  const previewPath = join(outDir, "shorts-preview.mp4");
  // audioPath already from generateTtsChunks (line 30)
  if (existsSync(v.shorts) && existsSync(audioPath)) {
    try {
      const durStr = execFileSync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        audioPath
      ]).toString().trim();
      const audioDur = parseFloat(durStr) || 0;
      console.log("Audio durasi:", audioDur, "s");
      if (audioDur > 0) {
        const args = [
          "-y", "-v", "error", "-i", v.shorts,
          "-vf", "scale=480:854",
          "-c:v", "libx264", "-preset", "fast", "-crf", "32",
          "-c:a", "aac", "-b:a", "96k",
          "-t", String(audioDur),
          previewPath
        ];
        console.log("[pipeline] running ffmpeg with args:", args.join(" "));
        execFileSync("ffmpeg", args, { stdio: "inherit" });
        renameSync(previewPath, v.shorts);
        console.log("[pipeline] video replaced with trimmed version");
      } else {
        console.warn("Audio duration invalid, skip trim");
      }
    } catch (e) {
      console.warn("Trim failed:", e);
    }
  }

  // 4.5 generate thumbnail + upload ke Zernio (URL ikut caption preview)
  console.log("[pipeline] generate thumbnail...");
  const cFull = getContentWithSources(date);
  let thumbUrl: string | undefined;
  if (cFull && cFull.sources.length > 0) {
    try {
      const { generateThumbnail } = await import("../src/thumbnail.js");
      const { uploadImageToZernio } = await import("../src/zernio.js");
      const hook = cFull.topic_title ?? "Berita AI Hari Ini";
      const thumb = generateThumbnail(date, cFull.sources, hook, v.shorts);
      console.log("Thumbnail:", thumb);
      thumbUrl = await uploadImageToZernio(thumb, date);
      console.log("Thumbnail URL:", thumbUrl ?? "(gagal upload)");
    } catch (e) {
      console.error("Thumbnail generation error:", e);
    }
  } else {
    console.warn("Tidak ada sumber untuk thumbnail");
  }

  // 5. Cek Mode Publikasi: Manual Approval vs Autopilot (Zero-Approval)
  const requireApproval = PIPELINE_CONFIG.REQUIRE_APPROVAL;

  if (requireApproval) {
    // MODE MANUAL APPROVAL (Konfirmasi Manual via Telegram)
    console.log("[pipeline] 5/5 Mode Manual Approval aktif — mengirim preview dengan tombol konfirmasi...");
    await sendPreview(contentId, 0, thumbUrl, { requireApproval: true });
    updateContentStatus(contentId, "PENDING_REVIEW");
    console.log("Preview terkirim → PENDING_REVIEW. Menunggu konfirmasi Owner di Telegram.");
    return;
  }

  // MODE AUTOPILOT (ZERO-APPROVAL) DENGAN RANDOM TIMING
  console.log("[pipeline] 5/5 Mode Autopilot aktif (tanpa perlu konfirmasi Owner)...");

  // Hitung jeda waktu acak (random timing / jitter)
  let delayMinutes = 0;
  let publishTimeWIB = "";
  if (PIPELINE_CONFIG.RANDOM_TIMING.ENABLED) {
    const minM = PIPELINE_CONFIG.RANDOM_TIMING.MIN_MINUTES;
    const maxM = PIPELINE_CONFIG.RANDOM_TIMING.MAX_MINUTES;
    delayMinutes = Math.floor(Math.random() * (maxM - minM + 1)) + minM;
    const targetTimestamp = Date.now() + delayMinutes * 60 * 1000;
    publishTimeWIB = new Date(targetTimestamp).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";
    console.log(`[pipeline] Random Timing Jitter: +${delayMinutes} menit (target publikasi: ± ${publishTimeWIB})`);
  }

  // Kirim preview notifikasi ke Telegram (informatif, tanpa meminta approve)
  await sendPreview(contentId, 0, thumbUrl, {
    requireApproval: false,
    delayMinutes: delayMinutes > 0 ? delayMinutes : undefined,
    publishTimeWIB: publishTimeWIB || undefined,
  });
  updateContentStatus(contentId, "READY_FOR_PUBLISH");
  console.log("Preview Autopilot terkirim → READY_FOR_PUBLISH");

  // Jeda waktu acak (dengan polling cek pembatalan/skip/percepat dari Owner)
  if (delayMinutes > 0) {
    console.log(`[pipeline] Memulai hitung mundur jeda acak selama ${delayMinutes} menit...`);
    const totalMs = delayMinutes * 60 * 1000;
    const checkIntervalMs = 10000; // cek tiap 10 detik
    const startMs = Date.now();

    while (Date.now() - startMs < totalMs) {
      await new Promise((r) => setTimeout(r, Math.min(checkIntervalMs, totalMs - (Date.now() - startMs))));

      // Cek apakah Owner membatalkan atau meminta revisi selama jeda
      const current = getContentById(contentId);
      if (current?.status === "SKIPPED") {
        console.log(`[pipeline] Konten #${contentId} dibatalkan (SKIPPED) oleh Owner via Telegram. Menghentikan publikasi.`);
        return;
      }
      if (current?.status === "REVISION_PENDING") {
        console.log(`[pipeline] Konten #${contentId} diminta revisi oleh Owner. Menghentikan publikasi otomatis.`);
        return;
      }
      if (current?.status === "PUBLISHED") {
        console.log(`[pipeline] Konten #${contentId} telah dipublikasikan di sesi lain. Melewati.`);
        return;
      }
    }
    console.log("[pipeline] Jeda waktu acak selesai. Melanjutkan publikasi...");
  }

  // 6. Zero-Approval Autonomous Publish to Multi-Platform
  console.log("[pipeline] Menjalankan rilis otomatis tanpa approval (Zero-Approval Autopilot)...");
  try {
    const videoShort = v.shorts;
    if (existsSync(videoShort)) {
      const summary = (cFull?.script_text ?? cFull?.caption ?? "").slice(0, 1500);
      const sources = cFull ? (await import("../src/db.js")).db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = ?").all(contentId) as any[] : [];
      const srcLines = sources.map((s: any, i: number) => `${i + 1}. ${s.publisher ?? "Sumber"}: ${s.title}`).join("\n");
      const frictionQuestion = "💬 Menurut Anda, apakah terobosan AI ini ancaman nyata bagi pekerjaan atau peluang emas? Tulis opini Anda di bawah! 👇";
      const caption = summary 
        ? `${summary}\n\n${frictionQuestion}\n\n📰 Sumber:\n${srcLines}\n\n#AI #BeritaAI #Teknologi #ArtificialIntelligence #TechNews` 
        : `Update Perkembangan AI Terbaru\n\n${frictionQuestion}\n\n#AI #BeritaAI #Teknologi #ArtificialIntelligence`;

      const rawTopic = cFull?.topic_title?.trim();
      const isGenericTitle = !rawTopic || rawTopic.toLowerCase().startsWith("berita ai");
      const topicClean = isGenericTitle ? `Terobosan AI Terbaru ${date}` : rawTopic;
      const ytTitle = `${topicClean.slice(0, 75)} #Shorts`;

      const { publishToSocialDirect } = await import("../src/zernio.js");
      const { uploadYoutube } = await import("../src/publisher.js");

      const pubResults: any[] = [];
      // Publish TikTok + Instagram via Zernio
      try {
        const social = await publishToSocialDirect(videoShort, caption, date, contentId, undefined, thumbUrl);
        pubResults.push(...social);
      } catch (zErr: any) {
        console.error("[pipeline] auto-publish zernio gagal:", zErr.message);
        pubResults.push({ platform: "tiktok+instagram", ok: false, error: zErr.message });
      }

      // Publish YouTube Shorts
      try {
        const ytId = await uploadYoutube(videoShort, ytTitle, caption, "public");
        pubResults.push({ platform: "youtube", ok: true, externalId: ytId, url: `https://youtu.be/${ytId}` });
      } catch (yErr: any) {
        console.error("[pipeline] auto-publish youtube gagal:", yErr.message);
        pubResults.push({ platform: "youtube", ok: false, error: yErr.message });
      }

      const allOk = pubResults.every((r: any) => r.ok);
      updateContentStatus(contentId, allOk ? "PUBLISHED" : "PUBLISH_FAILED");
      console.log(`[pipeline] Auto-publish selesai: ${allOk ? "SUCCESS" : "PARTIAL/FAILED"}`);

      // Kirim laporan publikasi ke Telegram
      await sendPublishReport(contentId, pubResults);
    } else {
      console.warn("[pipeline] Video short tidak ditemukan untuk auto-publish:", videoShort);
    }
  } catch (pubErr: any) {
    console.error("[pipeline] Error saat auto-publish:", pubErr.message);
  }
}

try {
  await run();
} catch (e) {
  const msg = `Pipeline gagal: ${(e as Error).message}`;
  console.error("[pipeline]", msg);
  await sendAlert(msg);
  process.exit(1);
}
