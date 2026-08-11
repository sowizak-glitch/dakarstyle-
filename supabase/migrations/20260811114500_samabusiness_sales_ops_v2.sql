-- SAMABUSINESS Sales Operations V2 — 2026-08-11
-- Additive/backward-compatible: client directory, phone dedupe, historical backfill,
-- customer 360 view, atomic/idempotent sale + optional delivery orchestration.

create or replace function public.sama_normalize_phone(p_phone text)
returns text language plpgsql immutable set search_path=public as $$
declare v_digits text;
begin
  v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if v_digits='' then return null; end if;
  if left(v_digits,2)='00' then v_digits:=substr(v_digits,3); end if;
  if length(v_digits)=9 and left(v_digits,1) in ('3','7') then v_digits:='221'||v_digits; end if;
  return v_digits;
end;$$;

alter table public.sama_customers
  add column if not exists default_address text,
  add column if not exists default_area text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='sama_customers' and column_name='normalized_phone') then
    alter table public.sama_customers add column normalized_phone text generated always as (public.sama_normalize_phone(coalesce(phone,whatsapp))) stored;
  end if;
end $$;

create unique index if not exists sama_customers_merchant_normalized_phone_uidx on public.sama_customers(merchant_id,normalized_phone) where normalized_phone is not null;
create index if not exists sama_customers_merchant_updated_idx on public.sama_customers(merchant_id,updated_at desc);

with sale_source as (
  select distinct on (s.merchant_id,public.sama_normalize_phone(s.customer_phone_snapshot)) s.merchant_id,
    coalesce(nullif(btrim(s.customer_name_snapshot),''),'Client') customer_name,
    nullif(btrim(s.customer_phone_snapshot),'') customer_phone,
    public.sama_normalize_phone(s.customer_phone_snapshot) normalized,s.happened_at
  from public.sama_sales s
  where s.deleted_at is null and public.sama_normalize_phone(s.customer_phone_snapshot) is not null
  order by s.merchant_id,public.sama_normalize_phone(s.customer_phone_snapshot),s.happened_at desc
)
insert into public.sama_customers(merchant_id,name,phone,whatsapp,notes,created_at,updated_at)
select merchant_id,customer_name,customer_phone,customer_phone,'Créé automatiquement depuis l’historique des ventes',now(),now() from sale_source
on conflict (merchant_id,normalized_phone) where normalized_phone is not null do update set
  name=case when btrim(coalesce(public.sama_customers.name,'')) in ('','Client') then excluded.name else public.sama_customers.name end,
  phone=coalesce(public.sama_customers.phone,excluded.phone),whatsapp=coalesce(public.sama_customers.whatsapp,excluded.whatsapp),updated_at=greatest(public.sama_customers.updated_at,excluded.updated_at);

with order_source as (
  select distinct on (o.merchant_id,public.sama_normalize_phone(coalesce(o.customer_phone,o.customer_whatsapp))) o.merchant_id,
    coalesce(nullif(btrim(o.customer_name),''),'Client') customer_name,nullif(btrim(coalesce(o.customer_phone,o.customer_whatsapp)),'') customer_phone,
    nullif(btrim(o.delivery_address),'') delivery_address,nullif(btrim(o.delivery_area),'') delivery_area,
    public.sama_normalize_phone(coalesce(o.customer_phone,o.customer_whatsapp)) normalized,o.created_at
  from public.sama_orders o
  where public.sama_normalize_phone(coalesce(o.customer_phone,o.customer_whatsapp)) is not null
  order by o.merchant_id,public.sama_normalize_phone(coalesce(o.customer_phone,o.customer_whatsapp)),o.created_at desc
)
insert into public.sama_customers(merchant_id,name,phone,whatsapp,default_address,default_area,notes,created_at,updated_at)
select merchant_id,customer_name,customer_phone,customer_phone,delivery_address,delivery_area,'Créé automatiquement depuis l’historique des commandes',now(),now() from order_source
on conflict (merchant_id,normalized_phone) where normalized_phone is not null do update set
  name=case when btrim(coalesce(public.sama_customers.name,'')) in ('','Client') then excluded.name else public.sama_customers.name end,
  phone=coalesce(public.sama_customers.phone,excluded.phone),whatsapp=coalesce(public.sama_customers.whatsapp,excluded.whatsapp),
  default_address=coalesce(nullif(public.sama_customers.default_address,''),excluded.default_address),default_area=coalesce(nullif(public.sama_customers.default_area,''),excluded.default_area),updated_at=greatest(public.sama_customers.updated_at,excluded.updated_at);

update public.sama_sales s set customer_id=c.id,updated_at=now() from public.sama_customers c
where s.merchant_id=c.merchant_id and s.customer_id is null and c.normalized_phone is not null and c.normalized_phone=public.sama_normalize_phone(s.customer_phone_snapshot);
update public.sama_orders o set customer_id=c.id,updated_at=now() from public.sama_customers c
where o.merchant_id=c.merchant_id and o.customer_id is null and c.normalized_phone is not null and c.normalized_phone=public.sama_normalize_phone(coalesce(o.customer_phone,o.customer_whatsapp));

with latest_address as (
 select distinct on(o.customer_id) o.customer_id,o.delivery_address,o.delivery_area from public.sama_orders o
 where o.customer_id is not null and nullif(btrim(o.delivery_address),'') is not null order by o.customer_id,o.created_at desc
)
update public.sama_customers c set default_address=coalesce(nullif(c.default_address,''),a.delivery_address),default_area=coalesce(nullif(c.default_area,''),a.delivery_area),updated_at=now()
from latest_address a where c.id=a.customer_id and (nullif(c.default_address,'') is null or nullif(c.default_area,'') is null);

create or replace view public.sama_customer_360_v2 as
with sales_agg as (
 select merchant_id,customer_id,count(*)::bigint purchase_count,coalesce(sum(total_amount),0)::numeric total_purchased,
 coalesce(sum(paid_amount),0)::numeric total_paid,coalesce(sum(greatest(coalesce(remaining_amount,total_amount-paid_amount),0)),0)::numeric outstanding_amount,max(happened_at) last_purchase_at
 from public.sama_sales where deleted_at is null and customer_id is not null group by merchant_id,customer_id
), order_agg as (
 select merchant_id,customer_id,
 count(*) filter(where delivery_status in ('pending','assigned','picked_up') or status in ('preparing','ready','out_for_delivery'))::bigint open_delivery_count,
 count(*) filter(where requested_for is not null and (requested_for at time zone 'Africa/Dakar')::date=(now() at time zone 'Africa/Dakar')::date and delivery_status not in ('delivered','failed','returned','not_required') and status not in ('cancelled','failed','delivered'))::bigint delivery_today_count,
 min(requested_for) filter(where requested_for is not null and delivery_status not in ('delivered','failed','returned','not_required') and status not in ('cancelled','failed','delivered')) next_delivery_at,max(created_at) last_order_at
 from public.sama_orders where customer_id is not null group by merchant_id,customer_id
)
select c.id,c.merchant_id,c.name,c.phone,c.whatsapp,c.normalized_phone,c.default_address,c.default_area,c.notes,c.metadata,c.created_at,c.updated_at,
 coalesce(s.purchase_count,0)::bigint purchase_count,coalesce(s.total_purchased,0)::numeric total_purchased,coalesce(s.total_paid,0)::numeric total_paid,coalesce(s.outstanding_amount,0)::numeric outstanding_amount,s.last_purchase_at,
 coalesce(o.open_delivery_count,0)::bigint open_delivery_count,coalesce(o.delivery_today_count,0)::bigint delivery_today_count,o.next_delivery_at,o.last_order_at
from public.sama_customers c left join sales_agg s on s.merchant_id=c.merchant_id and s.customer_id=c.id left join order_agg o on o.merchant_id=c.merchant_id and o.customer_id=c.id;

create or replace function public.sama_sales_ops_create_sale(
 p_merchant_id uuid,p_client_ref uuid,p_customer_name text,p_customer_phone text,p_customer_address text,p_customer_area text,p_items jsonb,p_paid_amount numeric,p_payment_method text,
 p_delivery_required boolean default false,p_scheduled_for timestamptz default null,p_delivery_cost numeric default 0,p_source text default 'manual',p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_ref uuid:=coalesce(p_client_ref,gen_random_uuid());v_phone_norm text:=public.sama_normalize_phone(p_customer_phone);v_customer public.sama_customers%rowtype;v_existing_sale public.sama_sales%rowtype;v_existing_order public.sama_orders%rowtype;v_existing_delivery public.liv_deliveries%rowtype;v_order_id uuid;v_order_number text;v_delivery_id uuid;v_sale jsonb;v_sale_id uuid;v_total numeric;v_paid numeric;v_remaining numeric;v_item jsonb;v_delivery_number text;v_delivery_code text;v_public_token text;
begin
 if p_merchant_id is null then raise exception 'merchant_required'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'items_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_merchant_id::text||':'||v_ref::text,0));
 select * into v_existing_sale from public.sama_sales where merchant_id=p_merchant_id and client_ref=v_ref and deleted_at is null limit 1;
 if found then
  if v_existing_sale.order_id is not null then select * into v_existing_order from public.sama_orders where id=v_existing_sale.order_id and merchant_id=p_merchant_id; if v_existing_order.delivery_id is not null then select * into v_existing_delivery from public.liv_deliveries where id=v_existing_order.delivery_id and merchant_id=p_merchant_id; end if; end if;
  if v_existing_sale.customer_id is not null then select * into v_customer from public.sama_customers where id=v_existing_sale.customer_id; end if;
  return jsonb_build_object('replayed',true,'sale',to_jsonb(v_existing_sale),'customer',case when v_customer.id is null then null else to_jsonb(v_customer) end,'order',case when v_existing_order.id is null then null else to_jsonb(v_existing_order) end,'delivery',case when v_existing_delivery.id is null then null else to_jsonb(v_existing_delivery) end);
 end if;
 if v_phone_norm is not null then
  insert into public.sama_customers(merchant_id,name,phone,whatsapp,default_address,default_area,created_at,updated_at)
  values(p_merchant_id,coalesce(nullif(btrim(p_customer_name),''),'Client'),nullif(btrim(p_customer_phone),''),nullif(btrim(p_customer_phone),''),nullif(btrim(p_customer_address),''),nullif(btrim(p_customer_area),''),now(),now())
  on conflict(merchant_id,normalized_phone) where normalized_phone is not null do update set name=case when excluded.name<>'Client' then excluded.name else public.sama_customers.name end,phone=coalesce(excluded.phone,public.sama_customers.phone),whatsapp=coalesce(excluded.whatsapp,public.sama_customers.whatsapp),default_address=coalesce(excluded.default_address,public.sama_customers.default_address),default_area=coalesce(excluded.default_area,public.sama_customers.default_area),updated_at=now() returning * into v_customer;
 end if;
 if coalesce(p_delivery_required,false) then
  if nullif(btrim(p_customer_phone),'') is null then raise exception 'delivery_phone_required'; end if;
  if nullif(btrim(p_customer_address),'') is null then raise exception 'delivery_address_required'; end if;
  select public.sama_business_order_number(p_merchant_id) into v_order_number;
  insert into public.sama_orders(merchant_id,client_ref,order_number,source,status,payment_status,delivery_status,customer_id,customer_name,customer_phone,customer_whatsapp,delivery_address,delivery_area,requested_for,subtotal,total_amount,paid_amount,cost_amount,delivery_cost,payment_method,notes,metadata,created_at,updated_at,confirmed_at)
  values(p_merchant_id,v_ref,v_order_number,case when p_source in('manual','whatsapp','voice','photo','web','import') then p_source else 'manual' end,'confirmed','unpaid','pending',case when v_customer.id is null then null else v_customer.id end,nullif(btrim(p_customer_name),''),nullif(btrim(p_customer_phone),''),nullif(btrim(p_customer_phone),''),nullif(btrim(p_customer_address),''),nullif(btrim(p_customer_area),''),p_scheduled_for,0,0,0,0,greatest(coalesce(p_delivery_cost,0),0),coalesce(nullif(p_payment_method,''),'cash'),nullif(btrim(p_notes),''),jsonb_build_object('created_by','samabusiness-sales-ops-v2'),now(),now(),now()) returning id into v_order_id;
 end if;
 select public.sama_business_create_sale(p_merchant_id,v_ref,coalesce(p_customer_name,''),coalesce(p_customer_phone,''),coalesce(nullif(btrim(p_notes),''),'Vente'),p_items,greatest(coalesce(p_paid_amount,0),0),coalesce(nullif(p_payment_method,''),'cash'),greatest(coalesce(p_delivery_cost,0),0),now(),case when p_source in('manual','voice','text','image','whatsapp','import') then p_source when p_source='photo' then 'image' else 'manual' end,v_order_id) into v_sale;
 v_sale_id:=(v_sale->>'id')::uuid;v_total:=coalesce((v_sale->>'total_amount')::numeric,0);v_paid:=coalesce((v_sale->>'paid_amount')::numeric,0);v_remaining:=greatest(v_total-v_paid,0);
 update public.sama_sales set customer_id=case when v_customer.id is null then customer_id else v_customer.id end,notes=nullif(btrim(p_notes),''),updated_at=now() where id=v_sale_id and merchant_id=p_merchant_id;
 if v_order_id is not null then
  for v_item in select value from jsonb_array_elements(p_items) loop
   insert into public.sama_order_items(merchant_id,order_id,product_id,product_name,variant,quantity,unit_price,unit_cost,notes) values(p_merchant_id,v_order_id,nullif(v_item->>'product_id','')::uuid,coalesce(nullif(btrim(v_item->>'product_name'),''),'Article'),nullif(btrim(v_item->>'variant'),''),greatest(coalesce((v_item->>'quantity')::numeric,1),.001),greatest(coalesce((v_item->>'unit_price')::numeric,0),0),greatest(coalesce((v_item->>'unit_cost')::numeric,0),0),null);
  end loop;
  v_delivery_number:='LIV-'||to_char(clock_timestamp() at time zone 'Africa/Dakar','YYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));v_delivery_code:=lpad((floor(random()*9000)+1000)::int::text,4,'0');v_public_token:=encode(gen_random_bytes(24),'hex');
  insert into public.liv_deliveries(merchant_id,client_ref,delivery_number,source_type,source_reference,recipient_name,recipient_phone,delivery_address,delivery_area,package_description,package_value,amount_to_collect,payment_received,delivery_fee,payment_expected,payment_status,provider,status,priority,delivery_code,public_token,scheduled_for,recipient_notes,created_at,updated_at)
  values(p_merchant_id,v_ref,v_delivery_number,'sama_business_order',v_order_id::text,coalesce(nullif(btrim(p_customer_name),''),'Client'),btrim(p_customer_phone),btrim(p_customer_address),nullif(btrim(p_customer_area),''),'Commande '||v_order_number,v_total,v_remaining,0,0,case when p_payment_method in('cash','wave','orange_money') then p_payment_method else 'other' end,case when v_remaining>0 then 'unpaid' else 'paid' end,'own_fleet','unassigned','normal',v_delivery_code,v_public_token,p_scheduled_for,nullif(btrim(p_notes),''),now(),now()) returning id into v_delivery_id;
  update public.sama_orders set customer_id=case when v_customer.id is null then customer_id else v_customer.id end,delivery_id=v_delivery_id,delivery_status='pending',payment_status=case when v_paid>=v_total and v_total>0 then 'paid' when v_paid>0 then 'partial' else 'unpaid' end,updated_at=now() where id=v_order_id and merchant_id=p_merchant_id;
 end if;
 select * into v_existing_sale from public.sama_sales where id=v_sale_id;if v_order_id is not null then select * into v_existing_order from public.sama_orders where id=v_order_id;end if;if v_delivery_id is not null then select * into v_existing_delivery from public.liv_deliveries where id=v_delivery_id;end if;
 return jsonb_build_object('replayed',false,'sale',to_jsonb(v_existing_sale),'customer',case when v_customer.id is null then null else to_jsonb(v_customer) end,'order',case when v_existing_order.id is null then null else to_jsonb(v_existing_order) end,'delivery',case when v_existing_delivery.id is null then null else to_jsonb(v_existing_delivery) end);
end;$$;

create or replace function public.sama_sales_autolink_customer() returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer_id uuid;begin if new.customer_id is not null or public.sama_normalize_phone(new.customer_phone_snapshot) is null then return new;end if;insert into public.sama_customers(merchant_id,name,phone,whatsapp,created_at,updated_at) values(new.merchant_id,coalesce(nullif(btrim(new.customer_name_snapshot),''),'Client'),nullif(btrim(new.customer_phone_snapshot),''),nullif(btrim(new.customer_phone_snapshot),''),now(),now()) on conflict(merchant_id,normalized_phone) where normalized_phone is not null do update set name=case when excluded.name<>'Client' then excluded.name else public.sama_customers.name end,phone=coalesce(excluded.phone,public.sama_customers.phone),whatsapp=coalesce(excluded.whatsapp,public.sama_customers.whatsapp),updated_at=now() returning id into v_customer_id;new.customer_id:=v_customer_id;return new;end;$$;
drop trigger if exists trg_sama_sales_autolink_customer on public.sama_sales;create trigger trg_sama_sales_autolink_customer before insert or update of customer_phone_snapshot,customer_name_snapshot,customer_id on public.sama_sales for each row execute function public.sama_sales_autolink_customer();

create or replace function public.sama_orders_autolink_customer() returns trigger language plpgsql security definer set search_path=public as $$
declare v_customer_id uuid;begin if new.customer_id is not null or public.sama_normalize_phone(coalesce(new.customer_phone,new.customer_whatsapp)) is null then return new;end if;insert into public.sama_customers(merchant_id,name,phone,whatsapp,default_address,default_area,created_at,updated_at) values(new.merchant_id,coalesce(nullif(btrim(new.customer_name),''),'Client'),nullif(btrim(new.customer_phone),''),nullif(btrim(coalesce(new.customer_whatsapp,new.customer_phone)),''),nullif(btrim(new.delivery_address),''),nullif(btrim(new.delivery_area),''),now(),now()) on conflict(merchant_id,normalized_phone) where normalized_phone is not null do update set name=case when excluded.name<>'Client' then excluded.name else public.sama_customers.name end,phone=coalesce(excluded.phone,public.sama_customers.phone),whatsapp=coalesce(excluded.whatsapp,public.sama_customers.whatsapp),default_address=coalesce(excluded.default_address,public.sama_customers.default_address),default_area=coalesce(excluded.default_area,public.sama_customers.default_area),updated_at=now() returning id into v_customer_id;new.customer_id:=v_customer_id;return new;end;$$;
drop trigger if exists trg_sama_orders_autolink_customer on public.sama_orders;create trigger trg_sama_orders_autolink_customer before insert or update of customer_phone,customer_whatsapp,customer_name,customer_id,delivery_address,delivery_area on public.sama_orders for each row execute function public.sama_orders_autolink_customer();