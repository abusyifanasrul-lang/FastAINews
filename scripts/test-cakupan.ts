// Test: regenerasi naskah #3 dgn prompt baru + cek cakupan 5 topik
import { generateScript } from "../src/llm.js";
import { db } from "../src/db.js";

const sources = db.prepare("SELECT title, url, publisher, published_at FROM sources WHERE content_id=?").all(3) as { title: string; url: string; publisher: string; published_at: string }[];
const items = sources.map(s => ({ title: s.title, url: s.url, publisher: s.publisher, publishedAt: s.published_at }));

const { script, topicTitle } = await generateScript(items);
console.log("JUDUL:", topicTitle);
console.log("--- NASKAH ---");
console.log(script);
console.log("--- CEK CAKUPAN ---");
const low = script.toLowerCase();
for (const s of sources) {
  const kws = s.title.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 4);
  const hit = kws.filter(k => low.includes(k)).length;
  console.log(`  [${s.publisher}] "${s.title.slice(0, 32)}..." → ${hit}/${kws.length} keyword${hit >= 1 ? " ✓" : " ❌ GAGAL"}`);
}