import { db } from "../src/db.js";
const c = db.prepare("SELECT id, date, topic_title, script_text FROM contents WHERE date='2026-08-04'").get() as { id: number; date: string; topic_title: string | null; script_text: string | null } | undefined;
if (!c?.script_text) { console.log("tak ada naskah"); process.exit(0); }
const sources = db.prepare("SELECT title, publisher FROM sources WHERE content_id=?").all(c.id) as { title: string; publisher: string }[];
console.log(`Konten #${c.id} — ${c.date}`);
console.log(`Topic title: ${c.topic_title}`);
console.log(`Jumlah sumber: ${sources.length}`);
console.log("--- SUMBER (salah satu = topik) ---");
sources.forEach((s, i) => console.log(`  ${i+1}. [${s.publisher}] ${s.title}`));
console.log("--- NASKAH (${c.script_text.split(/[.!?]/).filter(x=>x.trim()).length} kalimat) ---");
console.log(c.script_text);
console.log("--- CEK sebutan tiap sumber di naskah (samakan kata kunci) ---");
for (const s of sources) {
  const kws = s.title.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 4);
  const hit = kws.filter(k => c.script_text!.toLowerCase().includes(k)).length;
  console.log(`  [${s.publisher}] "${s.title.slice(0,35)}..." → ${hit}/${kws.length} keyword cocok: ${hit>=2?"BAHAS":"???"}`);
}