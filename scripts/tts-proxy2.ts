import "dotenv/config";
const endpoint = process.env.LLM_ENDPOINT, key = process.env.LLM_API_KEY;
const res = await fetch(`${endpoint}/audio/speech`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
  body: JSON.stringify({ model: "Hermes", input: "tes", voice: "alloy" }),
});
console.log(await res.text());
