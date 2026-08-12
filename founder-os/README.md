# SOWHAT FOUNDER OS — Control Plane v1

Purpose: a single autonomous operating layer above SOWHAT AFRICA, Sama Business, SeneCompare, Social Intelligence, delivery, finance and knowledge systems.

## Design goals

1. One operator, one command center.
2. Existing systems stay systems of record. Founder OS orchestrates them; it does not duplicate them.
3. Every agent action is logged with evidence, status, risk and correlation ID.
4. Analysis, triage, formatting, classification and internal reversible updates run autonomously.
5. External or irreversible commitments can require one-click approval according to policy.
6. Every connector reports only `connected`, `not_configured`, `degraded` or `error`.
7. No secrets in Git. Secrets remain in provider secret stores.
8. Every workflow is idempotent, retry-safe and observable.

## Topology

```text
Signals
Gmail / WhatsApp / Meta / GitHub / Notion / Supabase / n8n / Cloudflare / Payments
   ↓
Event Intake + Normalization
   ↓
Central Supervisor / Policy Engine
   ↓
6 Pillars → 8 Agents → 8 SOPs
   ↓
Decision Gate (L1-L5 autonomy + risk class)
   ↓
Existing Systems of Record + Connectors
   ↓
Run Log / Evidence / Alerts / Daily Brief
```

## Pillars

- COMMAND — business context, priorities, decisions and knowledge routing.
- COMMS — inboxes, WhatsApp and communication triage.
- FINANCE — CRM movement, payments, invoices and reconciliation.
- CONTENT — content repurposing and distribution preparation.
- KNOWLEDGE — documentation, facts, memory and retrieval.
- AUTOMATIONS — health, webhooks, n8n, Supabase and workflow continuity.

## Initial delivery

- Root spine: `system.md`, `encoding.md`, `invariants.md`, `company.yaml`.
- Agent registry: `agents.yaml`.
- SOP registry: `sops.yaml`.
- Data contracts: `data-contracts.md`.
- Isolated Supabase control-plane migration under `migrations/`.

## Deployment rule

This branch is intentionally isolated from production. No production cutover is implied by the existence of these files. The Supabase schema is namespaced `founder_os_*` and designed to coexist with existing `sama_*`, `sowhat_*`, `senecompare_*`, `liv_*` and security tables.
