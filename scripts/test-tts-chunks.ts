// Test TTS per-chunk dgn naskah #4
import { generateTtsChunks } from "../src/tts.js";
import { db } from "../src/db.js";
import { join } from "node:path";
const c = db.prepare("SELECT script_text FROM contents WHERE date='2026-08-05'").get() as { script_text: string };
const outDir = join(process.cwd(), "content", "2026-08-05");
const { audioPath, durationSec, chunkDurations } = await generateTtsChunks(c.script_text, outDir, "voiceover.mp3");
console.log("\ntotal:", durationSec.toFixed(2), "s");
console.log("chunks:", chunkDurations.map(d => d.toFixed(2)).join(", "));