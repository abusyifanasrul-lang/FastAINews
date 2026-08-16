// Tukar authorization code → refresh token, simpan ke .env
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const CODE = process.argv[2];
if (!CODE) throw new Error("Usage: npx tsx scripts/exchange-code.ts <authorization-code>");

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: CODE,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: "http://localhost",
    grant_type: "authorization_code",
  }),
});
const j = await res.json() as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };
if (!j.refresh_token) {
  console.error("Gagal:", JSON.stringify(j).slice(0, 400));
  process.exit(1);
}
const envPath = process.cwd() + "/.env";
const env = readFileSync(envPath, "utf8");
const updated = env.includes("YT_REFRESH_TOKEN=")
  ? env.replace(/YT_REFRESH_TOKEN=.*/g, `YT_REFRESH_TOKEN=${j.refresh_token}`)
  : env + `\nYT_REFRESH_TOKEN=${j.refresh_token}\n`;
writeFileSync(envPath, updated);
console.log("✅ Refresh token tersimpan di .env");