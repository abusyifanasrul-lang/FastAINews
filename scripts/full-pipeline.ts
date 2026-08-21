import { runPipeline } from "../src/pipeline.js";
import { generateTtsChunks } from "../src/tts.js";
import { renderVideos } from "../src/video.js";
import { getContentByDate, getContentWithSources, updateContentStatus } from "../src/db.js";
import { sendPreview } from "../src/telegram.js";
import { sendAlert } from "../src/telegram.js";
import { join } from "node:path";
import { mkdirSync, existsSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";

const date = new Date().toISOString().slice(0, 10);

async function run() {
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

  // 4.5 generate thumbnail
  console.log("[pipeline] generate thumbnail...");
  const cFull = getContentWithSources(date);
  if (cFull && cFull.sources.length > 0) {
    try {
      const { generateThumbnail } = await import("../src/thumbnail.js");
      const hook = cFull.topic_title ?? "Berita AI Hari Ini";
      const thumb = generateThumbnail(date, cFull.sources, hook, v.shorts);
      console.log("Thumbnail:", thumb);
    } catch (e) {
      console.error("Thumbnail generation error:", e);
    }
  } else {
    console.warn("Tidak ada sumber untuk thumbnail");
  }

  // 5. kirim preview ke Telegram
  await sendPreview(contentId);
  updateContentStatus(contentId, "PENDING_REVIEW");
  console.log("Preview terkirim → PENDING_REVIEW");
}

try {
  await run();
} catch (e) {
  const msg = `Pipeline gagal: ${(e as Error).message}`;
  console.error("[pipeline]", msg);
  await sendAlert(msg);
  process.exit(1);
}
