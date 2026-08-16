import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VERSION = "10.3.0";
const SOURCE_REF = "62de4076ff7b717770b3b6ff1b8821b0fbf5950f";
const PARTS = Array.from({ length: 10 }, (_, index) =>
  `https://raw.githubusercontent.com/sowizak-glitch/dakarstyle-/${SOURCE_REF}/supabase/functions/samabusiness-field-ux/parts/part-${String(index).padStart(2, "0")}.js`
);
let cachedSource = "";

async function loadSource(): Promise<string> {
  if (cachedSource) return cachedSource;
  const responses = await Promise.all(PARTS.map((url) => fetch(url, { headers: { accept: "text/plain" } })));
  if (responses.some((response) => !response.ok)) {
    throw new Error(`Field UX source unavailable: ${responses.map((response) => response.status).join(",")}`);
  }
  const source = (await Promise.all(responses.map((response) => response.text()))).join("");
  const markers = [
    "__SAMABUSINESS_FIELD_UX__",
    "Partager sur WhatsApp",
    "Commander sur WhatsApp",
    "Wolof activé",
    "__SAMABUSINESS_NATIVE_PWA__",
    "Importer un vocal WhatsApp",
  ];
  if (source.length < 60000 || !markers.every((marker) => source.includes(marker))) {
    throw new Error("Invalid field UX source");
  }
  cachedSource = source;
  return cachedSource;
}

function headers(type = "application/javascript; charset=utf-8", cache = "public, max-age=120, stale-while-revalidate=300"): HeadersInit {
  return {
    "content-type": type,
    "cache-control": cache,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-field-ux": VERSION,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: headers("application/json; charset=utf-8", "no-store") });
  }
  try {
    const source = await loadSource();
    return new Response(req.method === "HEAD" ? null : source, { headers: headers() });
  } catch (error) {
    console.error("samabusiness-field-ux", error);
    return Response.json({ ok: false, error: "Field UX unavailable" }, { status: 503, headers: headers("application/json; charset=utf-8", "no-store") });
  }
});
