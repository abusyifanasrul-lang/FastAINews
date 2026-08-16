import { getVoices } from "edge-tts";
try {
  const voices = await getVoices();
  const id = voices.filter(v => v.Locale === "id-ID");
  console.log("id-ID voices:", id.length);
  for (const v of id) console.log(`  ${v.ShortName} | ${v.Gender} | ${v.FriendlyName}`);
  const algieba = voices.filter(v => /algieba/i.test(v.ShortName + v.FriendlyName));
  console.log("Algieba:", algieba.map(v => v.ShortName));
} catch (e) {
  console.log("ERR:", (e as Error).message);
}
