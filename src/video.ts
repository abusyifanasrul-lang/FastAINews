import { getContentWithSources, db } from "../src/db.js";
import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { cpus } from "node:os";
import { chunkScript } from "./tts.js";
import { fetchBroll } from "./broll.js";
import "dotenv/config";

const COMPOSER = join(process.cwd(), "vendor-openmontage");

/**
 * Render vertical shorts via OpenMontage remotion-composer.
 *  - NewsShort (480x854) = vertical utk TikTok/Reels/Shorts (480p)
 * Props dibangun dari naskah → cuts (hero_title, text_card, callout).
 */
export async function renderVideos(date: string): Promise<{ shorts: string; durationSec: number }> {
  const c = getContentWithSources(date);
  if (!c || !c.script_text) throw new Error("tidak ada konten/naskah");
  const outDir = join(process.cwd(), "content", date);
  mkdirSync(outDir, { recursive: true });

  const audioPath = join(outDir, "voiceover.mp3");
  if (!existsSync(audioPath)) throw new Error("voiceover.mp3 belum ada");

  // salin audio ke public composer (staticFile)
  const pub = join(COMPOSER, "public");
  mkdirSync(pub, { recursive: true });
  copyFileSync(audioPath, join(pub, "voiceover.mp3"));

  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath]).toString().trim());

  // timing chunk audio (dari TTS per-chunk) — sinkron cut↔narasi
  let chunkDurations: number[] = [];
  const timingFile = join(outDir, "chunk-durations.json");
  if (existsSync(timingFile)) {
    try { chunkDurations = JSON.parse(readFileSync(timingFile, "utf8")); } catch {}
  }

  // bangun props (naskah → cuts)
  const images = c.sources
    .map(s => s.image_path)
    .filter((p): p is string => !!p) // gambar yang berhasil didownload
    .map(p => p.replace(/\\/g, "/")); // path posix utk resolveAsset
  // label topik utk tiap text_card — dari publisher (pilih yang berisi, utama = non-generik)
  const titles = c.sources
    .filter(s => !!s.title)
    .map(s => s.publisher ?? s.title ?? "Berita AI");
  // b-roll: cari klip Pexels per topik (query = publisher + kata kunci dari judul)
  const brollFiles = await fetchBroll(c.sources.map(s => ({
    query: (s.publisher ?? s.title ?? "technology").split(" ").slice(0, 3).join(" ") + " technology",
    duration: chunkDurations[1] ?? 6, // durasi utk klip pertama ±
  })), outDir);
  const props = buildProps(c.topic_title ?? "Berita AI Hari Ini", c.script_text, dur, images, chunkDurations, titles, brollFiles.map(b => b.file));
  const propsPath = join(process.cwd(), "news-props.json");
  writeFileSync(propsPath, JSON.stringify(props));

  // render vertical (480p)
  const shorts = join(outDir, "shorts-916.mp4");
  renderComposition("Explainer", shorts, propsPath, 480, 854);

  db.prepare("UPDATE contents SET video_916_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(shorts, c.id);
  return { shorts, durationSec: dur };
}

function renderComposition(comp: string, outFile: string, propsPath: string, width: number, height: number) {
  // panggil remotion CLI via node langsung (bukan npx/npx.cmd — .cmd shim gagal di spawnSync Windows)
  const cli = join(COMPOSER, "node_modules", "@remotion", "cli", "remotion-cli.js");
  // priority: REMOTION_BROWSER_EXECUTABLE (standard) → REMOTION_CHROMIUM_EXECUTABLE (legacy) → null (Remotion auto-download)
  const CHROME = process.env.REMOTION_BROWSER_EXECUTABLE || process.env.REMOTION_CHROMIUM_EXECUTABLE || "";
  const args = [cli, "render", "src/index.tsx", comp, outFile,
    `--props=${propsPath}`, "--codec=h264", `--width=${width}`, `--height=${height}`, "--fps=24", "--concurrency=1", "--quality=60", "--gl=swangle"];
  if (CHROME) args.push(`--browser-executable=${CHROME}`);
  const r = spawnSync(process.execPath, args, {
    cwd: COMPOSER,
    timeout: 7200000,
    env: CHROME ? { ...process.env, REMOTION_CHROMIUM_EXECUTABLE: CHROME } : process.env,
  });
  if (r.status !== 0) {
    const err = r.stderr?.toString() || r.stdout?.toString() || `exit code ${r.status}`;
    throw new Error(`render ${comp} gagal: ${err}`);
  }
}

// naskah → cuts utk Explainer
export function buildProps(title: string, script: string, dur: number, images: string[] = [], chunkDurations: number[] = [], titles: string[] = [], broll: string[] = []) {
  // copy gambar ke public composer (staticFile) — resolveAsset butuh public/
  // pertahankan ekstensi asli (png/webp/jpg) agar <Img> ke-resolve benar
  const pubDir = join(COMPOSER, "public");
  const publicImages: string[] = [];
  images.forEach((img, i) => {
    try {
      const ext = img.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? ".jpg";
      const name = `newsimg${i + 1}${ext}`;
      copyFileSync(img, join(pubDir, name));
      publicImages.push(name);
    } catch {}
  });

  const sentences = script.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  const CUTS: any[] = [];
  let t = 0;
  const addCut = (cut: any) => { CUTS.push(cut); t = cut.out_seconds; };

  // gambar pertama sbg background hero (relevan ke topik utama)
  const heroImg = publicImages[0];

  // hero singkat: judul (2.5s) — pembuka narasi dimasukkan sbg text_card pertama
  addCut({
    id: "c1", type: "hero_title", text: title,
    heroSubtitle: "Ringkasan AI Harian", in_seconds: 0, out_seconds: Math.min(2.5, dur),
    accentColor: "#22D3EE",
    ...(heroImg ? { backgroundImage: heroImg, backgroundOverlay: 0.6 } : {}),
  });

  // setiap chunk = 1 topik = 1 text_card dengan label — pembagian jelas per topik
  // chunkScript() sudah handle hook internal — gunakan langsung supaya identik dgn TTS
  const chunks: string[] = chunkScript(script);
  for (let i = 0; i < chunks.length; i++) {
    if (t >= dur - 2) break;
    const segDur = chunkDurations[i] ?? Math.max(3.5, (dur - 2.5) / Math.max(1, chunks.length));
    const imgIdx = Math.min(Math.floor(i / Math.max(1, chunks.length) * publicImages.length), publicImages.length - 1);
    const bgImg = publicImages.length > 0 ? publicImages[imgIdx] : undefined;
    // b-roll: klip video per topik (jika ada) — copy ke public composer (staticFile), lebih dinamis drpd gambar statis
    let brollName: string | undefined;
    const bSrc = broll[i] ?? broll[Math.min(i, broll.length - 1)];
    if (bSrc) {
      try {
        const bName = `brollv${i + 1}.mp4`;
        copyFileSync(bSrc, join(pubDir, bName));
        brollName = bName;
      } catch {}
    }
    // layout: chunk 0 = pembuka; chunks 1.. = topik ber-publisher
    const topicLabel = i === 0 ? "Berita AI Harian" : (titles[i - 1] ?? `Poin ${i}`);
    addCut({
      id: `c${CUTS.length + 1}`, type: "text_card", text: chunks[i],
      title: topicLabel,
      in_seconds: t, out_seconds: Math.min(t + segDur, dur - 1),
      fontSize: 42, color: "#F8FAFC", backgroundColor: "transparent",
      ...(bgImg ? { backgroundImage: bgImg, backgroundOverlay: 0.6 }
        : brollName ? { backgroundVideo: brollName, backgroundOverlay: 0.55 } : {}),
    });
  }

  // callout (3s) lalu CTA — sisakan ruang, tanpa overlap. Kalau tak cukup ruang, lewati CTA.
  const ctaDur = 2.5;
  const ctaStart = Math.min(t + 3, dur - ctaDur);
  if (ctaStart > t + 0.5) {
    addCut({
      id: `c${CUTS.length + 1}`, type: "callout",
      text: "Kesimpulan: " + (sentences[sentences.length - 1] ?? "Tetap update dengan AI."),
      title: "💡 Intisari", callout_type: "tip",
      in_seconds: t, out_seconds: ctaStart,
      backgroundColor: "#1E293B",
    });
    addCut({
      id: `c${CUTS.length + 1}`, type: "hero_title", text: "Ikuti terus kabar AI terbaru!",
      heroSubtitle: "Sampai jumpa besok! 👋", in_seconds: ctaStart, out_seconds: dur,
      accentColor: "#22D3EE",
    });
  } else {
    addCut({
      id: `c${CUTS.length + 1}`, type: "callout",
      text: "Kesimpulan: " + (sentences[sentences.length - 1] ?? "Tetap update dengan AI."),
      title: "💡 Intisari", callout_type: "tip",
      in_seconds: t, out_seconds: dur,
      backgroundColor: "#1E293B",
    });
  }

  return {
    theme: "flat-motion-graphics",
    cuts: CUTS,
    overlays: [],
    captions: [],
    audio: { narration: { src: "voiceover.mp3", volume: 1 } },
  };
}