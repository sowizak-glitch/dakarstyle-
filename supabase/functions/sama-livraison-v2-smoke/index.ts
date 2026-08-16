import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(()=>Response.json({
    ok: false,
    closed: true
  }, {
    status: 410
  }));
