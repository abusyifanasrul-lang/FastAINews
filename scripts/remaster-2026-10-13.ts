import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStoryboardMd,
  extractPromptsText,
  extractNarrationsText,
  extractParagraphsText,
  type Chapter,
  type Beat,
} from "../src/long/storyboard.js";
import { themedHintFor } from "../src/long/llm-long.js";
import { renderHookVideo } from "./render-hook.js";

const date = "2026-10-13";
const baseDir = join(process.cwd(), "content", "long", date);

const scriptFile = join(baseDir, "script.md");
const sbFile = join(baseDir, "storyboard.json");

const scriptRaw = readFileSync(scriptFile, "utf8");
const cleanScript = scriptRaw.replace(/^#\s+[^\n]+\n+/, "").trim();

const sbData = JSON.parse(readFileSync(sbFile, "utf8")) as {
  date: string;
  title: string;
  chapters: Chapter[];
  beats: Beat[];
  estTotalSec: number;
};

// Update Beat 1 with high-stakes hook
sbData.beats[0].text =
  "Perang kecerdasan buatan baru saja memasuki babak yang paling agresif: Meta secara mengejutkan meluncurkan model frontier Muse Wonder yang menantang hegemoni model tertutup, sementara di sisi lain Silicon Valley mulai dipaksa membongkar kerahasiaan operasional pusat data mereka.";
sbData.beats[0].prompt =
  "Clean isometric 3D illustration of a futuristic data processor core surrounded by glowing telemetry displays, floating digital cards labeled 'FRONTIER' and 'TRANSPARENCY', mint and slate palette, soft studio lighting.";
sbData.beats[0].contextTitle = "FAST AI NEWS // HOOK INTEL";
sbData.beats[0].keyMetric = "72-Jam Disrupsi Frontier";
sbData.beats[0].visualClue = "Pusat Kendali Telemetri Frontier";
sbData.beats[0].audio.audio_prompt = "futuristic digital riser, low sub-bass hum, clean foley, no background music";

// Enrich all beats with contextTitle, keyMetric, visualClue
for (let i = 0; i < sbData.beats.length; i++) {
  const b = sbData.beats[i];
  const themed = themedHintFor(b.text, i);
  if (!b.contextTitle) b.contextTitle = themed.contextTitle;
  if (!b.keyMetric) b.keyMetric = themed.keyMetric;
  if (!b.visualClue) b.visualClue = themed.visualClue;
}

writeFileSync(sbFile, JSON.stringify(sbData, null, 2), "utf8");
console.log(`[remaster] updated ${sbFile}`);

// Rebuild manifest files
const sbMd = buildStoryboardMd(
  sbData.title,
  date,
  sbData.chapters,
  sbData.beats,
  sbData.estTotalSec || 778,
  431,
);
writeFileSync(join(baseDir, "STORYBOARD.md"), sbMd, "utf8");

const promptsTxt = extractPromptsText(sbData.beats);
writeFileSync(join(baseDir, "prompts.txt"), promptsTxt.trim() + "\n", "utf8");

const narrationsTxt = extractNarrationsText(sbData.beats);
writeFileSync(join(baseDir, "narrations.txt"), narrationsTxt.trim() + "\n", "utf8");

const parasTxt = extractParagraphsText(cleanScript);
writeFileSync(join(baseDir, "paragraphs.txt"), parasTxt.trim() + "\n", "utf8");

console.log("[remaster] Rebuilt STORYBOARD.md, prompts.txt, narrations.txt, paragraphs.txt");

// Re-render Hook Opener
const hookOut = renderHookVideo(date);
console.log(`[remaster] Hook Opener rendered: ${hookOut}`);
