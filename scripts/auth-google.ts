// Auth Google OAuth (YouTube Data API v3) — dapatkan refresh token sekali
// Jalankan: npx tsx scripts/auth-google.ts
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT = "http://localhost"; // dari client JSON (installed app)

if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("GOOGLE_CLIENT_ID/SECRET belum di .env");

// 1. Buat auth URL
const params = new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: "https://www.googleapis.com/auth/youtube.upload",
  access_type: "offline",
  prompt: "consent",
});
const authUrl = `https://accounts.google.com/o/oauth2/auth?${params}`;
console.log("\n1. Buka URL ini di browser (login akun Google kamu):\n");
console.log(authUrl);
console.log("\n2. Setelah approve, browser redirect ke http://localhost/?code=...");
console.log("   Salin SELURUH URL dari address bar (atau nilai code=).\n");

// 2. Minta user paste URL/code
import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise<string>(res => rl.question("Tempel URL redirect di sini: ", res));
rl.close();

const code = new URL(answer).searchParams.get("code");
if (!code) throw new Error("Tidak ada code= di URL. Coba lagi.");

// 3. Tukar code → refresh token
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const tokenJson = await tokenRes.json() as { refresh_token?: string; access_token?: string; error?: string };
if (!tokenJson.refresh_token) {
  console.error("Gagal dapat refresh token:", JSON.stringify(tokenJson).slice(0, 300));
  process.exit(1);
}

// 4. Simpan ke .env
const envPath = process.cwd() + "/.env";
const env = readFileSync(envPath, "utf8");
const updated = env.includes("YT_REFRESH_TOKEN=")
  ? env.replace(/YT_REFRESH_TOKEN=.*/g, `YT_REFRESH_TOKEN=${tokenJson.refresh_token}`)
  : env + `\nYT_REFRESH_TOKEN=${tokenJson.refresh_token}\n`;
writeFileSync(envPath, updated);

console.log("\n✅ Refresh token tersimpan di .env (YT_REFRESH_TOKEN).");
console.log("   Siap lanjut ke script upload YouTube.");