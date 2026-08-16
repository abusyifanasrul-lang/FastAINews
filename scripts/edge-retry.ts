import { tts } from "edge-tts";
import { writeFileSync } from "node:fs";

// tes: suara Ardi (male) + rate pelan
for (const rate of ["+0%", "-15%"]) {
  try {
    const buf = await tts("Selamat pagi, ini tes suara laki-laki Ardi.", { voice: "id-ID-ArdiNeural", rate });
    writeFileSync(`content/edge-test-${rate.replace(/[+%]/g, "")}.mp3`, buf);
    console.log(`OK rate=${rate} size=${buf.length}`);
  } catch (e) {
    console.log(`FAIL rate=${rate}: ${(e as Error).message.slice(0, 80)}`);
  }
}
