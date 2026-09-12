// Split beats + storyboard.json/md + chapter validator.
// Estimasi durasi: WPM_ID=130 (kalibrasi kasar ID). ponytail: upgrade ke durasi
// TTS riil per beat saat producer kirim durasi aktual — ceiling = estimasi.
import { FACELESS_NEGATIVE, LONG_AUDIO_PROMPT, themedHintFor, type BeatHint, type BeatVisual } from "./llm-long.js";
import { formatTimestamp } from "./validate.js";

export const WPM_ID = 130;
const estSec = (words: number) => Math.min(10, Math.max(3, (words / WPM_ID) * 60));

export interface Beat {
  i: number; chapter: string; startSec: number; estSec: number;
  text: string; visual: BeatVisual; prompt: string;
  faceless: boolean; negative_prompt: string;
  audio: { music: boolean; ambient_sfx: boolean; audio_prompt: string };
  srcImage: string | null;
}
export interface Chapter { title: string; startSec: number }

/** Pecah naskah bersih jadi beats: gabung kalimat hingga ~25 kata / <1000 char / ≤10 dtk. */
export function splitBeats(
  scriptClean: string,
  hints: BeatHint[],
  chapters: Chapter[],
  images: string[],
): Beat[] {
  const sentences = scriptClean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  // potong kalimat raksasa (>20 kata) jadi potongan kata agar estimasi <=10 dtk jujur & muat di clip video AI 10s
  const units: string[] = [];
  for (const s of sentences) {
    const w = s.split(/\s+/);
    if (w.length <= 20) { units.push(s); continue; }
    for (let k = 0; k < w.length; k += 20) units.push(w.slice(k, k + 20).join(" "));
  }
  const texts: string[] = [];
  let cur = "";
  for (const s of units) {
    const words = (cur + " " + s).trim().split(/\s+/).length;
    if (cur && (words > 20 || (cur + " " + s).length >= 1000)) { texts.push(cur.trim()); cur = s; }
    else cur = (cur + " " + s).trim();
  }
  if (cur.trim()) texts.push(cur.trim());
  if (texts.some((t) => t.length >= 1000)) throw new Error("Ada beat ≥1000 char — split gagal.");

  let t = 0;
  let imgIdx = 0;
  return texts.map((text, k) => {
    const w = text.split(/\s+/).length;
    const dur = Math.round(estSec(w) * 10) / 10;
    const chapter = [...chapters].reverse().find((c) => c.startSec <= t)?.title ?? chapters[0]?.title ?? "Intro";
    const hint = hints[k] ?? { visual: "STATIC_IMAGE_MOTION" as BeatVisual, sfx: "futuristic ambient hum, no music" };
    const needImg = hint.visual !== "T2V_GENERATION";
    // srcImage dari hint LLM dipakai bila path-nya benar-benar ada di daftar gambar edisi;
    // selain itu fallback siklik (perilaku lama).
    const hinted = hint.srcImage != null && images.includes(hint.srcImage) ? hint.srcImage : null;
    let srcImage: string | null = null;
    if (needImg) {
      if (hinted) srcImage = hinted;
      else if (images.length > 0) srcImage = images[imgIdx++ % images.length] ?? null;
    }
    let visual = hint.visual;
    let prompt = hint.prompt ?? "";
    let sfx = hint.sfx ?? LONG_AUDIO_PROMPT;
    // Guard anti-blank: STATIC tanpa gambar ter-resolve (hanya terjadi bila edisi 0 gambar
    // terdownload) tidak boleh tanpa arahan visual — alihkan ke T2V prompt tema deterministik.
    if (visual === "STATIC_IMAGE_MOTION" && srcImage == null) {
      const themed = themedHintFor(text);
      visual = "T2V_GENERATION";
      prompt = themed.prompt;
      sfx = themed.sfx;
      srcImage = null;
    }
    const beat: Beat = {
      i: k + 1, chapter, startSec: Math.round(t * 10) / 10, estSec: dur, text,
      visual, prompt,
      faceless: true, negative_prompt: FACELESS_NEGATIVE,
      audio: { music: false, ambient_sfx: true, audio_prompt: sfx },
      srcImage,
    };
    t += dur;
    return beat;
  });
}

export function validateChapters(chapters: Chapter[], totalSec: number): void {
  if (chapters.length < 3) throw new Error(`Chapters ${chapters.length} < 3.`);
  if (chapters[0].startSec !== 0) throw new Error("Chapter pertama harus mulai 00:00.");
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].startSec <= chapters[i - 1].startSec) throw new Error(`Chapter "${chapters[i].title}" tidak monoton naik.`);
    if (chapters[i].startSec - chapters[i - 1].startSec < 10) throw new Error(`Jeda chapter "${chapters[i].title}" <10 dtk.`);
  }
  if (totalSec > 0 && chapters[chapters.length - 1].startSec >= totalSec) throw new Error("Chapter terakhir mulai setelah video selesai.");
}

export function chaptersToDescription(desc: string, chapters: Chapter[]): string {
  const lines = chapters.map((c) => `${formatTimestamp(c.startSec)} ${c.title}`).join("\n");
  return `${desc}\n\n⏱ Chapters:\n${lines}`.slice(0, 4900);
}

const LABEL: Record<BeatVisual, string> = {
  STATIC_IMAGE_MOTION: "[🖼️ GUNAKAN GAMBAR BERITA]",
  T2V_GENERATION: "[🎬 GENERATE AI VIDEO]",
  I2V_ANIMATE_IMAGE: "[✨ ANIMASIKAN GAMBAR]",
};

export function buildStoryboardMd(
  title: string, date: string, chapters: Chapter[], beats: Beat[], totalSec: number, midrollAtSec: number | null,
): string {
  const L: string[] = [
    `# STORYBOARD — ${title}`, ``, `Tanggal: ${date} | Estimasi durasi: ${formatTimestamp(totalSec)} (${Math.round(totalSec)} dtk)`,
    midrollAtSec != null ? `Iklan mid-roll (target): ${formatTimestamp(midrollAtSec)}` : `Mid-roll: -`, ``,
    `> Timestamps ESTIMASI (WPM 130). Chapters final ikut file ini.`, ``,
    `## Chapters`, ``,
    `| Start | Bab |`, `|---|---|`,
    ...chapters.map((c) => `| ${formatTimestamp(c.startSec)} | ${c.title} |`), ``, `## Beats (${beats.length})`, ``,
  ];
  for (const b of beats) {
    L.push(`### Beat ${b.i} — ${formatTimestamp(b.startSec)} (~${b.estSec} dtk) — Bab: ${b.chapter}`);
    L.push(`${LABEL[b.visual]}${b.srcImage ? ` file: \`${b.srcImage}\`` : ""}`);
    L.push(`\`\`\``, b.text, `\`\`\``);
    if (b.prompt) L.push(`Prompt video: ${b.prompt}`);
    if (b.visual !== "STATIC_IMAGE_MOTION") L.push(`Negative: ${b.negative_prompt}`);
    L.push(`SFX: ${b.audio.audio_prompt} (TANPA musik)`, ``);
  }
  return L.join("\n");
}
