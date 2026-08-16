import { db } from "../src/db.js";
import { generateScript } from "../src/llm.js";

const rows = db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = 3 AND title NOT LIKE 'Sumber%'").all() as { title: string; url: string; publisher: string | null }[];
const items = rows.map(r => ({ title: r.title, url: r.url, publisher: r.publisher ?? "unknown", publishedAt: new Date().toISOString() }));

console.log(`Mengirim ${items.length} sumber ke LLM...`);
const { script, topicTitle } = await generateScript(items);
console.log("=== JUDUL ===");
console.log(topicTitle);
console.log("=== NASKAH ===");
console.log(script.slice(0, 1200));
console.log("...");
console.log("panjang:", script.length, "char");
