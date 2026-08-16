import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const VERSION = "11.2.2";
const SCRIPT = `;(()=>{'use strict';window.SAMABUSINESS=Object.assign(window.SAMABUSINESS||{},{version:'${VERSION}',adminIntegratedInSiteStudio:true});document.querySelectorAll('script[data-samabusiness-admin-fix]').forEach(node=>{if(node!==document.currentScript)node.remove()});})();`;
Deno.serve((req)=>{
  const headers = {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "cross-origin-resource-policy": "cross-origin",
    "x-content-type-options": "nosniff",
    "x-samabusiness-version": VERSION,
    "x-samabusiness-deprecated-helper": "admin-integrated-in-site-studio"
  };
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers
  });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", {
    status: 405,
    headers
  });
  return new Response(req.method === "HEAD" ? null : SCRIPT, {
    headers
  });
});
