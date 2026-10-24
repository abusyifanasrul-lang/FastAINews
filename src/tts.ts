import "dotenv/config";
import { writeFileSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Fix Microsoft Edge TTS 403 on cloud runners (synthesize via api.msedgeservices.com)
(MsEdgeTTS as any).getSynthUrl = async function() {
  const req_id = (MsEdgeTTS as any).generateUUID();
  const secMsGEC = await (MsEdgeTTS as any).generateSecMsGec((MsEdgeTTS as any).TRUSTED_CLIENT_TOKEN);
  return `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${(MsEdgeTTS as any).TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${req_id}`;
};

const KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts";
const FALLBACK_MODELS = ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"];
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Algieba";
const EDGE_VOICE = process.env.EDGE_TTS_VOICE ?? "id-ID-GadisNeural";
// utk sinkron cut↔audio: mp3 24kHz sama dgn Gemini (ffprobe durasi presisi)
const EDGE_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

export interface TtsResult {
  audioPath: string;
  durationSec: number;
  provider: "gemini" | "edge";
}

export interface TtsChunksResult extends TtsResult {
  chunkDurations: number[]; // durasi tiap chunk (detik), utk sinkronisasi cut
}

/** Gemini TTS satu segmen → mp3. Return durasi audio. Dilengkapi retry dengan exponential backoff dan fallback model. */
async function synthGemini(text: string, outPath: string, modelName: string = MODEL): Promise<number> {
  if (!KEY) throw new Error("GOOGLE_API_KEY missing (Gemini TTS)");
  
  const maxRetries = 5;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text,
                speech_metadata: {
                  style: "formal Indonesian news anchor, natural Indonesian pronunciation and native Indonesian accent",
                },
              }],
            }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
              },
            },
          }),
        }
      );

      if (res.status === 429 || res.status === 503 || res.status === 502) {
        const waitSec = Math.min(attempt * 5, 20);
        console.warn(`  [tts] Gemini returned ${res.status} (attempt ${attempt}/${maxRetries}), waiting ${waitSec}s backoff...`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
        throw new Error(`Gemini TTS ${res.status}`);
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Gemini TTS HTTP ${res.status}: ${errBody}`);
      }

      const j = await res.json();
      const parts = j.candidates?.[0]?.content?.parts ?? [];
      const audio = parts.find((p: any) => p.inlineData?.data);
      if (!audio) throw new Error("Gemini TTS: tidak ada audio di response");

      const buf = Buffer.from(audio.inlineData.data, "base64");
      const isWav = buf.slice(0, 4).toString("ascii") === "RIFF";
      const rawPath = outPath.replace(/\.mp3$/, isWav ? ".wav" : ".pcm");
      writeFileSync(rawPath, buf);

      // Konversi ke MP3 berkualitas tinggi dengan micro-fade 10ms (smooth zero-crossing)
      // Mencegah letupan klik/pop atau suara distorsi mic di awal/akhir segmen audio
      const ffmpegArgs = ["-y"];
      if (!isWav) {
        ffmpegArgs.push("-f", "s16le", "-ar", "24000", "-ac", "1");
      }
      ffmpegArgs.push(
        "-i", rawPath,
        "-af", "afade=t=in:ss=0:d=0.01,afade=t=out:st=300:d=0.01",
        "-codec:a", "libmp3lame", "-q:a", "2", outPath
      );
      execFileSync("ffmpeg", ffmpegArgs, { stdio: "pipe" });
      rmSync(rawPath, { force: true });
      return parseFloat(
        execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outPath]).toString().trim()
      );
    } catch (err: any) {
      lastErr = err;
      const waitSec = Math.min(attempt * 5, 20);
      if (attempt < maxRetries) {
        console.warn(`  [tts] Gemini attempt ${attempt} error: ${err.message}, waiting ${waitSec}s...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
      } else {
        break;
      }
    }
  }

  throw lastErr ?? new Error("Gemini TTS failed after retries");
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

/** Dispatcher: Gemini dulu, fallback Edge saat quota habis. Kalau keduanya gagal → lempar Error (jangan buat silent audio). */
async function synthSegment(text: string, outPath: string): Promise<{ dur: number; provider: "gemini" | "edge" }> {
  // 1. Coba Gemini model utama
  try {
    const dur = await synthGemini(text, outPath, MODEL);
    return { dur, provider: "gemini" };
  } catch (e: any) {
    console.warn("  [tts] ⚠️ Gemini model utama gagal:", e?.message ?? e, "→ mencoba Gemini fallback models...");
  }

  // 2. Coba Gemini fallback models (flash-tts, preview-tts)
  for (const fbModel of FALLBACK_MODELS) {
    if (fbModel === MODEL) continue;
    try {
      console.log(`  [tts] Mencoba fallback ke model ${fbModel}...`);
      const dur = await synthGemini(text, outPath, fbModel);
      return { dur, provider: "gemini" };
    } catch (e: any) {
      console.warn(`  [tts] ⚠️ Model fallback ${fbModel} gagal:`, e?.message ?? e);
    }
  }

  // 3. Fallback terakhir ke Edge TTS
  try {
    const dur = await synthEdge(text, outPath);
    return { dur, provider: "edge" };
  } catch (e: any) {
    console.error("  [tts] ❌ Edge TTS juga gagal:", (e as Error).message);
    throw new Error(`TTS gagal total untuk teks: "${text.slice(0, 50)}...": ${(e as Error).message}`);
  }
}

/** Naskah → chunk per topik (pola sama dgn buildProps):
 * hook = kalimat pertama; sisanya di-split per colon-publisher.
 */
export function chunkScript(script: string, _size = 1): string[] {
  // First, try splitting by newline and bullet points.
  const lines = script.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // Check if lines start with bullet or number.
  const bulletRegex = /^[-•*]\s+/;
  const numberRegex = /^\d+[\.\)]\s+/;
  const hasBullet = lines.some(l => bulletRegex.test(l) || numberRegex.test(l));
  if (hasBullet) {
    // Each bullet line is a chunk.
    // Keep the first line as hook if it doesn't start with bullet.
    const chunks: string[] = [];
    let current = '';
    for (const line of lines) {
      if (bulletRegex.test(line) || numberRegex.test(line)) {
        if (current) { chunks.push(current.trim()); current = ''; }
        let lineClean = line.replace(/^[-•*]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim();
        // Ganti pelafalan brand asing agar tidak dibaca dengan dialek bahasa Inggris yang aneh
        lineClean = lineClean
          .replace(/\bOpenAI\b/g, "Open A.I.")
          .replace(/\bPony AI\b/g, "Poni A.I.")
          .replace(/\bKimi K3\.1 Pro\b/g, "Kimi K-3 poin 1 Pro")
          .replace(/\bClaude Opus 5\.5\b/g, "Claude Opus 5 poin 5")
          .replace(/\bNvidia\b/g, "En-vidia")
          .replace(/\bMIT Tech Review\b/g, "M.I.T. Tech Review")
          .replace(/\bAI\b/g, "A.I.");
        current = lineClean;
      } else {
        current += (current ? ' ' : '') + line;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks.filter(c => c.length > 0);
  }

  // Fallback: sentence-based detection jika naskah tidak memakai bullet.
  // Batasi chunk maksimal ~180 karakter agar teks tidak meluap di screen dan narasi berirama.
  const sentences = script.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur.length + s.length > 180 || /^[A-Za-zÀ-ÿ][^:]{2,40}:\s/.test(s) || /^\s*(Sementara itu|Terakhir|Di sisi lain|Selanjutnya|Kedua|Ketiga|Berikutnya|Lainnya|Analisis|Peluang|Pertama|Bagi Anda|Jangan lewatkan)[,:]\s/i.test(s))) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += (cur ? " " : "") + s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(c => c.length > 0);
}

/**
 * TTS naskah penuh dalam 1 request audio terpadu:
 * 1. Menghilangkan 100% masalah distorsi klik/pop/mic rusak antar segmen karena audio dihasilkan dalam 1 aliran suara mulus berkesinambungan.
 * 2. Menghilangkan 100% masalah switch model/aksen/dialek di tengah jalan karena seluruh naskah diucapkan oleh model dan persona yang konsisten.
 * 3. Menghindari limit kuota harian (Free Tier 10 RPD) karena hanya mengonsumsi 1 request per video, bukan 9-10 request.
 */
export async function generateTtsChunks(text: string, outDir: string, filename: string): Promise<TtsChunksResult> {
  mkdirSync(outDir, { recursive: true });
  const audioPath = join(outDir, filename);

  // Bersihkan teks dan susun naskah mengalir alami untuk pembacaan lisan
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const cleanedLines = lines.map(line => {
    let l = line.replace(/^[-•*]\s+/, "").replace(/^\d+[\.\)]\s+/, "").trim();
    return l
      .replace(/\bOpenAI\b/g, "Open A.I.")
      .replace(/\bPony AI\b/g, "Poni A.I.")
      .replace(/\bKimi K3\.1 Pro\b/g, "Kimi K-3 poin 1 Pro")
      .replace(/\bClaude Opus 5\.5\b/g, "Claude Opus 5 poin 5")
      .replace(/\bNvidia\b/g, "En-vidia")
      .replace(/\bMIT Tech Review\b/g, "M.I.T. Tech Review")
      .replace(/\bAI\b/g, "A.I.");
  });

  const fullSpeechText = cleanedLines.join("\n\n");
  console.log(`  [tts] Menjalankan sintesis audio utuh (1 request, ${fullSpeechText.length} karakter)...`);

  const { dur: durationSec, provider } = await synthSegment(fullSpeechText, audioPath);
  console.log(`  [tts] Sintesis audio utuh berhasil: ${durationSec.toFixed(2)}s [${provider}]`);

  // Distribusikan timing tiap kartu/chunk secara proporsional sesuai panjang teks
  const chunks = chunkScript(text);
  const totalChars = chunks.reduce((acc, c) => acc + c.length, 0);
  const chunkDurations: number[] = chunks.map(c => {
    return parseFloat(((c.length / totalChars) * durationSec).toFixed(2));
  });

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
