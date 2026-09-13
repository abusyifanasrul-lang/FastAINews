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

const { values } = parseArgs({ options: { date: { type: "string" }, "gdrive-url": { type: "string" } } });
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

/** Natural numeric sort untuk mengurutkan file: 1.jpg, 2.jpg, ... 10.jpg */
function naturalSort(a: string, b: string): number {
  const numA = basename(a).match(/\d+/)?.[0];
  const numB = basename(b).match(/\d+/)?.[0];
  if (numA !== undefined && numB !== undefined) {
    const diff = parseInt(numA, 10) - parseInt(numB, 10);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function run(): Promise<void> {
  const row = getLongContentByDate(date);
  if (!row) { console.error(`[assemble-long] edisi ${date} tidak ada di DB`); process.exit(1); }
  if (row.status === "PUBLISHING") {
    await tgSend(`⏳ Long ${date} sedang diproses runner lain.`);
    console.log("[assemble-long] guard: sudah PUBLISHING, tolak");
    process.exit(0);
  }
  if (row.status === "PUBLISHED") {
    await tgSend(`✅ Long ${date} sudah terbit: https://youtu.be/${row.youtube_id}`);
    console.log("[assemble-long] sudah PUBLISHED, skip");
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
    execFileSync("gdown", ["--fuzzy", `https://drive.google.com/uc?id=${fileId!}`, "-O", zipPath], { stdio: "inherit" });
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

  // Cari file audio narasi
  const audioFile = allFiles.find((f) => extname(f).toLowerCase() === ".mp3");
  if (!audioFile) {
    fail(row.id, "Tidak ditemukan file audio .mp3 (narration.mp3) di dalam asset.zip!");
  }
  console.log(`[assemble-long] audio narasi ditemukan: ${basename(audioFile)}`);

  // Cari seluruh file gambar (.jpg, .jpeg, .png, .webp, .jfif)
  const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".jfif"];
  const imageFilesRaw = allFiles.filter((f) => IMG_EXTS.includes(extname(f).toLowerCase()));

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

  // Ukur durasi riil audio via ffprobe
  let actualAudioSec = 0;
  try {
    const probe = execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioFile,
    ]).toString().trim();
    actualAudioSec = parseFloat(probe);
  } catch (e) {
    fail(row.id, `ffprobe gagal membaca durasi audio: ${(e as Error).message}`);
  }
  if (!actualAudioSec || isNaN(actualAudioSec) || actualAudioSec < 60) {
    fail(row.id, `Durasi audio narasi tidak valid: ${actualAudioSec} dtk (minimal 60 detik)`);
  }
  console.log(`[assemble-long] durasi audio riil narration.mp3: ${actualAudioSec.toFixed(1)} dtk (~${(actualAudioSec / 60).toFixed(1)} mnt)`);

  // 5. Penyelarasan Waktu Narasi Proposional (Word-Count Proportional Alignment)
  const beats = sbData.beats;
  const totalWords = beats.reduce((acc, b) => acc + (b.text.trim().split(/\s+/).length || 1), 0);

  let curStart = 0;
  const alignedBeats = beats.map((b, idx) => {
    const w = b.text.trim().split(/\s+/).length || 1;
    const dur = (w / totalWords) * actualAudioSec;
    const startSec = curStart;
    curStart += dur;
    // Pasangkan gambar (loop/fallback jika jumlah gambar kurang dari jumlah beat)
    const imgPath = normalizedImages[idx] ?? normalizedImages[idx % normalizedImages.length];
    return {
      i: b.i,
      startSec,
      durationSec: dur,
      imagePath: imgPath,
    };
  });

  // Sinkronkan chapters timestamp ke durasi audio riil
  const alignedChapters = sbData.chapters.map((c) => ({
    title: c.title,
    startSec: Math.round((c.startSec / (sbData.estTotalSec || actualAudioSec)) * actualAudioSec),
  }));

  // 6. Perakitan Video via High-Efficiency FFmpeg Ken Burns Engine
  console.log(`[assemble-long] merakit ${alignedBeats.length} adegan visual dengan Ken Burns motion & 24fps...`);
  const clipListFile = join(workDir, "clips.txt");
  const clipPaths: string[] = [];

  for (let idx = 0; idx < alignedBeats.length; idx++) {
    const ab = alignedBeats[idx];
    const clipOut = join(workDir, `clip_${String(idx + 1).padStart(3, "0")}.mp4`);
    const dur = ab.durationSec.toFixed(2);
    // Efek dinamis: adegan genap zoom-in, adegan ganjil zoom-out
    const isEven = idx % 2 === 0;
    const zoomExpr = isEven
      ? "min(zoom+0.0006,1.15)" // slow zoom-in
      : "max(1.15-0.0006*on,1.0)"; // slow zoom-out
    const panExprX = isEven ? "iw/2-(iw/zoom/2)" : "iw/2-(iw/zoom/2)+0.05*on";
    const panExprY = "ih/2-(ih/zoom/2)";

    // FFmpeg filter: scale 1920:1080 -> crop -> zoompan -> veryfast h264
    const filter = `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='${zoomExpr}':d=1:x='${panExprX}':y='${panExprY}':s=1920x1080:fps=24`;

    try {
      execFileSync("ffmpeg", [
        "-y",
        "-framerate", "24",
        "-loop", "1",
        "-i", ab.imagePath,
        "-t", dur,
        "-vf", filter,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-an",
        clipOut,
      ], { stdio: "ignore" });
      clipPaths.push(clipOut);
    } catch (e) {
      fail(row.id, `FFmpeg gagal merender clip ${idx + 1}: ${(e as Error).message}`);
    }
  }

  // Gabungkan seluruh klip visual
  const concatFileContent = clipPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n");
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
    ], { stdio: "inherit" });
  } catch (e) {
    fail(row.id, `FFmpeg concat visual gagal: ${(e as Error).message}`);
  }

  // Gabungkan visual dengan audio narasi (audio mixing murni)
  const finalVideoPath = join(workDir, `final-${date}.mp4`);
  console.log("[assemble-long] menggabungkan visual dengan audio narration.mp3...");
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-i", visualConcatMp4,
      "-i", audioFile,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
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
  await tgSend(`🎉 Video Long-Form ${date} BERHASIL TERBIT!\n📌 ${sbData.title}\n⏱ Durasi: ${(actualAudioSec / 60).toFixed(1)} menit (${Math.round(actualAudioSec)}s)\n🎬 ${beats.length} Scene Ken Burns 1080p\n🔗 Tonton di YouTube: ${ytUrl}`);

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
