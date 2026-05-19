require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const INSTANTID_BASE_URL = (process.env.INSTANTID_BASE_URL || "https://instantid.info").replace(/\/+$/, "");

const AI_PROVIDER     = process.env.AI_PROVIDER || "base44";
const BASE44_API_KEY  = process.env.BASE44_API_KEY || "";
const BASE44_APP_ID   = process.env.BASE44_APP_ID  || "";
const BASE44_CHAT_URL = `https://base44.app/api/apps/${BASE44_APP_ID}/functions/chat`;
const OLLAMA_URL      = process.env.OLLAMA_URL   || "http://localhost:11434";
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || "llama3";

if (AI_PROVIDER === "base44" && (!BASE44_API_KEY || !BASE44_APP_ID)) {
  console.error("FEJL: BASE44_API_KEY og BASE44_APP_ID skal være sat i .env (eller sæt AI_PROVIDER=ollama)");
  process.exit(1);
}

// ── Routes ──────────────────────────────────────────────────────────────────

// InstantID authentication proxy
app.post("/api/instantid/login", async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email og adgangskode kræves." });
  }

  try {
    // Fetch the login page first to get the CSRF token and session cookie
    const pageRes = await fetch(`${INSTANTID_BASE_URL}/login`, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; MIA/4.0)"
      }
    });

    const html = await pageRes.text();
    const rawCookies = pageRes.headers.getSetCookie ? pageRes.headers.getSetCookie() : [];
    const cookieHeader = rawCookies.map(c => c.split(";")[0]).join("; ");

    // Extract Laravel CSRF token from meta tag or hidden input
    const csrfMatch = html.match(/name="_token"\s+value="([^"]+)"/) ||
                      html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    // Submit login form
    const loginRes = await fetch(`${INSTANTID_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/html, */*",
        "Cookie": cookieHeader,
        "Referer": `${INSTANTID_BASE_URL}/login`,
        "User-Agent": "Mozilla/5.0 (compatible; MIA/4.0)",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: new URLSearchParams({
        email,
        password,
        _token: csrfToken,
        ...(remember ? { remember: "on" } : {})
      }).toString(),
      redirect: "manual"
    });

    const status = loginRes.status;

    // Successful login usually redirects away from /login
    if (status === 302 || status === 301 || status === 303) {
      const location = loginRes.headers.get("location") || "";
      if (!location.endsWith("/login") && !location.includes("login?")) {
        return res.json({ ok: true });
      }
      return res.json({ ok: false, error: "Forkert email eller adgangskode." });
    }

    // Some apps return JSON errors
    if (status === 200 || status === 422) {
      const body = await loginRes.text();
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (_) {}

      if (parsed) {
        const msg = parsed.message || parsed.error || "";
        if (parsed.ok === false || msg) {
          return res.json({ ok: false, error: msg || "Forkert email eller adgangskode." });
        }
        if (parsed.ok === true) return res.json({ ok: true });
      }

      if (body.includes("credentials do not match") || body.includes("These credentials")) {
        return res.json({ ok: false, error: "Forkert email eller adgangskode." });
      }
      if (body.includes("too many login") || body.includes("throttl")) {
        return res.json({ ok: false, error: "For mange forsøg. Vent lidt og prøv igen." });
      }
    }

    return res.json({ ok: false, error: "Login mislykkedes. Tjek dine oplysninger og prøv igen." });
  } catch (err) {
    console.error("[InstantID] Login fejl:", err.message);
    return res.status(500).json({ ok: false, error: "Kunne ikke forbinde til InstantID. Prøv igen." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ai: AI_PROVIDER, model: AI_PROVIDER === "ollama" ? OLLAMA_MODEL : "gpt_5_5" });
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

  const provider = req.body.provider || AI_PROVIDER;

  try {
    if (provider === "ollama") {
      const ollamaMessages = [{ role: "system", content: sys }, ...apiMessages];
      const ollamaRes = await fetch(`${OLLAMA_URL.replace(/\/+$/, "")}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages: ollamaMessages, temperature, stream: false })
      });
      if (!ollamaRes.ok) {
        const body = await ollamaRes.text();
        console.error(`[Ollama] ${ollamaRes.status}: ${body}`);
        return res.status(502).json({ text: `Ollama svarede ikke (${ollamaRes.status}). Er 'ollama serve' kørt?` });
      }
      const data = await ollamaRes.json();
      const text = (data.choices?.[0]?.message?.content || "").trim();
      if (!text) return res.status(502).json({ text: "Ollama returnerede tomt svar." });
      return res.json({ text, provider: "ollama", model: OLLAMA_MODEL });
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
    return res.status(500).json({ text: `Kunne ikke nå ${provider}. ${provider === "ollama" ? "Tjek at 'ollama serve' kører." : "Tjek forbindelsen."}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MIA kører på http://localhost:${PORT} (AI: ${AI_PROVIDER}${AI_PROVIDER === "ollama" ? ` / ${OLLAMA_MODEL}` : ""})`);
});
