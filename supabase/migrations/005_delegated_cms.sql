-- Burton & Found delegated content management. Applied to production 2026-11-17.
-- No change to inventory quantities, payments, shipping or tax configuration.
create table if not exists public.bf_cms_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in('editor','manager')),
 active boolean not null default true,
 granted_by uuid references auth.users(id),
 granted_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.bf_cms_entries(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in('product','automobile','set','page')),
 item_key text not null check(length(item_key) between 2 and 80),
 draft_data jsonb not null default '{}'::jsonb check(jsonb_typeof(draft_data)='object'),
 published_data jsonb,
 is_published boolean not null default false,
 revision integer not null default 1 check(revision>0),
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 published_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 published_at timestamptz,
 unique(kind,item_key),
 check(published_data is null or jsonb_typeof(published_data)='object')
);
create index if not exists bf_cms_entries_public_idx on public.bf_cms_entries(kind,item_key) where is_published=true;
create table if not exists public.bf_cms_audit(
 id bigint generated always as identity primary key,
 entry_id uuid not null references public.bf_cms_entries(id) on delete cascade,
 actor_id uuid references auth.users(id),
 action text not null check(action in('created','edited','published','unpublished')),
 revision integer not null,
 change_time timestamptz not null default now(),
 before_data jsonb,
 after_data jsonb
);
create index if not exists bf_cms_audit_entry_idx on public.bf_cms_audit(entry_id,change_time desc);
alter table public.bf_cms_members enable row level security;
alter table public.bf_cms_entries enable row level security;
alter table public.bf_cms_audit enable row level security;
-- RLS deny by default: only Cloudflare secret-key server routes can read/write.
revoke all on public.bf_cms_members,public.bf_cms_entries,public.bf_cms_audit from anon,authenticated;
grant select,insert,update,delete on public.bf_cms_members,public.bf_cms_entries,public.bf_cms_audit to service_role;
grant usage,select on all sequences in schema public to service_role;

create or replace function public.bf_cms_log_change()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 insert into public.bf_cms_audit(entry_id,actor_id,action,revision,before_data,after_data)
 values(new.id,new.updated_by,
  case when tg_op='INSERT' then 'created'
    when old.is_published is distinct from new.is_published
    then case when new.is_published then 'published' else 'unpublished' end
    else 'edited' end,
  new.revision,case when tg_op='INSERT' then null else old.draft_data end,new.draft_data);
 return new;
end $$;
drop trigger if exists bf_cms_log_entry on public.bf_cms_entries;
create trigger bf_cms_log_entry after insert or update on public.bf_cms_entries
for each row execute function public.bf_cms_log_change();

-- Called with server-only service_role after the Worker has authenticated manager/owner.
-- Update existing commerce price and published editorial snapshot atomically.
create or replace function public.bf_cms_publish(
 p_kind text,p_key text,p_actor uuid,p_revision integer,p_visible boolean
) returns public.bf_cms_entries language plpgsql security invoker set search_path=public as $$
declare entry public.bf_cms_entries%rowtype; new_price integer;
begin
 select * into entry from public.bf_cms_entries
 where kind=p_kind and item_key=p_key for update;
 if not found then raise exception 'Content entry not found'; end if;
 if entry.revision<>p_revision then raise exception 'Content changed since you opened it'; end if;
 if p_visible and entry.kind='product' and (entry.draft_data ? 'priceCAD') then
  new_price:=round((entry.draft_data->>'priceCAD')::numeric*100)::integer;
  if new_price<1 or new_price>10000000 then raise exception 'Invalid catalogue price'; end if;
  update public.bf_products set price_cents=new_price,updated_at=now() where sku=entry.item_key;
 end if;
 update public.bf_cms_entries
 set is_published=p_visible,
 published_data=case when p_visible then draft_data else published_data end,
 published_by=case when p_visible then p_actor else published_by end,
 published_at=case when p_visible then now() else published_at end,
 updated_by=p_actor,updated_at=now(),revision=revision+1
 where id=entry.id returning * into entry;
 return entry;
end $$;
revoke all on function public.bf_cms_publish(text,text,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.bf_cms_publish(text,text,uuid,integer,boolean) to service_role;

-- Only server-validated image uploads, no direct browser insert policies.
-- Public URLs are intended exclusively for product photographs, not private records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bf-cms-media','bf-cms-media',true,5242880,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set file_size_limit=5242880,allowed_mime_types=array['image/webp','image/jpeg','image/png'];
