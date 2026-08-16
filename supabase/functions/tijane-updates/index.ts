import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const MANIFEST = `{"schema":1,"app":"Tijane","contentVersion":2,"minimumAppVersionCode":4,"bundlePath":"tijane-content-v2.zip","sha256":"60bee9c0a2bc358f7b600d7a9c15777b6f2f912e96411717b59602d77b69eb03","size":30130,"publishedAt":"2026-08-06T11:32:00Z"}\n`;
const SIGNATURE = `Kw1BYOWyWhae52lEXYMwET28y7q32A0nA49eEeH/U2OgMVsDhkf243OQ7A92P9oceO7LKpqZ+k1naz5RE6BQIc4SECsMahVzkFP03yCoBx0Ltmlndi4DBUO87ZG9HTLJ18vnKW4yE/pEIWNtSmY/5W2Oag2KJgJGIrGhY2bcqrcpBwaWI92K6YPIvadf4twoBkoOCxjym57HRji0jvP3a0J27HUaeaYRK+zmuR2qyDYItPw719tqmyJTQnSlNi5R/WSHmm5ciOG1bY1ZBghNrEodlsOsUBWR5QennaL2uFlKdl3tJyDlc0ugf9ywLHaEHrDpnpXTcyifR1epGkOzsKIQF7lw/kOufsPNAGgz5StTYS7kZ8WUesYz+jKWXY7vxi526xQV7z5VNPS3xTr28d5wADPnXBcQxJQgfJOzdGkGdhwRlXrryjSvVCXvsh52M0QLPUrxKyx9GYOj+fc8zIlyxhekMbX7nhAaV7dLLwg9UiWjV5OunEB4YN4rmhz/FExvp3a4zw2ZJIL+K2YzYggdzqwcZEJc6/kkEpWTdDwpz5To91pq8iw/BByc+52HZHfW4g2thLgA4X//yVZF8gxTw3aBa1rkfjYiBp/kN/Q5/OsrSXoDlRgT1j2reSIBFHVun7ouQ5lJm6bvLIc+OflwBpQNdxqYxmP+6NaaZSM=\n`;
const EXPECTED_SHA256 = "60bee9c0a2bc358f7b600d7a9c15777b6f2f912e96411717b59602d77b69eb03";
const EXPECTED_SIZE = 30130;
const EXPECTED_TEXT_LENGTHS = [
  7000,
  7000,
  7000,
  7000,
  7000,
  5176
];
const PROJECT_BASE = "https://xmdpmtvieqgoorbxytey.supabase.co/functions/v1";
let cachedBundle = null;
const commonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store"
};
function fromBase64(value) {
  const clean = value.replace(/\s+/g, "");
  const binary = atob(clean);
  const output = new Uint8Array(binary.length);
  for(let index = 0; index < binary.length; index++)output[index] = binary.charCodeAt(index);
  return output;
}
function hex(bytes) {
  return [
    ...new Uint8Array(bytes)
  ].map((value)=>value.toString(16).padStart(2, "0")).join("");
}
async function buildBundle() {
  if (cachedBundle) return cachedBundle;
  const textParts = await Promise.all(EXPECTED_TEXT_LENGTHS.map(async (expectedLength, index)=>{
    const response = await fetch(`${PROJECT_BASE}/tijane-update-part-${index}`, {
      headers: {
        "Accept-Encoding": "identity",
        "User-Agent": "Tijane-Update-Assembler/2.0"
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error(`Fragment ${index}: HTTP ${response.status}`);
    const text = (await response.text()).trim();
    if (text.length !== expectedLength) throw new Error(`Fragment ${index}: longueur ${text.length}`);
    return text;
  }));
  const bundle = fromBase64(textParts.join(""));
  if (bundle.byteLength !== EXPECTED_SIZE) throw new Error(`Taille incorrecte: ${bundle.byteLength}`);
  const digest = hex(await crypto.subtle.digest("SHA-256", bundle));
  if (digest !== EXPECTED_SHA256) throw new Error(`Empreinte invalide: ${digest}`);
  cachedBundle = bundle;
  return bundle;
}
Deno.serve(async (request)=>{
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: commonHeaders
  });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Méthode refusée", {
      status: 405,
      headers: commonHeaders
    });
  }
  const path = new URL(request.url).pathname;
  if (path.endsWith("/health")) {
    try {
      const bundle = await buildBundle();
      return new Response(JSON.stringify({
        ok: true,
        app: "Tijane",
        contentVersion: 2,
        signed: true,
        bundleBytes: bundle.byteLength
      }), {
        headers: {
          ...commonHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    } catch (error) {
      console.error("Tijane health failure", error);
      return new Response(JSON.stringify({
        ok: false,
        app: "Tijane"
      }), {
        status: 503,
        headers: {
          ...commonHeaders,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }
  }
  if (path.endsWith("/manifest.json.sig")) {
    return new Response(request.method === "HEAD" ? null : SIGNATURE, {
      headers: {
        ...commonHeaders,
        "Content-Type": "text/plain; charset=us-ascii",
        "Content-Length": String(SIGNATURE.length)
      }
    });
  }
  if (path.endsWith("/manifest.json")) {
    return new Response(request.method === "HEAD" ? null : MANIFEST, {
      headers: {
        ...commonHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": String(new TextEncoder().encode(MANIFEST).byteLength)
      }
    });
  }
  if (path.endsWith("/tijane-content-v2.zip")) {
    try {
      const bundle = await buildBundle();
      return new Response(request.method === "HEAD" ? null : bundle, {
        headers: {
          ...commonHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=\"tijane-content-v2.zip\"",
          "Content-Length": String(bundle.byteLength),
          "ETag": `\"${EXPECTED_SHA256}\"`,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    } catch (error) {
      console.error("Tijane bundle assembly failure", error);
      return new Response("Canal temporairement indisponible", {
        status: 503,
        headers: commonHeaders
      });
    }
  }
  return new Response("Tijane Update Channel", {
    status: 200,
    headers: commonHeaders
  });
});
