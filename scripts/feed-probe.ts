import { RSS_FEEDS, fetchFeeds, filterRecent, isAiRelevant, dedupe } from "../src/research.js";
const all = await fetchFeeds();
console.log("per-feed dalam 48h, relevan AI, unique:");
const byPub = new Map<string, number>();
for (const f of RSS_FEEDS) {
  const rec = filterRecent(all.filter(i=>i.publisher===f.name), 48);
  const ai = rec.filter(i=>isAiRelevant(i.title));
  console.log(`  ${f.name}: ${rec.length} dalam48h, ${ai.length} AI-relevan`);
}
const recent = filterRecent(all, 48).filter(i=>isAiRelevant(i.title));
const uniq = dedupe(recent);
console.log("\ntotal AI unik dalam 48h:", uniq.length);
uniq.slice(0,12).forEach(i=>console.log(" -", i.publisher, "|", i.title.slice(0,70)));
