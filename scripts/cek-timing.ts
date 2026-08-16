// Verifikasi timing cut vs chunk audio (sinkron presisi)
import { db } from "../src/db.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const outDir = join(process.cwd(), "content", "2026-08-05");
const durs: number[] = JSON.parse(readFileSync(join(outDir, "chunk-durations.json"), "utf8"));
const dur = durs.reduce((a, b) => a + b, 0);
console.log("chunk audio durations:", durs.map(d => d.toFixed(2)).join(", "));
console.log("total audio:", dur.toFixed(2), "s");
// cut timing = cumulative
let t = 0;
durs.forEach((d, i) => {
  console.log(`cut ${i + 1}: ${t.toFixed(2)}s → ${(t + d).toFixed(2)}s (dur ${d.toFixed(2)}s)`);
  t += d;
});