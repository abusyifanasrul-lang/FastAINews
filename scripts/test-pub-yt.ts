// Test publishToYouTube nyata via publisher.ts
import { publishToYouTube } from "../src/publisher.js";
import { db } from "../src/db.js";
const c = db.prepare("SELECT id FROM contents WHERE date='2026-08-04'").get() as { id: number };
const r = await publishToYouTube(c.id);
console.log(JSON.stringify(r, null, 2));