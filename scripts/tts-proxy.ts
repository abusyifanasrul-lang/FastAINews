import "dotenv/config";
const endpoint = process.env.LLM_ENDPOINT, key = process.env.LLM_API_KEY;
for (const path of ["/audio/speech", "/v1/audio/speech"]) {
  try {
    const res = await fetch(`${endpoint}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "Hermes", input: "Selamat pagi, ini tes suara.", voice: "alloy" }),
    });
    const ct = res.headers.get("content-type") ?? "";
    console.log(`${path} → ${res.status} ${ct} len=${ (await res.arrayBuffer()).byteLength}`);
  } catch (e) {
    console.log(`${path} → ERR ${(e as Error).message}`);
  }
}
