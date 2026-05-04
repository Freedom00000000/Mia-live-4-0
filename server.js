require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const BASE44_API_KEY    = process.env.BASE44_API_KEY    || "";
const BASE44_SUBDOMAIN  = process.env.BASE44_SUBDOMAIN  || "";
const GROQ_API_KEY      = process.env.GROQ_API_KEY      || "";

if (!BASE44_API_KEY && !GROQ_API_KEY) {
  console.warn("ADVARSEL: Hverken BASE44_API_KEY eller GROQ_API_KEY er sat — Pollinations bruges som fallback.");
}

// ── Base44 InvokeLLM ────────────────────────────────────────────────────────
async function callBase44(systemPrompt, apiMessages) {
  if (!BASE44_API_KEY || !BASE44_SUBDOMAIN) throw new Error("Base44 ikke konfigureret");

  const history = apiMessages
    .map(m => `${m.role === "assistant" ? "MIA" : "Bruger"}: ${m.content}`)
    .join("\n");

  const fullPrompt = `${systemPrompt}\n\nSamtalehistorik:\n${history}\n\nMIA:`;

  const res = await fetch(`https://${BASE44_SUBDOMAIN}.base44.app/api/functions/invoke-llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": BASE44_API_KEY },
    body: JSON.stringify({ prompt: fullPrompt, model: "gpt-4o", response_type: "text" })
  });

  if (!res.ok) throw new Error(`Base44 ${res.status}`);
  const data = await res.json();
  return (data.result || data.text || "").trim();
}

// ── Groq ────────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, apiMessages) {
  if (!GROQ_API_KEY) throw new Error("Groq ikke konfigureret");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.95,
      messages: [{ role: "system", content: systemPrompt }, ...apiMessages]
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── Pollinations (gratis, ingen nøgle) ─────────────────────────────────────
async function callPollinations(systemPrompt, apiMessages) {
  const res = await fetch("https://api.pollinations.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai-large",
      max_tokens: 300,
      temperature: 0.95,
      private: true,
      messages: [{ role: "system", content: systemPrompt }, ...apiMessages]
    })
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    ai: BASE44_API_KEY && BASE44_SUBDOMAIN ? "base44" : GROQ_API_KEY ? "groq" : "pollinations"
  });
});

app.post("/api/chat", async (req, res) => {
  const { messages = [], profile = {}, systemPrompt } = req.body;

  const sys = systemPrompt || "";
  if (!sys) return res.status(400).json({ text: "systemPrompt mangler." });

  const apiMessages = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(-40)
    .map(m => ({ role: m.role, content: m.content || m.text || "" }));

  if (!apiMessages.length || apiMessages[apiMessages.length - 1].role !== "user") {
    return res.status(400).json({ text: "Ingen besked modtaget." });
  }
  if (!groq) {
    return res.status(503).json({ text: "Groq ikke konfigureret." });
  }

  // Prøv Base44 → Groq → Pollinations i rækkefølge
  const providers = [
    { name: "base44",      fn: () => callBase44(sys, apiMessages) },
    { name: "groq",        fn: () => callGroq(sys, apiMessages) },
    { name: "pollinations",fn: () => callPollinations(sys, apiMessages) },
  ];

  for (const { name, fn } of providers) {
    try {
      const text = await fn();
      if (text) {
        console.log(`[AI] svarede via ${name}`);
        return res.json({ text, provider: name });
      }
    } catch (err) {
      console.warn(`[AI] ${name} fejlede: ${err.message}`);
    }
  }

  res.status(500).json({ text: "Beklager, jeg kunne ikke svare. Prøv igen." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const ai = BASE44_API_KEY && BASE44_SUBDOMAIN ? "Base44" : GROQ_API_KEY ? "Groq" : "Pollinations";
  console.log(`MIA kører på http://localhost:${PORT} (AI: ${ai})`);
});
