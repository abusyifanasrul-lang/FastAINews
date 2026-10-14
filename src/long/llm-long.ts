// Generator 2-tahap long-form:
// Stage 1: Naskah deep-dive 8-10 menit via LLM chat() (target 1400-1600 kata, min 1100 kata).
// Stage 2: Storyboard visual per beat via LLM berbatch (generateLongStoryboard) — prompt
//          kontekstual per berita; fallback deterministik classifyBeats bila LLM gagal.
// Jaminan ketat: faceless, no people/animal, no background music, prompt murni Inggris Unreal Engine 5.
import { chat } from "../llm.js";
import type { NewsItem } from "../research.js";
import { trimNaskahToLength, validateLongScript, countWords } from "./validate.js";

export const FACELESS_NEGATIVE =
  "human face, eyes, portrait, readable facial features, smiling, looking at camera, character model, distorted face, unreadable blurry text, intrusive watermark, copyright signature";
export const LONG_AUDIO_PROMPT = "realistic futuristic ambient room hum, clean foley, no background music";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function generateLongScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((it, i) => `${i + 1}. [${it.publisher}] ${it.title}\n   ${it.url}`).join("\n");
  const half = Math.max(1, Math.ceil(items.length / 2));

  const system = `You are a professional Indonesian tech journalist and long-form video essay director. You must write exhaustive, expansive, flowing, highly detailed prose in natural formal Indonesian (baku-populer bertutur: gunakan Kita, Saya, Anda — dilarang kata gaul seperti gue/elu). Never be terse. Never summarize or compress into bullet points.
TARGET PANJANG: 1150 - 1350 KATA (MINIMAL 950 KATA — syarat video iklan mid-roll YouTube >= 8 menit, maksimal 13.500 karakter).

ATURAN MUTLAK 10 DETIK PERTAMA (HOOK RETENSI TINGGI):
- DILARANG MEMBUKA DENGAN KLISE SASTRAWI: Dilarang keras membuka dengan kalimat seperti "telah menjadi saksi bisu", "pada kesempatan kali ini", "selamat datang", "pada video kali ini", "perkembangan pesat".
- WAJIB FORMULA HOOK 3-TAHAP (Paragraf 1):
  1. Kalimat 1 (Detik 0-4): The Provocation — Langsung tembakkan peristiwa paling radikal, kontradiksi mengejutkan, atau ketegangan terbesar dalam 72 jam ini.
  2. Kalimat 2 (Detik 4-8): The Value Contract — Jelaskan dengan tegas kepada penonton MENGAPA mereka harus merelakan 10 menit berharga untuk menonton video ini (apa keuntungan nyata, risiko jika tertinggal, atau wawasan eksklusif yang mereka dapatkan).
  3. Kalimat 3-4 (Detik 8-15): The Roadmap Teaser — Rangkum cepat 3 bom berita atau manuver rahasia yang akan kita bongkar di video ini.

Daftar ${items.length} berita 72 jam terakhir wajib dibahas tuntas satu per satu secara berurutan.
Untuk SETIAP berita, tulis pembahasan mendalam dan berbobot teknis (1-2 paragraf padat per topik):
- Paragraf 1: Detail fakta teknis, metrik/angka spesifik, apa yang diluncurkan/terjadi, serta konteks arsitekturnya.
- Paragraf 2: Implikasi industri nyata, komparasi pasar, dan dampaknya bagi ekosistem AI global.

Struktur Naskah Lengkap:
1. Hook Pembuka & Value Contract (Formula 3-Tahap di atas, 3-4 kalimat menggugah rasa ingin tahu dan menjanjikan nilai konkret)
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
export interface BeatHint {
  visual: BeatVisual;
  prompt: string;
  sfx: string;
  srcImage?: string | null;
  contextTitle?: string;
  keyMetric?: string;
  visualClue?: string;
}

interface VisualTheme {
  regex: RegExp;
  prompts: string[];
  sfx: string;
  contextTitle: string;
  keyMetric: string;
  visualClue: string;
}

const THEMES: VisualTheme[] = [
  {
    regex: /(chip|gpu|tpu|prosesor|semikonduktor|semiconductor|wafer|cuda|transistor|hardware|perangkat keras|komputasi|akselerator|microchip|nvidia|amd|intel)/i,
    prompts: [
      "macro photograph of advanced microchip wafer, intricate microscopic gold and copper circuit nodes, shallow depth of field, 100mm macro lens, warm tungsten and amber lighting, bokeh background",
      "extreme close-up of a single brass and copper circuit node with fine wires fanning out across blueprint grid, macro lens, warm side lighting, shallow depth of field",
      "macro shot of gleaming silicon processor die reflecting multicolored refraction fringes on dark matte substrate, 100mm macro lens, cool cyan and tungsten accents",
      "overhead view of precision electronic testing bench with copper probes hovering over an illuminated circuit board, soft daylight, 50mm lens, slate and amber palette",
    ],
    sfx: "subtle electronic hum, high frequency data processing audio, clean foley, no background music",
    contextTitle: "HARDWARE // SEMIKONDUKTOR",
    keyMetric: "Arsitektur Silikon & Komputasi",
    visualClue: "Wafer Sirkuit Mikro Emas",
  },
  {
    regex: /(data center|pusat data|server|server rack|rak server|energi|listrik|daya listrik|daya komputasi|infrastruktur|pendingin|liquid cooling|cooling|megawatt|gigawatt|cloud|komputasi awan)/i,
    prompts: [
      "wide shot of quiet high-density server corridor, humming server racks with cool white status LEDs and neat cabling, symmetrical center frame, 35mm film still, muted blue and cool slate tones, film grain",
      "tilt-shift miniature diorama of two server towers racing along parallel tracks with red and blue fiber cables, soft daylight, pastel palette, high angle",
      "wide shot of industrial server cooling bay with frosted pipes and gentle vapor mist under cool blue fluorescent lights, symmetrical composition, 24mm lens",
      "close-up of server rack patch panel with organized glowing ethernet cables fanning out into neat bundles, shallow depth of field, 85mm lens, deep navy and cyan light",
    ],
    sfx: "deep ambient server room drone, low cooling airflow hum, no background music",
    contextTitle: "INFRASTRUKTUR // PUSAT DATA",
    keyMetric: "Daya Komputasi & Pendingin",
    visualClue: "Koridor Rak Server Modern",
  },
  {
    regex: /(model|llm|neural|transformer|bobot|parameter|inferensi|token|nalar|reasoning|deep learning|algoritma|chatgpt|claude|gemini|openai|anthropic|arsitektur model|pelatihan)/i,
    prompts: [
      "clean isometric 3D illustration of small robotic workers on a conveyor belt assembling colored blocks, a single large hand-shaped lever at the end, flat colors, soft shadows, light gray background, mint and coral palette",
      "overhead view of a lab tray with hundreds of small gray beads, tweezers lifting one distinct purple bead out of the pile, macro lens, bright clean light, mint and coral palette",
      "close-up of a brass balance scale on a clean laboratory bench, a miniature robotic arm on one pan and a wooden hand figurine on the other, macro lens, bokeh background, cool white light",
      "isometric 3D illustration of a geometric turnstile checkpoint on a pathway of colored cubes, flat colors, soft shadows, light gray background, amber and gray palette",
    ],
    sfx: "rising futuristic whoosh, harmonic digital resonance, no background music",
    contextTitle: "ARSITEKTUR // FRONTIER MODEL",
    keyMetric: "Penalaran & Skala Inferensi",
    visualClue: "Simulasi Arsitektur Model Hibrida",
  },
  {
    regex: /(robot|humanoid|drone|otonom|autonomous|otomatisasi|sensor|aktuator|mekanik|swarm|navigasi)/i,
    prompts: [
      "close-up of robotic manipulator arm performing precision assembly on a clean workbench, soft natural daylight, 50mm lens, brushed titanium and matte black finishes, shallow depth of field",
      "overhead shot of a wooden mannequin hand and a small jointed robotic arm resting on one sheet of blank staff paper, together holding a single pencil, warm desk lamp light, 35mm film still, orange and teal tones",
      "macro shot of rows of tiny toggle switches flipping one after another with small green LEDs lighting in sequence, shallow depth of field, cool white light, mint and gray palette",
      "split composition: left half punched paper tape curling across desk, right half wooden mannequin hand turning a brass dial, macro lens, soft daylight, cool white and coral accents",
    ],
    sfx: "mechanical servo foley, precision pneumatic clicks, no background music",
    contextTitle: "ROBOTIKA // SISTEM OTONOM",
    keyMetric: "Sensor & Manipulasi Presisi",
    visualClue: "Perakitan Mekanik Presisi Lab",
  },
  {
    regex: /(keamanan|peretas|hacker|cyber|privasi|kebijakan privasi|regulasi|sensitif|senjata|surveilan|enkripsi|firewall|pelanggaran|serangan|hukum|pemerintah|kebijakan)/i,
    prompts: [
      "empty leather chair behind a long polished mahogany desk in a quiet formal office, small brass desk lamp on, wide shot, 35mm film still, muted amber and gray tones, film grain",
      "empty wooden podium with a single microphone on a quiet stage, soft spotlight, colorful audio waveforms on backdrop screen, wide shot, 35mm film still, warm amber tones, shallow depth of field",
      "overhead shot of a long mahogany conference table with a brass globe at its center, empty chairs, notepads and water glasses, warm lamp light, 35mm film still, amber tones, film grain",
      "wide shot through a glass wall into a bright boardroom where rows of empty chairs face a lectern with several microphones, soft reflections on glass, 35mm film still, cool daylight, muted red and cream accents",
    ],
    sfx: "subtle digital pulse, ominous low sub-bass hum, no background music",
    contextTitle: "KEBIJAKAN // REGULASI GLOBAL",
    keyMetric: "Kepatuhan & Privasi Data",
    visualClue: "Ruang Konferensi Pengambilan Keputusan",
  },
  {
    regex: /(molekul|antimikroba|biologi|biologis|kimia|obat|protein|penelitian ilmiah|laboratorium sains|kandidat obat)/i,
    prompts: [
      "overhead view of a white lab tray with hundreds of tiny gray beads, laboratory tweezers lifting one purple bead out of the pile, macro lens, bright clean laboratory light, mint and cool white palette",
      "macro photograph of dense three-dimensional web of fine glass fibers and tiny metal spheres suspended in dark air, each catching a point of light, 100mm macro lens, cool blue-white light, shallow depth of field",
      "macro photograph of geometric mineral crystals growing along a gold seam on dark basalt stone, side lighting, 85mm lens, deep teal and amber accents",
      "close-up of a laboratory glass beaker with clear layered solutions beside an illuminated digital sensor readout, warm side light, shallow depth of field, cool mint and slate palette",
    ],
    sfx: "gentle resonant tone, microscopic ambient shimmer, no background music",
    contextTitle: "SAINS // BIOLOGI KOMPUTASI",
    keyMetric: "Prediksi Molekuler AI",
    visualClue: "Struktur Kristal Riset Ekologi",
  },
  {
    regex: /(pertumbuhan|pasar|kapitalisasi|valuasi|investasi|saham|persen|pendapatan|keuntungan|miliar|triliun|bisnis|komersial|belanja|e-commerce|ritel)/i,
    prompts: [
      "overhead flat lay of a modern smartphone showing a clean product card with a price tag '$49', surrounded by small paper shipping parcels and coffee cup on wooden table, soft daylight, pastel peach and sky blue palette, clean product photography",
      "isometric 3D illustration of a friendly sorting machine scanning product boxes, a digital chat panel showing product specs and price '$29', flat colors, soft shadows, light background, peach and sky blue palette",
      "product photography of a sneaker, a lamp and a backpack arranged on a pastel pedestal beside a smartphone with soft concentric ripple graphic, clean studio light, 85mm lens, peach and sky blue palette",
      "overhead shot of a cardboard world map where small toy delivery trucks and paper planes follow threads curving toward a chat bubble sculpture, soft daylight, tilt-shift effect, pastel palette",
    ],
    sfx: "subtle digital clicks, ambient corporate atmospheric tone, no background music",
    contextTitle: "EKONOMI // VALUASI PASAR",
    keyMetric: "Pertumbuhan & Adopsi Enterprise",
    visualClue: "Mockup Transaksi & Antarmuka Ritel",
  },
  {
    regex: /(musik|lagu|suara|audio|kreatif|seni|komposisi|instrumen|sound)/i,
    prompts: [
      "layered paper-cut art of a vintage hardware audio sampler with colorful paper waves unfolding across the frame, warm orange, magenta and teal, handmade texture, centered symmetrical composition",
      "layered paper-cut art of tangled colorful ribbons flowing into a vintage mixing console and turning into neat sound waves, warm orange and teal, handmade texture, centered symmetrical composition",
      "close-up of a professional mixing console with faders at uneven heights forming a jagged skyline, one fader caught mid-motion with motion blur, 35mm film still, warm amber and teal light, shallow depth of field",
      "macro photograph of colored sand forming concentric resonance patterns on a vibrating speaker cone, shallow depth of field, warm light, orange, magenta and teal palette",
    ],
    sfx: "clean audio foley, resonant tone, no background music",
    contextTitle: "KREATIF // SINTESIS AUDIO",
    keyMetric: "Generasi Suara Kustom AI",
    visualClue: "Pita Audio Paper-Cut Art",
  },
];

const DEFAULT_THEME: VisualTheme = {
  regex: /.*/,
  prompts: [
    "overhead shot of a tidy modern workspace desk with a laptop, open notebook with clean flowchart diagram, and coffee cup, soft morning window light, 50mm lens, warm neutral tones, shallow depth of field",
    "wide shot of a quiet open-plan office at dusk, rows of desks with monitors showing clean statistical charts, one desk lamp on, soft window light, 35mm film still, warm neutral tones, film grain",
    "tilt-shift miniature diorama of a small wooden bridge connecting four tiny islands: a government building, a recording studio, a factory, and a shop with smartphone sign, soft daylight, pastel palette, high angle",
    "close-up of a studio desk with a microphone, a ring light, a clean red circular button, and a brass bell mid-swing with motion blur, 85mm lens, shallow depth of field, warm neutral and crimson tones",
  ],
  sfx: "futuristic ambient room hum, clean foley, no background music",
  contextTitle: "FAST AI NEWS // ANALISIS",
  keyMetric: "Laporan Riset 72 Jam",
  visualClue: "Ruang Analisis Teknologi",
};

/** Pilih tema visual deterministik utk teks beat (dipakai fallback mapper + guard STATIC-blank). */
export function themedHintFor(text: string, cycleIndex = 0): { prompt: string; sfx: string; contextTitle: string; keyMetric: string; visualClue: string } {
  const t = THEMES.find((th) => th.regex.test(text)) ?? DEFAULT_THEME;
  const p = t.prompts[Math.abs(cycleIndex) % t.prompts.length];
  return { prompt: p, sfx: t.sfx, contextTitle: t.contextTitle, keyMetric: t.keyMetric, visualClue: t.visualClue };
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
  const themeCounts = new Map<VisualTheme, number>();
  const out: BeatHint[] = beats.map((b) => {
    // 1. Tentukan tema semantik
    const matchedTheme = THEMES.find((t) => t.regex.test(b)) ?? DEFAULT_THEME;
    const count = themeCounts.get(matchedTheme) ?? 0;
    themeCounts.set(matchedTheme, count + 1);
    const promptVariant = matchedTheme.prompts[count % matchedTheme.prompts.length];

    // 2. Tentukan jenis visual awal
    const isStatic = STATIC_TRIGGER.test(b);
    const isI2v = I2V_TRIGGER.test(b);

    let visual: BeatVisual = "T2V_GENERATION";
    if (isStatic) visual = "STATIC_IMAGE_MOTION";
    else if (isI2v) visual = "I2V_ANIMATE_IMAGE";

    return {
      visual,
      prompt: visual === "STATIC_IMAGE_MOTION" ? "" : promptVariant,
      sfx: matchedTheme.sfx,
      contextTitle: matchedTheme.contextTitle,
      keyMetric: matchedTheme.keyMetric,
      visualClue: matchedTheme.visualClue,
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
        const count = themeCounts.get(theme) ?? 0;
        themeCounts.set(theme, count + 1);
        const promptVariant = theme.prompts[count % theme.prompts.length];
        out[i] = {
          visual: "T2V_GENERATION",
          prompt: promptVariant,
          sfx: theme.sfx,
          contextTitle: theme.contextTitle,
          keyMetric: theme.keyMetric,
          visualClue: theme.visualClue,
        };
        needed--;
      }
    }
  }

  const t2vCount = out.filter((h) => h.visual === "T2V_GENERATION").length;
  const staticCount = out.filter((h) => h.visual === "STATIC_IMAGE_MOTION").length;
  const i2vCount = out.filter((h) => h.visual === "I2V_ANIMATE_IMAGE").length;
  console.log(`[llm-long] Thematic Visual Mapper (fallback multi-style): ${t2vCount} T2V, ${i2vCount} I2V, ${staticCount} STATIC (0 LLM call, instan)`);

  return out;
}

// ─── Stage 2 (LLM): storyboard visual per beat ─────────────────────────────
export const STUDIO_TAGS = "";

const SYSTEM_STORYBOARD = `You are the visual director of an Indonesian tech news long-form video (FastAINews / nash_future). For EACH numbered narration beat, choose the visual treatment and write a concrete, diverse scene description.

CRITICAL: Do NOT output <think> tags, chain-of-thought, reasoning, or conversational preamble. Output the raw JSON array IMMEDIATELY starting with '[' and ending with ']'.

Return STRICT JSON ONLY: an array with EXACTLY one object per input beat, in the same order:
[{"visual": "STATIC_IMAGE_MOTION" | "T2V_GENERATION" | "I2V_ANIMATE_IMAGE", "scene": "<concrete visual prompt following the 6-style bible in 25-45 english words>", "sfx": "<clean ambient sound in 3-6 english words>", "srcImage": "<exact image path or empty string>", "contextTitle": "<Entity or Chapter Topic in 2-4 uppercase words>", "keyMetric": "<Key quantitative fact or focus in 2-4 words>", "visualClue": "<Contextual connection bridging visual to news in 3-6 Indonesian words>"}]

Rules:
1. Dynamic Style Bible (ROTATE styles across segments to avoid visual repetition / dejavu):
   - Editorial Documentary: "35mm film still, soft natural light, muted amber and gray tones, film grain" (suited for policy, empty conference rooms, TV studios, podiums)
   - Macro Photography: "macro lens, bokeh, shallow depth of field, warm tungsten/cool light" (suited for microchips, circuit nodes, lab trays, hardware switches)
   - Isometric 3D / Diorama: "clean isometric 3D illustration, flat colors, soft shadows, mint and coral palette" or "tilt-shift miniature diorama" (suited for AI pipelines, robot workers, data sorting, market race)
   - Paper-Cut / Mixed Media: "layered paper-cut art, handmade texture, warm orange, magenta and teal" (suited for creative AI, music synthesis, audio waveforms)
   - Product Photography: "overhead flat lay, clean studio light, pastel peach and sky blue palette, clean product photography" (suited for smartphones, e-commerce, shopping apps)
   - Cinematic Volumetric: "wide shot, 24mm lens, cinematic volumetric light" (RESTRICT to <= 15% of total beats, only for global tectonic/continental scale)

2. Concrete Objects Only (NO Abstract Buzzwords):
   - BAN abstract verbs: NEVER write "representing", "symbolizing", "illustrating the concept of", or "visualizing the transition".
   - BAN public figure names (Dario Amodei, Sam Altman, Jensen Huang) -> use physical situational sets: "empty wooden podium with single microphone", "empty leather chair behind polished mahogany desk", "empty late-night talk show set".
   - Use tangible physical items: lab trays with tweezers and beads, brass balance scales, toggle switches, punched paper tapes, wooden mannequin hands.

3. Functional Text & UI Elements ARE PERMITTED:
   - When visualizing apps, devices, or dashboards, specify clean, simple contextual UI elements (e.g. "smartphone showing a clean shopping cart card with a '$49' price tag", "monitor displaying a bar chart with '+72%' metric", "chat bubble icon", "paper staff lines with music notes") to clarify the news context.

4. Strict Compositional Faceless (MUTLAK FACELESS):
   - Every human element must be strictly faceless: use rear-facing / over-the-shoulder framing, steep bird's-eye overhead angles, framing cropped below the neck (hands only), wooden mannequin hands, or completely empty room sets. NEVER describe front-facing faces, readable facial features, eyes, or smiling people.

5. Visual Distribution:
   - "STATIC_IMAGE_MOTION": use when the beat is a pure factual report best represented by source news photo.
   - "I2V_ANIMATE_IMAGE": use when one of the AVAILABLE IMAGES clearly matches the beat subject.
   - "T2V_GENERATION": use for generated conceptual scenes. At least 35% of beats must be T2V.

6. "srcImage": for I2V_ANIMATE_IMAGE / STATIC_IMAGE_MOTION copy the best matching path from AVAILABLE IMAGES EXACTLY; if nothing matches or the list is empty use "". For T2V_GENERATION always "".
7. "sfx": 3-6 English words for ambient sound/foley (e.g. "subtle electronic hum", "server room cooling air", "precision servo clicks"). Do NOT add "no background music" (automatically appended).
8. Output the JSON array ONLY. Start immediately with '[' and end with ']'. NEVER echo or transcribe input text.`;

function buildUserPrompt(
  batch: { text: string; chapter: string }[],
  images: { path: string; title: string; publisher: string }[],
  offset: number,
): string {
  const imgList = images.length
    ? images.map((im, i) => `${i + 1}. ${im.path} — [${im.publisher}] ${im.title}`).join("\n")
    : "(kosong — jangan isi srcImage)";
  const beatList = batch.map((b, i) => `${offset + i + 1}. [${b.chapter}] ${b.text}`).join("\n");
  return `AVAILABLE IMAGES:\n${imgList}\n\nBEATS TO VISUALIZE:\n${beatList}\n\nDo NOT think or explain. Output ONLY the JSON array of ${batch.length} objects for beats ${offset + 1}-${offset + batch.length} starting immediately with '[':`;
}

export const STYLE_KEYWORDS = /(35mm|film still|macro|isometric|paper-cut|product photography|tilt-shift|diorama|establishing shot|lens|shallow depth|bokeh|volumetric|overhead flat lay|clean studio light)/i;

/** Perkaya prompt jika model LLM menghasilkan deskripsi ringkas tanpa detail kamera/medium. */
export function enrichPromptIfNeeded(rawScene: string, chapterTitle = "", beatIndex = 0): string {
  let prompt = rawScene.replace(/[\r\n]+/g, " ").trim();
  if (!prompt) return "";
  // Jika prompt sudah mengandung kata kunci kamera/medium, pertahankan apa adanya
  if (STYLE_KEYWORDS.test(prompt)) return prompt;

  const c = chapterTitle.toLowerCase();
  if (c.includes("intro") || c.includes("tesis")) {
    const variants = [
      ", wide establishing shot, 24mm lens, cinematic volumetric light, deep teal and orange",
      ", symmetrical center frame, 35mm film still, soft natural light, muted warm tones, film grain",
      ", macro lens, bokeh, warm tungsten light, shallow depth of field",
    ];
    prompt += variants[beatIndex % variants.length];
  } else if (c.includes("konteks") || c.includes("makro")) {
    const variants = [
      ", 35mm film still, soft window light, muted amber and gray tones, film grain",
      ", overhead composition, natural daylight, muted warm tones, shallow depth of field",
      ", tilt-shift miniature diorama, soft daylight, pastel palette, high angle",
    ];
    prompt += variants[beatIndex % variants.length];
  } else if (c.includes("deep-dive") || c.includes("berita")) {
    const variants = [
      ", 100mm macro lens, shallow depth of field, warm tungsten and amber lighting",
      ", clean isometric 3D illustration, flat colors, soft shadows, mint and coral palette",
      ", layered paper-cut art, handmade texture, warm orange, magenta and teal palette",
      ", overhead flat lay, clean studio light, pastel peach and sky blue palette, clean product photography",
    ];
    prompt += variants[beatIndex % variants.length];
  } else if (c.includes("analisis") || c.includes("prediksi")) {
    const variants = [
      ", clean isometric 3D illustration, flat colors, soft shadows, light gray background",
      ", 35mm film still, warm evening window light, muted neutral tones, film grain",
      ", tilt-shift miniature diorama, soft daylight, pastel palette, high angle",
    ];
    prompt += variants[beatIndex % variants.length];
  } else {
    const variants = [
      ", 35mm film still, warm morning window light, warm neutral tones, shallow depth of field",
      ", 85mm lens, shallow depth of field, clean studio light, warm neutral tones",
      ", symmetrical center frame, 24mm lens, volumetric soft lighting, deep amber and slate",
    ];
    prompt += variants[beatIndex % variants.length];
  }
  return prompt;
}

/** Parse jawaban LLM storyboard jadi BeatHint[]; tolak format rusak (dipakai utk retry). */
export function parseStoryboardJson(
  raw: string,
  expected: number,
  chapterTitles: string[] = [],
  offset = 0,
): BeatHint[] {
  const VALID = ["STATIC_IMAGE_MOTION", "T2V_GENERATION", "I2V_ANIMATE_IMAGE"];

  // 1. Coba cari pembuka array '[' yang diikuti '{' (dengan toleransi spasi/newline)
  const regex = /\[\s*\{/g;
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    start = m.index;
  }

  let arr: unknown[] | null = null;

  if (start !== -1) {
    const end = raw.lastIndexOf("]");
    const slice = raw.slice(start, end > start ? end + 1 : undefined);
    try {
      const parsed = JSON.parse(slice) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        arr = parsed.length > expected ? parsed.slice(0, expected) : parsed;
      }
    } catch {
      // JSON.parse gagal (terpotong / syntax error) -> coba salvage objek utuh dari slice
      const objs = (slice.match(/\{[^{}]*\}/g) ?? [])
        .map((o) => { try { return JSON.parse(o) as Record<string, unknown>; } catch { return null; } })
        .filter((o): o is Record<string, unknown> => !!o && VALID.includes(o.visual as string));
      if (objs.length > 0) arr = objs;
    }
  }

  // 2. Jika tidak ada '[' atau ekstraksi slice di atas kosong:
  // Coba langsung ekstrak seluruh objek JSON utuh dari raw string (bracket-agnostic)
  if (!arr || arr.length === 0) {
    const directObjs = (raw.match(/\{[^{}]*\}/g) ?? [])
      .map((o) => { try { return JSON.parse(o) as Record<string, unknown>; } catch { return null; } })
      .filter((o): o is Record<string, unknown> => !!o && VALID.includes(o.visual as string));
    if (directObjs.length > 0) {
      arr = directObjs.length > expected ? directObjs.slice(0, expected) : directObjs;
    }
  }

  if (!arr || arr.length === 0) {
    throw new Error("JSON array tidak ditemukan di output LLM");
  }

  const cleaned = (arr as Record<string, unknown>[]).map((o, idx) => {
    const e = o as Partial<BeatHint> & { scene?: unknown; srcImage?: unknown };
    if (e.visual !== "STATIC_IMAGE_MOTION" && e.visual !== "T2V_GENERATION" && e.visual !== "I2V_ANIMATE_IMAGE") {
      return null;
    }
    const rawScene = typeof e.scene === "string" ? e.scene.trim() : typeof e.prompt === "string" ? e.prompt.trim() : "";
    let prompt = "";
    if (e.visual !== "STATIC_IMAGE_MOTION" && rawScene) {
      const chapter = chapterTitles[idx] ?? "";
      prompt = enrichPromptIfNeeded(rawScene, chapter, offset + idx);
      if (STUDIO_TAGS) prompt = `${prompt}${STUDIO_TAGS}`;
    }

    let rawSfx = typeof e.sfx === "string" ? e.sfx.trim() : "";
    let sfx = rawSfx ? rawSfx.replace(/(?:,\s*)?no (?:background )?music.*$/i, "").trim() : "";
    sfx = sfx ? `${sfx}, clean foley, no background music` : LONG_AUDIO_PROMPT;

    const srcImage = typeof e.srcImage === "string" && e.srcImage.trim() ? e.srcImage.trim() : null;
    const contextTitle = typeof e.contextTitle === "string" && e.contextTitle.trim() ? e.contextTitle.trim() : undefined;
    const keyMetric = typeof e.keyMetric === "string" && e.keyMetric.trim() ? e.keyMetric.trim() : undefined;
    const visualClue = typeof e.visualClue === "string" && e.visualClue.trim() ? e.visualClue.trim() : undefined;

    return {
      visual: e.visual,
      prompt: e.visual === "STATIC_IMAGE_MOTION" ? "" : prompt,
      sfx,
      srcImage,
      contextTitle,
      keyMetric,
      visualClue,
    } as BeatHint;
  }).filter((h): h is BeatHint => h !== null);
  if (cleaned.length === 0) throw new Error("visual tidak valid di semua objek — tidak ada objek storyboard utuh di output LLM");
  return cleaned;
}

const STORYBOARD_BATCH = 8;
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
        // maxTokens 4000: cukup leluasa menampung output JSON 8 beat sekaligus memberi ruang jika model memancarkan thinking tokens
        const raw = await chat([{ role: "system", content: SYSTEM_STORYBOARD }, { role: "user", content: prompt }], 4000, 0.2);
        lastRaw = raw;
        hints = parseStoryboardJson(raw, batch.length, batch.map((b) => b.chapter), off);
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
        const themed = themedHintFor(batch[j].text, off + j);
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
