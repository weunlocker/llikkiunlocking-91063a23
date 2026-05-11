// Public hosted page that redirects the user to Cashfree's hosted checkout
// using the official Cashfree.js SDK. No JWT — this is a browser landing URL.
Deno.serve((req) => {
  const url = new URL(req.url);
  const sid = url.searchParams.get("sid") || "";
  const env = (url.searchParams.get("env") || "sandbox") === "production" ? "production" : "sandbox";
  const safeSid = sid.replace(/[^A-Za-z0-9_\-\.]/g, "");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Redirecting to Cashfree…</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#0b0b0f;color:#eee}</style>
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
</head><body>
<div>Redirecting to secure Cashfree checkout…</div>
<script>
  try {
    const cashfree = Cashfree({ mode: "${env}" });
    cashfree.checkout({ paymentSessionId: ${JSON.stringify(safeSid)}, redirectTarget: "_self" });
  } catch (e) {
    document.body.innerText = "Failed to load Cashfree checkout: " + (e && e.message ? e.message : e);
  }
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
