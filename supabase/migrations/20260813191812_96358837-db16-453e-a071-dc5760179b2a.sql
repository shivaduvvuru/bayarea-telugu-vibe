update public.content_items
set category = case when kind = 'event' then 'events' when kind = 'announcement' then 'temples' else 'news' end,
    updated_at = now()
where source ilike '%WordPress%'
  and (category is null or category like 'india-%' or category = 'political');