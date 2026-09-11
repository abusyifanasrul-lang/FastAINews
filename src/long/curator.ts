// Kurasi berita 72 jam utk long-form. Reuse fetchFeeds/filterRecent/isAiRelevant/
// dedupe/fetchOgImage dari research.ts; pola pickDiverse + widen tiru pipeline.ts.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchFeeds, filterRecent, isAiRelevant, dedupe, fetchOgImage, type NewsItem } from "../research.js";

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
  const all = await fetchFeeds();
  let unique: NewsItem[] = [];
  let used = hours;
  for (const h of [hours, 96, 120]) {
    unique = dedupe(filterRecent(all, h).filter((i) => isAiRelevant(i.title)));
    if (unique.length >= 3) { used = h; break; }
    used = h;
  }
  console.log(`[long-curator] ${unique.length} relevan AI dalam ${used}h`);
  const top = pickDiverse(unique, 7);
  const imgDir = join(process.cwd(), "content", "long", day, "images");
  mkdirSync(imgDir, { recursive: true });
  const images = await Promise.all(top.map(async (s, i) => fetchOgImage(s.url, join(imgDir, `src${i + 1}`))));
  console.log(`[long-curator] ${images.filter(Boolean).length}/${top.length} gambar terdownload`);
  return { date: day, items: top, images };
}
