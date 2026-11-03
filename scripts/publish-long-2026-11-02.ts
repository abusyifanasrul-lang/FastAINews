import "dotenv/config";
import { existsSync, statSync, openSync, readSync, closeSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const date = "2026-11-02";
const videoPath = join(process.cwd(), "content", "long", date, `FastAINews-Long-${date}.mp4`);
// Gunakan thumbnail 01_workstation_night atau 02_compute_campus
const thumbPath = join(process.cwd(), "content", "long", date, "images", "01_workstation_night.jpg");

if (!existsSync(videoPath)) {
  console.error(`Video ${videoPath} tidak ditemukan!`);
  process.exit(1);
}

const chapters = [
  { title: "Intro & Tesis Utama: Kedaulatan Manusia vs Kontrol AI", startSec: 0 },
  { title: "OpenAI Compute Campuses: Krisis Energi & Monopoli Infrastruktur", startSec: 51 },
  { title: "Investigasi Wired: Halusinasi Chatbot & Ancaman Fisik Pendaki", startSec: 100 },
  { title: "Adobe Photoshop Agent: Dari Operator Tombol ke Konseptor Sistem", startSec: 147 },
  { title: "AI Tamagotchi ESP32: Bukti Kemenangan Inovasi Solo Builder", startSec: 194 },
  { title: "OpenAI Web Preferences: Perang Kedaulatan Data & Kontrol Bot", startSec: 243 },
  { title: "Riset MIT: Menghitung Biaya Ekologis & Emisi Karbon Agen AI", startSec: 287 },
  { title: "Kesenjangan Sosial: Ledakan Valuasi vs Kecemasan Tenaga Kerja", startSec: 334 },
  { title: "Sintesis Industri: Menavigasi Benturan Komputasi dan Regulasi", startSec: 380 },
  { title: "Langkah Tindakan Nyata & Epilog Diskusi Komunitas", startSec: 424 }
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const chapterLines = chapters.map(c => `${formatTime(c.startSec)} ${c.title}`).join("\n");

const title = "Revolusi AI: Komputasi Fisik, Krisis Navigasi, & Disrupsi Agen Kreatif | FastAI News";
const description = `Revolusi AI: Komputasi Fisik, Krisis Navigasi, dan Disrupsi Agen Kreatif

Analisis mendalam 72 jam perkembangan industri kecerdasan buatan: dari rencana OpenAI membangun kampus komputasi fisik multi-gigawatt, investigasi bahaya halusinasi navigasi chatbot di alam liar, lompatan agen otonom Adobe Photoshop, terobosan hardware open-source AI Tamagotchi ESP32, hingga audit jejak ekologis dari MIT.

⏱ Chapters:
${chapterLines}

Sumber & Liputan Berita:
- Wired: Chatbot Navigation Hallucinations
- The Verge: Open Source AI Tamagotchi & Hardware Agents
- MIT Technology Review: Environmental Cost of Autonomous Agents
- TechCrunch AI: Corporate AI Disruption & Workforce Gap
- OpenAI Policy & Research

#FastAINews #ArtificialIntelligence #OpenAI #Adobe #TechNews #MachineLearning #HardwareAI #MIT`;

async function getGoogleAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: process.env.YT_REFRESH_TOKEN!,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const j = await r.json() as { access_token?: string; error?: string };
  if (!j.access_token) throw new Error(`Google token gagal: ${j.error}`);
  return j.access_token;
}

async function uploadToYouTube(): Promise<string> {
  const token = await getGoogleAccessToken();
  const meta = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 4900),
      tags: ["AI", "Teknologi", "Berita", "Artificial Intelligence", "FastAI News", "OpenAI", "Machine Learning"],
      categoryId: "28", // Science & Technology
    },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };

  const size = statSync(videoPath).size;
  console.log(`[upload] Menginisialisasi resumable upload (${(size / (1024 * 1024)).toFixed(1)} MB)...`);

  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": size.toString(),
    },
    body: JSON.stringify(meta),
  });

  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube: tidak ada upload URL");

  console.log(`[upload] Mengunggah file dalam chunk 8MB...`);
  const CHUNK = 8 * 1024 * 1024;
  const fd = openSync(videoPath, "r");
  try {
    let offset = 0;
    const buf = Buffer.alloc(CHUNK);
    while (offset < size) {
      const n = readSync(fd, buf, 0, Math.min(CHUNK, size - offset), offset);
      if (n <= 0) throw new Error(`YouTube upload: baca file gagal di offset ${offset}`);
      const chunk = buf.subarray(0, n);
      let lastErr = "";
      for (let attempt = 1; attempt <= 3; attempt++) {
        const up = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(n),
            "Content-Range": `bytes ${offset}-${offset + n - 1}/${size}`,
          },
          body: chunk,
          // @ts-ignore duplex wajib utk body stream/Buffer di undici
          duplex: "half",
        });

        if (up.status === 308) {
          const pct = Math.round(((offset + n) / size) * 100);
          process.stdout.write(`\r[upload] Progres: ${pct}% (${((offset + n) / (1024 * 1024)).toFixed(1)}/${(size / (1024 * 1024)).toFixed(1)} MB)`);
          break;
        }

        const upJson = await up.json() as { id?: string; error?: { message?: string } };
        if (up.ok && upJson.id) {
          console.log(`\n[upload] Video berhasil diunggah! Video ID: ${upJson.id}`);
          // Set thumbnail
          if (existsSync(thumbPath)) {
            try {
              console.log("[upload] Mengunggah thumbnail custom...");
              const imgBuf = readFileSync(thumbPath);
              const tRes = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${upJson.id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
                body: imgBuf,
              });
              console.log(tRes.ok ? "[upload] Thumbnail custom berhasil diset!" : `[upload] Set thumbnail gagal: ${tRes.status}`);
            } catch (tErr) {
              console.warn("[upload] Thumbnail error:", tErr);
            }
          }
          return upJson.id;
        }

        lastErr = `YouTube upload ${up.status}: ${JSON.stringify(upJson).slice(0, 300)}`;
        console.warn(`\n[upload] chunk @${offset} percobaan ${attempt}/3 gagal: ${lastErr}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }

      if (offset + n >= size) throw new Error(lastErr || "YouTube upload: chunk terakhir tanpa id");
      offset += n;
    }
    throw new Error("Loop selesai tanpa return ID");
  } finally {
    closeSync(fd);
  }
}

async function main() {
  try {
    const ytId = await uploadToYouTube();
    console.log(`\n🎉 PUBLISH SUKSES!`);
    console.log(`URL Video: https://youtu.be/${ytId}`);

    // Update database sqlite via Python helper
    execFileSync("python", ["-c", `
import sqlite3
conn = sqlite3.connect('C:/Users/K4G3/FastAINews/content/ainews.db')
c = conn.cursor()
c.execute("UPDATE long_contents SET youtube_id=?, duration_sec=?, status='PUBLISHED', updated_at=CURRENT_TIMESTAMP WHERE date=?", ('${ytId}', 469, '${date}'))
conn.commit()
conn.close()
print('Database ainews.db updated successfully!')
`]);

    // Send Telegram
    const token = process.env.BOT_TOKEN;
    const chat = process.env.OWNER_CHAT_ID;
    if (token && chat) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: `🎉 Video Long-Form ${date} BERHASIL TERBIT DI YOUTUBE!\n\n📌 ${title}\n⏱ Durasi: 7.8 menit (469s)\n🎬 10 Chapters Semantik + Motion Graphics HyperFrames 14s + Ticker Subtitle\n🔗 Tonton di YouTube: https://youtu.be/${ytId}`,
        }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error("[main] Gagal publish:", e);
    process.exit(1);
  }
}

main();
