// B-roll: cari + download klip video Pexels utk background tiap topik
// Query per topik dari publisher/kata kunci. Output: content/<date>/broll/bN.mp4 (9:16)
import "dotenv/config";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const KEY = process.env.PEXELS_API_KEY;

export interface BrollClip { file: string; query: string; duration: number; }

/** Cari klip portrait pendek dr Pexels. Return link file video 480x854 siap download. */
async function searchClip(query: string): Promise<{ link: string; duration: number } | null> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=6&size=medium`;
  const res = await fetch(url, { headers: { Authorization: KEY! } });
  if (!res.ok) { console.warn(`  [broll] Pexels ${res.status} utk "${query}"`); return null; }
  const data = await res.json();
  const vids = data.videos ?? [];
  // pilih landscape? No — portrait utk shorts. Ambil video dengan file 480x854
  for (const v of vids) {
    const hd = v.video_files.find((f: any) => f.width === 480 && f.height === 854);
    if (hd) return { link: hd.link, duration: v.duration };
  }
  // fallback: file 360x640
  for (const v of vids) {
    const sd = v.video_files.find((f: any) => f.width === 360 && f.height === 640);
    if (sd) return { link: sd.link, duration: v.duration };
  }
  return null;
}

/** Tonggam/download per topik → broll/bN.mp4. Return array klip siap render. */
export async function fetchBroll(topics: { query: string; duration: number }[], outDir: string): Promise<BrollClip[]> {
  const clips: BrollClip[] = [];
  const bdir = join(outDir, "broll");
  mkdirSync(bdir, { recursive: true });
  for (let i = 0; i < topics.length; i++) {
    const out = join(bdir, `b${i + 1}.mp4`);
    if (existsSync(out)) { clips.push({ file: out, query: topics[i].query, duration: topics[i].duration }); continue; }
    const found = await searchClip(topics[i].query);
    if (!found) { console.warn(`  [broll] tidak ada klip utk "${topics[i].query}", pakai default`); continue; }
    // download + trim ke durasi target (dari durasi audio chunk)
    const target = Math.min(16, Math.max(5, topics[i].duration + 1));
    try {
      const tmp = join(bdir, `b${i + 1}.src.mp4`);
      const dl = await fetch(found.link);
      if (dl.ok) {
        const buf = Buffer.from(await dl.arrayBuffer());
        mkdirSync(bdir, { recursive: true });
        // tulis tmp via fs
        const { writeFileSync } = await import("node:fs");
        writeFileSync(tmp, buf);
        // potong ke durasi target + resize ke 480x854 crop
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-t", String(target), "-vf", "scale=480:854:force_original_aspect_ratio=increase,crop=480:854", "-c:v", "libx264", "-preset", "fast", out]);
        // hapus tmp
        execFileSync("rm", [tmp], { stdio: "ignore" });
        clips.push({ file: out, query: topics[i].query, duration: topics[i].duration });
        console.log(`  [boll] klip ${i + 1}: "${topics[i].query}" (${found.duration}s→${target})`);
      }
    } catch (e) {
      console.warn(`  [broad] gagal download/trim "${topics[i].query}": ${(e as Error).message}`);
    }
  }
  return clips;
}