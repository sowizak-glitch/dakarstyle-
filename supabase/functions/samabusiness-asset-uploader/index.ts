import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(()=>Response.json({
    ok: false,
    error: "Endpoint retired"
  }, {
    status: 410,
    headers: {
      "cache-control": "no-store"
    }
  }));
