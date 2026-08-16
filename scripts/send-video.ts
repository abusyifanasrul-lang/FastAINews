import { sendPreview } from "../src/telegram.js";
import { db, updateContentStatus } from "../src/db.js";
const c = db.prepare("SELECT id FROM contents WHERE date = '2026-08-04'").get() as {id:number};
await sendPreview(c.id);
updateContentStatus(c.id, "PENDING_REVIEW");
console.log("Video preview terkirim #", c.id);
