import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

function getRotatingSource(sources: any[], date: string): any {
  const d = new Date(date);
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % sources.length;
  return sources[idx];
}

/** Extract frame ke-N dari video sebagai gambar */
export function extractThumbnailFromVideo(videoPath: string, outputPath: string, timestamp = 1): string {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-ss", String(timestamp), "-i", videoPath,
    "-vframes", "1", "-q:v", "2", outputPath
  ], { stdio: "pipe" });
  if (!existsSync(outputPath)) throw new Error("frame extract gagal");
  return outputPath;
}

export function generateThumbnail(date: string, sources: any[], hookText: string, videoPath?: string): string {
  const outDir = join(process.cwd(), "content", date);
  mkdirSync(outDir, { recursive: true });
  const thumbPath = join(outDir, "thumbnail.jpg");

  // pilih background: rotasi sumber harian → fallback sumber lain → fallback frame video → warna solid
  let bg: string | null = null;
  const src = getRotatingSource(sources, date);
  if (src?.image_path && existsSync(src.image_path)) {
    bg = src.image_path;
  } else {
    const fallback = sources.find(s => s.image_path && existsSync(s.image_path));
    if (fallback) bg = fallback.image_path;
  }
  let bgIsTemp = false;
  if (!bg && videoPath && existsSync(videoPath)) {
    try {
      bg = extractThumbnailFromVideo(videoPath, join(outDir, "thumb-frame.jpg"), 1);
      bgIsTemp = true;
    } catch (e) {
      console.warn("[thumbnail] extract frame gagal:", e instanceof Error ? e.message : e);
    }
  }

  // teks via textfile (hindari masalah escaping drawtext); path RELATIF dari cwd — aman utk Windows/Linux
  const relTextFile = join("content", date, "hook.txt");
  writeFileSync(join(process.cwd(), relTextFile), hookText, "utf8");
  const drawtext = `drawtext=textfile='${relTextFile.replace(/\\/g, "/")}':fontcolor=white:fontsize=56:x=50:y=50:borderw=3:bordercolor=black`;

  const args = ["-y"];
  if (bg) {
    args.push("-i", bg);
    args.push("-vf", `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${drawtext}`);
  } else {
    args.push("-f", "lavfi", "-i", "color=c=#0A0F1A:s=1080x1920:d=1");
    args.push("-vf", drawtext);
  }
  args.push("-frames:v", "1", "-q:v", "2", thumbPath);

  try {
    execFileSync("ffmpeg", args, { stdio: "pipe" });
    console.log(`[thumbnail] OK: ${thumbPath} (bg=${bg ?? "solid"})`);
  } catch (e) {
    console.error("[thumbnail] ffmpeg gagal, fallback copy mentah:", e);
    if (bg && existsSync(bg)) {
      execFileSync("cp", [bg, thumbPath]);
    } else {
      throw new Error("Gagal generate thumbnail: " + (e as Error).message);
    }
  } finally {
    if (bgIsTemp && bg) { try { unlinkSync(bg); } catch {} }
  }

  return thumbPath;
}