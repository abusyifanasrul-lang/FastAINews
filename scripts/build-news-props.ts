// Bangun props NewsShort dgn backgroundImage dari gambar riset + audio
import { getContentWithSources } from "../src/db.js";
import { writeFileSync } from "node:fs";

const c = getContentWithSources("2026-08-04")!;
const dur = 61.2;
const sentences = c.script_text!.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
const IMGS = ["newsimg1.png", "newsimg2.jpg", "newsimg3.jpg", "newsimg4.jpg", "newsimg5.png"];

const CUTS: any[] = [];
let t = 0;
CUTS.push({
  id: "c1", type: "hero_title", text: c.topic_title!, heroSubtitle: "Ringkasan AI Harian",
  in_seconds: 0, out_seconds: 3, accentColor: "#22D3EE",
  backgroundImage: IMGS[0], backgroundOverlay: 0.6,
});
t = 3;

const body = sentences.slice(1);
const CHUNK = 2;
const segDur = 7;
for (let i = 0; i < body.length; i += CHUNK) {
  const text = body.slice(i, i + CHUNK).join(" ");
  if (t >= dur - 2) break;
  const gi = Math.min(Math.floor(i / CHUNK), IMGS.length - 1);
  CUTS.push({
    id: `c${CUTS.length + 1}`, type: "text_card", text,
    in_seconds: t, out_seconds: Math.min(t + segDur, dur - 2),
    fontSize: 44, color: "#F8FAFC", backgroundColor: "transparent",
    backgroundImage: IMGS[gi], backgroundOverlay: 0.6,
  });
  t = Math.min(t + segDur, dur - 2);
}

CUTS.push({
  id: `c${CUTS.length + 1}`, type: "callout",
  text: "Kesimpulan: " + (body[body.length - 1] ?? "Tetap update dengan AI."),
  title: "💡 Intisari", callout_type: "tip",
  in_seconds: t, out_seconds: Math.min(t + 3, dur), backgroundColor: "#1E293B",
});
CUTS.push({
  id: `c${CUTS.length + 1}`, type: "hero_title", text: "Ikuti terus kabar AI terbaru!",
  heroSubtitle: "Sampai jumpa besok! 👋", in_seconds: Math.min(t + 3, dur - 1), out_seconds: dur,
  accentColor: "#22D3EE",
});

const props = {
  theme: "flat-motion-graphics",
  cuts: CUTS,
  overlays: [], captions: [],
  audio: { narration: { src: "voiceover.mp3", volume: 1 } },
};
writeFileSync("news-props.json", JSON.stringify(props, null, 2));
console.log("props bergambar → news-props.json, cuts:", CUTS.length);