import { generateTts } from "../src/tts.js";
import { getContentWithSources } from "../src/db.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const date = new Date().toISOString().slice(0, 10);
const c = getContentWithSources(date);
if (!c || !c.script_text) throw new Error("tidak ada konten/naskah hari ini");

const outDir = join(process.cwd(), "content", date);
mkdirSync(outDir, { recursive: true });

const { audioPath, durationSec } = await generateTts(c.script_text, outDir, "voiceover.mp3");
console.log("TTS OK:", audioPath, `(${durationSec.toFixed(1)}s)`);