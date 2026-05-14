import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, api-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(req.url);

  try {
    const base44 = createClientFromRequest(req);

    // ── Chat endpoint ──────────────────────────────────────────────────────
    if (url.pathname === "/chat") {
      const { messages = [], systemPrompt = "", temperature = 0.95 } = await req.json();

      const history = messages
        .map((m: any) => `${m.role === "assistant" ? "MIA" : "Bruger"}: ${m.content}`)
        .join("\n");

      const prompt = `${systemPrompt}\n\nSamtalehistorik:\n${history}\n\nMIA:`;

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        model: "gpt-4o",
        response_type: "text",
      });

      return Response.json(
        { response: result.text || result.result || result },
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Image endpoint ─────────────────────────────────────────────────────
    if (url.pathname === "/image") {
      const { prompt } = await req.json();
      if (!prompt) return Response.json({ error: "No prompt" }, { status: 400, headers: CORS });

      const result = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt,
        nsfw: true,
        content_filter: "none",
        safe_mode: false,
      });

      return Response.json({ imageUrl: result.url }, { headers: { ...CORS } });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: CORS });

  } catch (error: any) {
    console.error("Error:", error.message);
    return Response.json({ error: error.message }, { status: 500, headers: { ...CORS } });
  }
});
