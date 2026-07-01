alter table connections
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists data jsonb not null default '{}'::jsonb;

update connections
set data = '{}'::jsonb
where data is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'connections_data_is_object'
  ) then
    alter table connections
      add constraint connections_data_is_object check (jsonb_typeof(data) = 'object');
  end if;
end $$;
