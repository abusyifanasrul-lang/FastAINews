// QC Gate — validasi pre-render + pasca-render (port dari OpenMontage reviewer/composition_validator/frame_sampler/audio_probe)
// Usage: npx tsx scripts/quality-gate.ts <date> [--pre]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db.js";

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const preOnly = process.argv.includes("--pre");
const outDir = join(process.cwd(), "content", date);

interface Finding { severity: "critical" | "suggestion" | "nitpick" | "investigation"; message: string; proposed_fix?: string; }
const findings: Finding[] = [];
const critical = (message: string, proposed_fix?: string) => findings.push({ severity: "critical", message, proposed_fix });
const suggestion = (message: string, proposed_fix?: string) => findings.push({ severity: "suggestion", message, proposed_fix });
const nitpick = (message: string) => findings.push({ severity: "nitpick", message });

// ---- PRE-RENDER: validasi props ----
function preRenderCheck() {
  const propsPath = join(process.cwd(), "news-props.json");
  if (!existsSync(propsPath)) { critical("news-props.json tak ada — buildProps belum jalan"); return; }
  const props = JSON.parse(readFileSync(propsPath, "utf8"));
  const cuts = props.cuts ?? [];
  if (!cuts.length) { critical("props.cuts kosong"); return; }

  // durasi narasi vs durasi video
  const narration = props.audio?.durationSec ?? props.durationSec ?? 0;
  const videoEnd = Math.max(...cuts.map((c: any) => c.out_seconds ?? 0));
  if (narration > 0 && narration > videoEnd + 0.5) critical(`Narasi ${narration.toFixed(1)}s > video ${videoEnd.toFixed(1)}s — audio terpotong`, "Perpanjang cut terakhir atau potong narasi");

  // cut overlap / out of order
  let prev = -1;
  for (const c of cuts) {
    if ((c.in_seconds ?? 0) < prev - 0.1) critical(`Cut ${c.id} mulai ${c.in_seconds}s sebelum cut sebelumnya berakhir ${prev}s — overlap`, "Perbaiki urutan in_seconds");
    prev = c.out_seconds ?? prev;
  }

  // asset ada
  for (const c of cuts) {
    for (const key of ["backgroundImage", "backgroundVideo"]) {
      const src = c[key];
      if (src) {
        const p = join(process.cwd(), "vendor-openmontage", "public", src);
        if (!existsSync(p)) critical(`Asset ${src} (cut ${c.id}) tak ada di public/`, "Re-generate props / download ulang asset");
      }
    }
  }
}

// ---- PASCA-RENDER: frame sampler + audio level ----
function probeDur(file: string): number {
  return parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
}
function frameBrightness(file: string, at: number): number {
  // hitung mean luma via ffmpeg signalstats — ffmpeg tulis metadata ke stderr, gabungkan
  const { status, stdout, stderr } = spawnSync("ffmpeg", ["-ss", String(at), "-i", file, "-frames:v", "1", "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-f", "null", "-"], { encoding: "utf8" });
  if (status !== 0) return -1;
  const m = (stdout + stderr).match(/YAVG=([\d.]+)/);
  return m ? parseFloat(m[1]) : -1;
}

function postRenderCheck() {
  const video = join(outDir, "shorts-916.mp4");
  if (!existsSync(video)) { critical("shorts-916.mp4 tak ada — render belum selesai", "Jalankan render dulu"); return; }

  const dur = probeDur(video);
  if (dur < 5) critical(`Video cuma ${dur.toFixed(1)}s — terlalu pendek`, "Cek naskah/render");

  // frame sampling — 5 titik merata
  const samples = [0.1, 0.3, 0.5, 0.7, 0.9];
  const dark: number[] = [];
  for (const f of samples) {
    const b = frameBrightness(video, dur * f);
    if (b < 0) { suggestion(`Frame @${(dur * f).toFixed(1)}s tak bisa diukur`); continue; }
    if (b < 10) dark.push(Math.round(b));
  }
  if (dark.length >= 3) critical(`Frame gelap di ${dark.length}/5 sampel (YAVG ${dark.join(", ")}) — kemungkinan layar hitam`, "Cek background asset / overlay opacity");

  // audio level — deteksi sepi/rusak
  const audio = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const meanM = audio.match(/mean_volume: ([\d.]+) dB/);
  const maxM = audio.match(/max_volume: ([\d.]+) dB/);
  if (meanM) {
    const mean = parseFloat(meanM[1]);
    if (mean < -40) critical(`Audio sepi (mean ${mean} dB) — voiceover mungkin hilang`, "Cek concat audio / TTS chunk");
  }
  if (maxM) {
    const max = parseFloat(maxM[1]);
    if (max > -1) suggestion(`Audio clipping (max ${max} dB)`, "Turunkan volume voiceover");
  }
}

preRenderCheck();
if (!preOnly) postRenderCheck();

// ---- report ----
const report = {
  date, pass: !findings.some(f => f.severity === "critical"),
  criticals: findings.filter(f => f.severity === "critical").length,
  suggestions: findings.filter(f => f.severity === "suggestion").length,
  findings,
};
const repPath = join(outDir, "qc-report.json");
mkdirSync(outDir, { recursive: true });
writeFileSync(repPath, JSON.stringify(report, null, 2));
console.log(`QC ${report.pass ? "PASS ✅" : "FAIL ❌"} — critical: ${report.criticals}, suggestion: ${report.suggestions}`);
findings.forEach(f => console.log(`  [${f.severity}] ${f.message}${f.proposed_fix ? ` → ${f.proposed_fix}` : ""}`));
console.log(`Laporan: ${repPath}`);
process.exit(report.pass ? 0 : 1);
