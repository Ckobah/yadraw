alter type connection_status add value if not exists 'draft' before 'active';

drop index if exists connections_active_unique;

create unique index if not exists connections_active_unique
  on connections (
    board_id,
    source_card_id,
    source_port_key,
    target_card_id,
    target_port_key,
    coalesce(connection_type_id::text, 'legacy:' || type)
  )
  where deleted_at is null;
