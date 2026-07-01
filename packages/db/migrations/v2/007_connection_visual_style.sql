alter table connections
  add column if not exists visual_style jsonb not null default '{}'::jsonb;

update connections
set visual_style = '{}'::jsonb
where visual_style is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'connections_visual_style_is_object'
  ) then
    alter table connections
      add constraint connections_visual_style_is_object check (jsonb_typeof(visual_style) = 'object');
  end if;
end $$;
