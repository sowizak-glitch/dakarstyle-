drop policy if exists senecompare_source_directory_service_role_all on public.senecompare_source_directory;
create policy senecompare_source_directory_service_role_all
on public.senecompare_source_directory
for all
to service_role
using (true)
with check (true);

revoke execute on function public.senecompare_search_catalog(text, text, text, bigint, text, text, integer) from anon, authenticated;
grant execute on function public.senecompare_search_catalog(text, text, text, bigint, text, text, integer) to service_role;
