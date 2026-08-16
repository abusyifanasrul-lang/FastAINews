// Test props #4 dgn chunk size 1 → lihat title + count
import { chunkScript } from "../src/tts.js";
import { db } from "../src/db.js";
const c = db.prepare("SELECT script_text FROM contents WHERE date='2026-08-05'").get() as { script_text: string };
const chunks = chunkScript(c.script_text, 1);
console.log("chunks (size 1):", chunks.length);
const sources = db.prepare("SELECT publisher FROM sources WHERE content_id=(SELECT id FROM contents WHERE date='2026-08-05')").all() as { publisher: string }[];
console.log("sources:", sources.length);
chunks.forEach((ch, i) => {
  const label = sources[i]?.publisher ?? `Poin ${i + 1}`;
  console.log(`  ${i + 1}. [${label}] ${ch.slice(0, 40)}`);
});