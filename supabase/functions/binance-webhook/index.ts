// Legacy Binance Pay merchant webhook. The project now uses a personal Binance
// account with deposit polling (see binance-poll-deposits). This handler is
// kept as a no-op for backward compatibility.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ returnCode: "SUCCESS", returnMessage: "ignored" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
