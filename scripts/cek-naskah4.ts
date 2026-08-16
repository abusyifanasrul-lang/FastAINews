import { db } from "../src/db.js";
const c = db.prepare("SELECT topic_title, script_text FROM contents WHERE date='2026-08-05'").get() as { topic_title: string; script_text: string } | undefined;
if (!c) { console.log("tak ada"); process.exit(0); }
const sources = db.prepare("SELECT publisher, title FROM sources WHERE content_id=(SELECT id FROM contents WHERE date='2026-08-05')").all() as { publisher: string; title: string }[];
console.log("Judul:", c.topic_title);
console.log("Sumber:", sources.length);
sources.forEach((s, i) => console.log(`  ${i + 1}. [${s.publisher}] ${s.title.slice(0, 50)}`));
console.log("\nNaskah:\n" + c.script_text.slice(0, 1200));