import type { V2CardTypeFieldSchema } from "@yadraw/shared";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type DataFieldType = "text" | "number" | "boolean" | "json";

export type DataFieldDraft = {
  id: string;
  key: string;
  type: DataFieldType;
  value: string;
};

export type SchemaFieldDraft = {
  id: string;
  key: string;
  label: string;
  type: V2CardTypeFieldSchema["type"];
  value: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
};

export type DataFieldValidationResult =
  | {
      ok: true;
      data: Record<string, unknown>;
    }
  | {
      ok: false;
      errors: Record<string, string>;
    };

export function formatInspectorDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function createLocalFieldId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function detectDataFieldType(value: unknown): DataFieldType {
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

export function stringifyDataFieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2) ?? "null";
}

export function splitSchemaAndExtraData(
  schemaFields: V2CardTypeFieldSchema[],
  data: Record<string, unknown> | null | undefined
): { schemaKeys: Set<string>; extraData: Record<string, unknown> } {
  const schemaKeys = new Set(schemaFields.map((field) => field.key));
  const extraData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data ?? {})) {
    if (!schemaKeys.has(key)) {
      extraData[key] = value;
    }
  }

  return { schemaKeys, extraData };
}

export function createDataDraftFromRecord(
  data: Record<string, unknown> | null | undefined
): DataFieldDraft[] {
  return Object.entries(data ?? {}).map(([key, value], index) => ({
    id: `field-${index}-${key}`,
    key,
    type: detectDataFieldType(value),
    value: stringifyDataFieldValue(value),
  }));
}

function stringifySchemaFieldValue(
  field: V2CardTypeFieldSchema,
  value: unknown
): string {
  if (value === undefined || value === null) {
    if (field.defaultValue !== undefined) {
      return stringifyDataFieldValue(field.defaultValue);
    }
    return field.type === "boolean" ? "false" : "";
  }

  if (field.type === "json") {
    return stringifyDataFieldValue(value);
  }

  if (field.type === "boolean") {
    return value === true || value === "true" ? "true" : "false";
  }

  if (field.type === "date" && typeof value === "string") {
    const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return dateOnly ?? value;
  }

  return typeof value === "string" ? value : String(value);
}

export function createSchemaDraftFromData(
  schemaFields: V2CardTypeFieldSchema[],
  data: Record<string, unknown> | null | undefined
): SchemaFieldDraft[] {
  return schemaFields.map((field) => ({
    id: `schema-${field.key}`,
    key: field.key,
    label: field.label,
    type: field.type,
    value: stringifySchemaFieldValue(field, data?.[field.key]),
    required: field.required ?? false,
    description: field.description,
    placeholder: field.placeholder,
    options: field.options ?? [],
  }));
}

export function normalizeDataDraftForCompare(fields: DataFieldDraft[]): string {
  return JSON.stringify(fields.map(({ key, type, value }) => ({ key, type, value })));
}

export function normalizeSchemaDraftForCompare(fields: SchemaFieldDraft[]): string {
  return JSON.stringify(fields.map(({ key, type, value }) => ({ key, type, value })));
}

export function validateAndBuildDataRecord(
  draft: DataFieldDraft[],
  options: { reservedKeys?: Set<string> } = {}
): DataFieldValidationResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const seenKeys = new Set<string>();
  const reservedKeys = options.reservedKeys ?? new Set<string>();

  for (const field of draft) {
    const normalizedKey = field.key.trim();
    if (!normalizedKey) {
      errors[field.id] = "Key is required";
      continue;
    }
    if (reservedKeys.has(normalizedKey)) {
      errors[field.id] = "This key is controlled by schema fields";
      continue;
    }
    if (seenKeys.has(normalizedKey)) {
      errors[field.id] = "Duplicate key";
      continue;
    }
    seenKeys.add(normalizedKey);

    if (field.type === "text") {
      data[normalizedKey] = field.value;
      continue;
    }

    if (field.type === "number") {
      if (!field.value.trim()) {
        errors[field.id] = "Number is required";
        continue;
      }
      const nextNumber = Number(field.value);
      if (Number.isNaN(nextNumber)) {
        errors[field.id] = "Invalid number";
        continue;
      }
      data[normalizedKey] = nextNumber;
      continue;
    }

    if (field.type === "boolean") {
      data[normalizedKey] = field.value === "true";
      continue;
    }

    try {
      data[normalizedKey] = JSON.parse(field.value);
    } catch {
      errors[field.id] = "Invalid JSON";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}

export function validateAndBuildSchemaDataRecord(
  draft: SchemaFieldDraft[]
): DataFieldValidationResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const field of draft) {
    const value = field.value.trim();

    if (field.required && !value) {
      errors[field.id] = `${field.label} is required`;
      continue;
    }

    if (field.type === "text") {
      data[field.key] = field.value;
      continue;
    }

    if (field.type === "number") {
      if (!value) continue;
      const nextNumber = Number(field.value);
      if (Number.isNaN(nextNumber)) {
        errors[field.id] = "Invalid number";
        continue;
      }
      data[field.key] = nextNumber;
      continue;
    }

    if (field.type === "boolean") {
      data[field.key] = field.value === "true";
      continue;
    }

    if (field.type === "select") {
      const isKnownOption = field.options.some((option) => option.value === field.value);
      if (field.options.length > 0 && value && !isKnownOption) {
        errors[field.id] = "Choose a valid option";
        continue;
      }
      data[field.key] = field.value;
      continue;
    }

    if (field.type === "date") {
      if (!value) continue;
      const parsedDate = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsedDate.getTime())) {
        errors[field.id] = "Invalid date";
        continue;
      }
      data[field.key] = value;
      continue;
    }

    if (!value) continue;
    try {
      data[field.key] = JSON.parse(field.value);
    } catch {
      errors[field.id] = "Invalid JSON";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}
