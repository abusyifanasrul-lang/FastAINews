import { runPipeline } from "../src/pipeline.js";
import { generateTtsChunks } from "../src/tts.js";
import { renderVideos } from "../src/video.js";
import { getContentByDate, updateContentStatus } from "../src/db.js";
import { sendPreview } from "../src/telegram.js";
import { sendAlert } from "../src/telegram.js";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
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
  if (existsSync(v.shorts)) {
    try {
      // dapatkan durasi audio
      const audioPath = join(outDir, "voiceover.mp3");
      let audioDur = 0;
      if (existsSync(audioPath)) {
        const durStr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath]).toString().trim();
        audioDur = parseFloat(durStr) || 0;
      }
      // kompres dan potong ke durasi audio
      const args = [
        "-y", "-v", "error", "-i", v.shorts,
        "-vf", "scale=480:854",
        "-c:v", "libx264", "-preset", "fast", "-crf", "32",
        "-c:a", "aac", "-b:a", "96k",
      ];
      if (audioDur > 0) {
        args.push("-t", String(audioDur));
      }
      args.push(previewPath);
      execFileSync("ffmpeg", args, { stdio: "pipe" });
      console.log("Kompres:", previewPath);
    } catch (e) {
      console.warn("Kompres/trim gagal, pakai original:", e);
    }
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
