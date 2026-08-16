import { getVoices } from "edge-tts";
const voices = await getVoices();
const v = voices.filter(x => /algieba/i.test(x.ShortName));
console.log("Algieba:", v.length);
for (const x of v) console.log(`  ${x.ShortName} | ${x.Locale} | ${x.Gender} | ${x.FriendlyName}`);
