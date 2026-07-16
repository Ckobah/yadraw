# Task 06 completion record: instance connector port labels

Status: instance-level stage complete; type-level visibility deferred.

Implemented:

- optional `label` and `showLabel` in `card.visualStyle.connectorSlots[]`;
- one compact visual-edit port editor for label, visibility, and type;
- label blur, visibility, and type changes autosave through the existing visual-style path in request order;
- connected ports allow label/visibility changes but disable type changes;
- free ports retain type editing and stable handle IDs;
- labels render outside the port by side, use the card accent, avoid the edge label, and survive reload;
- generated slot IDs remain hidden from product UI.

Type-level defaults were not implemented: `card_type_ports` stores `label` but has no visibility field. Adding it requires a separately approved migration; no fallback metadata was placed in `card.data` or unrelated JSON.

Commit: `fcc8426`.

Task 07 is next.
