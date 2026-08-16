import "dotenv/config";
import { sendPreview } from "../src/telegram.js";
import { db } from "../src/db.js";

const c = db.prepare("SELECT id FROM contents WHERE date='2026-08-04'").get() as { id: number };
await sendPreview(c.id);
console.log("Preview OpenMontage terkirim #", c.id);