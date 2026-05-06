import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { prompt } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'No prompt' }, { status: 400 });
    }

    const result = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: prompt,
      nsfw: true,
      content_filter: "none",
      safe_mode: false
    });

    return Response.json(
      { imageUrl: result.url },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );

  } catch (error: any) {
    console.error("Deno Error:", error.message);
    return Response.json(
      { error: error.message },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      }
    );
  }
});
