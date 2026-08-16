// Upload video ke YouTube (Data API v3, resumable upload)
// Test: npx tsx scripts/test-yt-upload.ts <video-path> <title>
import "dotenv/config";
import { readFileSync } from "node:fs";

async function getAccessToken(): Promise<string> {
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
  if (!j.access_token) throw new Error("Token gagal: " + j.error);
  return j.access_token;
}

const videoPath = process.argv[2];
const title = process.argv[3] ?? "Ainews Test";
if (!videoPath) throw new Error("Usage: test-yt-upload.ts <path> <title>");

const token = await getAccessToken();

// 1. Initiate resumable session
const meta = {
  snippet: {
    title,
    description: "Ringkasan berita AI harian. #AI #Teknologi",
    tags: ["AI", "Teknologi", "Berita", "Artificial Intelligence"],
    categoryId: "28", // Science & Technology
  },
  status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
};
const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": "video/mp4",
    "X-Upload-Content-Length": readFileSync(videoPath).length.toString(),
  },
  body: JSON.stringify(meta),
});
if (!init.ok) {
  console.error("Init gagal:", init.status, await init.text());
  process.exit(1);
}
const uploadUrl = init.headers.get("location");
if (!uploadUrl) throw new Error("Tidak ada upload URL");

// 2. Upload bytes
const video = readFileSync(videoPath);
const up = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "video/mp4", "Content-Length": video.length.toString() },
  body: video,
});
const upJson = await up.json() as { id?: string; error?: { message?: string } };
if (!up.ok || !upJson.id) {
  console.error("Upload gagal:", up.status, JSON.stringify(upJson).slice(0, 400));
  process.exit(1);
}
console.log(`✅ Upload sukses! Video ID: ${upJson.id}`);
console.log(`   https://youtu.be/${upJson.id}`);