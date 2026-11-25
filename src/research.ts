import Parser from "rss-parser";

export interface NewsItem {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string; // ISO
}

export const RSS_FEEDS = [
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", name: "TechCrunch AI" },
  { url: "https://www.theverge.com/rss/index.xml", name: "The Verge" },
  { url: "https://venturebeat.com/category/ai/feed/", name: "VentureBeat AI" },
  { url: "https://www.wired.com/feed/tag/ai/latest/rss", name: "Wired AI" },
  { url: "https://www.technologyreview.com/feed/", name: "MIT Tech Review" },
  { url: "https://the-decoder.com/feed/", name: "The Decoder" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", name: "Ars Technica" },
  { url: "https://huggingface.co/blog/feed.xml", name: "Hugging Face Blog" },
  // blog resmi lab AI
  { url: "https://openai.com/news/rss.xml", name: "OpenAI Blog" },
  { url: "https://blog.google/technology/ai/rss/", name: "Google AI Blog" },
];

const parser = new Parser();

export async function fetchFeeds(): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Status code ${res.status}`);
      const xml = await res.text();
      const parsed = await parser.parseString(xml);
      const out: NewsItem[] = [];
      for (const item of parsed.items) {
        const title = item.title?.trim();
        const url = item.link;
        if (!title || !url) continue;
        out.push({
          title,
          url,
          publisher: feed.name,
          publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        });
      }
      return out;
    }),
  );
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      items.push(...r.value);
    } else {
      console.warn(`Feed gagal: ${RSS_FEEDS[i].name} — ${(r.reason as Error)?.message ?? r.reason}`);
    }
  }
  return items;
}

/** Filter item yang terbit dalam window (jam) terakhir */
export function filterRecent(items: NewsItem[], hours: number): NewsItem[] {
  const cutoff = Date.now() - hours * 3600_000;
  return items.filter(i => new Date(i.publishedAt).getTime() >= cutoff);
}

/** Deteksi keyword AI relevan */
const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt", "openai",
  "anthropic", "claude", "gemini", "deepmind", "meta ai", "transformer", "neural",
  "model", "chatbot", "agent", "hallucination", "agi", "inference", "fine-tun",
];

export function isAiRelevant(title: string): boolean {
  const t = title.toLowerCase();
  return AI_KEYWORDS.some(k => t.includes(k));
}

/** Hapus duplikat judul (case-insensitive, URL dinormalisasi) */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(i => {
    const norm = i.title.toLowerCase().trim();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

/** Ambil og:image / twitter:image dari halaman artikel, lalu download ke dir */
export async function fetchOgImage(url: string, outPath: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
    const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1];
    const img = og ?? tw;
    if (!img) return null;

    // resolve relative
    const abs = new URL(img, url).toString();
    const imgRes = await fetch(abs, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!imgRes.ok) return null;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    // cek tipe gambar dari content-type / magic bytes
    const ct = imgRes.headers.get("content-type") ?? "";
    let ext = ".jpg";
    if (ct.includes("png")) ext = ".png";
    else if (ct.includes("webp")) ext = ".webp";
    const file = outPath + ext;
    await import("node:fs").then(fs => fs.writeFileSync(file, buf));
    return file;
  } catch {
    return null;
  }
}
