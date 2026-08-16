import { db } from "../src/db.js";
const rows = db.prepare("SELECT title, url, publisher FROM sources WHERE content_id = 3").all() as { title: string; url: string; publisher: string }[];
console.log("total:", rows.length);
for (const r of rows) console.log(`[${r.publisher}] ${r.title.slice(0, 55)}\n  ${r.url}`);