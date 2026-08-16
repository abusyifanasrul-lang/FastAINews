import { getContentWithSources } from "../src/db.js";
const c = getContentWithSources(new Date().toISOString().slice(0,10));
if (!c) { console.log("kosong"); process.exit(0); }
console.log(`id=${c.id} status=${c.status}`);
console.log("topik:", c.topic_title);
console.log("sumber:", c.sources.length, c.sources.map(s=>s.publisher).join(", "));
