"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
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
  title?: string;
  description?: string;
};

const FIELD_TYPES: V2CardTypeFieldType[] = ["text", "number", "boolean", "select", "json", "date"];
const FIELD_TYPE_LABELS: Record<V2CardTypeFieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Yes / No",
  select: "Choice",
  json: "JSON",
  date: "Date",
};

function fieldKeyFromName(name: string): string {
  const transliterated = name.toLowerCase().replace(/[а-яё]/g, (letter) => ({
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }[letter] ?? ""));
  const normalized = transliterated
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "field";
  const withPrefix = /^[a-z]/.test(normalized) ? normalized : `field_${normalized}`;
  return withPrefix.replace(/_+/g, "_");
}

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
    const label = field.label.trim();
    if (!label) {
      return { ok: false, error: "Field name is required." };
    }
    const key = field.key.trim() || fieldKeyFromName(label);
    if (seenKeys.has(key)) {
      return { ok: false, error: `Field names must be unique: ${label}` };
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
  title = "Fields",
}: V2CardTypeSchemaEditorProps) {
  function updateField(fieldId: string, patch: Partial<Omit<V2CardTypeSchemaFieldDraft, "id">>) {
    onChange(fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  }

  function updateFieldName(field: V2CardTypeSchemaFieldDraft, label: string) {
    if (field.id.startsWith("schema-")) {
      updateField(field.id, { label });
      return;
    }
    const base = fieldKeyFromName(label);
    const usedKeys = new Set(fields.filter((item) => item.id !== field.id).map((item) => item.key));
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }
    updateField(field.id, { label, key });
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
        <h3>{title}</h3>
        <button
          type="button"
          className="v2SchemaEditButton"
          aria-label="Add field"
          title="Add field"
          onClick={addField}
          disabled={disabled}
        >
          <Plus size={13} strokeWidth={2.2} />
        </button>
      </div>

      {fields.length > 0 ? (
        <div className="v2SchemaFieldDraftList">
          {fields.map((field) => (
            <div key={field.id} className="v2SchemaFieldDraftRow">
              <div className="v2SchemaFieldDraftGrid">
                <input
                  className="v2InspectorDataValue"
                  value={field.label}
                  placeholder="Field name"
                  aria-label="Field name"
                  disabled={disabled}
                  onChange={(event) => updateFieldName(field, event.target.value)}
                />
                <select
                  className="v2InspectorDataValue"
                  value={field.type}
                  aria-label="Value type"
                  title="Value type"
                  disabled={disabled}
                  onChange={(event) =>
                    updateField(field.id, { type: event.target.value as V2CardTypeFieldType })
                  }
                >
                  {FIELD_TYPES.map((fieldType) => (
                    <option key={fieldType} value={fieldType}>
                      {FIELD_TYPE_LABELS[fieldType]}
                    </option>
                  ))}
                </select>
                <details className="v2SchemaFieldAdvanced">
                  <summary aria-label="More field options" title="More field options">
                    <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
                  </summary>
                  <div>
                    <label className="v2SchemaRequiredControl">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={disabled}
                        onChange={(event) => updateField(field.id, { required: event.target.checked })}
                      />
                      <span>Required</span>
                    </label>
                    <input
                      className="v2InspectorDataValue"
                      value={field.placeholder}
                      placeholder="Placeholder"
                      aria-label="Placeholder"
                      disabled={disabled}
                      onChange={(event) => updateField(field.id, { placeholder: event.target.value })}
                    />
                    <input
                      className="v2InspectorDataValue"
                      value={field.description}
                      placeholder="Developer note"
                      aria-label="Developer note"
                      disabled={disabled}
                      onChange={(event) => updateField(field.id, { description: event.target.value })}
                    />
                    {field.type === "select" ? (
                      <textarea
                        className="v2InspectorDataValue v2InspectorDataJsonValue"
                        value={field.optionsText}
                        placeholder={"new:New\ndone:Done"}
                        aria-label="Choice options"
                        disabled={disabled}
                        onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                      />
                    ) : null}
                  </div>
                </details>
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
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
