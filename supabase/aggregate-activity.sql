-- Only daily aggregate counts. No visitor or order identifiers.
create table public.bf_daily_activity (
 day date not null,
 event text not null check (event in ('page_view','add_to_bag','checkout_open')),
 collection text not null check (collection in ('home','coca-cola','hollywood','automobiles','sets','guides','other')),
 count bigint not null default 0 check (count between 0 and 10000000),
 primary key(day,event,collection)
);
alter table public.bf_daily_activity enable row level security;
revoke all on public.bf_daily_activity from public, anon, authenticated;
grant select,insert,update,delete on public.bf_daily_activity to service_role;
create function public.bf_count_activity(p_event text,p_collection text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.bf_daily_activity(day,event,collection,count)
 values ((now() at time zone 'UTC')::date,p_event,p_collection,1)
 on conflict(day,event,collection) do update set count=least(public.bf_daily_activity.count+1,10000000);
 delete from public.bf_daily_activity where day < (now() at time zone 'UTC')::date - 89;
 return true;
end;
$$;
revoke all on function public.bf_count_activity(text,text) from public,anon,authenticated;
grant execute on function public.bf_count_activity(text,text) to service_role;
