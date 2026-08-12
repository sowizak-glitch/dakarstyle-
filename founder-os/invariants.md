# INVARIANTS

## Data

- Existing `sowhat_*`, `sama_*`, `senecompare_*`, `liv_*` and security tables remain authoritative for their domains.
- Founder OS stores orchestration state, not a shadow copy of business data.
- Unknown data is `null`/`unknown`, never zero or success by assumption.
- Every event and run carries a correlation ID and an idempotency/deduplication key where applicable.

## Security

- Secrets never enter Git, Markdown knowledge, agent memory, analytics payloads or run logs.
- R4 actions are never autonomous.
- Security-sensitive writes fail closed when authentication, authorization, CSRF, signature or policy checks are incomplete.
- Every privileged action is attributable to an actor: agent, service, staff user or founder.

## Automation

- Writes must be retry-safe or explicitly non-retriable.
- External writes are verified against the source system when possible.
- A timeout after a potentially irreversible action produces `unknown_result` / manual verification, not blind replay.
- A connector in `error`, `degraded` or `not_configured` state cannot masquerade as operational.

## Human gate

- The founder receives decisions, not raw task lists.
- Approval payloads must be complete enough for a one-click yes/no decision.
- Email sends, commercial quotes, financial/legal commitments and destructive actions remain approval-gated unless a specific SOP has earned a higher autonomy level with evidence.

## Quality

- Agent outputs include evidence references and confidence when facts are inferred.
- Production claims require either direct verification or a recorded proof artifact.
- Every change must preserve mobile-first behavior and current production functionality.
