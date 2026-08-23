alter table public.content_items add column if not exists image_backfill_attempts integer default 0;

create or replace function public.increment_items_published(source_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update content_sources
  set items_published = content_sources.items_published + s.cnt
  from (select id, count(*) as cnt from unnest(source_ids) as id group by id) s
  where content_sources.id = s.id;
$$;

revoke all on function public.increment_items_published(uuid[]) from public, anon, authenticated;
grant execute on function public.increment_items_published(uuid[]) to service_role;