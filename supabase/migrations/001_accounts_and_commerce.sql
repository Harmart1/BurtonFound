-- Burton & Found / Supabase SQL editor, run ONCE in a new project.
-- Public access is RLS-limited; service role is held ONLY in Cloudflare secrets.
create extension if not exists pgcrypto;

-- Collector accounts: compatible with account-core.js
create table if not exists public.collector_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text not null default '', age_range text not null default '',
 collecting_experience text not null default '', purchase_purpose text not null default '', discovery_source text not null default '',
 interests text[] not null default '{}', newsletter_opt_in boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.collector_addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Home', recipient text not null, line1 text not null, line2 text not null default '',
 city text not null, region text not null, postal_code text not null, country text not null default 'Canada',is_default boolean not null default false
);
create table if not exists public.collector_watchlist (
 user_id uuid not null references auth.users(id) on delete cascade, sku text not null,
 primary key(user_id,sku)
);
create table if not exists public.collector_active_carts (
 user_id uuid primary key references auth.users(id) on delete cascade, item_skus text[] not null default '{}', updated_at timestamptz not null default now()
);
create table if not exists public.collector_saved_carts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, item_skus text[] not null default '{}', created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

-- Commerce: never grant writes to visitor roles.
create table if not exists public.bf_products (
 sku text primary key, title text not null, price_cents integer not null check(price_cents>=0),
 currency text not null default 'cad' check(currency='cad'), active boolean not null default true, collection text not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.bf_units (
 id text primary key, sold_order_id uuid, sold_at timestamptz
);
create table if not exists public.bf_product_units (
 sku text not null references public.bf_products(sku) on delete cascade,
 unit_id text not null references public.bf_units(id),primary key(sku,unit_id)
);
create table if not exists public.bf_checkout_holds (
 id uuid primary key default gen_random_uuid(), customer_id uuid references auth.users(id) on delete set null,
 item_skus text[] not null, unit_ids text[] not null, item_lines jsonb not null, subtotal_cents integer not null,
 stripe_session_id text unique, status text not null default 'creating' check(status in ('creating','reserved','paid','expired','released','review')),
 expires_at timestamptz not null default (now()+interval '45 minutes'), created_at timestamptz not null default now(),
 check(cardinality(item_skus)>0)
);
create table if not exists public.bf_orders (
 id uuid primary key default gen_random_uuid(), hold_id uuid not null unique references public.bf_checkout_holds(id),
 customer_id uuid references auth.users(id) on delete set null,
 stripe_session_id text not null unique, payment_intent text, email text, customer_name text,
 shipping_address jsonb, item_lines jsonb not null,
 subtotal_cents integer not null,shipping_cents integer not null,total_cents integer not null,
 payment_status text not null check(payment_status in ('paid','review','refunded')),
 fulfillment_status text not null default 'processing' check(fulfillment_status in ('processing','packed','shipped','delivered','needs_attention')),
 carrier text not null default '', tracking_number text not null default '',shipped_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.bf_units add constraint bf_units_order_fk foreign key(sold_order_id) references public.bf_orders(id);
create table if not exists public.bf_webhook_events(id text primary key, event_type text not null,processed_at timestamptz not null default now());
create table if not exists public.bf_admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create index if not exists bf_product_units_unit_idx on public.bf_product_units(unit_id);
create index if not exists bf_holds_status_idx on public.bf_checkout_holds(status,expires_at);
create index if not exists bf_orders_customer_idx on public.bf_orders(customer_id,created_at desc);

-- Access: customer information is not public, and catalogue prices are read via service-only API.
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY array['collector_profiles','collector_addresses','collector_watchlist','collector_active_carts','collector_saved_carts','bf_products','bf_units','bf_product_units','bf_checkout_holds','bf_orders','bf_webhook_events','bf_admin_users'] LOOP
   EXECUTE format('alter table public.%I enable row level security',r);
   EXECUTE format('revoke all on table public.%I from anon, authenticated',r);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.collector_profiles,public.collector_addresses,public.collector_watchlist,public.collector_active_carts,public.collector_saved_carts TO authenticated;
GRANT SELECT ON public.bf_orders TO authenticated;

create policy "profile own select" on public.collector_profiles for select to authenticated using((select auth.uid())=user_id);
create policy "profile own insert" on public.collector_profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy "profile own update" on public.collector_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "profile own delete" on public.collector_profiles for delete to authenticated using((select auth.uid())=user_id);
create policy "address own select" on public.collector_addresses for select to authenticated using((select auth.uid())=user_id);
create policy "address own insert" on public.collector_addresses for insert to authenticated with check((select auth.uid())=user_id);
create policy "address own update" on public.collector_addresses for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "address own delete" on public.collector_addresses for delete to authenticated using((select auth.uid())=user_id);
create policy "watch own select" on public.collector_watchlist for select to authenticated using((select auth.uid())=user_id);
create policy "watch own insert" on public.collector_watchlist for insert to authenticated with check((select auth.uid())=user_id);
create policy "watch own update" on public.collector_watchlist for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "watch own delete" on public.collector_watchlist for delete to authenticated using((select auth.uid())=user_id);
create policy "active cart own select" on public.collector_active_carts for select to authenticated using((select auth.uid())=user_id);
create policy "active cart own insert" on public.collector_active_carts for insert to authenticated with check((select auth.uid())=user_id);
create policy "active cart own update" on public.collector_active_carts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "saved cart own select" on public.collector_saved_carts for select to authenticated using((select auth.uid())=user_id);
create policy "saved cart own insert" on public.collector_saved_carts for insert to authenticated with check((select auth.uid())=user_id);
create policy "saved cart own update" on public.collector_saved_carts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "saved cart own delete" on public.collector_saved_carts for delete to authenticated using((select auth.uid())=user_id);
create policy "order owner read" on public.bf_orders for select to authenticated using((select auth.uid())=customer_id);

-- Uses owner-definer only; exclusively executable by the trusted service role.
create or replace function public.bf_hold_cart(p_skus text[],p_customer_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_skus text[];v_units text[];v_lines jsonb;v_total integer;v_id uuid;v_count integer;
begin
 if p_skus is null or cardinality(p_skus)<1 or cardinality(p_skus)>12 then raise exception 'invalid cart';end if;
 select array_agg(distinct x order by x) into v_skus from unnest(p_skus) as x;
 if cardinality(v_skus)<>cardinality(p_skus) then raise exception 'duplicate item';end if;
 select count(*) into v_count from public.bf_products where sku=any(v_skus) and active=true;
 if v_count<>cardinality(v_skus) then raise exception 'unknown or not available item';end if;
 select array_agg(distinct pu.unit_id order by pu.unit_id) into v_units
 from public.bf_product_units pu where pu.sku=any(v_skus);
 if v_units is null then raise exception 'missing physical inventory';end if;
 -- The sum of component counts must equal distinct units; overlapping cart SKUs cannot buy same physical page twice.
 select count(*) into v_count from public.bf_product_units where sku=any(v_skus);
 if v_count<>cardinality(v_units) then raise exception 'overlap between bundles and individual items';end if;
 -- Lock units before checking reservations, so simultaneous checkouts cannot both hold one page.
 perform 1 from public.bf_units where id=any(v_units) order by id for update;
 if exists(select 1 from public.bf_units where id=any(v_units) and sold_order_id is not null) then raise exception 'item already sold';end if;
 if exists(select 1 from public.bf_checkout_holds h where h.unit_ids && v_units and h.status in ('creating','reserved','review') and h.expires_at>now()) then raise exception 'item reserved by another collector';end if;
 -- Expired reservations may only be recycled after explicit Stripe-expiration webhook or manual administrative review.
 if exists(select 1 from public.bf_checkout_holds h where h.unit_ids && v_units and h.status in ('creating','reserved','review')) then raise exception 'item temporarily unavailable; please contact seller';end if;
 select coalesce(jsonb_agg(jsonb_build_object('sku',sku,'title',title,'price_cents',price_cents) order by sku),'[]'::jsonb),sum(price_cents)
 into v_lines,v_total from public.bf_products where sku=any(v_skus);
 insert into public.bf_checkout_holds(customer_id,item_skus,unit_ids,item_lines,subtotal_cents)
 values(p_customer_id,v_skus,v_units,v_lines,v_total) returning id into v_id;
 return jsonb_build_object('id',v_id,'lines',v_lines,'subtotal_cents',v_total);
end $$;

create or replace function public.bf_bind_stripe_session(p_hold_id uuid,p_session_id text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.bf_checkout_holds set stripe_session_id=p_session_id,status='reserved',expires_at=now()+interval '45 minutes'
 where id=p_hold_id and status='creating';
 if not found then raise exception 'checkout hold no longer active';end if;
 return true;
end $$;

create or replace function public.bf_release_hold(p_hold_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.bf_checkout_holds set status='released' where id=p_hold_id and status='creating';
 return found;
end $$;

create or replace function public.bf_mark_checkout_paid(p_session_id text,p_event_id text,p_amount integer,p_currency text,p_email text,p_shipping jsonb,p_payment_intent text,p_shipping_cents integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare h public.bf_checkout_holds%rowtype;v_id uuid;v_conflict boolean;v_status text;v_name text;
begin
 if exists(select 1 from public.bf_webhook_events where id=p_event_id) then return jsonb_build_object('status','duplicate');end if;
 select * into h from public.bf_checkout_holds where stripe_session_id=p_session_id for update;
 if not found then raise exception 'Stripe session not recognized';end if;
 if h.status='paid' then insert into public.bf_webhook_events(id,event_type) values(p_event_id,'paid-duplicate') on conflict do nothing;return jsonb_build_object('status','already_paid');end if;
 if p_currency<>'cad' or p_amount < h.subtotal_cents+greatest(p_shipping_cents,0) then raise exception 'payment totals mismatch; manual investigation required';end if;
 perform 1 from public.bf_units where id=any(h.unit_ids) order by id for update;
 select (h.status in ('expired','released','review') or exists(select 1 from public.bf_units where id=any(h.unit_ids) and sold_order_id is not null) or exists(select 1 from public.bf_checkout_holds other where other.id<>h.id and other.unit_ids && h.unit_ids and other.status in ('reserved','creating','review'))) into v_conflict;
 v_status:=case when v_conflict then 'review' else 'paid' end;
 v_name:=left(coalesce(p_shipping->>'name',''),120);
 insert into public.bf_orders(hold_id,customer_id,stripe_session_id,payment_intent,email,customer_name,shipping_address,item_lines,subtotal_cents,shipping_cents,total_cents,payment_status,fulfillment_status)
 values(h.id,h.customer_id,p_session_id,p_payment_intent,left(p_email,255),v_name,p_shipping,h.item_lines,h.subtotal_cents,greatest(p_shipping_cents,0),p_amount,v_status,case when v_conflict then 'needs_attention' else 'processing' end)
 on conflict(stripe_session_id) do update set stripe_session_id=excluded.stripe_session_id returning id into v_id;
 if not v_conflict then update public.bf_units set sold_order_id=v_id,sold_at=now() where id=any(h.unit_ids);end if;
 update public.bf_checkout_holds set status=case when v_conflict then 'review' else 'paid' end where id=h.id;
 insert into public.bf_webhook_events(id,event_type) values(p_event_id,'paid') on conflict do nothing;
 return jsonb_build_object('status',v_status,'order_id',v_id);
end $$;

create or replace function public.bf_expire_stripe_session(p_session_id text,p_event_id text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.bf_checkout_holds set status='expired' where stripe_session_id=p_session_id and status='reserved';
 insert into public.bf_webhook_events(id,event_type) values(p_event_id,'expired') on conflict do nothing;
 return true;
end $$;

-- Minimal public stock read via trusted Cloudflare function only.
create or replace view public.bf_public_stock as
select p.sku,p.price_cents,
 (p.active and not exists (
  select 1 from public.bf_product_units pu join public.bf_units u on u.id=pu.unit_id
  where pu.sku=p.sku and (
    u.sold_order_id is not null or exists (
      select 1 from public.bf_checkout_holds h where h.unit_ids @> array[u.id] and h.status in ('creating','reserved','review')
    )
  )
 )) as available
from public.bf_products p;
revoke all on public.bf_public_stock from anon,authenticated;

-- Minimal status view for the holder of an unguessable Stripe Checkout Session ID.
create or replace view public.bf_checkout_public_status as
 select h.stripe_session_id,
 case when h.status='paid' then 'paid' when h.status='review' then 'review' when h.status in ('expired','released') then 'expired' else 'processing' end as status,
 case when o.payment_status='paid' then left(o.id::text,8) else null end as order_ref
 from public.bf_checkout_holds h left join public.bf_orders o on o.hold_id=h.id;
revoke all on public.bf_checkout_public_status from anon,authenticated;
grant select on public.bf_public_stock,public.bf_checkout_public_status to service_role;
grant all on public.bf_products,public.bf_units,public.bf_product_units,public.bf_checkout_holds,public.bf_orders,public.bf_webhook_events,public.bf_admin_users to service_role;

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'not signed in';end if;
 -- Paid orders retain records for tax and fulfillment purposes; the owning account is detached.
 update public.bf_orders set customer_id=null where customer_id=auth.uid();
 update public.bf_checkout_holds set customer_id=null where customer_id=auth.uid();
 delete from auth.users where id=auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;

-- PostgreSQL defaults public EXECUTE on functions unless revoked.
revoke execute on function public.bf_hold_cart(text[],uuid),public.bf_bind_stripe_session(uuid,text),public.bf_release_hold(uuid),public.bf_mark_checkout_paid(text,text,integer,text,text,jsonb,text,integer),public.bf_expire_stripe_session(text,text) from public,anon,authenticated;
grant execute on function public.bf_hold_cart(text[],uuid),public.bf_bind_stripe_session(uuid,text),public.bf_release_hold(uuid),public.bf_mark_checkout_paid(text,text,integer,text,text,jsonb,text,integer),public.bf_expire_stripe_session(text,text) to service_role;
