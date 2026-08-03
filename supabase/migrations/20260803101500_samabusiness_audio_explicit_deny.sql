drop policy if exists sama_audio_transcriptions_deny_client_access on public.sama_audio_transcriptions;
create policy sama_audio_transcriptions_deny_client_access
  on public.sama_audio_transcriptions
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on policy sama_audio_transcriptions_deny_client_access on public.sama_audio_transcriptions is
  'Explicit defense-in-depth: browser roles can never read or mutate transcription audit metadata.';
