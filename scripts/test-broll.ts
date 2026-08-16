// Test broll: fetch 2 klip utk topic AI + robot
import { fetchBroll } from "../src/broll.js";
import { mkdirSync } from "node:fs";
const outDir = "./content/broll-test";
mkdirSync(outDir, { recursive: true });
const clips = await fetchBroll([
  { query: "artificial intelligence", duration: 6 },
  { query: "robot technology", duration: 5 },
], outDir);
console.log("\n=== hasil ===");
clips.forEach(c => console.log(c.file, c.query, c.duration));