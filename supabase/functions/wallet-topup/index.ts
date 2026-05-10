// DISABLED: This demo top-up endpoint allowed any authenticated user to credit
// their own wallet without payment. It is intentionally disabled in production.
// Legitimate top-ups must go through `binance-poll-deposits` (verified deposits)
// or `admin-adjust-balance` (admin-authenticated).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "This endpoint is disabled. Please use a supported payment method to top up your wallet." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
