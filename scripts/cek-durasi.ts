// cek panjang naskah baru vs durasi target (45-90s, ~770 char)
import { generateScript } from "../src/llm.js";
import { db } from "../src/db.js";
const sources = db.prepare("SELECT title,url,publisher,published_at FROM sources WHERE content_id=?").all(3) as { title:string;url:string;publisher:string;published_at:string }[];
const items = sources.map(s=>({title:s.title,url:s.url,publisher:s.publisher,publishedAt:s.published_at}));
const { script } = await generateScript(items);
const chars = script.length;
const words = script.trim().split(/\s+/).length;
// ~13-15 char/detik, ~11 kata/detik baca
console.log(`panjang: ${chars} char, ${words} kata`);
console.log(`estimasi baca: ${(chars/13).toFixed(0)}-${(chars/15).toFixed(0)}s (target 45-90s)`);