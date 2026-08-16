// Regenerate news-props.json tanpa render (test QC / iterate props)
import { buildProps } from "../src/video.js";
import { fetchBroll } from "../src/broll.js";
import { getContentWithSources } from "../src/db.js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const date = process.argv[2] ?? "2026-08-05";
const c = getContentWithSources(date);
if (!c) { console.error("content tak ada:", date); process.exit(1); }
const outDir = join(process.cwd(), "content", date);
const audioPath = join(outDir, "voiceover.mp3");
const dur = existsSync(audioPath)
  ? parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath]).toString().trim())
  : 80;
const images = c.sources.map(s => s.image_path).filter((p): p is string => !!p).map(p => p.replace(/\\/g, "/"));
const titles = c.sources.filter(s => s.title).map(s => s.publisher ?? s.title ?? "Berita AI");
let chunkDurations: number[] = [];
const tf = join(outDir, "chunk-durations.json");
if (existsSync(tf)) { try { chunkDurations = JSON.parse(readFileSync(tf, "utf8")); } catch {} }
let brollFiles: string[] = [];
if (process.argv.includes("--broll")) {
  const clips = await fetchBroll(c.sources.map(s => ({
    query: (s.publisher ?? s.title ?? "technology").split(" ").slice(0, 3).join(" ") + " technology",
    duration: chunkDurations[1] ?? 6,
  })), outDir);
  brollFiles = clips.map(b => b.file);
  console.log("b-roll:", brollFiles.join(", ") || "tak ada");
}
const props = buildProps(c.topic_title ?? "Berita AI Hari Ini", c.script_text ?? "", dur, images, chunkDurations, titles, brollFiles);
writeFileSync(join(process.cwd(), "news-props.json"), JSON.stringify(props));
console.log("props regenerated:", props.cuts.length, "cuts, dur:", dur.toFixed(1), "s");