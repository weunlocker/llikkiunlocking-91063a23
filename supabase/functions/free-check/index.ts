// Public free check: runs an upstream call for a service marked is_free=true.
// No auth, no charge, no order record. Rate-limited by IP via simple in-memory map.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Body = z.object({
  service_id: z.string().uuid(),
  imei: z.string().trim().regex(/^[A-Za-z0-9]{8,20}$/),
  challenge: z.object({
    nonce: z.string().min(8).max(64),
    exp: z.number().int(),
    sig: z.string().min(8).max(128),
  }).optional(),
});

const lastHit = new Map<string, number>();
const usedNonces = new Map<string, number>(); // nonce -> exp (prevents replay)
// Short-lived result cache so repeat checks for the same IMEI return instantly
const resultCache = new Map<string, { exp: number; payload: unknown }>();
const CACHE_TTL_MS = 5 * 60_000;

const CHALLENGE_SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "fallback-secret";

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CHALLENGE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return b64url(sig);
}
async function verifyChallenge(c: { nonce: string; exp: number; sig: string } | undefined): Promise<string | null> {
  if (!c) return "Challenge required";
  const now = Date.now();
  if (c.exp < now) return "Challenge expired";
  if (c.exp > now + 5 * 60_000) return "Challenge invalid";
  const expected = await hmac(`${c.nonce}.${c.exp}`);
  if (expected !== c.sig) return "Challenge invalid";
  // cleanup old nonces
  for (const [k, v] of usedNonces) if (v < now) usedNonces.delete(k);
  if (usedNonces.has(c.nonce)) return "Challenge already used";
  usedNonces.set(c.nonce, c.exp);
  return null;
}

function normalizeHtml(s: string): string {
  if (!s) return s;
  const trimmed = s.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const inner = obj?.response ?? obj?.result ?? obj?.message ?? obj?.data;
      if (typeof inner === "string" && inner.trim()) s = inner;
    } catch { /* ignore */ }
  }
  s = s.replace(
    /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*([^;"']+)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_m, c: string, inner: string) => `[[c:${c.trim()}]]${inner}[[/c]]`,
  );
  s = s.replace(
    /<font\b[^>]*\bcolor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
    (_m, c: string, inner: string) => `[[c:${c.trim()}]]${inner}[[/c]]`,
  );
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.split(/[.\[\]]+/).filter(Boolean);
  let cur: any = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}
function applyTemplate(template: string, data: unknown): string {
  if (!template) return typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return template.replace(/\{([\w\.\[\]]+)\}/g, (_, k) => {
    if (k.toLowerCase() === "imei") return "";
    const v = getByPath(data, k);
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const last = lastHit.get(ip) ?? 0;
    if (now - last < 5000) return json(429, { error: "Too many requests, please wait a few seconds." });
    lastHit.set(ip, now);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Verify lightweight HMAC challenge (replaces Turnstile)
    const challengeErr = await verifyChallenge(parsed.data.challenge);
    if (challengeErr) return json(401, { error: challengeErr });

    // Parallelize: fetch service (and supplier if needed)
    const { data: service } = await supabase.from("services").select("*").eq("id", parsed.data.service_id).maybeSingle();
    if (!service) return json(404, { error: "Service not found" });
    if (!service.active) return json(400, { error: "Service inactive" });
    if (!service.is_free) return json(403, { error: "This service is not a free check" });

    let supplier: any = null;
    if (service.supplier_id) {
      const { data: sup } = await supabase.from("suppliers").select("*").eq("id", service.supplier_id).maybeSingle();
      supplier = sup;
    }

    const imei = parsed.data.imei;

    if (!supplier && !service.api_url) {
      return json(200, { status: "completed", result: `Demo: ${service.name}\nIMEI: ${imei}\nResult: simulated success.` });
    }

    let url: string;
    const headers: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      // Some direct-check providers delay or drop Deno/default server fetches.
      // Send a normal browser UA so the provider handles this like the fast manual tests.
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    };
    const init: RequestInit = { method: "GET", headers };

    if (supplier) {
      url = String(supplier.endpoint_url);
      if (supplier.type === "dhru") {
        // Dhru placement is async — not suitable for free check sync flow.
        return json(400, { error: "Free check does not support Dhru suppliers (async). Use a direct API URL." });
      }
      if (supplier.type === "ifree") {
        init.method = "POST";
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        const params = new URLSearchParams();
        params.set("service", String(service.supplier_action ?? ""));
        params.set("imei", imei);
        params.set("key", String(supplier.dhru_api_key ?? ""));
        init.body = params.toString();
      } else if (supplier.type === "goimeicheck") {
        init.method = "GET";
        const base = String(supplier.endpoint_url || "https://api.goimeicheck.com").replace(/\/+$/, "");
        const qs = new URLSearchParams({
          api_key: String(supplier.dhru_api_key ?? ""),
          service: String(service.supplier_action ?? ""),
          imei,
        });
        url = `${base}/api/place-order/?${qs.toString()}`;
      } else {
        url = url.replace(/\{IMEI\}/gi, encodeURIComponent(imei))
          .replace(/\{ACTION\}/gi, encodeURIComponent(String(service.supplier_action ?? "")));
        init.method = service.api_method || "GET";
        Object.assign(headers, (service.api_headers ?? {}) as Record<string, string>);
        if (init.method === "POST") {
          headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
          init.body = (service.api_request_body || JSON.stringify({ imei }))
            .replace(/\{IMEI\}/gi, imei).replace(/\{ACTION\}/gi, String(service.supplier_action ?? ""));
        }
      }
    } else {
      url = service.api_url
        .replace(/\{IMEI\}/gi, encodeURIComponent(imei))
        .replace(/\{imei\}/g, encodeURIComponent(imei));
      Object.assign(headers, (service.api_headers ?? {}) as Record<string, string>);
      init.method = service.api_method || "GET";
      if (init.method === "POST") {
        if (service.api_request_body && service.api_request_body.trim()) {
          if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
          init.body = service.api_request_body.replace(/\{IMEI\}/gi, imei).replace(/\{imei\}/g, imei);
        } else {
          headers["Content-Type"] = "application/json";
          init.body = JSON.stringify({ imei });
        }
      }
    }

    // Call upstream once. If the provider socket hangs, return a normal app response
    // instead of an HTTP 504 so the frontend never treats this as an edge crash.
    let resp: Response;
    const ac = new AbortController();
    const upstreamStartedAt = Date.now();
    const t = setTimeout(() => ac.abort(), 15000);
    try {
      resp = await fetch(url, { ...init, signal: ac.signal });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("free-check upstream fetch failed", {
        aborted,
        elapsed_ms: Date.now() - upstreamStartedAt,
        service_id: service.id,
        host: new URL(url).hostname,
        error: err instanceof Error ? err.message : String(err),
      });
      if (aborted) {
        return json(200, unavailableResult(service.name, imei));
      }
      return json(502, { error: `Network error: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      clearTimeout(t);
    }
    console.log("free-check upstream response", {
      elapsed_ms: Date.now() - upstreamStartedAt,
      status: resp.status,
      service_id: service.id,
      host: new URL(url).hostname,
    });
    const ct = resp.headers.get("content-type") || "";
    const raw = ct.includes("json") ? await resp.json() : await resp.text();
    if (!resp.ok) {
      const isTimeout = typeof raw === "string" && /timed?\s*out|timeout/i.test(raw);
      if (isTimeout) return json(200, unavailableResult(service.name, imei));
      return json(isTimeout ? 504 : 502, {
        error: `Provider returned ${resp.status}`,
      });
    }

    let parsedRaw: unknown = raw;
    if (typeof raw === "string") {
      const t = raw.trim();
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try { parsedRaw = JSON.parse(t); } catch { /* keep */ }
      }
    }
    let resultText = service.response_template
      ? applyTemplate(service.response_template, parsedRaw)
      : (typeof parsedRaw === "string" ? parsedRaw : JSON.stringify(parsedRaw, null, 2));
    resultText = normalizeHtml(resultText) || "(empty response)";
    return json(200, { status: "completed", service: service.name, imei, result: resultText });
  } catch (e) {
    console.error("free-check error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Server error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unavailableResult(service: string, imei: string) {
  return {
    status: "unavailable",
    service,
    imei,
    result: "The free model-check provider is temporarily not responding. Please try again in a few minutes.",
  };
}
