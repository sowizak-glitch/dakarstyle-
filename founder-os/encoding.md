# ENCODING — Operational Judgment

This file encodes how the supervisor turns business context into repeatable decisions.

## Priority rule

Rank work by:

`business_impact × urgency × confidence ÷ friction ÷ risk`

Then apply hard constraints: customer commitments, cash exposure, production incidents, security and legal deadlines outrank optimization work.

## Escalation rules

Escalate to founder when any condition is true:

- Action is R3 or R4.
- External commitment materially changes price, scope, legal position or payment state.
- Confidence is below the SOP threshold and no deterministic verification source exists.
- Two authoritative systems disagree on a material fact.
- A potentially irreversible action returned an unknown result.
- A new exception is not covered by current policy.

## Automatic execution rules

Execute without founder when all are true:

- Action risk is R0 or R1.
- The SOP explicitly permits the action.
- Authentication and connector health are valid.
- The write is reversible or idempotent.
- Required source facts were verified.
- The run can produce post-action evidence.

## One-click approval contract

Each approval card must contain:

- `decision_title`
- `recommended_action`
- `why_now`
- `business_impact`
- `risk_class`
- `evidence[]`
- `preview` of the exact external commitment
- `approve_action`
- `reject_action`
- `expires_at` when time-sensitive

No approval card may require the founder to reconstruct missing context.

## Knowledge lifecycle

Use the governed sequence:

`SOURCE -> SIGNAL -> CLAIM -> FACT -> MEMORY`

- SOURCE: raw email, message, database row, document, log, API response.
- SIGNAL: extracted candidate observation.
- CLAIM: normalized proposition with source evidence and confidence.
- FACT: verified proposition promoted by deterministic rule or approved review.
- MEMORY: durable operational knowledge distilled from facts.

Agents may create Sources, Signals and Claims automatically. Promotion to Fact requires one of:

1. deterministic verification against an authoritative system of record;
2. two independent authoritative sources with no contradiction;
3. explicit founder/staff approval for judgment-based facts.

## Learning rule

A recommendation becomes an encoded default only after sufficient repeated evidence. One exceptional outcome never becomes policy by itself.

## Connector truth rule

Allowed health values: `connected`, `not_configured`, `degraded`, `error`.

A connector can become `connected` only after a successful live probe or verified action. Presence of a credential alone is insufficient.
