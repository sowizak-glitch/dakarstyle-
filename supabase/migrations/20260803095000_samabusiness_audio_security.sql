create table if not exists public.sama_audio_transcriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.sama_accounts(id) on delete cascade,
  merchant_id uuid not null references public.sama_merchants(id) on delete cascade,
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  mime_type text not null,
  language_hint text not null default 'auto' check (language_hint in ('auto', 'wo', 'fr')),
  status text not null default 'received' check (status in ('received', 'completed', 'empty', 'failed', 'unconfigured')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sama_audio_transcriptions_account_created_idx
  on public.sama_audio_transcriptions(account_id, created_at desc);
create index if not exists sama_audio_transcriptions_merchant_created_idx
  on public.sama_audio_transcriptions(merchant_id, created_at desc);

alter table public.sama_audio_transcriptions enable row level security;
revoke all on table public.sama_audio_transcriptions from public, anon, authenticated;
grant all on table public.sama_audio_transcriptions to service_role;

comment on table public.sama_audio_transcriptions is
  'Technical audit metadata for SAMABUSINESS voice transcription. Audio and transcript content are never stored.';
