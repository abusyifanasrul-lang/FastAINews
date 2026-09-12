import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fetchFeeds, filterRecent, isAiRelevant, dedupe, fetchOgImage, type NewsItem } from "../research.js";
import { getRecentContentsForLong } from "../db.js";

export interface CuratedLong { date: string; items: NewsItem[]; images: (string | null)[] }

function pickDiverse<T extends { publisher: string }>(items: T[], count: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const it of items) if (!seen.has(it.publisher) && out.length < count) { out.push(it); seen.add(it.publisher); }
  for (const it of items) { if (out.length >= count) break; if (!out.includes(it)) out.push(it); }
  return out;
}

export async function curateLongNews(hours = 72, date?: string): Promise<CuratedLong> {
  const day = date ?? new Date().toISOString().slice(0, 10);
  
  // 1. Ambil berita 72 jam dari SQLite database jika ada
  const dbContents = getRecentContentsForLong(3, day);
  const dbItems: NewsItem[] = [];
  for (const row of dbContents) {
    for (const s of row.sources) {
      if (s.title && s.url) {
        dbItems.push({
          title: s.title,
          url: s.url,
          publisher: s.publisher ?? "AI Tech",
          publishedAt: s.published_at ?? row.content.created_at,
        });
      }
    }
  }

  let candidates = dedupe(dbItems.filter((i) => isAiRelevant(i.title)));
  console.log(`[long-curator] ${candidates.length} berita dari database SQLite (edisi <= ${day})`);

  // 2. Jika database kurang dari 5 topik, augment atau fallback dengan RSS live
  if (candidates.length < 5) {
    try {
      const allRss = await fetchFeeds();
      let rssItems: NewsItem[] = [];
      for (const h of [hours, 96, 120]) {
        rssItems = dedupe(filterRecent(allRss, h).filter((i) => isAiRelevant(i.title)));
        if (rssItems.length >= 3) break;
      }
      console.log(`[long-curator] menambah ${rssItems.length} berita dari RSS live`);
      candidates = dedupe([...candidates, ...rssItems]);
    } catch (e) {
      console.warn("[long-curator] RSS fallback gagal:", (e as Error).message);
    }
  }

  const top = pickDiverse(candidates, 7);
  console.log(`[long-curator] terpilih ${top.length} topik utama kurasi`);

  // 3. Unduh OG images fresh ke folder edisi dan kembalikan path relatif
  const imgDir = join(process.cwd(), "content", "long", day, "images");
  mkdirSync(imgDir, { recursive: true });
  const rawImages = await Promise.all(top.map(async (s, i) => fetchOgImage(s.url, join(imgDir, `src${i + 1}`))));
  
  const relImages = rawImages.map((absPath) => {
    if (!absPath) return null;
    return relative(process.cwd(), absPath).replace(/\\/g, "/");
  });

  console.log(`[long-curator] ${relImages.filter(Boolean).length}/${top.length} gambar tersimpan di content/long/${day}/images/`);
  return { date: day, items: top, images: relImages };
}
