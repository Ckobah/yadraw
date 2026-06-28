-- Add visual_style column for per-card visual presentation settings.
-- visual_style is separate from data — it stores only visual presentation
-- properties (fontFamily, textAlign, textColor, etc.) and NOT semantic card data.

alter table cards
add column if not exists visual_style jsonb not null default '{}'::jsonb;

comment on column cards.visual_style is
  'Per-card visual presentation settings (fontFamily, textAlign, textColor, etc.)';
