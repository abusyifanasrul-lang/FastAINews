// Generator 2-tahap long-form:
// Stage 1: Naskah deep-dive 8-10 menit via LLM chat() (target 1400-1600 kata, min 1100 kata).
// Stage 2: Storyboard visual per beat via LLM berbatch (generateLongStoryboard) — prompt
//          kontekstual per berita; fallback deterministik classifyBeats bila LLM gagal.
// Jaminan ketat: faceless, no people/animal, no background music, prompt murni Inggris Unreal Engine 5.
import { chat } from "../llm.js";
import type { NewsItem } from "../research.js";
import { trimNaskahToLength, validateLongScript, countWords } from "./validate.js";

export const FACELESS_NEGATIVE =
  "human face, animal face, portrait, close up person, woman, man, eyes, character, character animation";
export const LONG_AUDIO_PROMPT = "realistic futuristic ambient room hum, clean foley, no background music";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateLongScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   ${it.url}`).join("\n");
  const half = Math.max(1, Math.ceil(items.length / 2));

  const system = `You are a professional Indonesian tech journalist and long-form video essay director. You must write exhaustive, expansive, flowing, highly detailed prose in natural formal Indonesian (baku-populer bertutur: gunakan Kita, Saya, Anda — dilarang kata gaul seperti gue/elu). Never be terse. Never summarize or compress into bullet points.
TARGET PANJANG: 1150 - 1350 KATA (MINIMAL 950 KATA — syarat video iklan mid-roll YouTube >= 8 menit, maksimal 13.500 karakter).

Daftar ${items.length} berita 72 jam terakhir wajib dibahas tuntas satu per satu secara berurutan.
Untuk SETIAP berita, tulis pembahasan mendalam dan berbobot teknis (1-2 paragraf padat per topik):
- Paragraf 1: Detail fakta teknis, metrik/angka spesifik, apa yang diluncurkan/terjadi, serta konteks arsitekturnya.
- Paragraf 2: Implikasi industri nyata, komparasi pasar, dan dampaknya bagi ekosistem AI global.

Struktur Naskah Lengkap:
1. Hook Pembuka & Tesis Utama (3-4 kalimat menggugah, sebut narasi besar 72 jam ini)
2. Konteks Makro 72 Jam Terakhir (rangkuman naratif pergeseran lanskap industri AI terkini)
3. Deep-Dive Topik 1 sampai ${items.length} (masing-masing 1-2 paragraf padat sesuai panduan di atas)
   * Sisipkan tepat di tengah naskah (setelah topik ke-${half}): [MID-ROLL AD BREAK: 04:30]
4. Sintesis & Analisis Masa Depan (korelasi antar peristiwa dan prediksi 6-12 bulan ke depan)
5. Peluang Konkret untuk Publik / Orang Awam (langkah praktis dan peluang karier/adopsi nyata)
6. CTA Penutup (ajak berdiskusi di kolom komentar dan subscribe)

ATURAN FORMAT WAJIB:
- Mulai baris pertama TEPAT dengan format: JUDUL: <Judul Menarik Maksimal 10 Kata>
- Dilarang menulis proses berpikir, catatan internal, tag markdown seperti **, ##, bullet, dsb. Tulis sebagai teks narasi lisan yang mengalir.
- Dilarang teks bahasa Inggris selain istilah teknologi standar.
- Hanya gunakan fakta dari daftar sumber yang diberikan, tanpa halusinasi.`;

  const userBase = `Daftar sumber berita 72 jam terakhir:\n${list}\n\nTulis naskah mendalam, elaboratif, dan mengalir 1150-1350 kata (maksimal 13.000 karakter). LANGSUNG mulai output pada baris pertama dengan JUDUL:.`;

  // Postmortem CI 2026-09-12 (kedua): model bisa over-produce (17630 char > batas 15000)
  // dan versi lama "tanpa retry" langsung mematikan pipeline. Kini: retry 3x dengan
  // feedback korektif, lalu fallback terakhir: pangkas naskah di batas kalimat.
  const extract = (raw: string): { script: string; topicTitle: string } => {
    const m = raw.match(/(?:^|\n)\s*JUDUL:\s*([^\n]+)/i);
    const mIdx = m?.index ?? -1;
    const topicTitle = m?.[1]?.trim().replace(/^["'*]+|["'*]+$/g, "") ?? items[0]?.title ?? "Deep-dive AI 3 hari";
    const script = m && mIdx >= 0 && mIdx < raw.length / 2 ? raw.slice(mIdx + m[0].length).trim() : raw.trim();
    return { script, topicTitle };
  };

  const MAX_ATTEMPTS = 3;
  let lastScript = "";
  let lastTitle = "";
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let user = userBase;
    if (lastScript) {
      const info = `${lastScript.length} char / ${countWords(lastScript)} kata`;
      if (lastScript.length > 15000) {
        user += `\n\nPERBAIKAN WAJIB (percobaan ${attempt}/${MAX_ATTEMPTS}): naskah sebelumnya TERLALU PANJANG (${info}; batas keras 15000 char). Tulis ulang TEPAT 1250-1450 kata: setiap topik cukup 1-2 paragraf padat, buang pengulangan dan basa-basi.`;
      } else {
        user += `\n\nPERBAIKAN WAJIB (percobaan ${attempt}/${MAX_ATTEMPTS}): naskah sebelumnya ditolak validasi (${info}): ${lastErr?.message}. Perbaiki dan tulis ulang.`;
      }
    }
    const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 6000);
    const { script, topicTitle } = extract(raw);
    try {
      validateLongScript(script, 900);
      console.log(`[llm-long] naskah berhasil dibuat: ${countWords(script)} kata (percobaan ${attempt}/${MAX_ATTEMPTS})`);
      return { script, topicTitle };
    } catch (err) {
      lastErr = err as Error;
      lastScript = script;
      lastTitle = topicTitle;
      console.warn(`[llm-long] naskah percobaan ${attempt}/${MAX_ATTEMPTS} gagal validasi: ${lastErr.message}`);
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
    }
  }

  // Fallback terakhir: pangkas naskah overlong di batas kalimat supaya edisi tetap terbit
  if (lastScript.length > 15000) {
    const trimmed = trimNaskahToLength(lastScript, 14500);
    if (trimmed) {
      try {
        validateLongScript(trimmed, 900);
        console.warn(`[llm-long] naskah 3x gagal validasi — dipangkas ${lastScript.length} -> ${trimmed.length} char (fallback, ekor dibuang)`);
        return { script: trimmed, topicTitle: lastTitle || items[0]?.title || "Deep-dive AI 3 hari" };
      } catch {}
    }
  }
  throw lastErr ?? new Error("generateLongScript gagal semua percobaan");
}

export type BeatVisual = "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE";
export interface BeatHint { visual: BeatVisual; prompt: string; sfx: string; srcImage?: string | null }

interface VisualTheme {
  regex: RegExp;
  prompt: string;
  sfx: string;
}

const THEMES: VisualTheme[] = [
  {
    regex: /(chip|gpu|tpu|prosesor|semikonduktor|semiconductor|wafer|cuda|transistor|hardware|perangkat keras|komputasi|akselerator|microchip|nvidia|amd|intel)/i,
    prompt: "cinematic macro shot of advanced next-gen AI microchip, glowing gold and copper microscopic interconnects, pulsing volumetric cyan lighting, dark reflective obsidian substrate, depth of field, Unreal Engine 5 render, 8k, faceless, no people, no text",
    sfx: "subtle electronic hum, high frequency data processing audio, clean foley, no background music",
  },
  {
    regex: /(data center|pusat data|server|server rack|rak server|energi|listrik|daya listrik|daya komputasi|infrastruktur|pendingin|liquid cooling|cooling|megawatt|gigawatt|cloud|komputasi awan)/i,
    prompt: "hyper-scale futuristic data center interior, endless corridors of humming high-density server racks, glowing blue LED status lights, liquid cooling conduits, atmospheric mist and volumetric light beams, Unreal Engine 5 cinematic photorealistic 8k, faceless, no people, no text",
    sfx: "deep ambient server room drone, low cooling airflow hum, no background music",
  },
  {
    regex: /(model|llm|neural|transformer|bobot|parameter|inferensi|token|nalar|reasoning|deep learning|algoritma|chatgpt|claude|gemini|openai|anthropic|arsitektur model|pelatihan)/i,
    prompt: "abstract 3D visualization of deep neural network topology, radiant interconnected mathematical nodes, glowing fiber optic synaptic pathways through dark space, holographic multidimensional data tensors, Unreal Engine 5 sci-fi cinematic render, faceless, no people, no text",
    sfx: "rising futuristic whoosh, harmonic digital resonance, no background music",
  },
  {
    regex: /(robot|humanoid|drone|otonom|autonomous|otomatisasi|sensor|aktuator|mekanik|swarm|navigasi)/i,
    prompt: "sleek futuristic robotic mechanism performing ultra-precision calibration in high-tech laboratory, matte black carbon fiber and brushed titanium, laser scanning beam, clean ambient workshop lighting, Unreal Engine 5 render, faceless, no people, no human body, no text",
    sfx: "mechanical servo foley, precision pneumatic clicks, no background music",
  },
  {
    regex: /(keamanan|peretas|hacker|cyber|privasi|kebijakan privasi|regulasi|sensitif|senjata|surveilan|enkripsi|firewall|pelanggaran|serangan)/i,
    prompt: "abstract visualization of cyber security mainframe, geometric holographic firewall shields rotating around glowing cryptographic core, streams of encrypted binary telemetry, dark navy and teal aesthetic, Unreal Engine 5 render, faceless, no people, no text",
    sfx: "subtle digital pulse, ominous low sub-bass hum, no background music",
  },
  {
    regex: /(molekul|antimikroba|biologi|biologis|kimia|obat|protein|penelitian ilmiah|laboratorium sains|kandidat obat)/i,
    prompt: "3D scientific visualization of synthetic antimicrobial molecular structure, glowing chemical bonds and atom spheres rotating in dark void, holographic volumetric depth, Unreal Engine 5 aesthetic, cinematic scientific render, faceless, no people, no text",
    sfx: "gentle resonant tone, microscopic ambient shimmer, no background music",
  },
  {
    regex: /(pertumbuhan|pasar|kapitalisasi|valuasi|investasi|saham|persen|pendapatan|keuntungan|miliar|triliun|bisnis|komersial)/i,
    prompt: "dynamic holographic data telemetry of tech industry analytics, floating glowing charts and volumetric graph lines in modern architectural glass boardroom at night, Unreal Engine 5 aesthetic, cinematic moody lighting, faceless, no people, no text",
    sfx: "subtle digital clicks, ambient corporate atmospheric tone, no background music",
  },
];

const DEFAULT_THEME: VisualTheme = {
  regex: /.*/,
  prompt: "sleek futuristic technology abstraction, glowing blue and amber light trails tracing computational circuit pathways across glass architecture, volumetric haze, cinematic sci-fi Unreal Engine 5 render, faceless, no people, no text",
  sfx: "futuristic ambient room hum, clean foley, no background music",
};

/** Pilih tema visual deterministik utk teks beat (dipakai fallback mapper + guard STATIC-blank). */
export function themedHintFor(text: string): { prompt: string; sfx: string } {
  const t = THEMES.find((th) => th.regex.test(text)) ?? DEFAULT_THEME;
  return { prompt: t.prompt, sfx: t.sfx };
}

const STATIC_TRIGGER = /(\d+\s*persen|melaporkan|dilaporkan|techcrunch|the verge|wired|mit|decoder|openai blog|miliar|juta|ceo|mengumumkan|menurut|hasil survei|laporan resmi)/i;
const I2V_TRIGGER = /(chip|gpu|prosesor|robot|drone|aplikasi|perangkat|produk|molekul|antimikroba|codex|chatgpt|antarmuka|sensor|kamera)/i;

/**
 * Fallback deterministik (0 LLM call) saat LLM storyboard gagal 2x per batch.
 * Menghasilkan prompt sinematik Unreal Engine 5 murni bahasa Inggris, faceless, no music.
 */
export async function classifyBeats(
  beats: string[],
  _chapters: string[],
  _images: string[],
): Promise<BeatHint[]> {
  const out: BeatHint[] = beats.map((b) => {
    // 1. Tentukan tema semantik
    const matchedTheme = THEMES.find((t) => t.regex.test(b)) ?? DEFAULT_THEME;

    // 2. Tentukan jenis visual awal
    const isStatic = STATIC_TRIGGER.test(b);
    const isI2v = I2V_TRIGGER.test(b);

    let visual: BeatVisual = "T2V_GENERATION";
    if (isStatic) visual = "STATIC_IMAGE_MOTION";
    else if (isI2v) visual = "I2V_ANIMATE_IMAGE";

    return {
      visual,
      prompt: visual === "STATIC_IMAGE_MOTION" ? "" : matchedTheme.prompt,
      sfx: matchedTheme.sfx,
    };
  });

  // Balance pass: Pastikan T2V minimal 35% agar visual video AI berlimpah
  const minT2v = Math.ceil(beats.length * 0.35);
  const currentT2v = out.filter((h) => h.visual === "T2V_GENERATION").length;
  if (currentT2v < minT2v) {
    let needed = minT2v - currentT2v;
    for (let i = 0; i < out.length && needed > 0; i++) {
      if (out[i].visual === "STATIC_IMAGE_MOTION") {
        const theme = THEMES.find((t) => t.regex.test(beats[i])) ?? DEFAULT_THEME;
        out[i] = { visual: "T2V_GENERATION", prompt: theme.prompt, sfx: theme.sfx };
        needed--;
      }
    }
  }

  const t2vCount = out.filter((h) => h.visual === "T2V_GENERATION").length;
  const staticCount = out.filter((h) => h.visual === "STATIC_IMAGE_MOTION").length;
  const i2vCount = out.filter((h) => h.visual === "I2V_ANIMATE_IMAGE").length;
  console.log(`[llm-long] Thematic Visual Mapper (fallback): ${t2vCount} T2V, ${i2vCount} I2V, ${staticCount} STATIC (0 LLM call, instan)`);

  return out;
}

// ─── Stage 2 (LLM): storyboard visual per beat ─────────────────────────────
export const STUDIO_TAGS = ", Unreal Engine 5 aesthetic, cinematic volumetric lighting, 8k, faceless, no people, no text";

const SYSTEM_STORYBOARD = `You are the visual director of a faceless Indonesian AI-news long-form YouTube video. For EACH numbered narration beat, choose the visual treatment and write a concise, concrete scene description.

Return STRICT JSON ONLY: an array with EXACTLY one object per input beat, in the same order:
[{"visual": "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE", "scene": "<concrete visual subject in 15-25 english words>", "sfx": "<clean ambient sound in 3-6 english words>", "srcImage": "<exact image path or empty string>"}]

Rules:
1. "scene": pure English, 15-25 words, describing ONLY the concrete visual subject (e.g. products, microchips, data center servers, algorithms, robotic arms, lab equipment, financial charts) specific to the beat narration. Do NOT write boilerplate quality buzzwords like "Unreal Engine 5", "8k", "faceless", "no people" (our rendering engine appends studio quality tags automatically).
2. "visual": use "STATIC_IMAGE_MOTION" when the beat is a pure factual report/numbers best shown by the source news image; use "I2V_ANIMATE_IMAGE" when one of the AVAILABLE IMAGES clearly matches the beat subject; use "T2V_GENERATION" otherwise. At least 35% of beats must be "T2V_GENERATION".
3. "srcImage": for I2V_ANIMATE_IMAGE / STATIC_IMAGE_MOTION copy the best matching path from AVAILABLE IMAGES EXACTLY; if nothing matches or the list is empty use "". For T2V_GENERATION always "".
4. "sfx": 3-6 English words for ambient sound/foley (e.g. "subtle electronic hum", "server room cooling air", "precision servo clicks"). Do NOT add "no background music" (automatically appended).
5. Output the JSON array ONLY. Start immediately with '[' and end with ']'. NEVER echo or transcribe input text.`;

function buildUserPrompt(
  batch: { text: string; chapter: string }[],
  images: { path: string; title: string; publisher: string }[],
  offset: number,
): string {
  const imgList = images.length
    ? images.map((im, i) => `${i + 1}. ${im.path} — [${im.publisher}] ${im.title}`).join("\n")
    : "(kosong — jangan isi srcImage)";
  const beatList = batch.map((b, i) => `${offset + i + 1}. [${b.chapter}] ${b.text}`).join("\n");
  return `AVAILABLE IMAGES:\n${imgList}\n\nBEATS TO VISUALIZE:\n${beatList}\n\nOutput JSON array of ${batch.length} objects for beats ${offset + 1}-${offset + batch.length} starting immediately with '[':`;
}

/** Parse jawaban LLM storyboard jadi BeatHint[]; tolak format rusak (dipakai utk retry). */
export function parseStoryboardJson(raw: string, expected: number): BeatHint[] {
  // Tahan benc: array dicari via lastIndexOf("[{") — kebal teks echo model yang memuat kurung siku.
  const start = raw.lastIndexOf("[{");
  if (start === -1) throw new Error("JSON array tidak ditemukan di output LLM");
  const end = raw.lastIndexOf("]");
  const slice = raw.slice(start, end > start ? end + 1 : undefined);
  let arr: unknown;
  try {
    const parsed = JSON.parse(slice) as unknown;
    if (!Array.isArray(parsed)) throw new Error("Output LLM bukan array");
    if (parsed.length === 0) throw new Error("Output LLM array kosong — tidak ada objek storyboard");
    arr = parsed.length > expected ? parsed.slice(0, expected) : parsed;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("Jumlah objek") || msg.includes("bukan array")) throw e;
    const VALID = ["STATIC_IMAGE_MOTION", "T2V_GENERATION", "I2V_ANIMATE_IMAGE"];
    const objs = (slice.match(/\{[^{}]*\}/g) ?? [])
      .map((o) => { try { return JSON.parse(o) as Record<string, unknown>; } catch { return null; } })
      .filter((o): o is Record<string, unknown> => !!o && VALID.includes(o.visual as string));
    if (objs.length === 0) throw new Error("Tidak ada objek storyboard utuh di output LLM");
    arr = objs;
  }

  const cleaned = (arr as Record<string, unknown>[]).map((o) => {
    const e = o as Partial<BeatHint> & { scene?: unknown; srcImage?: unknown };
    if (e.visual !== "STATIC_IMAGE_MOTION" && e.visual !== "T2V_GENERATION" && e.visual !== "I2V_ANIMATE_IMAGE") {
      return null;
    }
    const rawScene = typeof e.scene === "string" ? e.scene.trim() : typeof e.prompt === "string" ? e.prompt.trim() : "";
    let prompt = "";
    if (e.visual !== "STATIC_IMAGE_MOTION" && rawScene) {
      // Bersihkan jika LLM sempat menulis tag kualitas, lalu tambahkan studio tags standar
      const baseScene = rawScene.replace(/(?:,\s*)?(?:unreal engine 5|8k|faceless|no people|no text|cinematic).*$/i, "").trim();
      prompt = `${baseScene || rawScene}${STUDIO_TAGS}`;
    }

    let rawSfx = typeof e.sfx === "string" ? e.sfx.trim() : "";
    let sfx = rawSfx ? rawSfx.replace(/(?:,\s*)?no (?:background )?music.*$/i, "").trim() : "";
    sfx = sfx ? `${sfx}, clean foley, no background music` : LONG_AUDIO_PROMPT;

    const srcImage = typeof e.srcImage === "string" && e.srcImage.trim() ? e.srcImage.trim() : null;
    return {
      visual: e.visual,
      prompt: e.visual === "STATIC_IMAGE_MOTION" ? "" : prompt,
      sfx,
      srcImage,
    } as BeatHint;
  }).filter((h): h is BeatHint => h !== null);
  if (cleaned.length === 0) throw new Error("visual tidak valid di semua objek — tidak ada objek storyboard utuh di output LLM");
  return cleaned;
}

const STORYBOARD_BATCH = 12;
const STAGE2_BUDGET_MS = 20 * 60_000;

export interface StoryboardRunStats {
  totalBatches: number;
  batchesExecuted: number;
  llmOkBatches: number;
  fallbackBatches: number[];
  partialBatches: { no: number; got: number; expected: number }[];
  budgetHit: boolean;
  breakerHit: boolean;
}

export async function generateLongStoryboard(
  beats: { text: string; chapter: string }[],
  images: { path: string; title: string; publisher: string }[],
): Promise<{ hints: BeatHint[]; stats: StoryboardRunStats }> {
  const out: BeatHint[] = [];
  const totalBatches = Math.ceil(beats.length / STORYBOARD_BATCH);
  const stats: StoryboardRunStats = {
    totalBatches,
    batchesExecuted: 0,
    llmOkBatches: 0,
    fallbackBatches: [],
    partialBatches: [],
    budgetHit: false,
    breakerHit: false,
  };
  let consecutiveFallback = 0;
  const t0 = Date.now();
  for (let off = 0; off < beats.length; off += STORYBOARD_BATCH) {
    const batch = beats.slice(off, off + STORYBOARD_BATCH);
    const no = Math.floor(off / STORYBOARD_BATCH) + 1;
    const tBatch = Date.now();
    const elapsed = () => Math.round((Date.now() - tBatch) / 100) / 10;
    // Time budget: bila pagu Stage-2 habis, sisa beat langsung mapper instan
    if (Date.now() - t0 > STAGE2_BUDGET_MS) {
      const rest = beats.slice(off);
      stats.budgetHit = true;
      console.warn(`[llm-long] pagu waktu Stage-2 habis (${STAGE2_BUDGET_MS / 60000} mnt) — ${rest.length} beat sisa pakai mapper`);
      if (rest.length > 0) out.push(...(await classifyBeats(rest.map((b) => b.text), [], [])));
      break;
    }
    const user = buildUserPrompt(batch, images, off);
    let hints: BeatHint[] | null = null;
    let lastErr: Error | undefined;
    let lastRaw = "";
    for (let attempt = 1; attempt <= 2 && !hints; attempt++) {
      try {
        const prompt = attempt === 1 || !lastRaw
          ? user
          : `${user}\n\nPERBAIKAN WAJIB (percobaan 2/2): output sebelumnya GAGAL diparse (${lastErr?.message}). Potongan output mentah sebelumnya:\n${lastRaw.slice(0, 2000)}\nPerbaiki menjadi array JSON valid berisi TEPAT ${batch.length} objek sesuai aturan di atas. JANGAN mengulang/menyalin teks input. MULAI langsung dengan karakter '['.`;
        // maxTokens 2000: cukup untuk 12 beat x 35 tokens = 420 tokens, mencegah model rambling/timeout
        const raw = await chat([{ role: "system", content: SYSTEM_STORYBOARD }, { role: "user", content: prompt }], 2000, 0.2);
        lastRaw = raw;
        hints = parseStoryboardJson(raw, batch.length);
      } catch (err) {
        lastErr = err as Error;
        console.warn(`[llm-long] storyboard batch ${no}/${totalBatches} percobaan ${attempt}/2 gagal: ${lastErr.message}`);
        if (attempt < 2) await sleep(1500 * attempt);
      }
    }
    if (!hints) {
      consecutiveFallback++;
      stats.batchesExecuted++;
      stats.fallbackBatches.push(no);
      console.warn(`[llm-long] batch ${no}/${totalBatches} fallback Thematic Visual Mapper (${elapsed()} dtk, ${lastErr?.message})`);
      hints = await classifyBeats(batch.map((b) => b.text), [], []);
      out.push(...hints);
      if (consecutiveFallback >= 4) {
        // Circuit breaker: hanya aktif bila 4 batch berturut-turut gagal total
        const rest = beats.slice(off + STORYBOARD_BATCH);
        stats.breakerHit = true;
        console.warn(`[llm-long] LLM storyboard tidak sehat (${consecutiveFallback} batch beruntun gagal) — ${rest.length} beat sisa pakai mapper`);
        if (rest.length > 0) out.push(...(await classifyBeats(rest.map((b) => b.text), [], [])));
        break;
      }
      continue;
    }
    consecutiveFallback = 0;
    stats.batchesExecuted++;
    stats.llmOkBatches++;
    if (hints.length < batch.length) {
      stats.partialBatches.push({ no, got: hints.length, expected: batch.length });
      console.warn(`[llm-long] batch ${no}/${totalBatches} objek LLM parsial (${hints.length}/${batch.length}, ${elapsed()} dtk) — sisanya diisi prompt tema deterministik`);
      for (let j = hints.length; j < batch.length; j++) {
        const themed = themedHintFor(batch[j].text);
        hints.push({ visual: "T2V_GENERATION", prompt: themed.prompt, sfx: themed.sfx, srcImage: null });
      }
    } else {
      console.log(`[llm-long] batch ${no}/${totalBatches} ok (${hints.length}/${batch.length}, ${elapsed()} dtk)`);
    }
    // Buang srcImage liar (tidak ada di daftar gambar edisi)
    for (const h of hints) {
      if (h.srcImage && !images.some((im) => im.path === h.srcImage)) h.srcImage = null;
    }
    out.push(...hints);
  }
  const t2v = out.filter((h) => h.visual === "T2V_GENERATION").length;
  const i2v = out.filter((h) => h.visual === "I2V_ANIMATE_IMAGE").length;
  const st = out.filter((h) => h.visual === "STATIC_IMAGE_MOTION").length;
  console.log(`[llm-long] storyboard LLM: ${out.length} beat → ${t2v} T2V, ${i2v} I2V, ${st} STATIC (${stats.batchesExecuted}/${totalBatches} batch via LLM, fallback: [${stats.fallbackBatches.join(",") || "-"}], parsial: ${stats.partialBatches.length}, pagu: ${stats.budgetHit ? "HABIS" : "cukup"}, breaker: ${stats.breakerHit ? "MENYALA" : "mati"})`);
  return { hints: out, stats };
}
