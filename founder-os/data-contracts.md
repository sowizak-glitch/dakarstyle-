# DATA CONTRACTS

## Event

```json
{
  "event_id": "uuid",
  "correlation_id": "string",
  "source": "gmail|whatsapp|meta|github|notion|supabase|n8n|cloudflare|manual",
  "event_type": "string",
  "entity_type": "string|null",
  "entity_id": "string|null",
  "occurred_at": "ISO-8601",
  "dedupe_key": "string|null",
  "payload": {},
  "confidence": 1.0
}
```

## Agent run

```json
{
  "run_id": "uuid",
  "correlation_id": "string",
  "agent_id": "string",
  "sop_id": "string",
  "status": "queued|running|waiting_approval|succeeded|failed|unknown_result|cancelled",
  "risk_class": "R0|R1|R2|R3|R4",
  "autonomy_level": "L1|L2|L3|L4|L5",
  "input": {},
  "output": {},
  "evidence": [],
  "error": null
}
```

## Decision / approval

```json
{
  "decision_id": "uuid",
  "run_id": "uuid|null",
  "title": "string",
  "recommended_action": {},
  "risk_class": "R0|R1|R2|R3|R4",
  "autonomy_level": "L1|L2|L3|L4|L5",
  "requires_human": true,
  "status": "pending|approved|rejected|expired|executed|cancelled",
  "why_now": "string",
  "business_impact": "string",
  "preview": {},
  "evidence": [],
  "expires_at": null
}
```

## Connector state

```json
{
  "connector_id": "gmail",
  "provider": "Google",
  "status": "connected|not_configured|degraded|error",
  "capabilities": ["read", "draft", "send"],
  "last_probe_at": "ISO-8601|null",
  "last_success_at": "ISO-8601|null",
  "last_error": null,
  "metadata": {}
}
```

## Alert

```json
{
  "alert_id": "uuid",
  "severity": "info|warning|critical",
  "pillar": "COMMAND|COMMS|FINANCE|CONTENT|KNOWLEDGE|AUTOMATIONS",
  "component": "string",
  "status": "open|acknowledged|resolved",
  "summary": "string",
  "details": {},
  "correlation_id": "string|null"
}
```

## Knowledge item

```json
{
  "knowledge_id": "uuid",
  "stage": "source|signal|claim|fact|memory",
  "domain": "string",
  "subject": "string",
  "content": "string",
  "source_type": "string|null",
  "source_ref": "string|null",
  "confidence": 0.0,
  "verified": false,
  "verified_by": null,
  "metadata": {}
}
```

## Webhook response envelope

Every webhook-ready SOP returns:

```json
{
  "ok": true,
  "correlation_id": "string",
  "status": "accepted|completed|waiting_approval|failed|unknown_result",
  "result": {},
  "decision_id": null,
  "retryable": false
}
```
