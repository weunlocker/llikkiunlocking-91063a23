/**
 * Dhru requests routed through a static-IP proxy (cPanel PHP) when
 * DHRU_PROXY_URL and DHRU_PROXY_KEY are configured. Falls back to direct
 * fetch otherwise so local/testing envs still work.
 */
export async function dhruFetch(targetUrl: string, init: RequestInit = {}): Promise<Response> {
  const proxyUrl = Deno.env.get("DHRU_PROXY_URL");
  const proxyKey = Deno.env.get("DHRU_PROXY_KEY");
  if (!proxyUrl || !proxyKey) {
    return fetch(targetUrl, init);
  }
  const headers = new Headers(init.headers || {});
  headers.set("X-Proxy-Key", proxyKey);
  headers.set("X-Target-URL", targetUrl);
  return fetch(proxyUrl, { ...init, headers });
}
