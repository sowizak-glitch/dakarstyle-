create table if not exists public.senecompare_media_assets (
  slug text primary key,
  mime_type text not null check (mime_type in ('image/webp','image/jpeg','image/png')),
  content_base64 text not null default '',
  sha256 text not null default '',
  width integer,
  height integer,
  updated_at timestamptz not null default now()
);

alter table public.senecompare_media_assets enable row level security;
revoke all on table public.senecompare_media_assets from anon, authenticated;
grant select, insert, update, delete on table public.senecompare_media_assets to service_role;

insert into public.senecompare_media_assets(slug,mime_type,width,height)
values
 ('samabusiness-campaign','image/webp',384,384),
 ('sowhat-africa-campaign','image/webp',384,384)
on conflict (slug) do nothing;

update public.senecompare_ad_campaigns
set image_url = case slug
  when 'samabusiness-launch' then 'https://senecompare.dakarstyle.com/media/samabusiness-campaign.webp'
  when 'sowhat-africa-culture' then 'https://senecompare.dakarstyle.com/media/sowhat-africa-campaign.webp'
  else image_url
end,
updated_at = now()
where slug in ('samabusiness-launch','sowhat-africa-culture');

alter table public.senecompare_partner_leads
  add column if not exists notification_sent_at timestamptz,
  add column if not exists contact_destination text not null default 'hellodakarstyle@gmail.com';

update public.senecompare_partner_leads
set contact_destination = 'hellodakarstyle@gmail.com'
where contact_destination is distinct from 'hellodakarstyle@gmail.com';

comment on column public.senecompare_partner_leads.notification_sent_at is
'Date de transmission de la demande vers la boite partenariats.';
comment on column public.senecompare_partner_leads.contact_destination is
'Adresse opérationnelle recevant les demandes partenaires.';

-- Les octets des deux créations sont chargés par le pipeline privé de livraison.
-- Ils ne sont pas committés en Base64 dans GitHub afin de garder le dépôt lisible.
