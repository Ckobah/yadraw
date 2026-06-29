export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type DataFieldType = "text" | "number" | "boolean" | "json";

export type DataFieldDraft = {
  id: string;
  key: string;
  type: DataFieldType;
  value: string;
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

export function normalizeDataDraftForCompare(fields: DataFieldDraft[]): string {
  return JSON.stringify(fields.map(({ key, type, value }) => ({ key, type, value })));
}

export function validateAndBuildDataRecord(
  draft: DataFieldDraft[]
): DataFieldValidationResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const seenKeys = new Set<string>();

  for (const field of draft) {
    const normalizedKey = field.key.trim();
    if (!normalizedKey) {
      errors[field.id] = "Key is required";
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
