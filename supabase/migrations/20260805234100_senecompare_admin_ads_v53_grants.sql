grant usage on schema public to service_role;
grant select, insert, update, delete on public.senecompare_admin_users,
  public.senecompare_ad_campaigns,
  public.senecompare_analytics_events,
  public.senecompare_partner_leads to service_role;
