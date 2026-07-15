create table if not exists user_legal_acceptances (
  id uuid primary key,
  user_id uuid not null references users(id),
  terms_version text not null,
  privacy_version text not null,
  personal_data_consent_version text not null,
  source text not null default 'web',
  user_agent text null,
  accepted_at timestamptz not null default now(),

  constraint user_legal_acceptances_terms_not_blank check (length(trim(terms_version)) > 0),
  constraint user_legal_acceptances_privacy_not_blank check (length(trim(privacy_version)) > 0),
  constraint user_legal_acceptances_consent_not_blank check (length(trim(personal_data_consent_version)) > 0),
  constraint user_legal_acceptances_source_not_blank check (length(trim(source)) > 0),
  constraint user_legal_acceptances_version_unique unique (
    user_id,
    terms_version,
    privacy_version,
    personal_data_consent_version
  )
);

create index if not exists user_legal_acceptances_user_id_accepted_at_idx
  on user_legal_acceptances (user_id, accepted_at desc);
