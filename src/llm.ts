import "dotenv/config";
import type { NewsItem } from "./research.js";

const endpoint = process.env.LLM_ENDPOINT;
const apiKey = process.env.LLM_API_KEY;
const endpointFallback = process.env.LLM_ENDPOINT_FALLBACK;
const apiKeyFallback = process.env.LLM_API_KEY_FALLBACK;
const model = process.env.LLM_MODEL ?? "Hermes";
if (!endpoint) throw new Error("LLM_ENDPOINT missing");

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface LlmMessage { role: "system" | "user"; content: string }

async function chat(messages: LlmMessage[], maxTokens = 2000): Promise<string> {
  const MAX_RETRIES = 3;

  async function callApi(url: string, token: string): Promise<string> {
    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LLM ${res.status}: ${body.slice(0, 300)}`);
    }
    const rawText = await res.text();
    // Streaming leak: beberapa proxy menempelkan suffix SSE "data: [DONE]" tepat setelah "}"
    const cleaned = rawText.replace(/data:\s*\[DONE\]\s*$/, "").trim();
    const data = JSON.parse(cleaned) as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM: kosong");
    return content.trim();
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
 * Susun naskah dari daftar sumber berita.
 * prompt guidance: hook→isi→analisis/prediksi→peluang awam→CTA, durasi 45-90 detik, Bahasa Indonesia.
 */
export async function generateScript(items: NewsItem[]): Promise<{ script: string; topicTitle: string }> {
  const list = items.map((i, idx) => `${idx + 1}. [${i.publisher}] ${i.title}\n   ${i.url}`).join("\n");

  const system = `Kamu penulis berita AI Bahasa Indonesia untuk video pendek (45-90 detik saat dibacakan, ~120-220 kata).
Terdapat ${items.length} topik berita. KAMU WAJIB menyebut SEMUA ${items.length} topik dalam naskah — jangan buang satu pun. Alokasikan kata merata ke tiap topik (≈${Math.max(20, Math.round(140 / items.length))} kata per topik).
Struktur wajib:
1. Hook pembuka (1 kalimat, menarik) — singgung topik utama
2. Ringkasan fakta — sebut SEMUA ${items.length} topik, tiap topik 1 kalimat padat dengan nama/publisher diikutkan
3. Analisis/prediksi ke depan (1-2 kalimat)
4. Peluang untuk orang awam (1-2 kalimat, konkret & actionable)
5. CTA penutup (minta subscribe/ikuti)
Bila durasi terasa penuh, prioritaskan kerangka fakta tiap topik tetap ada (boleh ringkas), jangan dihilangkan.
Gunakan Bahasa Indonesia natural, gaya news presenter, tanpa kata "menurut sumber", tanpa markdown, tanpa emoji.
PENTING: sebut tiap topik dengan label jelas (mis. "Di sisi lain, ..." / "Sementara itu, ...") supaya auditor bisa kenali tiap topik. Hanya gunakan fakta dari daftar sumber, jangan halusinasi.
Berikan judul topik singkat (<=8 kata) di baris pertama dengan format: JUDUL: <judul>`;

  const user = `Daftar sumber berita hari ini:\n${list}\n\nTulis naskahnya.`;

  const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }]);

  // parse judul dari baris pertama
  const m = raw.match(/^JUDUL:\s*(.+)\n?/i);
  const topicTitle = m?.[1]?.trim() ?? items[0]?.title ?? "Berita AI hari ini";
  const script = m ? raw.slice(m[0].length).trim() : raw.trim();

  return { script, topicTitle };
}

/** Generate caption + hashtag untuk posting */
export async function generateCaption(script: string): Promise<{ title: string; caption: string; hashtags: string }> {
  const system = `Buat material posting dari naskah berita AI ini.
Format:
TITLE: <judul YouTube, <=60 char>
CAPTION: <caption menarik 1-3 kalimat untuk IG/TikTok>
HASHTAGS: <10-12 hashtag dipisah spasi, termasuk #AI #Teknologi #BeritaAI dan yang relevan>`;
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
Berikan judul di baris pertama format: JUDUL: <judul>`;
  const user = `Sumber:\n${list}\n\nNaskah lama:\n${currentScript}\n\nCatatan revisi dari reviewer:\n${feedback}\n\nTulis naskah revisi.`;
  const raw = await chat([{ role: "system", content: system }, { role: "user", content: user }]);
  const m = raw.match(/^JUDUL:\s*(.+)\n?/i);
  const topicTitle = m?.[1]?.trim() ?? items[0]?.title ?? "Berita AI hari ini";
  const script = m ? raw.slice(m[0].length).trim() : raw.trim();
  return { script, topicTitle };
}