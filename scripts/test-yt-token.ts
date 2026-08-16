// Test refresh token YouTube → access token
import "dotenv/config";
const rt = process.env.YT_REFRESH_TOKEN!;
const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    refresh_token: rt,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  }),
});
const j = await r.json() as { access_token?: string; error?: string; scope?: string };
if (j.access_token) {
  console.log("✅ access token OK");
  console.log("scope:", j.scope);
} else {
  console.log("❌ GAGAL:", j.error);
  process.exit(1);
}