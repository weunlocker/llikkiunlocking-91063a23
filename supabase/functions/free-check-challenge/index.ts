// Issues a short-lived signed challenge token for the Free Check flow.
// Replaces Cloudflare Turnstile with a lightweight HMAC nonce per request.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-secret";
const TTL_MS = 60_000; // 60s validity

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const exp = Date.now() + TTL_MS;
    const sig = await hmac(`${nonce}.${exp}`);
    return new Response(
      JSON.stringify({ nonce, exp, sig }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
