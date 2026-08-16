// Verifikasi alignment: chunkScript count vs cut count buildProps
import { chunkScript } from "../src/tts.js";
import { db } from "../src/db.js";
const c = db.prepare("SELECT script_text FROM contents WHERE date='2026-08-05'").get() as { script_text: string };
const sentences = c.script_text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
console.log("total kalimat:", sentences.length);
console.log("chunk size 3 →", chunkScript(sentences.slice(1).join(" ")).length, "body chunk (cut body)");
console.log("chunk size 2 →", chunkScript(sentences.slice(1).join(" "), 2).length, "body chunk");
// simulasi durasi chunk
const sizes = [3, 2];
for (const s of sizes) {
  const chunks = chunkScript(sentences.slice(1).join(" "), s);
  const totalChar = chunks.reduce((a, x) => a + x.length, 0);
  console.log(`\nsize ${s}: ${chunks.length} chunk, total ${totalChar} char, rata-rata ${Math.round(totalChar / chunks.length)} char/chunk`);
}