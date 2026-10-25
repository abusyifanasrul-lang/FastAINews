import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { buildAssHud, getCinematicKenBurns, getHudContent } from "../src/long/cinematic.js";

const date = "2026-10-24";
const baseDir = join(process.cwd(), "content", "long", date);
const workDir = join(process.cwd(), "tmp-full-render");
mkdirSync(workDir, { recursive: true });

function getAudioDuration(filePath: string): number {
  try {
    const probe = execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath,
    ]).toString().trim();
    const dur = parseFloat(probe);
    if (!isNaN(dur) && dur > 0) return dur;
  } catch {}
  return 0;
}

interface ManifestVisual {
  file: string;
  durationSec?: number;
  type: "image" | "video";
}

interface ManifestParagraph {
  index: number;
  topic: string;
  visuals: ManifestVisual[];
}

interface Manifest {
  edition: string;
  paragraphs: ManifestParagraph[];
}

async function renderFullVideo() {
  console.log(`[render-full] Memulai perakitan video 10 menit presisi semantik untuk edisi ${date}...`);

  // 1. Baca Manifest Semantik
  const manifestPath = join(baseDir, "semantic_manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

  // 2. Baca naskah teks paragraf
  const parasPath = join(baseDir, "paragraphs.txt");
  const paras = readFileSync(parasPath, "utf8").split("\n").map(p => p.trim()).filter(Boolean);

  // 3. Peta file audio paragraf
  const audioDir = join(baseDir, "audio_paras");
  const audioFiles: string[] = [];
  const paraDurations: number[] = [];

  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    const af = join(audioDir, `${num}.mp3`);
    if (!existsSync(af)) throw new Error(`Audio ${af} tidak ditemukan!`);
    audioFiles.push(af);
    const dur = getAudioDuration(af);
    paraDurations.push(dur);
  }

  // Gabungkan seluruh audio menjadi master_audio.mp3
  const audioListFile = join(workDir, "audio_concat.txt");
  writeFileSync(audioListFile, audioFiles.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const masterAudioPath = join(workDir, "master_audio.mp3");
  console.log("[render-full] Menggabungkan 12 audio narasi menjadi master audio...");
  execFileSync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", audioListFile,
    "-c:a", "libmp3lame", "-q:a", "2", masterAudioPath
  ]);
  const totalAudioSec = getAudioDuration(masterAudioPath);
  console.log(`[render-full] Master audio siap: ${totalAudioSec.toFixed(2)} detik (~${(totalAudioSec / 60).toFixed(2)} menit).`);

  // 4. Render Segmen Video per Paragraf secara Semantik
  const clipListFile = join(workDir, "clip_list.txt");
  const clipPaths: string[] = [];
  const fps = 24;

  const imagesDir = join(baseDir, "images");

  for (let p = 0; p < manifest.paragraphs.length; p++) {
    const pCfg = manifest.paragraphs[p];
    const pIdx = pCfg.index; // 1-indexed
    const targetDur = paraDurations[p];
    const paraText = paras[p];
    const clipOut = join(workDir, `segment_${String(pIdx).padStart(2, "0")}.mp4`);

    if (existsSync(clipOut)) {
      unlinkSync(clipOut);
    }

    console.log(`\n[render-full] Merender Segmen ${pIdx}/12 (${pCfg.topic}, ${targetDur.toFixed(1)}s)...`);

    // ASS HUD
    const hud = getHudContent(p, manifest.paragraphs.length, pCfg.topic, paraText);
    const hudAssName = `hud_${pIdx}.ass`;
    const hudAssPath = join(workDir, hudAssName);
    writeFileSync(hudAssPath, buildAssHud(pIdx, hud.title, hud.tag, targetDur, { ...hud, paraText }), "utf8");

    const visuals = pCfg.visuals;

    if (visuals.length === 1) {
      // 1 Visual Tunggal (Foto Sinematik Ken Burns sepanjang durasi paragraf)
      const v = visuals[0];
      const imgPath = join(imagesDir, v.file);
      const totalFrames = Math.round(targetDur * fps);
      const kbFilter = getCinematicKenBurns(pIdx, totalFrames, fps);

      execFileSync("ffmpeg", [
        "-y",
        "-loop", "1", "-t", targetDur.toFixed(2), "-i", imgPath,
        "-filter_complex", `[0:v]${kbFilter},ass=${hudAssName}[outv]`,
        "-map", "[outv]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-t", targetDur.toFixed(2),
        clipOut
      ], { cwd: workDir });

    } else if (visuals.length === 2) {
      // 2 Visual: Bisa (Video + Foto) seperti P1, atau (Foto + Video Klip HyperFrames) seperti P3-P8, P10, P11
      const v1 = visuals[0];
      const v2 = visuals[1];

      function resolveVisualPath(v: ManifestVisual): string {
        if (v.type === "video") {
          const direct = join(baseDir, v.file);
          if (existsSync(direct)) return direct;
          const stripped = join(baseDir, v.file.replace(/^00_/, "").replace(/^\d\d_/, ""));
          if (existsSync(stripped)) return stripped;
          return direct;
        } else {
          return join(imagesDir, v.file);
        }
      }

      const v1Path = resolveVisualPath(v1);
      const v2Path = resolveVisualPath(v2);

      if (!existsSync(v1Path)) throw new Error(`v1Path not found: ${v1Path}`);
      if (!existsSync(v2Path)) throw new Error(`v2Path not found: ${v2Path}`);

      // Hitung durasi masing-masing
      let d1 = 0;
      let d2 = 0;

      if (v1.durationSec) {
        // Misal Hook Opener (7.0 detik)
        d1 = v1.durationSec;
        d2 = Math.max(1.0, targetDur - d1);
      } else if (v2.type === "video") {
        // Klip HyperFrames di paruh kedua: tampilkan 7 detik penuh!
        d2 = 7.0;
        d1 = Math.max(1.0, targetDur - d2);
      } else {
        d1 = targetDur / 2;
        d2 = targetDur - d1;
      }

      const f1Frames = Math.round(d1 * fps);
      const f2Frames = Math.round(d2 * fps);

      const isV1Video = v1.type === "video";
      const isV2Video = v2.type === "video";

      const v1Filter = isV1Video
        ? `fps=${fps},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`
        : `scale=1920:1080,setsar=1,fps=${fps}`;

      const v2Filter = isV2Video
        ? `fps=${fps},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1`
        : `scale=1920:1080,setsar=1,fps=${fps}`;

      const filterComplex = `[0:v]${v1Filter}[v0];[1:v]${v2Filter}[v1];[v0][v1]concat=n=2:v=1:a=0,ass=${hudAssName}[outv]`;

      const inputArgs: string[] = [];
      if (isV1Video) {
        inputArgs.push("-t", d1.toFixed(2), "-i", v1Path);
      } else {
        inputArgs.push("-loop", "1", "-t", d1.toFixed(2), "-i", v1Path);
      }

      if (isV2Video) {
        inputArgs.push("-t", d2.toFixed(2), "-i", v2Path);
      } else {
        inputArgs.push("-loop", "1", "-t", d2.toFixed(2), "-i", v2Path);
      }

      execFileSync("ffmpeg", [
        "-y",
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", "[outv]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-t", targetDur.toFixed(2),
        clipOut
      ], { cwd: workDir });
    }

    clipPaths.push(clipOut);
    console.log(`  -> Selesai: segment_${String(pIdx).padStart(2, "0")}.mp4`);
  }

  // 5. Gabungkan seluruh 12 segmen video
  console.log("\n[render-full] Menggabungkan seluruh 12 segmen video visual...");
  const concatList = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
  writeFileSync(clipListFile, concatList, "utf8");
  const visualConcatPath = join(workDir, "visual_full.mp4");

  execFileSync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", clipListFile,
    "-c", "copy", visualConcatPath
  ]);

  // 6. Muxing Akhir dengan Audio Narasi Studio
  const finalVideoPath = join(baseDir, `FastAINews-Long-${date}.mp4`);
  console.log(`\n[render-full] Muxing video final dengan audio ke: ${finalVideoPath}...`);

  execFileSync("ffmpeg", [
    "-y",
    "-i", visualConcatPath,
    "-i", masterAudioPath,
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k",
    "-shortest",
    finalVideoPath
  ]);

  const probe = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration,size", "-of", "json", finalVideoPath
  ]).toString();

  console.log(`\n🎉 PROSES SELESAI! Video long-form final 10 menit berhasil diproduksi!`);
  console.log("Metadata:", probe);
  console.log(`File siap tonton: ${finalVideoPath}`);
}

renderFullVideo().catch(e => {
  console.error("Render Full Video GAGAL:", e);
  process.exit(1);
});
