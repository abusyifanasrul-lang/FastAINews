// Runner perakitan & publikasi video long-form:
// asset.zip (GDrive) → Unzip → Audio-Word Alignment → FFmpeg 1080p Ken Burns (3-5 mnt) → YouTube Upload + Chapters
import "dotenv/config";
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { parseGdriveId } from "../src/long/gdrive.js";
import { chaptersToDescription, type Chapter, type Beat } from "../src/long/storyboard.js";
import { uploadYoutube } from "../src/publisher.js";
import { db, getLongContentByDate } from "../src/db.js";
import { buildAssHud, getCinematicKenBurns, getHudContent } from "../src/long/cinematic.js";

const { values } = parseArgs({ options: { date: { type: "string" }, "gdrive-url": { type: "string" }, force: { type: "boolean" } } });
const date = (values.date ?? "").trim();
const gdriveUrl = (values["gdrive-url"] ?? "").trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error("--date harus YYYY-MM-DD"); process.exit(1); }
if (!gdriveUrl) { console.error("--gdrive-url wajib"); process.exit(1); }

async function tgSend(text: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const chat = process.env.OWNER_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000) }),
  }).catch(() => {});
}

function fail(id: number, msg: string): never {
  db.prepare("UPDATE long_contents SET status='FAILED', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
  void tgSend(`❌ Perakitan video long ${date} GAGAL: ${msg.slice(0, 300)}`);
  console.error(`[assemble-long] ${msg}`);
  process.exit(1);
}

/** Pindai rekursif untuk mencari file dalam direktori */
function getFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__MACOSX" && !entry.name.startsWith(".")) {
        files.push(...getFilesRecursively(fullPath));
      }
    } else {
      if (!entry.name.startsWith("._") && !entry.name.startsWith(".")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/** Natural numeric sort untuk mengurutkan file: 01.jpg, 02.jpg, ... 10.jpg (resilient thd prefix & suffix) */
function naturalSort(a: string, b: string): number {
  const baseA = basename(a, extname(a));
  const baseB = basename(b, extname(b));
  // Cek angka di awal nama file terlebih dahulu (misal: 01.jpg, 01_scene.jpg)
  const matchLeadingA = baseA.match(/^(\d+)/);
  const matchLeadingB = baseB.match(/^(\d+)/);
  if (matchLeadingA && matchLeadingB) {
    const diff = parseInt(matchLeadingA[1], 10) - parseInt(matchLeadingB[1], 10);
    if (diff !== 0) return diff;
  }
  // Fallback ke angka terakhir dalam nama file (misal: scene_1.jpg)
  const matchA = baseA.match(/(\d+)(?!.*\d)/);
  const matchB = baseB.match(/(\d+)(?!.*\d)/);
  if (matchA && matchB) {
    const diff = parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Baca durasi audio via ffprobe (detik) */
function getAudioDuration(filePath: string): number {
  try {
    const probe = execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath,
    ]).toString().trim();
    const dur = parseFloat(probe);
    if (!isNaN(dur) && dur > 0) return dur;
  } catch (e) {
    console.warn(`[assemble-long] ffprobe gagal baca durasi ${basename(filePath)}:`, (e as Error).message);
  }
  return 0;
}

async function run(): Promise<void> {
  const row = getLongContentByDate(date);
  if (!row) { console.error(`[assemble-long] edisi ${date} tidak ada di DB`); process.exit(1); }
  if (row.status === "PUBLISHING") {
    await tgSend(`⏳ Long ${date} sedang diproses runner lain.`);
    console.log("[assemble-long] guard: sudah PUBLISHING, tolak");
    process.exit(0);
  }
  if (row.status === "PUBLISHED" && !values.force) {
    await tgSend(`✅ Long ${date} sudah terbit: https://youtu.be/${row.youtube_id}`);
    console.log("[assemble-long] sudah PUBLISHED, skip (gunakan --force untuk merakit ulang)");
    process.exit(0);
  }

  let fileId: string;
  try { fileId = parseGdriveId(gdriveUrl); }
  catch (e) { fail(row.id, (e as Error).message); }

  db.prepare("UPDATE long_contents SET gdrive_url=?, status='PUBLISHING', updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(gdriveUrl, row.id);
  console.log(`[assemble-long] ${date} → PUBLISHING (file ${fileId!})`);
  await tgSend(`🛠️ Memulai perakitan video long ${date} di GitHub Actions runner...`);

  // 1. Download asset.zip dari GDrive
  const workDir = join(tmpdir(), `ainews-assemble-${date}-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });
  const zipPath = join(workDir, "asset.zip");

  try {
    console.log("[assemble-long] download asset.zip via gdown...");
    execFileSync("gdown", [`https://drive.google.com/uc?id=${fileId!}`, "-O", zipPath], { stdio: "inherit" });
  } catch {
    fail(row.id, "gdown gagal mengunduh asset.zip — pastikan link share Google Drive diatur ke 'Anyone with link can view'.");
  }
  if (!existsSync(zipPath) || statSync(zipPath).size < 1000) {
    fail(row.id, "File asset.zip tidak valid atau kosong setelah diunduh.");
  }

  // 2. Ekstrak asset.zip
  const extractDir = join(workDir, "extracted");
  mkdirSync(extractDir, { recursive: true });
  try {
    console.log("[assemble-long] mengekstrak asset.zip...");
    if (process.platform === "win32") {
      execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);
    } else {
      execFileSync("unzip", ["-q", "-o", zipPath, "-d", extractDir]);
    }
  } catch (e) {
    fail(row.id, `Gagal mengekstrak asset.zip: ${(e as Error).message}`);
  }

  // 3. Scan & normalisasi aset
  const allFiles = getFilesRecursively(extractDir);
  console.log(`[assemble-long] ${allFiles.length} file ditemukan di dalam asset.zip`);

  // Cari seluruh file audio narasi (.mp3)
  const audioFilesRaw = allFiles
    .filter((f) => {
      const b = basename(f);
      return !b.startsWith(".") && !f.includes("__MACOSX") && extname(f).toLowerCase() === ".mp3";
    })
    .sort(naturalSort);

  if (audioFilesRaw.length === 0) {
    fail(row.id, "Tidak ditemukan file audio .mp3 di dalam asset.zip!");
  }
  console.log(`[assemble-long] ${audioFilesRaw.length} file audio ditemukan: ${audioFilesRaw.map((f) => basename(f)).slice(0, 5).join(", ")}${audioFilesRaw.length > 5 ? "..." : ""}`);

  // Cari seluruh file gambar (.jpg, .jpeg, .png, .webp, .jfif)
  const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".jfif"];
  const imageFilesRaw = allFiles.filter((f) => {
    const b = basename(f);
    return !b.startsWith(".") && !f.includes("__MACOSX") && IMG_EXTS.includes(extname(f).toLowerCase());
  });

  if (imageFilesRaw.length === 0) {
    fail(row.id, "Tidak ditemukan file gambar (.jpg / .jfif / .png) di dalam asset.zip!");
  }

  // Normalisasi ekstensi .jfif -> .jpg
  const normalizedImages: string[] = [];
  for (const img of imageFilesRaw) {
    if (extname(img).toLowerCase() === ".jfif") {
      const newPath = img.replace(/\.jfif$/i, ".jpg");
      try { renameSync(img, newPath); normalizedImages.push(newPath); }
      catch { normalizedImages.push(img); }
    } else {
      normalizedImages.push(img);
    }
  }

  // Sort secara natural numeric
  normalizedImages.sort(naturalSort);
  console.log(`[assemble-long] ${normalizedImages.length} file gambar siap dirangkai`);

  // Siapkan master audio narasi: gabungkan seluruh MP3 jika lebih dari satu
  let masterAudioPath = audioFilesRaw[0];
  if (audioFilesRaw.length > 1) {
    const audioListFile = join(workDir, "audio_concat.txt");
    const audioListContent = audioFilesRaw.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
    writeFileSync(audioListFile, audioListContent, "utf8");
    masterAudioPath = join(workDir, "master_narration.mp3");
    console.log(`[assemble-long] menggabungkan ${audioFilesRaw.length} file audio menjadi master_narration.mp3...`);
    try {
      execFileSync("ffmpeg", [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", audioListFile,
        "-c:a", "libmp3lame",
        "-q:a", "2",
        masterAudioPath,
      ], { stdio: "ignore" });
    } catch (e) {
      fail(row.id, `FFmpeg concat audio gagal: ${(e as Error).message}`);
    }
  }

  // 4. Baca storyboard & durasi riil audio
  const storyboardFile = join(process.cwd(), "content", "long", date, "storyboard.json");
  if (!existsSync(storyboardFile)) {
    fail(row.id, `File storyboard.json tidak ditemukan untuk edisi ${date}`);
  }
  const sbData = JSON.parse(readFileSync(storyboardFile, "utf8")) as {
    title: string;
    chapters: Chapter[];
    beats: Beat[];
    estTotalSec: number;
  };

  const actualAudioSec = getAudioDuration(masterAudioPath);
  if (!actualAudioSec || actualAudioSec < 60) {
    fail(row.id, `Durasi total audio tidak valid: ${actualAudioSec} dtk (minimal 60 detik)`);
  }
  console.log(`[assemble-long] durasi total audio riil: ${actualAudioSec.toFixed(1)} dtk (~${(actualAudioSec / 60).toFixed(1)} mnt)`);

  // 5. Penyelarasan Waktu Narasi (Mendukung 3 Mode: Paragraf naskah, Beat 1:1, atau Proporsional)
  const beats = sbData.beats;

  // Baca paragraf naskah dari script.md jika ada
  const scriptFile = join(process.cwd(), "content", "long", date, "script.md");
  let scriptParas: string[] = [];
  if (existsSync(scriptFile)) {
    const rawScript = readFileSync(scriptFile, "utf8");
    const cleanScript = rawScript.replace(/^#\s+[^\n]+\n+/, "").trim();
    scriptParas = cleanScript
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\*\*/g, "").replace(/[\r\n]+/g, " "))
      .filter(Boolean);
  }

  const isParaMode = scriptParas.length > 0 && audioFilesRaw.length === scriptParas.length;
  const isBeatMode = audioFilesRaw.length === beats.length;

  let alignedBeats: { i: number; startSec: number; durationSec: number; imagePath: string }[] = [];
  let beatsWithPara: { beat: Beat; paraIdx: number }[] = [];
  let paraDurations: number[] = [];

  if (isParaMode) {
    console.log(`[assemble-long] mode paragraf aktif: ${audioFilesRaw.length} file audio cocok dengan ${scriptParas.length} paragraf naskah`);
    paraDurations = audioFilesRaw.map((af) => getAudioDuration(af));

    // Hitung waktu mulai setiap paragraf berdasarkan akumulasi durasi audio MP3 riil
    const paraStartTimes = [0];
    for (let i = 0; i < paraDurations.length - 1; i++) {
      paraStartTimes.push(paraStartTimes[i] + (paraDurations[i] || 0));
    }

    // Petakan tiap beat ke paragrafnya
    let pIdx = 0;
    beatsWithPara = beats.map((b) => {
      const bClean = b.text.replace(/\s+/g, " ").trim();
      const snippet = bClean.slice(0, 30);
      for (let i = pIdx; i < scriptParas.length; i++) {
        if (scriptParas[i].includes(snippet)) {
          pIdx = i;
          break;
        }
      }
      return { beat: b, paraIdx: pIdx };
    });

    // Kelompokkan beats per paragraf
    const paraGroups = new Map<number, Beat[]>();
    beatsWithPara.forEach((bp) => {
      if (!paraGroups.has(bp.paraIdx)) paraGroups.set(bp.paraIdx, []);
      paraGroups.get(bp.paraIdx)!.push(bp.beat);
    });

    const paraElapsed = new Map<number, number>();
    alignedBeats = beats.map((b, idx) => {
      const p = beatsWithPara[idx].paraIdx;
      const group = paraGroups.get(p) || [b];
      const paraDur = paraDurations[p] || (actualAudioSec / scriptParas.length);
      const groupWords = group.reduce((acc, gb) => acc + (gb.text.trim().split(/\s+/).length || 1), 0);
      const bWords = b.text.trim().split(/\s+/).length || 1;

      const elapsed = paraElapsed.get(p) || 0;
      const beatInGroupIdx = group.indexOf(b);
      const isLastInGroup = beatInGroupIdx === group.length - 1;

      // Beat terakhir di dalam paragraf menyerap sisa durasi agar 100% pas dengan durasi file MP3 paragraf ini
      const dur = isLastInGroup ? Math.max(0.5, paraDur - elapsed) : (bWords / (groupWords || 1)) * paraDur;
      const startSec = paraStartTimes[p] + elapsed;

      paraElapsed.set(p, elapsed + dur);

      const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
      return {
        i: b.i,
        startSec,
        durationSec: dur,
        imagePath: imgPath,
      };
    });
  } else if (isBeatMode) {
    console.log(`[assemble-long] mode presisi 1:1 aktif (${audioFilesRaw.length} audio cocok 1:1 dengan ${beats.length} scene)`);
    const perAudioDurations = audioFilesRaw.map((af) => getAudioDuration(af));
    let curStart = 0;
    alignedBeats = beats.map((b, idx) => {
      const dur = perAudioDurations[idx] > 0 ? perAudioDurations[idx] : (actualAudioSec / beats.length);
      const startSec = curStart;
      curStart += dur;
      const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
      return {
        i: b.i,
        startSec,
        durationSec: dur,
        imagePath: imgPath,
      };
    });
  } else {
    console.log(`[assemble-long] mode penyelarasan proporsional aktif (${audioFilesRaw.length} audio untuk ${beats.length} scene)`);
    const totalWords = beats.reduce((acc, b) => acc + (b.text.trim().split(/\s+/).length || 1), 0);
    let curStart = 0;
    alignedBeats = beats.map((b, idx) => {
      const w = b.text.trim().split(/\s+/).length || 1;
      const dur = (w / totalWords) * actualAudioSec;
      const startSec = curStart;
      curStart += dur;
      const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
      return {
        i: b.i,
        startSec,
        durationSec: dur,
        imagePath: imgPath,
      };
    });
  }

  // Sinkronkan chapters timestamp ke durasi audio riil (mengikuti startSec beat pertama di tiap bab)
  const alignedChapters = sbData.chapters.map((c) => {
    const firstBeat = alignedBeats.find((_, idx) => sbData.beats[idx]?.chapter === c.title);
    const startSec = firstBeat ? Math.round(firstBeat.startSec) : 0;
    return { title: c.title, startSec };
  });
  if (alignedChapters.length > 0) alignedChapters[0].startSec = 0;

  // 6. Perakitan Video via Cinematic Native Engine (2.5K Ken Burns, xfade dissolve, Lower-Third HUD, VFX Grading)
  interface RenderBeat {
    globalIdx: number;
    wordCount: number;
    imagePath: string;
    chapterName: string;
  }

  interface RenderGroup {
    pIdx: number;
    targetDurSec: number;
    paraText: string;
    chapterName: string;
    beats: RenderBeat[];
  }

  const renderGroups: RenderGroup[] = [];

  if (isParaMode) {
    for (let p = 0; p < scriptParas.length; p++) {
      const pBeats: RenderBeat[] = [];
      beatsWithPara.forEach((bp, idx) => {
        if (bp.paraIdx === p) {
          const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
          pBeats.push({
            globalIdx: idx,
            wordCount: Math.max(1, bp.beat.text.trim().split(/\s+/).length),
            imagePath: imgPath,
            chapterName: bp.beat.chapter || "FastAI News",
          });
        }
      });
      if (pBeats.length === 0) {
        const fallbackImg = normalizedImages[p % normalizedImages.length];
        pBeats.push({
          globalIdx: p,
          wordCount: 1,
          imagePath: fallbackImg,
          chapterName: sbData.chapters[0]?.title || "FastAI News",
        });
      }
      renderGroups.push({
        pIdx: p,
        targetDurSec: paraDurations[p] || (actualAudioSec / scriptParas.length),
        paraText: scriptParas[p],
        chapterName: pBeats[0]?.chapterName || "FastAI News",
        beats: pBeats,
      });
    }
  } else if (isBeatMode) {
    beats.forEach((b, idx) => {
      const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
      const dur = alignedBeats[idx]?.durationSec || (actualAudioSec / beats.length);
      renderGroups.push({
        pIdx: idx,
        targetDurSec: dur,
        paraText: b.text,
        chapterName: b.chapter || "FastAI News",
        beats: [{
          globalIdx: idx,
          wordCount: Math.max(1, b.text.trim().split(/\s+/).length),
          imagePath: imgPath,
          chapterName: b.chapter || "FastAI News",
        }],
      });
    });
  } else {
    // Single audio / proporsional: kelompokkan per scriptParas jika ada, fallback per beat
    if (scriptParas.length > 0) {
      const totalWordsAll = scriptParas.reduce((acc, s) => acc + (s.trim().split(/\s+/).length || 1), 0);
      let pIdxMatch = 0;
      const bWithP = beats.map((b) => {
        const snippet = b.text.replace(/\s+/g, " ").trim().slice(0, 30);
        for (let i = pIdxMatch; i < scriptParas.length; i++) {
          if (scriptParas[i].includes(snippet)) { pIdxMatch = i; break; }
        }
        return { beat: b, pIdx: pIdxMatch };
      });

      for (let p = 0; p < scriptParas.length; p++) {
        const pBeats: RenderBeat[] = [];
        bWithP.forEach((bp, idx) => {
          if (bp.pIdx === p) {
            const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
            pBeats.push({
              globalIdx: idx,
              wordCount: Math.max(1, bp.beat.text.trim().split(/\s+/).length),
              imagePath: imgPath,
              chapterName: bp.beat.chapter || "FastAI News",
            });
          }
        });
        if (pBeats.length === 0) {
          pBeats.push({
            globalIdx: p,
            wordCount: 1,
            imagePath: normalizedImages[p % normalizedImages.length],
            chapterName: sbData.chapters[0]?.title || "FastAI News",
          });
        }
        const pWords = scriptParas[p].trim().split(/\s+/).length || 1;
        const targetDur = (pWords / totalWordsAll) * actualAudioSec;
        renderGroups.push({
          pIdx: p,
          targetDurSec: targetDur,
          paraText: scriptParas[p],
          chapterName: pBeats[0]?.chapterName || "FastAI News",
          beats: pBeats,
        });
      }
    } else {
      beats.forEach((b, idx) => {
        const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
        const dur = alignedBeats[idx]?.durationSec || (actualAudioSec / beats.length);
        renderGroups.push({
          pIdx: idx,
          targetDurSec: dur,
          paraText: b.text,
          chapterName: b.chapter || "FastAI News",
          beats: [{
            globalIdx: idx,
            wordCount: Math.max(1, b.text.trim().split(/\s+/).length),
            imagePath: imgPath,
            chapterName: b.chapter || "FastAI News",
          }],
        });
      });
    }
  }

  console.log(`[assemble-long] merakit ${renderGroups.length} segmen visual via Cinematic Native Engine (2.5K Ken Burns, xfade dissolve, HUD ASS, VFX grading)...`);
  const clipListFile = join(workDir, "clips.txt");
  const clipPaths: string[] = [];
  const fps = 24;

  for (let p = 0; p < renderGroups.length; p++) {
    const group = renderGroups[p];
    const paraClipOut = join(workDir, `para_${String(p + 1).padStart(3, "0")}.mp4`);
    const K = group.beats.length;
    const targetDur = group.targetDurSec;

    // Buat file subtitle ASS untuk HUD Lower-Third di direktori workDir
    const hudAssName = `hud_${p + 1}.ass`;
    const hudAssPath = join(workDir, hudAssName);
    const hud = getHudContent(p, renderGroups.length, group.chapterName, group.paraText);
    writeFileSync(hudAssPath, buildAssHud(p + 1, hud.title, hud.tag, targetDur), "utf8");

    let filterComplex = "";
    const inputArgs: string[] = [];

    if (K === 1) {
      const b = group.beats[0];
      const totalFrames = Math.round(targetDur * fps);
      inputArgs.push("-loop", "1", "-t", targetDur.toFixed(2), "-i", b.imagePath);

      const kbFilter = getCinematicKenBurns(b.globalIdx, totalFrames, fps);
      const vfxChain = `vignette=PI/4.5,eq=contrast=1.05:brightness=-0.01:saturation=1.10,ass=${hudAssName},fade=t=out:st=${Math.max(0, targetDur - 0.35).toFixed(2)}:d=0.35`;
      filterComplex = `[0:v]${kbFilter},${vfxChain}[outv]`;
    } else {
      const wordCounts = group.beats.map((b) => b.wordCount);
      const totalW = wordCounts.reduce((acc, w) => acc + w, 0);

      const baseDurs: number[] = [];
      let accum = 0;
      for (let i = 0; i < K - 1; i++) {
        const d = (wordCounts[i] / totalW) * targetDur;
        baseDurs.push(d);
        accum += d;
      }
      baseDurs.push(Math.max(0.5, targetDur - accum));

      const minBaseDur = Math.min(...baseDurs);
      const transDur = Math.min(0.8, Math.max(0.2, minBaseDur * 0.4));

      const fcLines: string[] = [];
      for (let i = 0; i < K; i++) {
        const b = group.beats[i];
        const clipDur = baseDurs[i] + (i < K - 1 ? transDur : 0);
        const totalFrames = Math.round(clipDur * fps);
        inputArgs.push("-loop", "1", "-t", clipDur.toFixed(2), "-i", b.imagePath);

        const kbFilter = getCinematicKenBurns(b.globalIdx, totalFrames, fps);
        fcLines.push(`[${i}:v]${kbFilter}[v${i}]`);
      }

      let curOffset = 0;
      for (let i = 0; i < K - 1; i++) {
        curOffset += baseDurs[i];
        const prevLabel = i === 0 ? `[v0]` : `[x${i - 1}]`;
        const nextLabel = `[v${i + 1}]`;
        const outLabel = i === K - 2 ? `[mx]` : `[x${i}]`;
        fcLines.push(`${prevLabel}${nextLabel}xfade=transition=dissolve:duration=${transDur.toFixed(2)}:offset=${curOffset.toFixed(2)}${outLabel}`);
      }

      const vfxChain = `vignette=PI/4.5,eq=contrast=1.05:brightness=-0.01:saturation=1.10,ass=${hudAssName},fade=t=out:st=${Math.max(0, targetDur - 0.35).toFixed(2)}:d=0.35`;
      fcLines.push(`[mx]${vfxChain}[outv]`);
      filterComplex = fcLines.join(";");
    }

    try {
      execFileSync("ffmpeg", [
        "-y",
        ...inputArgs,
        "-filter_complex", filterComplex,
        "-map", "[outv]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-t", targetDur.toFixed(2),
        paraClipOut,
      ], { stdio: "ignore", cwd: workDir });
      clipPaths.push(paraClipOut);
    } catch (err) {
      console.warn(`[assemble-long] segmen ${p + 1} render dengan HUD gagal (${(err as Error).message}), fallback tanpa HUD...`);
      const fallbackFilter = filterComplex.replace(new RegExp(`,ass=${hudAssName}`, "g"), "");
      try {
        execFileSync("ffmpeg", [
          "-y",
          ...inputArgs,
          "-filter_complex", fallbackFilter,
          "-map", "[outv]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-pix_fmt", "yuv420p",
          "-t", targetDur.toFixed(2),
          paraClipOut,
        ], { stdio: "ignore", cwd: workDir });
        clipPaths.push(paraClipOut);
      } catch (e2) {
        fail(row.id, `FFmpeg gagal merender segmen ${p + 1}: ${(e2 as Error).message}`);
      }
    }
  }

  // Gabungkan seluruh klip visual segmen
  const concatFileContent = clipPaths.map((p) => `file '${basename(p)}'`).join("\n");
  writeFileSync(clipListFile, concatFileContent, "utf8");

  const visualConcatMp4 = join(workDir, "visual_concat.mp4");
  console.log("[assemble-long] menggabungkan seluruh klip visual...");
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", clipListFile,
      "-c", "copy",
      visualConcatMp4,
    ], { stdio: "inherit", cwd: workDir });
  } catch (e) {
    fail(row.id, `FFmpeg concat visual gagal: ${(e as Error).message}`);
  }

  // Gabungkan visual dengan audio narasi (audio mixing murni)
  const finalVideoPath = join(workDir, `final-${date}.mp4`);
  console.log("[assemble-long] menggabungkan visual dengan audio narasi...");
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-i", visualConcatMp4,
      "-i", masterAudioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-shortest",
      finalVideoPath,
    ], { stdio: "inherit" });
  } catch (e) {
    fail(row.id, `FFmpeg audio-visual merge gagal: ${(e as Error).message}`);
  }

  if (!existsSync(finalVideoPath) || statSync(finalVideoPath).size < 100_000) {
    fail(row.id, "Video final MP4 tidak ditemukan atau ukurannya tidak wajar.");
  }
  const videoSizeMb = Math.round(statSync(finalVideoPath).size / (1024 * 1024));
  console.log(`[assemble-long] Video MP4 1080p berhasil dirakit! Ukuran: ${videoSizeMb} MB`);

  // 7. Upload ke YouTube
  const description = chaptersToDescription(
    `Analisis mendalam AI edisi ${date}: ${sbData.title}.\n\nSimak rangkuman lengkap peristiwa kecerdasan buatan terpenting yang mengubah industri global minggu ini.`,
    alignedChapters,
  );

  // Thumbnail: gunakan gambar pertama dari zip atau cover edisi
  const thumbnailCandidate = normalizedImages[0] ?? join(process.cwd(), "content", "long", date, "images", "src1.jpg");
  const thumbnailPath = existsSync(thumbnailCandidate) ? thumbnailCandidate : undefined;

  console.log(`[assemble-long] mengunggah video ke YouTube (${videoSizeMb} MB)...`);
  let ytId = "";
  try {
    ytId = await uploadYoutube(
      finalVideoPath,
      sbData.title.slice(0, 100),
      description,
      "public",
      thumbnailPath,
    );
  } catch (e) {
    fail(row.id, `Upload YouTube gagal: ${(e as Error).message}`);
  }

  // 8. Update DB & Kirim Notifikasi Sukses
  db.prepare("UPDATE long_contents SET status='PUBLISHED', youtube_id=?, duration_sec=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(ytId, Math.round(actualAudioSec), row.id);

  const ytUrl = `https://youtu.be/${ytId}`;
  console.log(`[assemble-long] BERHASIL TERBIT: ${ytUrl}`);
  await tgSend(`🎉 Video Long-Form ${date} BERHASIL TERBIT!\n📌 ${sbData.title}\n⏱ Durasi: ${(actualAudioSec / 60).toFixed(1)} menit (${Math.round(actualAudioSec)}s)\n🎬 ${beats.length} Scene Cinematic Engine (2.5K Smooth Ken Burns, xfade dissolve, Lower-Third HUD, VFX Grading)\n🔗 Tonton di YouTube: ${ytUrl}`);

  // Bersihkan temporary directory
  try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  console.log("[assemble-long] Selesai.");
}

try {
  await run();
} catch (e) {
  const err = e as Error;
  console.error("[assemble-long] FATAL:", err.message, err.stack);
  process.exit(1);
}
