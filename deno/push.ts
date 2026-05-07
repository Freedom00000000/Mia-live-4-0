// Deno Deploy – MIA push notification sender
// Receives POST { user_id, message } from the MIA frontend
// Fetches the push subscription from Base44, sends Web Push

import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const VAPID_PUBLIC  = "zcBVudmCzHM-YOIAotsUs8zN3zdb1JyuUB7aCHrsFozKelusJoEOrnY2m2hRx51mHVGW4Gh30bEgG8UkdNv4YQ";
const VAPID_PRIVATE = "JY3dLnV17jY-4ZTW49EDgZ45pOPm-h_tT0aoHIk5u4o";
const VAPID_SUBJECT = "mailto:mia@freedom.dk";
const B44_APP_ID    = "69f8dd2a6d51679ed4906dd2";

// ── VAPID JWT signing ─────────────────────────────────────────────────────────

function b64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function parseB64url(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

async function makeVapidJwt(audience: string): Promise<string> {
  const header  = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 3600, sub: VAPID_SUBJECT
  })));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    (() => {
      const raw = parseB64url(VAPID_PRIVATE);
      // wrap in PKCS8 header for P-256
      const prefix = new Uint8Array([0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20]);
      const der = new Uint8Array(prefix.length + raw.length);
      der.set(prefix); der.set(raw, prefix.length);
      return der.buffer;
    })(),
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  ));
  return `${header}.${payload}.${b64url(sig)}`;
}

// ── Send one Web Push ─────────────────────────────────────────────────────────

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<boolean> {
  try {
    const url      = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt      = await makeVapidJwt(audience);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type":  "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Authorization": `vapid t=${jwt},k=${VAPID_PUBLIC}`,
        "TTL": "86400"
      },
      body: new TextEncoder().encode(payload)
    });
    return res.status < 300 || res.status === 410;
  } catch (_) { return false; }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")   return new Response("Method Not Allowed", { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const { user_id, message, title } = await req.json();
    if (!user_id || !message) return Response.json({ error: "missing fields" }, { status: 400, headers: cors });

    // Fetch subscription from Base44
    const rows = await base44.asServiceRole.entities.PushSubscription.filter({ user_id });
    if (!rows.length) return Response.json({ sent: 0 }, { headers: cors });

    const payload = JSON.stringify({ title: title || "MIA 💜", body: message });
    let sent = 0;
    for (const row of rows) {
      const ok = await sendPush({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, payload);
      if (ok) sent++;
    }
    return Response.json({ sent }, { headers: cors });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers: cors });
  }
});
