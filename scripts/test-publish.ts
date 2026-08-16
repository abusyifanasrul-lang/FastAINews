import { publishAll } from "../src/publisher.js";
import { db } from "../src/db.js";
const c = db.prepare("SELECT id FROM contents WHERE date='2026-08-04'").get() as { id: number };
const r = await publishAll(c.id);
console.log("allOk:", r.allOk);
for (const p of r.results) console.log(`${p.platform}: ${p.ok ? "OK " + p.url : "FAIL " + p.error}`);