# CONNECTOR MAP

Founder OS does not treat credential presence as connectivity. A connector is green only after a verified live probe.

## Current orchestration access verified during bootstrap

| Connector | Current access path | Founder OS capability | State |
|---|---|---|---|
| Gmail | ChatGPT connector | read, draft, send | connected |
| GitHub | ChatGPT connector | read, branch, commit, PR operations | connected |
| Notion | ChatGPT connector | search/read/write | connected |
| Supabase | ChatGPT connector | SQL, migrations, functions, health/advisors | connected |
| WhatsApp | existing ecosystem/n8n path, not probed by this bootstrap | read/send/templates | not_configured in Founder OS |
| Meta Social | existing Social Intelligence implementation, not probed as Founder OS adapter | metrics/publish | not_configured in Founder OS |
| n8n | existing ecosystem runtime, no direct connector exposed to this bootstrap | inspect/trigger/retry | not_configured in Founder OS |
| Cloudflare | existing GitHub CI + Worker runtime, no direct control connector exposed here | deploy/logs/dns/workers | not_configured in Founder OS |

## Adapter rules

Every adapter must implement:

- `probe()` -> honest connector state.
- `read()` -> typed normalized data.
- `prepare()` -> external write preview.
- `execute()` -> idempotency-aware write.
- `verify()` -> post-write confirmation.
- `redact()` -> secret/PII minimization for run logs.

## Integration priority

1. Supabase read layer for business aggregates and control-plane state.
2. Gmail Inbox Triage with draft-only default.
3. GitHub/Notion knowledge ingestion and release synchronization.
4. n8n event bridge into `founder_os_events`.
5. Meta/WhatsApp external-write adapters via outbox and approval gate.
6. Cloudflare health/deployment adapter with R4 production changes approval-gated.

## Rule for existing systems

Existing connectors and business logic are wrapped, not rewritten. Founder OS calls the existing Social Intelligence, Sama Business, SeneCompare and delivery systems through stable adapters and records only orchestration state.
