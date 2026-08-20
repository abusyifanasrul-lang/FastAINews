import { runPipeline } from "../src/pipeline.js";
import { generateTtsChunks } from "../src/tts.js";
import { renderVideos } from "../src/video.js";
import { getContentByDate, updateContentStatus } from "../src/db.js";
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

  // 4. kompres + potong ke durasi audio + log
  console.log("[pipeline] 4/4 kompres + trim ke audio...");
  const previewPath = join(outDir, "shorts-preview.mp4");
  const audioPath = join(outDir, "voiceover.mp3");
  if (existsSync(v.shorts) && existsSync(audioPath)) {
    try {
      // 4a. trim trailing silence dari audio
      console.log("[pipeline] trim trailing silence dari audio...");
      const trimmedAudioPath = join(outDir, "voiceover-trimmed.mp3");
      execFileSync("ffmpeg", [
        "-y",
        "-i", audioPath,
        "-af", "silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB",
        "-c:a", "libmp3lame",
        trimmedAudioPath
      ], { stdio: "inherit" });
      
      // dapatkan durasi audio trimmed
      const durStr = execFileSync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        trimmedAudioPath
      ]).toString().trim();
      const audioDur = parseFloat(durStr) || 0;
      console.log("Audio duration (trimmed):", audioDur, "s");

      // durasi video asli
      const videoDurStr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", v.shorts]).toString().trim();
      const videoDur = parseFloat(videoDurStr) || 0;
      console.log("Video durasi (raw):", videoDur, "s");

      // kompres dan potong video ke durasi audio (trimmed)
      const args = [
        "-y", "-v", "error", "-i", v.shorts,
        "-vf", "scale=480:854",
        "-c:v", "libx264", "-preset", "fast", "-crf", "32",
        "-c:a", "aac", "-b:a", "96k",
      ];
      if (audioDur > 0) {
        args.push("-t", String(audioDur));
        console.log("Trim video ke", audioDur, "s");
      } else {
        console.warn("Audio duration not found, skip trim");
      }
      args.push(previewPath);
      execFileSync("ffmpeg", args, { stdio: "pipe" });

      // durasi hasil
      const outDurStr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", previewPath]).toString().trim();
      const outDur = parseFloat(outDurStr) || 0;
      console.log("Video kompres (final):", outDur, "s");
      
      // ganti file audio dengan yang sudah ditrim
      renameSync(trimmedAudioPath, audioPath);
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
