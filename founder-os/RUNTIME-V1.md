# SOWHAT FOUNDER OS — Runtime v1

Date: 2026-08-12
Status: branch-ready / production-gated

## 1. Purpose

Founder OS is the private operating layer for the SOWHAT ecosystem. It does not replace SOWHAT AFRICA, Sama Business, SeneCompare, Social Intelligence, Supabase, n8n or the existing Cloudflare Worker. It supervises them through a single decision and exception layer.

The operating loop is:

`SIGNALS → NORMALIZE → CONTEXT → ROUTE → DECIDE → ACT → VERIFY → LOG → LEARN → BRIEF`

The system is optimized for minimal founder intervention:

- analysis, classification, health checks and safe internal reversible operations can run autonomously;
- external communications are prepared before they are committed;
- financial, legal, security, credential, deletion and production-cutover operations remain human-gated;
- every external action must be verifiable and idempotent;
- an unknown result is never treated as success.

## 2. Runtime topology

### Durable governance layer — Supabase

The `founder_os_*` tables remain the durable control plane for:

- registry of pillars, agents and SOPs;
- events and correlation IDs;
- agent runs and evidence;
- decisions;
- policies;
- verified outbox;
- alerts;
- governed knowledge graph.

The Founder OS tables are server-side only in v1. RLS is enabled and direct browser grants are revoked. The browser never receives a service-role credential.

### Private operational mirror — Cloudflare R2

The Worker uses the existing private `VISUALS_BUCKET` binding for a small operational mirror under:

`visuals/founder-os/v1/`

It stores only operational state needed by the cockpit:

- current connector health;
- health probes;
- recent Studio Monitor runs;
- pending/processed local decision cards;
- alerts mirrored for interaction;
- verified outbox queue metadata;
- idempotency reservations.

Business systems remain authoritative for their own data. R2 does not become an accounting, CRM or order database.

## 3. Authentication and write security

Founder OS reuses the existing SOWHAT Control V5 owner session instead of introducing another password.

Browser page:

- `/founder-os`

Client script:

- `/founder-os/client.js`

Owner APIs:

- `GET /api/founder-os/snapshot`
- `POST /api/founder-os/refresh`
- `POST /api/founder-os/decision`
- `POST /api/founder-os/alert`

Minimal public liveness endpoint:

- `GET /api/founder-os/health`

All mutable owner operations require:

1. the existing authenticated owner session;
2. same-origin validation;
3. a signed CSRF token;
4. a unique Founder OS idempotency key;
5. private R2 availability.

If the safety layer is unavailable, the write fails closed.

## 4. Product screens

The private cockpit contains nine operational views.

### Cockpit

Founder-first command center showing:

- ecosystem health;
- number of active connectors;
- open exceptions;
- pending approvals;
- current Command Brief;
- current priority;
- the six-pillar operating map.

### Decisions

One-click human gate for actions that require approval. A click only updates the decision and queues an outbox entry; it never impersonates external execution.

### 6 Pillars

1. COMMAND
2. COMMS
3. FINANCE
4. CONTENT
5. KNOWLEDGE
6. AUTOMATIONS

### 8 Agents

- Brain Librarian
- Inbox Triage
- Communication Scout
- CRM Pulse
- Payment Pulse
- Social Pulse
- Notion Sync
- Studio Monitor

Each card exposes its owning pillar, default autonomy level and maximum risk.

### Executions

Shows recent agent runs, result state, risk, autonomy and evidence timestamps.

### Alerts

Exception-only queue with acknowledgement and resolution lifecycle.

### Connectors

Truthful connection registry. `connected` means a real execution or health path is known; intended integrations remain `not_configured` or `degraded` until verified.

### Memory & Knowledge

Uses the governed promotion model:

`Source → Signal → Claim → Fact → Memory`

A `fact` or `memory` is not promoted without verification.

### Automations

Shows health probes and the verified outbox. Approval and execution are intentionally separated.

## 5. Current automatic supervision

### Cloudflare Worker cycle

The existing Worker scheduled handler invokes Studio Monitor health checks on the Worker cron cadence. It checks:

- SOWHAT Control health;
- Sama Business PWA health;
- SeneCompare production health;
- n8n health.

The run records evidence and opens or resolves alerts without changing financial/business records.

### Native ChatGPT condition watch

An hourly `Founder OS Supervisor` automation is configured separately. It checks the durable control-plane state and connected information sources, and only notifies for material anomalies, unknown/failed executions, connector degradation or decisions requiring approval.

This gives two layers:

- Edge runtime continuity;
- cross-connector supervisory reasoning.

## 6. Risk and autonomy contract

| Risk | Meaning | Default max autonomy | Founder gate |
|---|---|---:|---|
| R0 | Read-only / synthesis | L5 | No |
| R1 | Safe reversible internal action | L4 | Usually no |
| R2 | External communication / publication proposal | L2 | Yes before commitment |
| R3 | Financial or legal state | L2 | Always |
| R4 | Credentials, permissions, destructive action, production cutover | L1 | Always |

## 7. Idempotency and unknown-result handling

Mutable browser actions reserve a unique R2 idempotency key before state mutation.

External commitments are represented as outbox work. The runtime never considers an approval equivalent to completion. A verified executor must later perform the connector action, collect proof and move the durable outbox/decision to a terminal state.

Rules:

- never blind-retry an irreversible action;
- never mark success without evidence;
- `unknown_result` blocks automatic retry until reconciled;
- correlation IDs must follow the event through decision, action and evidence.

## 8. Sama Business CI drift found during integration

Founder OS integration surfaced a stale Sama Business release test: the live PWA is version `11.2.2` and its Service Worker uses the versioned cache namespace `samabusiness-<version>`, while the release workflow still expected the removed legacy `samabusiness-shell-*` prefix.

The branch correction updates the validation contract to test the actual behaviour:

- live health reports version `11.2.2`;
- cache key is versioned;
- `caches.open(C)` is used;
- old `samabusiness-*` cache versions are cleaned up.

No production Supabase Edge Function was modified to make the test green.

## 9. Quality gates

`Founder OS Quality` verifies:

- JavaScript syntax;
- 6-pillar / 8-agent / 8-SOP registry integrity;
- runtime persistence and idempotency;
- operational and degraded health-cycle behaviour;
- decision → outbox separation;
- alert lifecycle;
- all nine UI screens;
- 44px interaction targets and safe-area handling;
- reduced-motion support;
- no private credential rendered in the cockpit;
- owner authentication redirect;
- architecture contract;
- secret hygiene;
- complete Cloudflare Worker dry-run bundle.

The existing Social Intelligence, SeneCompare and Sama Business workflows are also allowed to run on the same PR to detect cross-product regressions.

## 10. Production gate

The source is intentionally prepared on `agent/founder-os-control-plane-v1` / PR #66.

Merging to `main` can trigger the existing deployment chain, so the merge is treated as R4. The correct final action is one explicit production approval after all relevant quality gates are green.
