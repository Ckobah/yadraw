# V2 quantitative relationships

Quantitative meaning belongs to a connection type. Values entered for one relationship belong to `connection.data`; calculated values are projections and are never persisted in `card.data`.

## Connection type contract

```json
{
  "key": "contains",
  "schema": {
    "fields": [
      {
        "key": "quantity",
        "label": "Quantity per assembly",
        "type": "number",
        "required": true,
        "defaultValue": 1,
        "numberConstraints": { "min": 0, "integer": true }
      },
      {
        "key": "unit",
        "label": "Unit",
        "type": "select",
        "required": true,
        "defaultValue": "piece",
        "options": [{ "value": "piece", "label": "pcs" }]
      }
    ],
    "semantics": {
      "version": 1,
      "sourceRole": "component",
      "targetRole": "assembly",
      "quantity": {
        "valueField": "quantity",
        "unitField": "unit",
        "basis": "per_target",
        "targetMultiplierField": "plannedQuantity",
        "aggregation": "sum"
      }
    }
  }
}
```

`sourceRole`, `targetRole`, field keys, and unit values are stable machine identifiers. Display labels may change without changing their meaning.

An `absolute` quantity is used as entered. A `per_target` quantity is multiplied by the numeric target-card field named by `targetMultiplierField`; a missing multiplier is treated as `1` and returned as a warning with a default input in the calculation provenance.

## Lifecycle and validation

- Creating a relationship applies connection-type defaults on the server.
- A valid relationship is `active` and participates in calculations.
- A relationship missing required fields is `draft` and is excluded from calculations.
- Invalid values are rejected at the API boundary.
- Valid autosave changes a `draft` relationship to `active`.
- Connection-type defaults are applied in semantic projections as well as at creation time. A schema update therefore does not rewrite every historical relationship in the workspace.
- Existing relationships that become incomplete after a schema update are reported with `validity: "incomplete"` and excluded with warnings. Their persisted lifecycle status is left unchanged until the relationship itself is edited.
- `disabled` relationships remain disabled and are excluded.

The active uniqueness identity is endpoint cards, endpoint port keys, and semantic `connectionTypeId`. This permits different relationship meanings between the same ports while rejecting a duplicate of the same semantic relationship.

## Semantic graph API

`GET /v2/boards/{boardId}/semantic-graph`

The response is a deterministic, machine-readable projection with:

- semantic nodes containing business card JSON;
- relations with a predicate, source/target roles, ports, status, validity, issues, effective relationship data (including schema defaults), and normalized quantity;
- `schemaVersion` for the response contract;
- a SHA-256 `graphRevision` over calculation-relevant board state;
- `generatedAt` for observation time.

Layout, visual style, attachments, authentication data, and derived totals are intentionally absent.

## Calculation API

`POST /v2/boards/{boardId}/calculations/evaluate`

Minimal request:

```json
{}
```

What-if request (not persisted):

```json
{
  "overrides": [
    {
      "cardId": "00000000-0000-4000-8000-000000000000",
      "patch": { "plannedQuantity": 10 }
    }
  ]
}
```

The current formula is `bom.required.v1`:

```text
required quantity = relationship quantity × target multiplier
```

Each result includes the source card, target card, connection, normalized unit, formula identifier, and every input used. Input provenance distinguishes persisted connection fields, persisted card fields, what-if overrides, and defaults. Totals are grouped by source card and normalized unit. Warnings identify drafts, invalid inputs, missing or invalid multipliers, and quantitative cycles.

The current engine evaluates direct quantitative relationships. It detects cycles but deliberately does not recursively expand multi-level bills of materials; a future recursive formula must use a new formula identifier and explicit cycle policy.

Both endpoints use the existing V2 read-authorization boundary. Browser access goes through same-origin Next routes under `/v2/actions/...`.
