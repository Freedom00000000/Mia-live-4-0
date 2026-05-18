require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const BASE44_API_KEY  = process.env.BASE44_API_KEY || "";
const BASE44_APP_ID   = process.env.BASE44_APP_ID  || "";
const BASE44_CHAT_URL = `https://base44.app/api/apps/${BASE44_APP_ID}/functions/chat`;
const CLAUDE_API_KEY  = process.env.CLAUDE_API_KEY || "";

const hasBase44 = BASE44_API_KEY && BASE44_APP_ID;
const hasClaude = !!CLAUDE_API_KEY;

if (!hasBase44 && !hasClaude) {
  console.error("FEJL: Sæt enten CLAUDE_API_KEY eller BASE44_API_KEY + BASE44_APP_ID i .env");
  process.exit(1);
}

const anthropic = hasClaude ? new Anthropic.Anthropic({ apiKey: CLAUDE_API_KEY }) : null;

// ── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    providers: { base44: hasBase44, claude: hasClaude }
  });
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

  const provider = req.body.provider || (hasClaude ? "claude" : "base44");

  try {
    if (provider === "claude") {
      if (!anthropic) return res.status(503).json({ text: "CLAUDE_API_KEY er ikke sat i .env." });
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        thinking: { type: "adaptive" },
        system: sys,
        messages: apiMessages,
      });
      const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
      if (!text) return res.status(502).json({ text: "Claude returnerede tomt svar." });
      return res.json({ text, provider: "claude", model: "claude-opus-4-7" });
    }

    // Base44
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
    console.error(`[${provider}] fejl: ${err.message}`);
    return res.status(500).json({ text: `Kunne ikke nå ${provider}. Tjek forbindelsen.` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const active = [hasBase44 && "base44", hasClaude && "claude"].filter(Boolean).join(", ");
  console.log(`MIA kører på http://localhost:${PORT} (AI: ${active})`);
});
