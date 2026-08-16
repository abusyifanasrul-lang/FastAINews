import { getContentWithSources } from "../src/db.js";
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const date = new Date().toISOString().slice(0, 10);
const c = getContentWithSources(date);
if (!c || !c.script_text) throw new Error("tidak ada konten/naskah");
const outDir = join(process.cwd(), "content", date);
mkdirSync(outDir, { recursive: true });

// voiceover harus ada
const audioPath = join(outDir, "voiceover.mp3");
if (!existsSync(audioPath)) throw new Error("voiceover.mp3 belum ada — jalankan tts-test dulu");

// salin ke public/ (staticFile Remotion)
const publicDir = join(process.cwd(), "public");
mkdirSync(publicDir, { recursive: true });
copyFileSync(audioPath, join(publicDir, "voiceover.mp3"));

// durasi audio → frames
const { execFileSync } = await import("node:child_process");
const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath]).toString().trim());
const durationFrames = Math.ceil(dur * 30) + 10;
console.log("durasi audio:", dur.toFixed(1), "s → frames:", durationFrames);

const props = {
  title: c.topic_title ?? "Berita AI Hari Ini",
  script: c.script_text,
  audioFile: "voiceover.mp3",
  sourceNames: c.sources.map(s => s.publisher ?? "").filter(Boolean),
};
const propsPath = join(process.cwd(), "props.json");
writeFileSync(propsPath, JSON.stringify(props));

const out169 = join(outDir, "master-169.mp4");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["remotion", "render", "remotion/index.ts", "NewsVideo", out169,
  "--props=props.json", "--codec=h264", "--width=1920", "--height=1080", "--fps=30",
  `--frames=0-${durationFrames - 1}`], { stdio: "inherit" });
console.log("Master 16:9:", out169);

// turunan 9:16 via ffmpeg crop center
const out916 = join(outDir, "shorts-916.mp4");
execFileSync("ffmpeg", ["-y", "-i", out169, "-vf", "crop=608:1080:656:0,scale=1080:1920", "-c:a", "copy", out916], { stdio: "inherit" });
console.log("9:16:", out916);