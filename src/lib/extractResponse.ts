// Extract just the human-readable response from a result that may be a JSON
// envelope (possibly nested) or a plain string. Tries common field names used
// by Dhru / IMEI-check APIs and falls back to the original text.
export function extractResponse(text?: string | null): string {
  if (!text) return "";
  const raw = text.trim();
  if (!raw.startsWith("{") && !raw.startsWith("[")) return text;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return text; }

  const KEYS = [
    "response", "result", "message", "data", "reply", "output",
    "description", "details", "info", "text", "content", "body",
  ];
  const WRAPPERS = ["RESPONSE", "Response", "response", "data", "result", "DATA", "RESULT", "payload", "0"];

  const seen = new WeakSet<object>();
  const stringify = (v: unknown): string =>
    typeof v === "string" ? v : JSON.stringify(v, null, 2);

  const walk = (node: unknown, depth: number): string | null => {
    if (node == null || depth > 6) return null;
    if (typeof node === "string") return node;
    if (typeof node !== "object") return String(node);
    if (seen.has(node as object)) return null;
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        const r = walk(item, depth + 1);
        if (r) return r;
      }
      return null;
    }

    const obj = node as Record<string, unknown>;
    for (const k of KEYS) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    for (const k of KEYS) {
      if (k in obj && obj[k] != null) return stringify(obj[k]);
    }
    for (const w of WRAPPERS) {
      if (w in obj) {
        const r = walk(obj[w], depth + 1);
        if (r) return r;
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        const r = walk(v, depth + 1);
        if (r) return r;
      }
    }
    return null;
  };

  const found = walk(parsed, 0);
  return normalizeHtml(found ?? text);
}

// Convert HTML response into plain text + [[c:#hex]]...[[/c]] color markers
// understood by the ColoredResult renderer.
function normalizeHtml(s: string): string {
  if (!s) return s;
  // <span style="color:red">X</span> -> [[c:red]]X[[/c]]
  let out = s.replace(
    /<span\b[^>]*\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*([^;"']+)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  // <font color="red">X</font> -> [[c:red]]X[[/c]]
  out = out.replace(
    /<font\b[^>]*\bcolor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/font>/gi,
    (_, color: string, inner: string) => `[[c:${color.trim()}]]${inner}[[/c]]`,
  );
  return out
    .replace(/<br\s*\/?>(\n)?/gi, "\n")
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

