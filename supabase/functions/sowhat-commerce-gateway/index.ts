import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const SOWHAT_GATEWAY_KEY = "DGrL0I93xLX96aiAfUza4eDG3-X2oP_b5UTLC-NAWq7_FQyilWLokagcM7r822Hz";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sowhat-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!key) {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    key = keys.default ?? "";
  }
  if (!url || !key) throw new Error("Supabase admin environment is unavailable");
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  if (req.method !== "POST") return json({
    ok: false,
    error: "POST required"
  }, 405);
  if (req.headers.get("x-sowhat-key") !== SOWHAT_GATEWAY_KEY) {
    return json({
      ok: false,
      error: "Unauthorized gateway key"
    }, 401);
  }
  try {
    const body = await req.json();
    const action = String(body.action ?? "health");
    const payload = body.payload ?? {};
    const supabase = adminClient();
    if (action === "health") {
      return json({
        ok: true,
        service: "sowhat-commerce-gateway",
        version: "1.0.0"
      });
    }
    if (action === "upsert_client") {
      const { data, error } = await supabase.rpc("sowhat_api_upsert_client", {
        p_client: payload
      });
      if (error) throw error;
      return json({
        ok: true,
        client_id: data
      });
    }
    if (action === "create_order") {
      const { data, error } = await supabase.rpc("sowhat_api_create_order", {
        p_payload: payload
      });
      if (error) throw error;
      return json({
        ok: true,
        ...data
      });
    }
    if (action === "log_message") {
      const clientPayload = payload.client ?? {};
      let clientId = payload.client_id ?? null;
      if (!clientId && Object.keys(clientPayload).length) {
        const { data, error } = await supabase.rpc("sowhat_api_upsert_client", {
          p_client: clientPayload
        });
        if (error) throw error;
        clientId = data;
      }
      const channel = payload.channel ?? "whatsapp";
      const channelRef = payload.channel_ref ?? payload.conversation_ref ?? null;
      let conversationId = payload.conversation_id ?? null;
      if (!conversationId) {
        const { data: existing, error: findError } = await supabase.from("sowhat_conversations").select("id").eq("channel", channel).eq("channel_ref", channelRef).maybeSingle();
        if (findError) throw findError;
        if (existing?.id) conversationId = existing.id;
        else {
          const { data: created, error: createError } = await supabase.from("sowhat_conversations").insert({
            client_id: clientId,
            channel,
            channel_ref: channelRef,
            status: payload.conversation_status ?? "open",
            last_message_at: payload.sent_at ?? new Date().toISOString(),
            metadata: payload.conversation_metadata ?? {}
          }).select("id").single();
          if (createError) throw createError;
          conversationId = created.id;
        }
      }
      const { data: message, error: messageError } = await supabase.from("sowhat_messages").insert({
        conversation_id: conversationId,
        direction: payload.direction ?? "inbound",
        sender_type: payload.sender_type ?? "customer",
        message_type: payload.message_type ?? "text",
        content: payload.content ?? null,
        provider_message_id: payload.provider_message_id ?? null,
        media_url: payload.media_url ?? null,
        payload: payload.raw_payload ?? {},
        sent_at: payload.sent_at ?? new Date().toISOString()
      }).select("id").single();
      if (messageError) throw messageError;
      await supabase.from("sowhat_conversations").update({
        last_message_at: payload.sent_at ?? new Date().toISOString()
      }).eq("id", conversationId);
      return json({
        ok: true,
        client_id: clientId,
        conversation_id: conversationId,
        message_id: message.id
      });
    }
    if (action === "store_memory") {
      const { data, error } = await supabase.from("sowhat_agent_memories").insert({
        agent_id: payload.agent_id,
        client_id: payload.client_id ?? null,
        session_id: payload.session_id ?? null,
        memory_type: payload.memory_type ?? "conversation",
        content: payload.content,
        metadata: payload.metadata ?? {},
        embedding: payload.embedding,
        importance: payload.importance ?? 0.5,
        expires_at: payload.expires_at ?? null
      }).select("id").single();
      if (error) throw error;
      return json({
        ok: true,
        memory_id: data.id
      });
    }
    if (action === "search_memory") {
      const { data, error } = await supabase.rpc("sowhat_match_agent_memories", {
        query_embedding: payload.embedding,
        match_count: payload.match_count ?? 5,
        p_agent_id: payload.agent_id ?? null,
        p_client_id: payload.client_id ?? null,
        metadata_filter: payload.metadata_filter ?? {}
      });
      if (error) throw error;
      return json({
        ok: true,
        matches: data
      });
    }
    if (action === "log_event") {
      const { data, error } = await supabase.from("sowhat_automation_events").insert({
        workflow_name: payload.workflow_name ?? "unknown",
        event_type: payload.event_type ?? "event",
        status: payload.status ?? "received",
        correlation_id: payload.correlation_id ?? null,
        client_id: payload.client_id ?? null,
        order_id: payload.order_id ?? null,
        payload: payload.payload ?? {},
        result: payload.result ?? {},
        error_message: payload.error_message ?? null,
        completed_at: payload.completed_at ?? null
      }).select("id").single();
      if (error) throw error;
      return json({
        ok: true,
        event_id: data.id
      });
    }
    if (action === "list_orders") {
      let query = supabase.from("sowhat_orders").select("id,order_number,status,payment_status,fulfillment_status,total_amount,amount_paid,currency,source,created_at,client_id").order("created_at", {
        ascending: false
      }).limit(Math.min(Number(payload.limit ?? 50), 200));
      if (payload.client_id) query = query.eq("client_id", payload.client_id);
      if (payload.status) query = query.eq("status", payload.status);
      const { data, error } = await query;
      if (error) throw error;
      return json({
        ok: true,
        orders: data
      });
    }
    return json({
      ok: false,
      error: `Unknown action: ${action}`
    }, 400);
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
