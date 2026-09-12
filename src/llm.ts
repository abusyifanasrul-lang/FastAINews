import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { NewsItem } from "./research.js";

const endpoint = process.env.LLM_ENDPOINT;
const apiKey = process.env.LLM_API_KEY;
const endpointFallback = process.env.LLM_ENDPOINT_FALLBACK;
const apiKeyFallback = process.env.LLM_API_KEY_FALLBACK;
const getModel = () => process.env.LLM_MODEL ?? "Hermes";
if (!endpoint) throw new Error("LLM_ENDPOINT missing");

// OpenCode Go (enforced 2026-09-06): API requests must carry a stable
// x-opencode-session per conversation + a real user-agent. Without them
// the vendor rejects with MissingSessionID / "free tier can only be used
// in OpenCode". One UUID per process = one pipeline run = one conversation.
// ponytail: per-day stable ID via file/env if vendor starts requiring
// same-session caching across retries; upgrade when they reject per-run IDs.
const OPENCODE_SESSION_ID = process.env.OPENCODE_SESSION_ID ?? randomUUID();
const OPENCODE_USER_AGENT = process.env.OPENCODE_USER_AGENT ?? "ainews-bot/1.0";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// rate-limit guard: 2 detik antar panggilan
let lastCall = 0;
const MIN_INTERVAL_MS = 2000;
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCall;
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed);
  }
  lastCall = Date.now();
}

export interface LlmMessage { role: "system" | "user"; content: string }

export async function chat(messages: LlmMessage[], maxTokens = 2000, temperature = 0.7): Promise<string> {
  const MAX_RETRIES = 3;

  async function callApi(url: string, token: string, modelName = getModel()): Promise<string> {
    await rateLimit(); // jeda 2 detik antar panggilan
    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-opencode-session": OPENCODE_SESSION_ID,
        "User-Agent": OPENCODE_USER_AGENT,
      },
      body: JSON.stringify({ model: modelName, messages, max_tokens: maxTokens, temperature }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
    }
    const rawText = await res.text();
    let content = "";

    // Deteksi apakah response berupa SSE streaming chunks (data: {...})
    if (rawText.startsWith("data:") || rawText.includes("\ndata:")) {
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") continue;
        try {
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          const chunk = JSON.parse(jsonStr);
          const piece = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? "";
          content += piece;
        } catch {}
      }
    } else {
      // Streaming leak: beberapa proxy menempelkan suffix SSE "data: [DONE]" tepat setelah "}"
      const cleaned = rawText.replace(/data:\s*\[DONE\]\s*$/, "").trim();
      try {
        const data = JSON.parse(cleaned) as { choices: { message: { content: string | null } }[] };
        content = data.choices?.[0]?.message?.content ?? "";
      } catch {}
    }

    if (!content) {
      if (modelName === "Hermes") {
        console.warn("[llm] model Hermes respons kosong, mencoba fallback ke kgw/kilo-auto/free...");
        return callApi(url, token, "kgw/kilo-auto/free");
      }
      throw new Error("LLM: kosong");
    }
    // Strip tag <think>...</think> jika model memancarkan thinking tokens (termasuk tag unclosed saat truncate)
    content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();
    return content;
  }

  async function withRetry(url: string, token: string): Promise<string> {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await callApi(url, token);
      } catch (err) {
        lastErr = err as Error;
        if (attempt < MAX_RETRIES - 1) await sleep(1000 * 2 ** attempt);
      }
    }
    throw lastErr!;
  }

  try {
    return await withRetry(endpoint!, apiKey!);
  } catch (primaryErr) {
    if (!endpointFallback || !apiKeyFallback) throw primaryErr;
    console.warn(`[llm] primary endpoint failed, trying fallback: ${(primaryErr as Error).message}`);
    return withRetry(endpointFallback, apiKeyFallback);
  }
}

/**
 * Validasi dan bersihkan output naskah dari LLM untuk mencegah kebocoran
 * proses berpikir (chain-of-thought/reasoning) dan durasi berlebih.
 */
export function cleanAndValidateScript(raw: string, fallbackTitle: string): { script: string; topicTitle: string } {
  let text = raw.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();

  // Cari posisi baris JUDUL: <judul>
  let topicTitle = fallbackTitle;
  let script = text;

  const titleMatch = text.match(/(?:^|\n)\s*JUDUL:\s*([^\n]+)/i);
  if (titleMatch) {
    topicTitle = titleMatch[1].trim().replace(/^["'*]+|["'*]+$/g, "");
    if (titleMatch.index! < text.length / 2) {
      const titleEndIndex = titleMatch.index! + titleMatch[0].length;
      script = text.slice(titleEndIndex).trim();
    } else {
      script = text.slice(0, titleMatch.index!).trim();
    }
  }

  // Bersihkan markdown fences jika ada
  script = script.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  // Potong teks pengantar/obrolan pembuka sebelum bullet point pertama
  const firstBullet = script.search(/(?:^|\n)\s*[-•*]\s+/);
  if (firstBullet !== -1) {
    script = script.slice(firstBullet).trim();
  }

  // Deteksi sisa reasoning / monologue bahasa Inggris
  const reasoningIndicators = [
    /\bwe need to\b/i,
    /\blet's craft\b/i,
    /\bcount words\b/i,
    /\bcount:\s*\w+\d+/i,
    /\bstructure:\s*\n/i,
    /\bhook line\b/i,
    /\bfact \d+:/i,
  ];
  for (const regex of reasoningIndicators) {
    if (regex.test(script)) {
      throw new Error(`LLM output mengandung reasoning/monolog internal ("${regex.source}"). Script ditolak.`);
    }
  }

  // Validasi bahasa: naskah berita wajib menggunakan Bahasa Indonesia yang wajar
  const indonesianWords = ["yang", "dan", "di", "ini", "untuk", "dengan", "dari", "pada", "adalah", "ke"];
  const lower = script.toLowerCase();
  const matchedCount = indonesianWords.filter(w => new RegExp(`(?:^|[\\s.,!?])${w}(?:$|[\\s.,!?])`, "i").test(lower)).length;
  if (matchedCount < 3) {
    throw new Error(`LLM output terdeteksi bukan Bahasa Indonesia yang valid (hanya ditemukan ${matchedCount} kata penghubung). Script ditolak.`);
  }

  // Validasi panjang karakter (video 45-90s berkisar ~120-220 kata, normal 350-2000 char)
  if (script.length < 250) {
    throw new Error(`LLM output terlalu pendek (${script.length} char < 250 char). Script ditolak.`);
  }
  if (script.length > 2500) {
    throw new Error(`LLM output terlalu panjang (${script.length} char > 2500 char). Script ditolak.`);
  }

  return { script, topicTitle };
}

/**
 * Susun naskah dari daftar sumber berita.
 * prompt guidance: hook→isi→analisis/prediksi→peluang awam→CTA, durasi 45-90 detik, Bahasa Indonesia.
 */
export async function generateScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((i, idx) => `${idx + 1}. [${i.publisher}] ${i.title}\n   ${i.url}`).join("\n");

  const system = `Kamu penulis berita AI Bahasa Indonesia untuk video pendek (45-90 detik saat dibacakan, ~120-220 kata).
Terdapat ${items.length} topik berita. KAMU WAJIB menyebut SEMUA ${items.length} topik dalam naskah — jangan buang satu pun. Tulis secara ringkas dan padat (1-2 kalimat per topik) agar total durasi naskah pas untuk video 45-90 detik.
Struktur wajib:
1. Hook pembuka (1 kalimat, menarik) — singgung topik utama
2. Ringkasan fakta — sebut SEMUA ${items.length} topik, tiap topik 1 kalimat padat dengan nama/publisher diikutkan
3. Analisis/prediksi ke depan (1-2 kalimat)
4. Peluang untuk orang awam (1-2 kalimat, konkret & actionable)
5. CTA penutup (minta subscribe/ikuti)
Bila durasi terasa penuh, prioritaskan kerangka fakta tiap topik tetap ada (boleh ringkas), jangan dihilangkan.
Gunakan Bahasa Indonesia natural, gaya news presenter, tanpa kata "menurut sumber", tanpa markdown, tanpa emoji.
Tulis naskah dengan SETIAP bagian (hook, fakta per topik, analisis, peluang, CTA) pada baris baru, dimulai dengan tanda strip (-) atau bullet (•). Pastikan setiap bagian berada di baris terpisah.
PENTING: sebut tiap topik dengan label jelas (mis. "Di sisi lain, ..." / "Sementara itu, ...") supaya auditor bisa kenali tiap topik. Hanya gunakan fakta dari daftar sumber, jangan halusinasi.
DILARANG KERAS: Jangan menuliskan proses berpikir, analisis internal, coretan perhitungan kata, atau teks bahasa Inggris.
LANGSUNG mulai output pada baris pertama dengan format: JUDUL: <judul topik singkat <=8 kata>`;

  const user = `Daftar sumber berita hari ini:\n${list}\n\nLANGSUNG tulis naskahnya dimulai dengan JUDUL:.`;

  const MAX_ATTEMPTS = 3;
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 900);
      return cleanAndValidateScript(raw, items[0]?.title ?? "Berita AI hari ini");
    } catch (err) {
      lastErr = err as Error;
      console.warn(`[llm] generateScript percobaan ${attempt}/${MAX_ATTEMPTS} gagal: ${lastErr.message}`);
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw lastErr!;
}

/** Generate caption + hashtag untuk posting */
export async function generateCaption(script: string): Promise<{ title: string; caption: string; hashtags: string }> {
  const system = `Buat material posting dari naskah berita AI ini.
Format:
TITLE: <judul YouTube, <=60 char>
CAPTION: <caption menarik 1-3 kalimat untuk IG/TikTok>
HASHTAGS: <10-12 hashtag dipisah spasi, termasuk #AI #Teknologi #BeritaAI dan yang relevan>
Dilarang menyertakan teks pengantar atau proses berpikir. Langsung format di atas.`;
  const raw = await chat([{ role: "system", content: system }, { role: "user", content: script }]);
  const t = raw.match(/^TITLE:\s*(.+)/im);
  const c = raw.match(/^CAPTION:\s*(.+)/im);
  const h = raw.match(/^HASHTAGS:\s*(.+)/im);
  return {
    title: t?.[1]?.trim() ?? "Berita AI Hari Ini",
    caption: c?.[1]?.trim() ?? "",
    hashtags: h?.[1]?.trim() ?? "#AI #Teknologi #BeritaAI",
  };
}

/** Susun ulang naskah berdasarkan catatan revisi reviewer */
export async function generateScriptWithFeedback(
  items: NewsItem[],
  currentScript: string,
  feedback: string
): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((i, idx) => `${idx + 1}. [${i.publisher}] ${i.title}\n   ${i.url}`).join("\n");
  const system = `Kamu penulis berita AI Bahasa Indonesia untuk video pendek (45-90 detik, ~120-220 kata).
Kamu akan merevisi naskah yang sudah ada sesuai catatan reviewer.
Terdapat ${items.length} topik berita. PERTAHANKAN cakupan SEMUA ${items.length} topik — revisi boleh ubah gaya/wording, jangan buang topik.
Struktur tetap: hook → fakta (semua topik) → analisis → peluang awam → CTA.
Bahasa Indonesia natural, gaya news presenter, tanpa markdown, tanpa emoji, tanpa kata "menurut sumber".
PENTING: revisi sesuai catatan reviewer. Tetap hanya gunakan fakta dari sumber.
DILARANG KERAS: Jangan menuliskan proses berpikir, analisis internal, coretan perhitungan kata, atau teks bahasa Inggris.
LANGSUNG mulai output pada baris pertama dengan format: JUDUL: <judul>`;

  const user = `Sumber:\n${list}\n\nNaskah lama:\n${currentScript}\n\nCatatan revisi dari reviewer:\n${feedback}\n\nLANGSUNG tulis naskah revisi dimulai dengan JUDUL:.`;

  const MAX_ATTEMPTS = 3;
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }], 900);
      return cleanAndValidateScript(raw, items[0]?.title ?? "Berita AI hari ini");
    } catch (err) {
      lastErr = err as Error;
      console.warn(`[llm] generateScriptWithFeedback percobaan ${attempt}/${MAX_ATTEMPTS} gagal: ${lastErr.message}`);
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt);
    }
  }
  throw lastErr!;
}