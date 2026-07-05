"use client";

import { Plus, Trash2 } from "lucide-react";
import type {
  V2CardTypeFieldSchema,
  V2CardTypeFieldType,
  V2CardTypeSchema,
} from "@yadraw/shared";

export type V2CardTypeSchemaFieldDraft = {
  id: string;
  key: string;
  label: string;
  type: V2CardTypeFieldType;
  required: boolean;
  placeholder: string;
  description: string;
  optionsText: string;
};

type V2CardTypeSchemaEditorProps = {
  fields: V2CardTypeSchemaFieldDraft[];
  onChange: (fields: V2CardTypeSchemaFieldDraft[]) => void;
  disabled?: boolean;
};

const FIELD_TYPES: V2CardTypeFieldType[] = ["text", "number", "boolean", "select", "json", "date"];

function optionsToText(field: V2CardTypeFieldSchema): string {
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

export function createV2CardTypeSchemaFieldDrafts(
  schema: V2CardTypeSchema | null | undefined
): V2CardTypeSchemaFieldDraft[] {
  return (schema?.fields ?? []).map((field) => ({
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

export function buildV2CardTypeSchemaFromDrafts(
  fields: V2CardTypeSchemaFieldDraft[]
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
  fields,
  onChange,
  disabled = false,
}: V2CardTypeSchemaEditorProps) {
  function updateField(fieldId: string, patch: Partial<Omit<V2CardTypeSchemaFieldDraft, "id">>) {
    onChange(fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  }

  function addField() {
    onChange([
      ...fields,
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
  }

  function deleteField(fieldId: string) {
    onChange(fields.filter((field) => field.id !== fieldId));
  }

  return (
    <section className="v2CardTypeSchemaEditor">
      <div className="v2CardTypeManagerSectionHeader">
        <div>
          <h3>Schema fields</h3>
          <span>Fields rendered in the card inspector for this type.</span>
        </div>
        <button type="button" className="v2SchemaEditButton" onClick={addField} disabled={disabled}>
          <Plus size={13} strokeWidth={2.2} />
          <span>Add field</span>
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="v2InspectorEmpty">No schema fields</p>
      ) : (
        <div className="v2SchemaFieldDraftList">
          {fields.map((field) => (
            <div key={field.id} className="v2SchemaFieldDraftRow">
              <div className="v2SchemaFieldDraftGrid">
                <label>
                  <span>Key</span>
                  <input
                    className="v2InspectorDataValue"
                    value={field.key}
                    placeholder="fieldKey"
                    disabled={disabled}
                    onChange={(event) => updateField(field.id, { key: event.target.value })}
                  />
                </label>
                <label>
                  <span>Label</span>
                  <input
                    className="v2InspectorDataValue"
                    value={field.label}
                    placeholder={field.key || "Field label"}
                    disabled={disabled}
                    onChange={(event) => updateField(field.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    className="v2InspectorDataValue"
                    value={field.type}
                    disabled={disabled}
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
                    disabled={disabled}
                    onChange={(event) => updateField(field.id, { required: event.target.checked })}
                  />
                  <span>Required</span>
                </label>
                <button
                  type="button"
                  className="v2InspectorDataDeleteButton"
                  aria-label="Delete schema field"
                  disabled={disabled}
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
                    disabled={disabled}
                    onChange={(event) => updateField(field.id, { placeholder: event.target.value })}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <input
                    className="v2InspectorDataValue"
                    value={field.description}
                    placeholder="Optional help text"
                    disabled={disabled}
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
                    disabled={disabled}
                    onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
