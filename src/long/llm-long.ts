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
  // Target 1500-1700 kata (overshoot aman; 1250 kata ≈ 8 mnt @130wpm, batas validator).
  // Tiap topik WAJIB 150-200 kata agar total tidak kempis.
  const system = `Kamu penulis deep-dive berita AI berbahasa Indonesia baku-populer bertutur (pakai Kita/Saya/Anda, tanpa gue/elu) untuk video 8-10 menit (TARGET 1500-1700 kata, MINIMAL 1250 kata — ini syarat mutlak, bukan saran).
Ada ${items.length} topik. WAJIB bahas SEMUA topik, tiap topik 1 segmen 150-200 kata (fakta + konteks + mengapa penting + contoh konkret).
Struktur: 1) Hook pembuka 3-4 kalimat 2) Konteks 72 jam terakhir (~150 kata) 3) Deep-dive per topik (150-200 kata per topik) 4) Analisis/prediksi (~200 kata) 5) Peluang untuk orang awam (~150 kata, konkret) 6) CTA subscribe (2-3 kalimat).
Sisipkan TEPAT 1 baris marker pada ~tengah naskah: [MID-ROLL AD BREAK: MM:SS] (format itu persis, tanpa variasi).
Hanya fakta dari sumber, tanpa halusinasi, tanpa markdown, tanpa emoji, tanpa kata "menurut sumber".
DILARANG menulis proses berpikir/internal monologue/teks Inggris.
Baris pertama: JUDUL: <judul <=10 kata>`;
  const user = `Sumber 72 jam terakhir:\n${list}\n\nTulis naskah dimulai dengan JUDUL:.`;
  let lastErr: Error | undefined;
  for (let a = 1; a <= 4; a++) {
    try {
      // umpan balik percobaan ulang: model sebelumnya gagal karena terlalu pendek
      const retryNote = a > 1
        ? `\n\nPERCOBAAN ULANG ${a}: draf sebelumnya DITOLAK karena terlalu pendek (<1250 kata). WAJIB tulis LEBIH PANJANG: kembangkan tiap segmen deep-dive hingga 150-200 kata per topik. Jangan ringkas.`
        : "";
      const raw = await chat(
        [{ role: "system", content: system }, { role: "user", content: user + retryNote }],
        6000,
      );
      const m = raw.match(/(?:^|\n)\s*JUDUL:\s*([^\n]+)/i);
      const mIdx = m?.index ?? -1;
      const topicTitle = m?.[1]?.trim().replace(/^["'*]+|["'*]+$/g, "") ?? items[0]?.title ?? "Deep-dive AI 3 hari";
      const script = m && mIdx >= 0 && mIdx < raw.length / 2 ? raw.slice(mIdx + m[0].length).trim() : raw.trim();
      validateLongScript(script);
      return { script, topicTitle };
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[llm-long] stage-1 percobaan ${a}/4 gagal: ${lastErr.message}`);
      if (a < 4) await sleep(1500 * a);
    }
  }
  throw lastErr!;
}

export type BeatVisual = "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE";
export interface BeatHint { visual: BeatVisual; prompt?: string; sfx?: string }

const VALID_VISUALS = ["STATIC_IMAGE_MOTION", "T2V_GENERATION", "I2V_ANIMATE_IMAGE"];
// Batch kecil: 47 beats sekaligus = respons JSON kepotong maxTokens → parse gagal →
// fallback semua STATIC. Batch ≤12 aman di maxTokens 2000.
const CLASSIFY_BATCH = 12;

async function classifyBatch(numbered: string, count: number): Promise<BeatHint[]> {
  const system = `Klasifikasikan tiap segmen naskah jadi SATU jenis visual.
Aturan seimbang (PENTING — jangan semua STATIC):
- STATIC_IMAGE_MOTION: fakta keras/headline/angka (maks ~40% segmen).
- T2V_GENERATION: analisis, prediksi, konsep abstrak, konteks masa depan → video AI sinematik.
- I2V_ANIMATE_IMAGE: objek/produk nyata dari berita (chip, robot, aplikasi).
Balas HANYA JSON array ${count} elemen, tiap elemen {"visual":"...","prompt":"...","sfx":"..."}. prompt (EN, <=40 kata, sci-fi realistis, Unreal Engine 5, faceless, no people) wajib untuk T2V/I2V, kosongkan untuk STATIC. sfx (EN, <=15 kata, ambient/foley, no music) selalu isi. Tanpa teks lain.`;
  const raw = await chat([{ role: "system", content: system }, { role: "user", content: numbered }], 2000);
  const arr = JSON.parse(raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim()) as BeatHint[];
  if (!Array.isArray(arr) || arr.length !== count) throw new Error(`klasifikasi kembali ${arr?.length ?? 0}/${count}`);
  return arr.map((h) => ({
    visual: (VALID_VISUALS.includes(h.visual) ? h.visual : "STATIC_IMAGE_MOTION") as BeatVisual,
    prompt: h.prompt?.slice(0, 300) ?? "",
    sfx: h.sfx?.slice(0, 120) ?? "futuristic ambient hum, no music",
  }));
}

/** Klasifikasi visual per beat via LLM, batch ≤12 agar JSON tidak kepotong. */
export async function classifyBeats(
  beats: string[],
  chapters: string[],
  images: string[],
): Promise<BeatHint[]> {
  const out: BeatHint[] = [];
  for (let s = 0; s < beats.length; s += CLASSIFY_BATCH) {
    const slice = beats.slice(s, s + CLASSIFY_BATCH);
    const numbered = slice.map((b, i) => `${s + i + 1}. [${chapters.join("/")}] ${b.slice(0, 200)}`).join("\n");
    let done = false;
    let lastErr: Error | undefined;
    for (let a = 1; a <= 3 && !done; a++) {
      try {
        out.push(...await classifyBatch(numbered, slice.length));
        done = true;
      } catch (e) {
        lastErr = e as Error;
        console.warn(`[llm-long] stage-2 batch ${s + 1}-${s + slice.length} percobaan ${a}/3 gagal: ${lastErr.message}`);
        if (a < 3) await sleep(1500 * a);
      }
    }
    if (!done) {
      console.warn(`[llm-long] batch ${s + 1}-${s + slice.length} gagal total — fallback STATIC utk batch ini`);
      for (const _ of slice) out.push({ visual: "STATIC_IMAGE_MOTION" as BeatVisual, sfx: "futuristic ambient hum, no music" });
    }
  }
  return out;
}
