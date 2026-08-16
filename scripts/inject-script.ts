import { db, getContentWithSources, updateContentStatus } from "../src/db.js";
import { sendPreview } from "../src/telegram.js";

const date = new Date().toISOString().slice(0, 10);
const c = getContentWithSources(date);
if (!c) throw new Error("konten tidak ada");

const script = `Halo! Selamat pagi, ini berita AI hari ini.
Palantir baru saja mengumumkan hasil kuartal yang luar biasa. Pendapatan naik tajam, dan CEO Alex Karp menyebut industri AI sedang mengalami semacam kegilaan — bahkan ia menyebutnya "Marxist" karena harga saham yang melambung tinggi.
Yang menarik: ini jadi sinyal bahwa ledakan AI masih sangat nyata, dan investor berlomba-lomba mengejar perusahaan yang paling diuntungkan dari tren ini.
Tapi hati-hati, analis mengingatkan valuasi yang tinggi bisa berarti risiko besar jika pertumbuhan melambat.
Jangan lupa subscribe untuk update berita AI setiap pagi!`;

db.prepare("UPDATE contents SET script_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(script, c.id);
updateContentStatus(c.id, "NASKAH_READY");
await sendPreview(c.id);
updateContentStatus(c.id, "PENDING_REVIEW");
console.log(`Naskah disimpan & preview #${c.id} dikirim ulang (dengan naskah).`);
