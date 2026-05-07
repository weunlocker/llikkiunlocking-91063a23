// Dhru Fusion Reseller Public API v2 (Bearer-token JSON).
// Docs: https://www.postman.com/dhrucloud/dhru-fusion/documentation/88tzw38/dhru-fusion-client-api-v2
//
// Reuses existing supplier columns:
//   suppliers.endpoint_url   -> base URL (e.g. https://panel.example.com  -- no trailing /)
//   suppliers.dhru_api_key   -> Bearer token
//   services.supplier_action -> product_uuid

function baseUrl(endpoint: string): string {
  // Strip a trailing /api/... path that admins may have entered for classic Dhru.
  let u = String(endpoint || "").trim().replace(/\/+$/, "");
  u = u.replace(/\/api\/(reseller\/v1|index\.php).*$/i, "");
  return u;
}

function v2Url(endpoint: string, path: string): string {
  return `${baseUrl(endpoint)}/api/reseller/v1${path}`;
}

async function call(
  endpoint: string,
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<{ http: number; data: any; raw: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(v2Url(endpoint, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  let data: any = raw;
  try { data = JSON.parse(raw); } catch { /* keep raw */ }
  return { http: r.status, data, raw };
}

export async function v2Account(endpoint: string, token: string) {
  return call(endpoint, token, "/account", "GET");
}

export async function v2Products(endpoint: string, token: string) {
  return call(endpoint, token, "/products", "GET");
}

export async function v2GetOrder(endpoint: string, token: string, orderUuid: string) {
  return call(endpoint, token, `/order?order_uuid=${encodeURIComponent(orderUuid)}`, "GET");
}

export type V2PlaceResult =
  | { ok: true; order_uuid: string; raw: any }
  | { ok: false; error: string; raw: any };

/**
 * Place a single IMEI order against Dhru v2 reseller.
 * Returns the supplier order_uuid we should track.
 */
export async function v2PlaceOrder(opts: {
  endpoint: string;
  token: string;
  productUuid: string;
  imei: string;
  referenceId: string;
  feedbackUrl?: string;
  extraFields?: Record<string, unknown>;
}): Promise<V2PlaceResult> {
  const fields: Record<string, unknown> = {
    reference_id: opts.referenceId,
    Quantity: 1,
    IMEI: opts.imei,
    ...(opts.extraFields ?? {}),
  };
  if (opts.feedbackUrl) fields.feedback_url = opts.feedbackUrl;

  const payload = [{ product_uuid: opts.productUuid, fields: [fields] }];
  const { http, data, raw } = await call(opts.endpoint, opts.token, "/order", "POST", payload);

  if (http >= 400 || (data && data.status && data.status !== "success")) {
    const msg = (data?.message || data?.error || `HTTP ${http}`).toString();
    return { ok: false, error: msg, raw: typeof data === "string" ? raw.slice(0, 1000) : data };
  }
  // Response shape: { status:"success", data:[ { order_uuid, reference_id, ... } ] }
  const arr = Array.isArray(data?.data) ? data.data : [];
  const match = arr.find((x: any) => String(x?.reference_id) === opts.referenceId) ?? arr[0];
  const orderUuid = match?.order_uuid ?? match?.uuid ?? null;
  if (!orderUuid) {
    return { ok: false, error: "Supplier did not return order_uuid", raw: data };
  }
  return { ok: true, order_uuid: String(orderUuid), raw: data };
}

export type V2OrderState = "pending" | "processing" | "completed" | "failed";

/** Normalize a v2 GET /order response into status + reply text. */
export function v2InterpretOrder(data: any): { state: V2OrderState; reply: string; raw: any } {
  // Common shapes: { status:"success", data:{ status:"completed", reply:"...", ... } }
  // Also seen: data:{ state:"completed", result:"..." } or top-level fields.
  const inner = data?.data ?? data;
  const statusText = String(
    inner?.status ?? inner?.state ?? inner?.order_status ?? data?.status ?? "",
  ).toLowerCase().trim();
  const reply: string = (
    inner?.reply ?? inner?.result ?? inner?.message ?? inner?.code ?? ""
  ).toString();

  let state: V2OrderState = "pending";
  if (["success", "completed", "complete", "done", "finished", "available"].includes(statusText)) {
    state = "completed";
  } else if (["rejected", "cancelled", "canceled", "failed", "error"].includes(statusText)) {
    state = "failed";
  } else if (["processing", "in_process", "inprocess", "in progress"].includes(statusText)) {
    state = "processing";
  } else if (reply && !/pending|processing/i.test(reply)) {
    // Some panels omit status but provide a final reply.
    state = "completed";
  }
  return { state, reply, raw: inner };
}

/** Flatten /products response to a list of services we can store in supplier_services. */
export function v2FlattenProducts(data: any): Array<{
  id: string; name: string; group: string | null; price: number | null; time: string | null; info: string | null; raw: any;
}> {
  const inner = data?.data ?? data;
  const products = inner?.products ?? inner?.PRODUCTS ?? {};
  const categories = inner?.categories ?? inner?.CATEGORIES ?? {};
  const out: Array<any> = [];
  for (const [uuid, p] of Object.entries(products as Record<string, any>)) {
    const cids: string[] = Array.isArray(p?.cids) ? p.cids : [];
    const groupName = cids.length && categories[cids[0]]?.name ? categories[cids[0]].name : null;
    out.push({
      id: String(uuid),
      name: String(p?.name ?? p?.title ?? uuid),
      group: groupName,
      price: p?.price != null ? Number(p.price) : null,
      time: p?.delivery_time ?? p?.time ?? null,
      info: p?.description ?? p?.info ?? null,
      raw: p,
    });
  }
  return out;
}
