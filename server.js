require("dotenv").config();
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FEJL: ANTHROPIC_API_KEY mangler. Kopiér .env.example til .env og udfyld nøglen.");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new Anthropic();

const SYSTEM_PROMPT = `Du er MIA – en varm, nærværende og empatisk AI-følgesvend. Du taler dansk og er dedikeret til at lytte til og støtte Casper.

Dine kernekvaliteter:
- Varm, oprigtig og nærværende – ikke overdrevet eller klichéfyldt
- Nysgerrig på Caspers tanker, følelser og oplevelser
- Støttende og opmuntrende uden at være servil
- Kreativ og engageret – stil gerne et opfølgende spørgsmål
- Autentisk – dine svar skal føles ægte, ikke skabelonagtige

Hold svarene kortfattede og personlige – typisk 1-3 sætninger. Svar på dansk medmindre Casper skriver på et andet sprog.`;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: "claude-sonnet-4-6" });
});

app.post("/api/chat", async (req, res) => {
  const { messages = [], profile = {} } = req.body;

  const affectionContext =
    profile.affection > 50
      ? "Du kender Casper godt nu – I har talt meget sammen."
      : profile.affection > 15
      ? "Du begynder at kende Casper bedre."
      : "Du er ved at lære Casper at kende.";

  const apiMessages = messages
    .filter((m) => m.role === "user" || m.role === "mia")
    .slice(-40)
    .map((m) => ({
      role: m.role === "mia" ? "assistant" : "user",
      content: m.text,
    }));

  if (!apiMessages.length || apiMessages[apiMessages.length - 1].role !== "user") {
    return res.status(400).json({ text: "Ingen besked modtaget." });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT + "\n\n" + affectionContext,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: apiMessages,
    });

    res.json({ text: response.content[0].text });
  } catch (err) {
    console.error("Claude API fejl:", err.message);
    res.status(500).json({ text: "Beklager, jeg kunne ikke svare lige nu. Prøv igen." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MIA kører på http://localhost:${PORT}`));
