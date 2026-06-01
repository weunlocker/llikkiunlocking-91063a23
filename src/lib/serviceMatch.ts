// Token-based fuzzy matching for supplier service names + price/delivery.
const NOISE = new Set([
  "check","unlock","service","services","premium","instant","fast","slow",
  "the","a","an","and","or","of","for","with","by","via","new","old",
  "imei","gsm","phone","mobile","status","info","information","details",
  "free","paid","report","lookup","query","result","results",
]);

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();

export function tokenize(name: string): string[] {
  return normalize(name).split(" ").filter((t) => t.length > 1 && !NOISE.has(t));
}

export function nameScore(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  // Dice coefficient
  return (2 * inter) / (A.size + B.size);
}

export function priceScore(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null || b == null || a <= 0 || b <= 0) return 0.5; // neutral
  const ratio = Math.min(a, b) / Math.max(a, b);
  if (ratio >= 0.8) return 1;
  if (ratio >= 0.5) return 0.5;
  return 0;
}

function deliveryBucket(t: string | null | undefined): string {
  if (!t) return "?";
  const s = t.toLowerCase();
  if (/instant|immediate|real/i.test(s)) return "instant";
  if (/min/i.test(s)) return "minutes";
  if (/hour|hr/i.test(s)) return "hours";
  if (/day|business/i.test(s)) return "days";
  return "?";
}

export function deliveryScore(a: string | null | undefined, b: string | null | undefined): number {
  const ba = deliveryBucket(a), bb = deliveryBucket(b);
  if (ba === "?" || bb === "?") return 0.5;
  return ba === bb ? 1 : 0;
}

export function combinedScore(
  supplier: { name: string; credit: number | null; delivery_time: string | null },
  service: { name: string; price: number; delivery_time: string },
): number {
  return (
    0.70 * nameScore(supplier.name, service.name) +
    0.20 * priceScore(supplier.credit, service.price) +
    0.10 * deliveryScore(supplier.delivery_time, service.delivery_time)
  );
}

export type Match = { service_id: string; score: number };

export function bestMatch(
  supplier: { name: string; credit: number | null; delivery_time: string | null },
  services: Array<{ id: string; name: string; price: number; delivery_time: string; supplier_id: string | null }>,
): Match | null {
  let best: Match | null = null;
  for (const s of services) {
    // Skip services already linked to a DIFFERENT supplier to keep auto-match clean
    const score = combinedScore(supplier, s);
    if (!best || score > best.score) best = { service_id: s.id, score };
  }
  return best;
}
