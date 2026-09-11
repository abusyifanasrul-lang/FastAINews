// Generator 2-tahap long-form. Import chat() dari llm.ts (tanpa duplikat
// retry/rate-limit/session). Konstanta faceless disuntik di kode.
import { chat } from "../llm.js";
import type { NewsItem } from "../research.js";
import { validateLongScript } from "./validate.js";

export const FACELESS_NEGATIVE =
  "human face, animal face, portrait, close up person, woman, man, eyes, character, character animation";
export const LONG_AUDIO_PROMPT = "realistic futuristic ambient room hum, clean foley, no background music";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateLongScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   ${it.url}`).join("\n");
  const system = `Kamu penulis deep-dive berita AI berbahasa Indonesia baku-populer bertutur (pakai Kita/Saya/Anda, tanpa gue/elu) untuk video 8-10 menit (~1300-1500 kata).
Ada ${items.length} topik. WAJIB bahas SEMUA topik, tiap topik 1 segmen mendalam (fakta + konteks + mengapa penting).
Struktur: 1) Hook pembuka 2-3 kalimat 2) Konteks 72 jam terakhir 3) Deep-dive per topik 4) Analisis/prediksi 5) Peluang untuk orang awam 6) CTA subscribe.
Sisipkan TEPAT 1 baris marker pada ~tengah naskah: [MID-ROLL AD BREAK: MM:SS] (format itu persis, tanpa variasi).
Hanya fakta dari sumber, tanpa halusinasi, tanpa markdown, tanpa emoji, tanpa kata "menurut sumber".
DILARANG menulis proses berpikir/internal monologue/teks Inggris.
Baris pertama: JUDUL: <judul <=10 kata>`;
  const user = `Sumber 72 jam terakhir:\n${list}\n\nTulis naskah dimulai dengan JUDUL:.`;
  let lastErr: Error | undefined;
  for (let a = 1; a <= 3; a++) {
    try {
      const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 4000);
      const m = raw.match(/(?:^|\n)\s*JUDUL:\s*([^\n]+)/i);
      const mIdx = m?.index ?? -1;
      const topicTitle = m?.[1]?.trim().replace(/^["'*]+|["'*]+$/g, "") ?? items[0]?.title ?? "Deep-dive AI 3 hari";
      const script = m && mIdx >= 0 && mIdx < raw.length / 2 ? raw.slice(mIdx + m[0].length).trim() : raw.trim();
      validateLongScript(script);
      return { script, topicTitle };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[llm-long] stage-1 percobaan ${a}/3 gagal: ${lastErr.message}`);
      if (a < 3) await sleep(1500 * a);
    }
  }
  throw lastErr!;
}

export type BeatVisual = "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE";
export interface BeatHint { visual: BeatVisual; prompt?: string; sfx?: string }

/** Klasifikasi visual per beat via LLM. beats: teks bersih per segmen. */
export async function classifyBeats(
  beats: string[],
  chapters: string[],
  images: string[],
): Promise<BeatHint[]> {
  const numbered = beats.map((b, i) => `${i + 1}. ${b.slice(0, 200)}`).join("\n");
  const system = `Klasifikasikan tiap segmen naskah jadi SATU jenis visual.
Jenis: STATIC_IMAGE_MOTION (fakta/headline keras, cocok gambar berita) | T2V_GENERATION (konsep abstrak/analisis/prediksi, cocok video AI sinematik) | I2V_ANIMATE_IMAGE (objek/produk nyata dari berita).
Balas HANYA JSON array, tiap elemen {"visual":"...","prompt":"...","sfx":"..."}. prompt (EN, <=40 kata, sci-fi realistis, Unreal Engine 5, faceless, no people) wajib untuk T2V/I2V, kosongkan untuk STATIC. sfx (EN, <=15 kata, ambient/foley, no music) selalu isi. ${beats.length} elemen, tanpa teks lain.`;
  const user = `Bab: ${chapters.join(" | ")}\nGambar tersedia: ${images.length} file (src1..srcN).\nSegmen:\n${numbered}`;
  let lastErr: Error | undefined;
  for (let a = 1; a <= 3; a++) {
    try {
      const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 2000);
      const arr = JSON.parse(raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim()) as BeatHint[];
      if (!Array.isArray(arr) || arr.length !== beats.length) throw new Error(`klasifikasi kembali ${arr?.length ?? 0}/${beats.length}`);
      return arr.map((h) => ({
        visual: ["STATIC_IMAGE_MOTION", "T2V_GENERATION", "I2V_ANIMATE_IMAGE"].includes(h.visual) ? h.visual : "STATIC_IMAGE_MOTION",
        prompt: h.prompt?.slice(0, 300) ?? "",
        sfx: h.sfx?.slice(0, 120) ?? "futuristic ambient hum, no music",
      }));
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[llm-long] stage-2 percobaan ${a}/3 gagal: ${lastErr.message}`);
      if (a < 3) await sleep(1500 * a);
    }
  }
  console.warn("[llm-long] klasifikasi gagal total — fallback semua STATIC_IMAGE_MOTION");
  return beats.map(() => ({ visual: "STATIC_IMAGE_MOTION" as BeatVisual, sfx: "futuristic ambient hum, no music" }));
}
