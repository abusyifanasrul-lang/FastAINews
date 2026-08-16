// Test msedge-tts: suara Indonesia + output format + durasi
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { writeFileSync } from "node:fs";

const tts = new MsEdgeTTS();
await tts.setMetadata("id-ID-GadisNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
const { audioFilePath } = await tts.toFile("C:/Users/K4G3/ainews-bot/content/edge-test-dir", "Tes suara Edge TTS untuk berita AI harian. Ini kalimat kedua.");
console.log("file:", audioFilePath);
