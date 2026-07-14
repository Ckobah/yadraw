create table if not exists card_library_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  card_type_id uuid not null,
  title text not null,
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint card_library_entries_workspace_type_id_unique
    unique (workspace_id, card_type_id, id),
  constraint card_library_entries_title_not_blank
    check (length(trim(title)) > 0),
  constraint card_library_entries_title_length
    check (length(title) <= 240),
  constraint card_library_entries_description_length
    check (length(description) <= 10000),
  constraint card_library_entries_data_is_object
    check (jsonb_typeof(data) = 'object'),
  constraint card_library_entries_data_no_internal_yadraw
    check (not (data ? '_yadraw')),
  constraint card_library_entries_version_positive
    check (version > 0),
  constraint card_library_entries_workspace_type_consistency
    foreign key (workspace_id, card_type_id)
    references card_types(workspace_id, id)
);

alter table cards
  add column if not exists library_entry_id uuid null;

do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'cards'::regclass
      and conname = 'cards_workspace_type_library_entry_consistency'
  ) then
    alter table cards
      add constraint cards_workspace_type_library_entry_consistency
      foreign key (workspace_id, card_type_id, library_entry_id)
      references card_library_entries(workspace_id, card_type_id, id)
      on delete restrict;
  end if;
end $$;

create index if not exists card_library_entries_active_title_idx
  on card_library_entries (workspace_id, card_type_id, lower(title), id)
  where deleted_at is null and archived_at is null;

create index if not exists card_library_entries_status_updated_idx
  on card_library_entries (workspace_id, card_type_id, archived_at, updated_at desc, id)
  where deleted_at is null;

create index if not exists cards_library_entry_id_idx
  on cards (library_entry_id)
  where deleted_at is null and library_entry_id is not null;

create or replace function set_card_library_entry_updated_at_and_version()
returns trigger as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_card_library_entries_updated_at on card_library_entries;
create trigger trg_card_library_entries_updated_at
before update on card_library_entries
for each row execute function set_card_library_entry_updated_at_and_version();

comment on table card_library_entries is
  'Workspace-scoped canonical semantic records grouped implicitly by card type.';

comment on column cards.library_entry_id is
  'Optional live reference to canonical card content. The reference is system metadata and must not be stored in cards.data.';
