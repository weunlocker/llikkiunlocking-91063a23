// Issues a short-lived signed challenge token for the Free Check flow.
// Bound to the requesting client's IP + Origin to prevent reuse from other sites/clients.

const ALLOWED_ORIGINS = [
  "https://likkiunlocking.com",
  "https://www.likkiunlocking.com",
  "https://llikkiunlocking.lovable.app",
];
const ALLOWED_SUFFIXES = [".lovable.app", ".lovableproject.com", ".lovable.dev"];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const h = new URL(origin).hostname;
    return ALLOWED_SUFFIXES.some((s) => h.endsWith(s));
  } catch { return false; }
}

function corsFor(origin: string | null): Record<string, string> {
  const allow = isAllowedOrigin(origin) ? origin! : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-secret";
const TTL_MS = 30_000; // 30s validity

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return b64url(sig);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsFor(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const exp = Date.now() + TTL_MS;
    // bind to ip + origin so a stolen token can't be replayed from another client/site
    const sig = await hmac(`${nonce}.${exp}.${ip}.${origin}`);
    return new Response(
      JSON.stringify({ nonce, exp, sig }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
