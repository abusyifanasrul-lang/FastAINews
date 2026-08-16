import "dotenv/config";
import { writeFileSync } from "node:fs";
const KEY = process.env.GOOGLE_API_KEY!;
const model = "gemini-3.1-flash-tts-preview";
const base = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

const res = await fetch(`${base}:generateContent?key=${KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Selamat pagi, ini tes suara." }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Algieba" } },
      },
    },
  }),
});
console.log("status:", res.status);
const j = await res.json();
if (!res.ok) { console.log("err:", JSON.stringify(j.error).slice(0, 300)); process.exit(1); }
const parts = j.candidates?.[0]?.content?.parts ?? [];
for (const p of parts) {
  if (p.inlineData?.data) {
    writeFileSync("content/gemini-tts-algieba.wav", Buffer.from(p.inlineData.data, "base64"));
    console.log("wav tersimpan:", p.inlineData.mimeType, "len:", p.inlineData.data.length);
  } else console.log("part:", JSON.stringify(p).slice(0, 150));
}