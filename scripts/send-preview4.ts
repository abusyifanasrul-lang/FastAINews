// Kirim preview #4 ke Telegram (render selesai, preview belum terkirim)
import { sendPreview } from "../src/telegram.js";
import { db } from "../src/db.js";
const c = db.prepare("SELECT id, video_169_path, video_916_path FROM contents WHERE date='2026-08-05'").get() as { id: number; video_169_path: string | null; video_916_path: string | null };
console.log("video_916:", c.video_916_path);
console.log("video_169:", c.video_169_path);
await sendPreview(c.id);
console.log("Preview #4 terkirim");