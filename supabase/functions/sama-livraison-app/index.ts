import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const DESTINATION = "https://sama-livraison.vercel.app";
Deno.serve((req)=>{
  const source = new URL(req.url);
  const marker = "/functions/v1/sama-livraison-app";
  let suffix = source.pathname.startsWith(marker) ? source.pathname.slice(marker.length) : "/";
  if (!suffix || suffix === "/") suffix = "/";
  const target = new URL(suffix, DESTINATION);
  target.search = source.search;
  return new Response(null, {
    status: 302,
    headers: {
      "Location": target.toString(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
});
