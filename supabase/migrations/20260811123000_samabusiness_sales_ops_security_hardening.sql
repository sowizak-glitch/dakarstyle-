-- Harden Sales Ops objects so browser roles cannot bypass the custom session API.

alter view public.sama_customer_360_v2 set (security_invoker = true);

revoke all on public.sama_customer_360_v2 from public, anon, authenticated;
grant select on public.sama_customer_360_v2 to service_role;

revoke execute on function public.sama_sales_autolink_customer() from public, anon, authenticated;
revoke execute on function public.sama_orders_autolink_customer() from public, anon, authenticated;
revoke execute on function public.sama_sales_ops_create_sale(uuid,uuid,text,text,text,text,jsonb,numeric,text,boolean,timestamptz,numeric,text,text) from public, anon, authenticated;

grant execute on function public.sama_sales_autolink_customer() to service_role;
grant execute on function public.sama_orders_autolink_customer() to service_role;
grant execute on function public.sama_sales_ops_create_sale(uuid,uuid,text,text,text,text,jsonb,numeric,text,boolean,timestamptz,numeric,text,text) to service_role;
