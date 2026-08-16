import { getContentWithSources } from "../src/db.js";
const c = getContentWithSources(new Date().toISOString().slice(0, 10));
if (!c) { console.log("kosong"); process.exit(0); }
console.log(`id=${c.id} status=${c.status}`);
console.log("topik:", c.topic_title);
console.log("sumber:");
for (const s of c.sources) console.log(`  - [${s.publisher}] ${s.title.slice(0, 70)}`);
console.log("\nnaskah (awal 300):", (c.script_text ?? "").slice(0, 300));
