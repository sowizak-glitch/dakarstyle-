-- SOWHAT Founder OS Control Plane v1
-- Isolated orchestration schema. Does not alter existing business tables.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.founder_os_pillars (
  id text primary key,
  display_name text not null,
  purpose text not null,
  position smallint not null unique check (position between 1 and 6),
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_os_agents (
  id text primary key,
  pillar_id text not null references public.founder_os_pillars(id) on update cascade,
  display_name text not null,
  mission text not null,
  default_autonomy smallint not null check (default_autonomy between 1 and 5),
  max_risk smallint not null check (max_risk between 0 and 4),
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_os_sops (
  id text primary key,
  pillar_id text not null references public.founder_os_pillars(id) on update cascade,
  owner_agent_id text not null references public.founder_os_agents(id) on update cascade,
  trigger_kind text not null,
  default_autonomy smallint not null check (default_autonomy between 1 and 5),
  risk_class smallint not null check (risk_class between 0 and 4),
  approval_required boolean not null default false,
  objective text not null,
  output_contract jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_os_connectors (
  id text primary key,
  provider text not null,
  status text not null default 'not_configured' check (status in ('connected','not_configured','degraded','error')),
  capabilities text[] not null default '{}',
  last_probe_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.founder_os_events (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  source text not null,
  event_type text not null,
  entity_type text,
  entity_id text,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  dedupe_key text unique,
  payload jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 1.0 check (confidence between 0 and 1)
);

create index if not exists founder_os_events_correlation_idx on public.founder_os_events(correlation_id);
create index if not exists founder_os_events_source_time_idx on public.founder_os_events(source, occurred_at desc);
create index if not exists founder_os_events_entity_idx on public.founder_os_events(entity_type, entity_id, occurred_at desc);

create table if not exists public.founder_os_agent_runs (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  agent_id text not null references public.founder_os_agents(id) on update cascade,
  sop_id text references public.founder_os_sops(id) on update cascade,
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','succeeded','failed','unknown_result','cancelled')),
  risk_class smallint not null check (risk_class between 0 and 4),
  autonomy_level smallint not null check (autonomy_level between 1 and 5),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists founder_os_runs_status_idx on public.founder_os_agent_runs(status, created_at desc);
create index if not exists founder_os_runs_agent_idx on public.founder_os_agent_runs(agent_id, created_at desc);
create index if not exists founder_os_runs_correlation_idx on public.founder_os_agent_runs(correlation_id);

create table if not exists public.founder_os_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.founder_os_agent_runs(id) on delete set null,
  title text not null,
  recommended_action jsonb not null default '{}'::jsonb,
  risk_class smallint not null check (risk_class between 0 and 4),
  autonomy_level smallint not null check (autonomy_level between 1 and 5),
  requires_human boolean not null default true,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executed','cancelled')),
  why_now text,
  business_impact text,
  preview jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  decided_by_actor text,
  decided_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint founder_os_high_risk_human_gate check (risk_class < 3 or requires_human = true)
);

create index if not exists founder_os_decisions_pending_idx on public.founder_os_decisions(status, created_at desc) where status = 'pending';
create index if not exists founder_os_decisions_run_idx on public.founder_os_decisions(run_id);

create table if not exists public.founder_os_policies (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('global','pillar','agent','sop','connector')),
  scope_id text,
  policy_key text not null,
  policy_value jsonb not null,
  active boolean not null default true,
  created_by_actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope_type, scope_id, policy_key)
);

create table if not exists public.founder_os_outbox (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  connector_id text not null references public.founder_os_connectors(id) on update cascade,
  action text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','succeeded','failed','unknown_result','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  non_retriable boolean not null default false,
  last_error jsonb,
  result jsonb,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_os_outbox_queue_idx on public.founder_os_outbox(status, next_attempt_at, created_at) where status in ('queued','failed');
create index if not exists founder_os_outbox_correlation_idx on public.founder_os_outbox(correlation_id);

create table if not exists public.founder_os_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info','warning','critical')),
  pillar_id text references public.founder_os_pillars(id) on update cascade,
  component text not null,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  correlation_id text,
  acknowledged_by_actor text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists founder_os_alerts_open_idx on public.founder_os_alerts(severity, created_at desc) where status = 'open';

create table if not exists public.founder_os_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('source','signal','claim','fact','memory')),
  domain text not null,
  subject text not null,
  content text not null,
  source_type text,
  source_ref text,
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  verified boolean not null default false,
  verified_by_actor text,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_os_fact_verification check (stage not in ('fact','memory') or verified = true)
);

create index if not exists founder_os_knowledge_stage_idx on public.founder_os_knowledge_items(stage, domain, updated_at desc);
create index if not exists founder_os_knowledge_source_idx on public.founder_os_knowledge_items(source_type, source_ref);

create table if not exists public.founder_os_knowledge_edges (
  from_id uuid not null references public.founder_os_knowledge_items(id) on delete cascade,
  to_id uuid not null references public.founder_os_knowledge_items(id) on delete cascade,
  relation text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, relation),
  constraint founder_os_no_self_edge check (from_id <> to_id)
);

-- Seed the six pillars.
insert into public.founder_os_pillars(id, display_name, purpose, position) values
  ('COMMAND','COMMAND','Context, priorities, decisions and central supervision',1),
  ('COMMS','COMMS','Inbox and communication intelligence',2),
  ('FINANCE','FINANCE','CRM, revenue, payments and reconciliation',3),
  ('CONTENT','CONTENT','Multichannel content operations',4),
  ('KNOWLEDGE','KNOWLEDGE','Verified documentation and memory',5),
  ('AUTOMATIONS','AUTOMATIONS','Workflow, webhook and infrastructure continuity',6)
on conflict (id) do update set display_name = excluded.display_name, purpose = excluded.purpose, position = excluded.position, updated_at = now();

-- Seed the eight agents.
insert into public.founder_os_agents(id,pillar_id,display_name,mission,default_autonomy,max_risk) values
  ('brain-librarian','COMMAND','Brain Librarian','Organize context, decisions and governed knowledge',4,1),
  ('inbox-triage','COMMS','Inbox Triage','Classify inboxes and prepare complete reply drafts',2,2),
  ('slack-scout','COMMS','Communication Scout','Summarize channels and extract commitments and blockers',5,1),
  ('crm-pulse','FINANCE','CRM Pulse','Qualify leads and maintain pipeline state',4,1),
  ('payment-pulse','FINANCE','Payment Pulse','Reconcile orders, invoices and payment evidence without moving funds',4,1),
  ('social-pulse','CONTENT','Social Pulse','Build channel-ready content packages and learn from performance',2,2),
  ('notion-sync','KNOWLEDGE','Notion Sync','Synchronize verified knowledge and documentation',4,1),
  ('studio-monitor','AUTOMATIONS','Studio Monitor','Monitor and self-heal reversible workflow failures',5,1)
on conflict (id) do update set pillar_id=excluded.pillar_id, display_name=excluded.display_name, mission=excluded.mission, default_autonomy=excluded.default_autonomy, max_risk=excluded.max_risk, updated_at=now();

-- Seed the eight SOPs.
insert into public.founder_os_sops(id,pillar_id,owner_agent_id,trigger_kind,default_autonomy,risk_class,approval_required,objective,output_contract) values
  ('daily-command-brief','COMMAND','brain-librarian','schedule_daily',5,0,false,'Produce a decision-first daily brief','{"outputs":["top_decisions","exceptions","cash_snapshot","pipeline_risks","automation_health","today_focus"]}'::jsonb),
  ('inbox-triage-and-draft','COMMS','inbox-triage','new_or_unread_email',2,2,true,'Classify mail, extract asks and prepare a complete reply','{"outputs":["classification","priority","commitments","draft_reply","approval_card"]}'::jsonb),
  ('communications-scout','COMMS','slack-scout','schedule_or_message_batch',5,0,false,'Summarize streams and extract decisions, blockers and commitments','{"outputs":["summary","decisions","blockers","commitments","knowledge_signals"]}'::jsonb),
  ('lead-and-crm-pulse','FINANCE','crm-pulse','new_lead_or_activity',4,1,false,'Qualify opportunities and maintain standard CRM state','{"outputs":["lead_score","stage","owner","next_action","stale_alert"]}'::jsonb),
  ('payment-reconciliation','FINANCE','payment-pulse','payment_or_order_change',4,1,false,'Reconcile expected and observed money states without transfers','{"outputs":["matched_records","discrepancy","amount_due","payment_status","escalation"]}'::jsonb),
  ('content-multichannel-pack','CONTENT','social-pulse','approved_idea_campaign_or_release',2,2,true,'Generate brand-consistent multichannel content and scheduling proposal','{"outputs":["master_angle","channel_variants","visual_brief","approval_card"]}'::jsonb),
  ('verified-knowledge-sync','KNOWLEDGE','notion-sync','verified_fact_or_release',4,1,false,'Sync verified facts, releases and backlinks; flag stale documentation','{"outputs":["updated_pages","backlinks","stale_flags","conflict_flags"]}'::jsonb),
  ('automation-health-watch','AUTOMATIONS','studio-monitor','schedule_5m_or_failure_event',5,1,false,'Detect failures and repair only reversible known-safe cases','{"outputs":["health_state","incidents","safe_fixes_applied","unresolved_escalations"]}'::jsonb)
on conflict (id) do update set pillar_id=excluded.pillar_id, owner_agent_id=excluded.owner_agent_id, trigger_kind=excluded.trigger_kind, default_autonomy=excluded.default_autonomy, risk_class=excluded.risk_class, approval_required=excluded.approval_required, objective=excluded.objective, output_contract=excluded.output_contract, updated_at=now();

-- Connector registry contains no credentials.
insert into public.founder_os_connectors(id,provider,status,capabilities) values
  ('gmail','Google','not_configured',array['read','draft','send']),
  ('whatsapp','Meta','not_configured',array['read','send','template']),
  ('meta-social','Meta','not_configured',array['read_metrics','publish']),
  ('github','GitHub','not_configured',array['read','branch','commit','pr']),
  ('notion','Notion','not_configured',array['read','write']),
  ('supabase','Supabase','not_configured',array['read','write','health']),
  ('n8n','n8n','not_configured',array['trigger','inspect','retry']),
  ('cloudflare','Cloudflare','not_configured',array['deploy','logs','dns','workers'])
on conflict (id) do nothing;

-- Default policy seeds.
insert into public.founder_os_policies(scope_type,scope_id,policy_key,policy_value,created_by_actor) values
  ('global',null,'risk_autonomy_matrix','{"R0":5,"R1":4,"R2":2,"R3":2,"R4":1}'::jsonb,'migration'),
  ('global',null,'verify_after_external_write','true'::jsonb,'migration'),
  ('global',null,'never_blind_retry_irreversible','true'::jsonb,'migration')
on conflict (scope_type,scope_id,policy_key) do update set policy_value=excluded.policy_value, updated_at=now();

-- Founder OS is server-side only in v1. Browser clients get no direct table access.
alter table public.founder_os_pillars enable row level security;
alter table public.founder_os_agents enable row level security;
alter table public.founder_os_sops enable row level security;
alter table public.founder_os_connectors enable row level security;
alter table public.founder_os_events enable row level security;
alter table public.founder_os_agent_runs enable row level security;
alter table public.founder_os_decisions enable row level security;
alter table public.founder_os_policies enable row level security;
alter table public.founder_os_outbox enable row level security;
alter table public.founder_os_alerts enable row level security;
alter table public.founder_os_knowledge_items enable row level security;
alter table public.founder_os_knowledge_edges enable row level security;

revoke all on public.founder_os_pillars from anon, authenticated;
revoke all on public.founder_os_agents from anon, authenticated;
revoke all on public.founder_os_sops from anon, authenticated;
revoke all on public.founder_os_connectors from anon, authenticated;
revoke all on public.founder_os_events from anon, authenticated;
revoke all on public.founder_os_agent_runs from anon, authenticated;
revoke all on public.founder_os_decisions from anon, authenticated;
revoke all on public.founder_os_policies from anon, authenticated;
revoke all on public.founder_os_outbox from anon, authenticated;
revoke all on public.founder_os_alerts from anon, authenticated;
revoke all on public.founder_os_knowledge_items from anon, authenticated;
revoke all on public.founder_os_knowledge_edges from anon, authenticated;
