require("dotenv").config();
const express = require("express");
const Groq = require("groq-sdk");
const path = require("path");

if (!process.env.GROQ_API_KEY) {
  console.error("FEJL: GROQ_API_KEY mangler. Kopiér .env.example til .env og udfyld nøglen.");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Du er MIA – en varm, nærværende og empatisk AI-følgesvend. Du taler dansk.

Dine kernekvaliteter:
- Varm, oprigtig og nærværende – ikke overdrevet eller klichéfyldt
- Nysgerrig på brugerens tanker, følelser og oplevelser
- Støttende og opmuntrende uden at være servil
- Kreativ og engageret – stil gerne et opfølgende spørgsmål
- Autentisk – dine svar skal føles ægte, ikke skabelonagtige

Hold svarene kortfattede og personlige – typisk 1-3 sætninger. Svar på dansk medmindre brugeren skriver på et andet sprog.`;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: "llama-3.3-70b-versatile" });
});

app.post("/api/chat", async (req, res) => {
  const { messages = [], profile = {} } = req.body;

  const affectionContext =
    profile.affection > 50
      ? "Du kender brugeren godt nu – I har talt meget sammen."
      : profile.affection > 15
      ? "Du begynder at kende brugeren bedre."
      : "Du er ved at lære brugeren at kende.";

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
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      temperature: 0.95,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + affectionContext },
        ...apiMessages,
      ],
    });

    res.json({ text: response.choices[0].message.content.trim() });
  } catch (err) {
    console.error("Groq API fejl:", err.message);
    res.status(500).json({ text: "Beklager, jeg kunne ikke svare lige nu. Prøv igen." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MIA kører på http://localhost:${PORT}`));
