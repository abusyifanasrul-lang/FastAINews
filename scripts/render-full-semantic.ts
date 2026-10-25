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
    const numV = visuals.length;

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

    // Hitung alokasi durasi setiap visual
    // Jika ada video berdurasi tetap (misal klip HF 7.0s), alokasikan durasi tersebut, sisanya dibagi rata ke gambar
    const vDurs: number[] = new Array(numV).fill(0);
    let reservedTime = 0;
    let autoCount = 0;

    for (let i = 0; i < numV; i++) {
      if (visuals[i].durationSec) {
        vDurs[i] = visuals[i].durationSec!;
        reservedTime += visuals[i].durationSec!;
      } else {
        autoCount++;
      }
    }

    const remainingTime = Math.max(0, targetDur - reservedTime);
    const perAutoTime = autoCount > 0 ? remainingTime / autoCount : 0;
    for (let i = 0; i < numV; i++) {
      if (!visuals[i].durationSec) {
        vDurs[i] = perAutoTime;
      }
    }

    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < numV; i++) {
      const v = visuals[i];
      const vPath = resolveVisualPath(v);
      if (!existsSync(vPath)) throw new Error(`Visual path not found: ${vPath}`);

      const dur = vDurs[i];
      const isVid = v.type === "video";
      const totalFrames = Math.round(dur * fps);

      if (isVid) {
        inputArgs.push("-t", dur.toFixed(2), "-i", vPath);
        filterParts.push(`[${i}:v]fps=${fps},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`);
      } else {
        inputArgs.push("-loop", "1", "-t", dur.toFixed(2), "-i", vPath);
        const kb = getCinematicKenBurns(pIdx * 3 + i, totalFrames, fps);
        filterParts.push(`[${i}:v]${kb}[v${i}]`);
      }
      concatInputs.push(`[v${i}]`);
    }

    const filterComplex = numV === 1
      ? `${filterParts[0].replace(`[v0]`, `[pre]`)}[pre]ass=${hudAssName}[outv]`
      : `${filterParts.join(";")};${concatInputs.join("")}concat=n=${numV}:v=1:a=0,ass=${hudAssName}[outv]`;

    execFileSync("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "[outv]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
      "-t", targetDur.toFixed(2),
      clipOut
    ], { cwd: workDir });

    clipPaths.push(clipOut);
    console.log(`  -> Selesai: segment_${String(pIdx).padStart(2, "0")}.mp4 (${numV} visual beat)`);
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
