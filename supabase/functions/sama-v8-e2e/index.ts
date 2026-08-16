import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(()=>new Response("Not found", {
    status: 404,
    headers: {
      "cache-control": "no-store"
    }
  }));
