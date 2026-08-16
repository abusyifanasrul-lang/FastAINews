import "dotenv/config";
import { writeFileSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Algieba";
const EDGE_VOICE = process.env.EDGE_TTS_VOICE ?? "id-ID-GadisNeural";
// utk sinkron cut↔audio: mp3 24kHz sama dgn Gemini (ffprobe durasi presisi)
const EDGE_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

export interface TtsResult {
  audioPath: string;
  durationSec: number;
  provider: "gemini" | "edge" | "silent";
}

export interface TtsChunksResult extends TtsResult {
  chunkDurations: number[]; // durasi tiap chunk (detik), utk sinkronisasi cut
}

/** Gemini TTS satu segmen → mp3. Return durasi audio. Retry 429 w/ backoff. */
let geminiDown = false; // sekali 429/error → sisa chunk pakai Edge

/** Gemini TTS satu segmen → mp3. Return durasi audio. */
async function synthGemini(text: string, outPath: string): Promise<number> {
  if (!KEY) throw new Error("GOOGLE_API_KEY missing (Gemini TTS)");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      }),
    }
  );
  if (res.status === 429 || !res.ok) {
    throw new Error(`Gemini TTS ${res.status}`);
  }
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const audio = parts.find((p: any) => p.inlineData?.data);
  if (!audio) throw new Error("Gemini TTS: tidak ada audio di response");

  const rawPath = outPath.replace(/\.mp3$/, ".pcm");
  writeFileSync(rawPath, Buffer.from(audio.inlineData.data, "base64"));
  execFileSync("ffmpeg", [
    "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", rawPath,
    "-codec:a", "libmp3lame", "-q:a", "4", outPath,
  ], { stdio: "pipe" });
  return parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outPath]).toString().trim()
  );
}

/** Edge neural TTS (free, fallback saat Gemini quota habis). */
async function synthEdge(text: string, outPath: string): Promise<number> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(EDGE_VOICE, EDGE_FORMAT);
  const dir = outPath.replace(/\.mp3$/, "");
  mkdirSync(dir, { recursive: true });
  const { audioFilePath } = await tts.toFile(dir, text);
  // pindah hasil ke outPath final
  rmSync(outPath, { force: true });
  renameSync(audioFilePath, outPath);
  return parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outPath]).toString().trim()
  );
}

/** Dispatcher: Gemini dulu, fallback Edge saat quota habis. Kalau keduanya gagal → silent chunk. */
async function synthSegment(text: string, outPath: string): Promise<{ dur: number; provider: "gemini" | "edge" | "silent" }> {
  if (!geminiDown) {
    try {
      const dur = await synthGemini(text, outPath);
      return { dur, provider: "gemini" };
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("503") || msg.includes("502")) {
        console.log("  [tts] ⚠️ Gemini error → fallback Edge TTS");
        geminiDown = true;
      } else if (msg.includes("GOOGLE_API_KEY")) {
        geminiDown = true;
      } else {
        throw e;
      }
    }
  }
  try {
    const dur = await synthEdge(text, outPath);
    return { dur, provider: "edge" };
  } catch (e: any) {
    console.warn("  [tts] ⚠️ Edge TTS juga gagal:", (e as Error).message, "→ silent chunk");
    // generate silent audio (1 detik per 50 char) supaya timeline tetap jalan
    const silentDur = Math.max(1, Math.ceil(text.length / 50));
    execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", `anullsrc=r=24000:cl=mono`, "-t", String(silentDur), "-c:a", "libmp3lame", "-q:a", "4", outPath], { stdio: "pipe" });
    return { dur: silentDur, provider: "silent" };
  }
}

/** Naskah → chunk per topik (pola sama dgn buildProps):
 * hook = kalimat pertama; sisanya di-split per colon-publisher.
 */
export function chunkScript(script: string, _size = 1): string[] {
  const sentences = script.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  const hook = sentences[0] ?? "";
  const rest = sentences.slice(1).join(" ");
  const chunks: string[] = [hook];
  let cur = "";
  for (const s of rest ? rest.split(/(?<=[.!?])\s+/) : []) {
    const isTopicStart = /^[A-Za-zÀ-ÿ][^:]{2,40}:\s/.test(s) || /^\s*(Sementara itu|Terakhir|Di sisi lain)[,:]\s/.test(s);
    if (isTopicStart && cur) { chunks.push(cur.trim()); cur = ""; }
    cur += (cur ? " " : "") + s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(c => c.length > 0);
}

/**
 * TTS per chunk — durasi tiap chunk presisi (sinkron cut↔audio).
 * Tiap chunk: generateTts() terpisah → concat semua jadi voiceover.mp3.
 */
export async function generateTtsChunks(text: string, outDir: string, filename: string): Promise<TtsChunksResult> {
  mkdirSync(outDir, { recursive: true });
  const audioPath = join(outDir, filename);
  const chunks = chunkScript(text);

  const chunkFiles: string[] = [];
  const chunkDurations: number[] = [];
  let provider: "gemini" | "edge" = "gemini";
  for (let i = 0; i < chunks.length; i++) {
    const file = join(outDir, `chunk-${i + 1}.mp3`);
    const { dur, provider: p } = await synthSegment(chunks[i], file);
    if (p === "edge") provider = "edge";
    // trim leading/trailing silence so duration reflects actual speech
    const trimmedFile = join(outDir, `chunk-${i + 1}-trimmed.mp3`);
    execFileSync("ffmpeg", [
      "-y", "-i", file,
      "-af", "silenceremove=stop_periods=-1:stop_duration=0.05:stop_threshold=-40dB",
      trimmedFile,
    ], { stdio: "pipe" });
    const trimmedDur = parseFloat(
      execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", trimmedFile]).toString().trim()
    );
    chunkFiles.push(trimmedFile);
    chunkDurations.push(trimmedDur);
    console.log(`  [tts] chunk ${i + 1}/${chunks.length} [${p}]: ${trimmedDur.toFixed(2)}s (raw ${dur.toFixed(2)}s, ${chunks[i].length} char)`);
    // jaga rate limit Gemini (fallback Edge otomatis kalau kena) — delay kecil
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // concat semua chunk → voiceover.mp3 (ffmpeg concat, re-encode utk konsistensi)
  const listFile = join(outDir, "chunks.txt");
  writeFileSync(listFile, chunkFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "libmp3lame", "-q:a", "4", audioPath], { stdio: "pipe" });

  const durationSec = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath]).toString().trim()
  );
  // simpan timing chunk utk buildProps (video.ts) — sinkron cut↔audio
  writeFileSync(join(outDir, "chunk-durations.json"), JSON.stringify(chunkDurations));
  return { audioPath, durationSec, chunkDurations, provider };
}

// kompat mundur: satu segmen penuh
export async function generateTts(text: string, outDir: string, filename: string): Promise<TtsResult> {
  mkdirSync(outDir, { recursive: true });
  const audioPath = join(outDir, filename);
  const { dur: durationSec, provider } = await synthSegment(text, audioPath);
  return { audioPath, durationSec, provider };
}
