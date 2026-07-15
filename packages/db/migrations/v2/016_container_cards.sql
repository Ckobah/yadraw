alter table card_types
  add column if not exists kind text not null default 'entity';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'card_types_kind_valid'
      and conrelid = 'card_types'::regclass
  ) then
    alter table card_types
      add constraint card_types_kind_valid
      check (kind in ('entity', 'container'));
  end if;
end $$;

alter table cards
  add column if not exists container_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_container_not_self'
      and conrelid = 'cards'::regclass
  ) then
    alter table cards
      add constraint cards_container_not_self
      check (container_id is null or container_id <> id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_container_on_same_board'
      and conrelid = 'cards'::regclass
  ) then
    alter table cards
      add constraint cards_container_on_same_board
      foreign key (board_id, container_id)
      references cards(board_id, id);
  end if;
end $$;

create index if not exists cards_container_id_idx
  on cards(container_id)
  where container_id is not null and deleted_at is null;
