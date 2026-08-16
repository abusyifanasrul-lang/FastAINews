// Cek news-props.json (dihasilkan renderVideos) — struktur cut + title
import { readFileSync } from "node:fs";
const p = JSON.parse(readFileSync("news-props.json", "utf8"));
console.log("cuts:", p.cuts.length);
p.cuts.forEach((c: any) => console.log(`  ${c.id} [${c.type}] title="${c.title ?? "-"}" in=${c.in_seconds} out=${c.out_seconds} bg=${c.backgroundImage ?? "none"}`));