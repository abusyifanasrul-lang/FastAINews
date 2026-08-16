const endpoint = "http://localhost:20128/v1", key = "sk-f7ea650cd0fb7d88-cm8sdj-343f5520", model = "Hermes";
const res = await fetch(`${endpoint}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
  body: JSON.stringify({ model, messages: [{ role: "user", content: "balas satu kata: OK" }], max_tokens: 20 }),
});
console.log("status", res.status);
const j = await res.json();
console.log("choices:", JSON.stringify(j.choices?.[0]?.message?.content));
if (j.error) console.log("err:", JSON.stringify(j.error));
