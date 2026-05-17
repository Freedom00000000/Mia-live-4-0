require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const BASE44_API_KEY  = process.env.BASE44_API_KEY || "";
const BASE44_APP_ID   = process.env.BASE44_APP_ID  || "";
const BASE44_CHAT_URL = `https://base44.app/api/apps/${BASE44_APP_ID}/functions/chat`;

if (!BASE44_API_KEY || !BASE44_APP_ID) {
  console.error("FEJL: BASE44_API_KEY og BASE44_APP_ID skal være sat i .env");
  process.exit(1);
}

// ── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ai: "base44", model: "gpt_5_5" });
});

app.post("/api/chat", async (req, res) => {
  const { messages = [], systemPrompt, temperature = 0.95 } = req.body;

  const sys = systemPrompt || "";
  if (!sys) return res.status(400).json({ text: "systemPrompt mangler." });

  const apiMessages = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .slice(-40)
    .map(m => ({ role: m.role, content: m.content || m.text || "" }));

  if (!apiMessages.length || apiMessages[apiMessages.length - 1].role !== "user") {
    return res.status(400).json({ text: "Ingen besked modtaget." });
  }

  try {
    const b44res = await fetch(BASE44_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BASE44_API_KEY}`
      },
      body: JSON.stringify({ messages: apiMessages, systemPrompt: sys, temperature })
    });

    if (!b44res.ok) {
      const body = await b44res.text();
      console.error(`[Base44] ${b44res.status}: ${body}`);
      return res.status(502).json({ text: "Base44 svarede ikke korrekt. Prøv igen." });
    }

    const data = await b44res.json();
    const text = (data.response || data.text || data.result || "").trim();
    if (!text) return res.status(502).json({ text: "Base44 returnerede tomt svar." });

    return res.json({ text, provider: "base44" });
  } catch (err) {
    console.error(`[base44] fejl: ${err.message}`);
    return res.status(500).json({ text: "Kunne ikke nå Base44. Tjek forbindelsen." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MIA kører på http://localhost:${PORT} (AI: base44)`);
});
