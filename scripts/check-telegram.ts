import "dotenv/config";
const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN kosong");

const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
console.log("getMe:", me.ok ? `OK — @${me.result.username} (id ${me.result.id})` : JSON.stringify(me));

const upd = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=1`).then(r => r.json());
if (upd.ok && upd.result.length > 0) {
  const u = upd.result[0];
  console.log("update terbaru:", JSON.stringify(u).slice(0, 400));
} else {
  console.log("getUpdates: belum ada update. Kirim /start ke bot @pegawainj1_bot dulu, lalu jalankan ulang script ini.");
}
