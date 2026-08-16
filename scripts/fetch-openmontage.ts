// Ambil remotion-composer dari OpenMontage via GitHub API → ainews-bot/vendor-openmontage
// (bukan git clone; repo penuh terlalu besar & clone berulang gagal/block)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = "calesthio/OpenMontage";
const TREE = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
const PREFIX = "remotion-composer/";

const res = await fetch(TREE, { headers: { "User-Agent": "hermes-agent" } });
if (!res.ok) throw new Error(`tree ${res.status}`);
const tree = await res.json();
const files = tree.tree.filter((t: any) => t.type === "blob" && t.path.startsWith(PREFIX));
console.log("file count (remotion-composer):", files.length);

const BASE = "https://raw.githubusercontent.com";
const dest = join(process.cwd(), "vendor-openmontage");
let n = 0;
for (const f of files) {
  const rel = f.path.slice(PREFIX.length);
  const out = join(dest, rel);
  mkdirSync(join(dest, rel.split("/").slice(0, -1).join("/")), { recursive: true });
  const raw = await fetch(`${BASE}/${REPO}/main/${f.path}`, { headers: { "User-Agent": "hermes-agent" } });
  if (!raw.ok) { console.log("  SKIP (gagal):", rel, raw.status); continue; }
  const buf = Buffer.from(await raw.arrayBuffer());
  // jangan ambil package-lock besar kalau sudah ada? ambil semua kecuali diabaikan
  writeFileSync(out, buf);
  n++;
}
console.log("download OK:", n, "files →", dest);