"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type {
  V2CardType,
  V2CardTypeFieldType,
  V2CardTypeSchema,
} from "@yadraw/shared";

type V2CardTypeSchemaEditorProps = {
  cardType: V2CardType | null;
  onSave: (cardTypeId: string, schema: V2CardTypeSchema) => Promise<V2CardType>;
};

type FieldDraft = {
  id: string;
  key: string;
  label: string;
  type: V2CardTypeFieldType;
  required: boolean;
  placeholder: string;
  description: string;
  optionsText: string;
};

const FIELD_TYPES: V2CardTypeFieldType[] = ["text", "number", "boolean", "select", "json", "date"];

function optionsToText(field: V2CardType["schema"]["fields"][number]): string {
  return (field.options ?? [])
    .map((option) => `${option.value}:${option.label}`)
    .join("\n");
}

function createFieldId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `schema-field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createDraftFromCardType(cardType: V2CardType | null): FieldDraft[] {
  return (cardType?.schema.fields ?? []).map((field) => ({
    id: `schema-${field.key}`,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    placeholder: field.placeholder ?? "",
    description: field.description ?? "",
    optionsText: optionsToText(field),
  }));
}

function parseOptions(text: string): Array<{ value: string; label: string }> | undefined {
  const options = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return { value: line, label: line };
      }
      const value = line.slice(0, separatorIndex).trim();
      const label = line.slice(separatorIndex + 1).trim();
      return { value, label: label || value };
    })
    .filter((option) => option.value.length > 0);

  return options.length > 0 ? options : undefined;
}

function buildSchemaFromDraft(
  fields: FieldDraft[]
): { ok: true; schema: V2CardTypeSchema } | { ok: false; error: string } {
  const seenKeys = new Set<string>();
  const schemaFields: V2CardTypeSchema["fields"] = [];

  for (const field of fields) {
    const key = field.key.trim();
    const label = field.label.trim() || key;
    if (!key) {
      return { ok: false, error: "Field key is required." };
    }
    if (seenKeys.has(key)) {
      return { ok: false, error: `Duplicate field key: ${key}` };
    }
    seenKeys.add(key);

    schemaFields.push({
      key,
      label,
      type: field.type,
      required: field.required,
      ...(field.placeholder.trim() ? { placeholder: field.placeholder.trim() } : {}),
      ...(field.description.trim() ? { description: field.description.trim() } : {}),
      ...(field.type === "select" ? { options: parseOptions(field.optionsText) } : {}),
    });
  }

  return { ok: true, schema: { fields: schemaFields } };
}

export function V2CardTypeSchemaEditor({
  cardType,
  onSave,
}: V2CardTypeSchemaEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>(() => createDraftFromCardType(cardType));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    setFieldDrafts(createDraftFromCardType(cardType));
    setError(null);
  }, [cardType, isEditing]);

  if (!cardType) {
    return null;
  }

  function updateField(fieldId: string, patch: Partial<Omit<FieldDraft, "id">>) {
    setFieldDrafts((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    );
    setError(null);
  }

  function addField() {
    setFieldDrafts((current) => [
      ...current,
      {
        id: createFieldId(),
        key: "",
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        description: "",
        optionsText: "",
      },
    ]);
    setError(null);
  }

  function deleteField(fieldId: string) {
    setFieldDrafts((current) => current.filter((field) => field.id !== fieldId));
    setError(null);
  }

  function cancelEdit() {
    setFieldDrafts(createDraftFromCardType(cardType));
    setError(null);
    setIsEditing(false);
  }

  async function saveSchema() {
    if (!cardType) {
      return;
    }

    const parsed = buildSchemaFromDraft(fieldDrafts);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(cardType.id, parsed.schema);
      setIsEditing(false);
    } catch {
      setError("Could not save card type fields.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="v2InspectorSection v2CardTypeSchemaEditor">
      <div className="v2InspectorSectionHeader">
        <div className="v2CardTypeSchemaTitle">
          <h3>Card type fields</h3>
          <span>{cardType.name}</span>
        </div>
        {!isEditing ? (
          <button type="button" className="v2SchemaEditButton" onClick={() => setIsEditing(true)}>
            <Pencil size={13} strokeWidth={2.2} />
            <span>Edit type fields</span>
          </button>
        ) : null}
      </div>

      {!isEditing ? (
        cardType.schema.fields.length === 0 ? (
          <p className="v2InspectorEmpty">No schema fields</p>
        ) : (
          <div className="v2SchemaFieldSummaryList">
            {cardType.schema.fields.map((field) => (
              <div key={field.key} className="v2SchemaFieldSummaryRow">
                <strong>{field.key}</strong>
                <span>{field.label}</span>
                <em>{field.type}</em>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="v2SchemaFieldEditorBody">
          {fieldDrafts.length === 0 ? (
            <p className="v2InspectorEmpty">No fields in this type yet.</p>
          ) : (
            <div className="v2SchemaFieldDraftList">
              {fieldDrafts.map((field) => (
                <div key={field.id} className="v2SchemaFieldDraftRow">
                  <div className="v2SchemaFieldDraftGrid">
                    <label>
                      <span>Key</span>
                      <input
                        className="v2InspectorDataValue"
                        value={field.key}
                        placeholder="fieldKey"
                        onChange={(event) => updateField(field.id, { key: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Label</span>
                      <input
                        className="v2InspectorDataValue"
                        value={field.label}
                        placeholder={field.key || "Field label"}
                        onChange={(event) => updateField(field.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Type</span>
                      <select
                        className="v2InspectorDataValue"
                        value={field.type}
                        onChange={(event) =>
                          updateField(field.id, { type: event.target.value as V2CardTypeFieldType })
                        }
                      >
                        {FIELD_TYPES.map((fieldType) => (
                          <option key={fieldType} value={fieldType}>
                            {fieldType}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="v2SchemaRequiredControl">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(field.id, { required: event.target.checked })}
                      />
                      <span>Required</span>
                    </label>
                    <button
                      type="button"
                      className="v2InspectorDataDeleteButton"
                      aria-label="Delete schema field"
                      onClick={() => deleteField(field.id)}
                    >
                      <Trash2 size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                  <div className="v2SchemaFieldDetailsGrid">
                    <label>
                      <span>Placeholder</span>
                      <input
                        className="v2InspectorDataValue"
                        value={field.placeholder}
                        placeholder="Optional placeholder"
                        onChange={(event) => updateField(field.id, { placeholder: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>Description</span>
                      <input
                        className="v2InspectorDataValue"
                        value={field.description}
                        placeholder="Optional help text"
                        onChange={(event) => updateField(field.id, { description: event.target.value })}
                      />
                    </label>
                  </div>
                  {field.type === "select" ? (
                    <label className="v2SchemaOptionsControl">
                      <span>Select options</span>
                      <textarea
                        className="v2InspectorDataValue v2InspectorDataJsonValue"
                        value={field.optionsText}
                        placeholder={"new:New\ndone:Done"}
                        onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {error ? <p className="v2InspectorDataError">{error}</p> : null}
          <div className="v2InspectorEditActions">
            <button type="button" onClick={addField}>
              <Plus size={13} strokeWidth={2.2} />
              <span>Add field</span>
            </button>
            <button type="button" onClick={cancelEdit} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="button"
              className="v2InspectorPrimaryAction"
              onClick={() => void saveSchema()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save schema"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
