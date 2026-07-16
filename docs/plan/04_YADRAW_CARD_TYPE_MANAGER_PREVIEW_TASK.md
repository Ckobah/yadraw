# Task 04 completion record: Card Type Manager preview and appearance

Status: complete; do not rerun.

Implemented:

- live card preview driven by the unsaved type draft;
- accent swatches and shared local icon picker;
- type list rows show icon/accent;
- default width/height controls were removed;
- new type/card minimum defaults align at `172x122`;
- icon choice remains card-type appearance metadata in `default_visual_style.iconKey`.

No remote icons, migration, `card.data` metadata, attachment changes, or port/connection semantic changes were introduced.

Commit: `f5e205ae9e736b109c5082b6c28a79cfd15ae0f7`.

Task 05 must preserve this manager preview/list behavior while adding deletion.
