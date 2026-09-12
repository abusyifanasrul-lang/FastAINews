// Generator 2-tahap long-form:
// Stage 1: Naskah deep-dive 8-10 menit via LLM chat() (target 1400-1600 kata, min 1100 kata).
// Stage 2: Thematic Visual Mapper deterministik (0 LLM call, 0 delay, 100% bebas timeout).
// Jaminan ketat: faceless, no people/animal, no background music, prompt murni Inggris Unreal Engine 5.
import { chat } from "../llm.js";
import type { NewsItem } from "../research.js";
import { validateLongScript, countWords } from "./validate.js";

export const FACELESS_NEGATIVE =
  "human face, animal face, portrait, close up person, woman, man, eyes, character, character animation";
export const LONG_AUDIO_PROMPT = "realistic futuristic ambient room hum, clean foley, no background music";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateLongScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   ${it.url}`).join("\n");
  const half = Math.max(1, Math.ceil(items.length / 2));

  const system = `You are a professional Indonesian tech journalist and long-form video essay director. You must write exhaustive, expansive, flowing, highly detailed prose in natural formal Indonesian (baku-populer bertutur: gunakan Kita, Saya, Anda — dilarang kata gaul seperti gue/elu). Never be terse. Never summarize or compress into bullet points.
TARGET PANJANG: 1300 - 1500 KATA (MINIMAL 950 KATA — syarat video iklan mid-roll YouTube >= 8 menit).

Daftar ${items.length} berita 72 jam terakhir wajib dibahas tuntas satu per satu secara berurutan. DILARANG merangkum secara singkat!
Untuk SETIAP berita, tulis pembahasan menyeluruh (minimal 2-3 paragraf padat per topik):
- Paragraf 1: Detail fakta teknis, metrik/angka spesifik, pernyataan resmi, dan apa yang sebenarnya diluncurkan atau terjadi.
- Paragraf 2: Konteks mengapa peristiwa ini terjadi, analisis arsitektur atau teknis di baliknya, dan komparasi dengan teknologi kompetitor/sebelumnya.
- Paragraf 3: Implikasi industri nyata, tantangan masa depan, dan dampaknya bagi ekosistem AI global.

Struktur Naskah Lengkap:
1. Hook Pembuka & Tesis Utama (3-4 kalimat menggugah, sebut narasi besar 72 jam ini)
2. Konteks Makro 72 Jam Terakhir (rangkuman naratif pergeseran lanskap industri AI terkini)
3. Deep-Dive Topik 1 sampai ${items.length} (masing-masing 3 paragraf berbobot sesuai panduan di atas)
   * Sisipkan tepat di tengah naskah (setelah topik ke-${half}): [MID-ROLL AD BREAK: 04:30]
4. Sintesis & Analisis Masa Depan (korelasi antar peristiwa dan prediksi 6-12 bulan ke depan)
5. Peluang Konkret untuk Publik / Orang Awam (langkah praktis dan peluang karier/adopsi nyata)
6. CTA Penutup (ajak berdiskusi di kolom komentar dan subscribe)

ATURAN FORMAT WAJIB:
- Mulai baris pertama TEPAT dengan format: JUDUL: <Judul Menarik Maksimal 10 Kata>
- Dilarang menulis proses berpikir, catatan internal, tag markdown seperti **, ##, bullet, dsb. Tulis sebagai teks narasi lisan yang mengalir.
- Dilarang teks bahasa Inggris selain istilah teknologi standar.
- Hanya gunakan fakta dari daftar sumber yang diberikan, tanpa halusinasi.`;

  const user = `Daftar sumber berita 72 jam terakhir:\n${list}\n\nTulis naskah mendalam, elaboratif, dan mengalir minimal 1100-1400 kata. LANGSUNG mulai output pada baris pertama dengan JUDUL:.`;

  const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 6000);
  const m = raw.match(/(?:^|\n)\s*JUDUL:\s*([^\n]+)/i);
  const mIdx = m?.index ?? -1;
  const topicTitle = m?.[1]?.trim().replace(/^["'*]+|["'*]+$/g, "") ?? items[0]?.title ?? "Deep-dive AI 3 hari";
  const script = m && mIdx >= 0 && mIdx < raw.length / 2 ? raw.slice(mIdx + m[0].length).trim() : raw.trim();

  // Validasi tanpa retry: jika gagal, biarkan melempar error agar langsung tertangkap dan dikirim ke Telegram
  validateLongScript(script, 900);
  console.log(`[llm-long] naskah berhasil dibuat: ${countWords(script)} kata`);
  return { script, topicTitle };
}

export type BeatVisual = "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE";
export interface BeatHint { visual: BeatVisual; prompt: string; sfx: string }

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

const STATIC_TRIGGER = /(\d+\s*persen|melaporkan|dilaporkan|techcrunch|the verge|wired|mit|decoder|openai blog|miliar|juta|ceo|mengumumkan|menurut|hasil survei|laporan resmi)/i;
const I2V_TRIGGER = /(chip|gpu|prosesor|robot|drone|aplikasi|perangkat|produk|molekul|antimikroba|codex|chatgpt|antarmuka|sensor|kamera)/i;

/**
 * Thematic Visual Mapper deterministik (0 LLM call, 0 latency, 100% bebas timeout).
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
  console.log(`[llm-long] Thematic Visual Mapper: ${t2vCount} T2V, ${i2vCount} I2V, ${staticCount} STATIC (0 LLM call, instan)`);

  return out;
}
