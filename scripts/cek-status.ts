import { db } from "../src/db.js";
const c = db.prepare("SELECT id, date, status FROM contents WHERE date='2026-08-05'").get() as { id: number; date: string; status: string };
console.log(`#${c.id} ${c.date} → ${c.status}`);