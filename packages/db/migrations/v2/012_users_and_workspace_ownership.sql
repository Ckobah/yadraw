create table if not exists users (
  id uuid primary key,
  email text not null,
  name text not null default '',
  avatar_url text null,
  auth_provider text not null,
  auth_subject text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,

  constraint users_email_not_blank check (length(trim(email)) > 0),
  constraint users_auth_provider_not_blank check (length(trim(auth_provider)) > 0),
  constraint users_auth_subject_not_blank check (length(trim(auth_subject)) > 0),
  constraint users_auth_identity_unique unique (auth_provider, auth_subject)
);

create unique index if not exists users_email_unique
  on users (lower(email));

-- Older local databases may already have the legacy workspace_members table.
alter table workspace_members
  add column if not exists deleted_at timestamptz null;

create index if not exists workspace_members_user_id_active_idx
  on workspace_members (user_id)
  where deleted_at is null;

create index if not exists workspace_members_workspace_id_active_idx
  on workspace_members (workspace_id)
  where deleted_at is null;

insert into users (id, email, name, auth_provider, auth_subject)
select distinct
  wm.user_id,
  'legacy+' || wm.user_id::text || '@local.invalid',
  'Legacy user',
  'legacy',
  wm.user_id::text
from workspace_members wm
on conflict (id) do nothing;

alter table workspaces
  add column if not exists owner_user_id uuid null;

update workspaces w
set owner_user_id = coalesce(
  (
    select wm.user_id
    from workspace_members wm
    where wm.workspace_id = w.id
      and wm.deleted_at is null
      and wm.role = 'owner'
    order by wm.created_at asc, wm.id asc
    limit 1
  ),
  (
    select wm.user_id
    from workspace_members wm
    where wm.workspace_id = w.id
      and wm.deleted_at is null
    order by wm.created_at asc, wm.id asc
    limit 1
  )
)
where w.owner_user_id is null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspaces_owner_user_id_fkey'
  ) then
    alter table workspaces
      add constraint workspaces_owner_user_id_fkey
      foreign key (owner_user_id) references users(id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_members_user_id_fkey'
  ) then
    alter table workspace_members
      add constraint workspace_members_user_id_fkey
      foreign key (user_id) references users(id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from workspaces
    where deleted_at is null
      and owner_user_id is null
  ) then
    alter table workspaces alter column owner_user_id set not null;
  end if;
end $$;

create index if not exists workspaces_owner_user_id_idx
  on workspaces (owner_user_id)
  where deleted_at is null;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function set_updated_at();
