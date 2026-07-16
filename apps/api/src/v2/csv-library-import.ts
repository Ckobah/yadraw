import { createHash } from "node:crypto";
import type {
  V2CardLibraryEntry,
  V2CardType,
  V2CardTypeFieldSchema,
  V2CsvLibraryImportColumnMapping,
  V2CsvLibraryImportDuplicateKey,
  V2CsvLibraryImportDuplicatePolicy,
} from "@yadraw/shared";

export const V2_CSV_LIBRARY_IMPORT_MAX_BYTES = 1024 * 1024;
export const V2_CSV_LIBRARY_IMPORT_MAX_ROWS = 500;
export const V2_CSV_LIBRARY_IMPORT_MAX_COLUMNS = 50;
export const V2_CSV_LIBRARY_IMPORT_MAX_HEADER_LENGTH = 120;
export const V2_CSV_LIBRARY_IMPORT_MAX_CELL_LENGTH = 10_000;

export class V2CsvLibraryImportError extends Error {}

export type V2ParsedCsvLibraryRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type V2PreparedCsvLibraryRow = V2ParsedCsvLibraryRow & {
  title: string;
  description: string;
  data: Record<string, unknown>;
  descriptionMapped: boolean;
  mappedFieldKeys: string[];
};

export type V2CsvLibraryImportIssue = {
  rowNumber: number | null;
  sourceHeader: string | null;
  message: string;
};

export type V2CsvLibraryImportOperation =
  | { kind: "create"; row: V2PreparedCsvLibraryRow }
  | { kind: "update"; row: V2PreparedCsvLibraryRow; entry: V2CardLibraryEntry }
  | { kind: "skipped"; row: V2PreparedCsvLibraryRow }
  | { kind: "invalid"; row: V2PreparedCsvLibraryRow; message: string };

export type V2CsvLibraryImportPlan = {
  operations: V2CsvLibraryImportOperation[];
  createRows: number;
  updateRows: number;
  skippedRows: number;
  invalidRows: number;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintV2CsvLibraryImportPlan(
  plan: V2CsvLibraryImportPlan,
  duplicatePolicy: V2CsvLibraryImportDuplicatePolicy
): string {
  const operations = plan.operations.map((operation) => ({
    kind: operation.kind,
    rowNumber: operation.row.rowNumber,
    title: operation.row.title,
    description: operation.row.description,
    data: operation.row.data,
    ...(operation.kind === "update"
      ? { entryId: operation.entry.id, entryVersion: operation.entry.version }
      : {}),
    ...(operation.kind === "invalid" ? { message: operation.message } : {})
  }));
  return createHash("sha256")
    .update(stableJson({ duplicatePolicy, operations }), "utf8")
    .digest("hex");
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function detectCsvDelimiter(csv: string): "," | ";" {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "\r" || character === "\n")) {
      break;
    } else if (!quoted && character === ",") {
      commas += 1;
    } else if (!quoted && character === ";") {
      semicolons += 1;
    }
  }
  return semicolons > commas ? ";" : ",";
}

function parseCsvMatrix(csv: string, delimiter: "," | ";"): string[][] {
  const source = csv.startsWith("\uFEFF") ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let quoteClosed = false;

  function pushCell() {
    if (cell.length > V2_CSV_LIBRARY_IMPORT_MAX_CELL_LENGTH) {
      throw new V2CsvLibraryImportError(
        `CSV cells cannot exceed ${V2_CSV_LIBRARY_IMPORT_MAX_CELL_LENGTH.toLocaleString()} characters`
      );
    }
    row.push(cell);
    cell = "";
    quoteClosed = false;
  }

  function pushRow() {
    pushCell();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (quoteClosed && character !== delimiter && character !== "\r" && character !== "\n") {
      throw new V2CsvLibraryImportError("Quoted CSV values must end before a comma or new line");
    }
    if (character === '"') {
      if (cell.length > 0) {
        throw new V2CsvLibraryImportError("Quotes must start at the beginning of a CSV value");
      }
      quoted = true;
    } else if (character === delimiter) {
      pushCell();
    } else if (character === "\n") {
      pushRow();
    } else if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += character;
    }
  }

  if (quoted) throw new V2CsvLibraryImportError("CSV contains an unclosed quoted value");
  if (cell.length > 0 || row.length > 0 || quoteClosed) pushRow();
  return rows;
}

export function parseV2CsvLibraryImport(csv: string): {
  headers: string[];
  rows: V2ParsedCsvLibraryRow[];
} {
  if (Buffer.byteLength(csv, "utf8") > V2_CSV_LIBRARY_IMPORT_MAX_BYTES) {
    throw new V2CsvLibraryImportError("CSV files cannot exceed 1 MiB");
  }
  const matrix = parseCsvMatrix(csv, detectCsvDelimiter(csv));
  const headerRow = matrix.shift();
  if (!headerRow || headerRow.every((value) => value.trim() === "")) {
    throw new V2CsvLibraryImportError("CSV must contain a header row");
  }
  if (headerRow.length > V2_CSV_LIBRARY_IMPORT_MAX_COLUMNS) {
    throw new V2CsvLibraryImportError(
      `CSV cannot contain more than ${V2_CSV_LIBRARY_IMPORT_MAX_COLUMNS} columns`
    );
  }

  const headers = headerRow.map((value) => value.trim());
  const normalizedHeaders = new Set<string>();
  for (const header of headers) {
    if (!header) throw new V2CsvLibraryImportError("CSV headers cannot be empty");
    if (header.length > V2_CSV_LIBRARY_IMPORT_MAX_HEADER_LENGTH) {
      throw new V2CsvLibraryImportError(
        `CSV headers cannot exceed ${V2_CSV_LIBRARY_IMPORT_MAX_HEADER_LENGTH} characters`
      );
    }
    const normalized = header.toLocaleLowerCase();
    if (normalizedHeaders.has(normalized)) {
      throw new V2CsvLibraryImportError(`Duplicate CSV header: ${header}`);
    }
    normalizedHeaders.add(normalized);
  }

  const dataRows = matrix.filter((values) => values.some((value) => value.trim() !== ""));
  if (dataRows.length === 0) {
    throw new V2CsvLibraryImportError("CSV must contain at least one data row");
  }
  if (dataRows.length > V2_CSV_LIBRARY_IMPORT_MAX_ROWS) {
    throw new V2CsvLibraryImportError(
      `CSV cannot contain more than ${V2_CSV_LIBRARY_IMPORT_MAX_ROWS} data rows`
    );
  }

  const rows = dataRows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new V2CsvLibraryImportError(
        `Row ${index + 2} has ${values.length} values; expected ${headers.length}`
      );
    }
    return {
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]))
    };
  });
  return { headers, rows };
}

export function suggestV2CsvLibraryImportMapping(
  headers: string[],
  cardType: V2CardType
): V2CsvLibraryImportColumnMapping[] {
  const fieldsByHeader = new Map<string, V2CardTypeFieldSchema>();
  for (const field of cardType.schema.fields) {
    fieldsByHeader.set(normalizeHeader(field.key), field);
    fieldsByHeader.set(normalizeHeader(field.label), field);
  }
  let titleMapped = false;
  const mapping = headers.map<V2CsvLibraryImportColumnMapping>((sourceHeader) => {
    const normalized = normalizeHeader(sourceHeader);
    if (!titleMapped && ["title", "name"].includes(normalized)) {
      titleMapped = true;
      return { sourceHeader, target: { kind: "title" } };
    }
    if (["description", "details", "notes"].includes(normalized)) {
      return { sourceHeader, target: { kind: "description" } };
    }
    const field = fieldsByHeader.get(normalized);
    return field
      ? { sourceHeader, target: { kind: "field", fieldKey: field.key } }
      : { sourceHeader, target: { kind: "ignore" } };
  });
  if (!titleMapped && mapping[0]) mapping[0] = { sourceHeader: mapping[0].sourceHeader, target: { kind: "title" } };
  return mapping;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function convertFieldValue(
  rawValue: string,
  field: V2CardTypeFieldSchema
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = rawValue.trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (field.type === "text") return { ok: true, value: rawValue };
  if (field.type === "number") {
    const value = Number(trimmed);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: `${field.label} must be a finite number` };
  }
  if (field.type === "boolean") {
    const normalized = trimmed.toLocaleLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return { ok: true, value: true };
    if (["false", "no", "0"].includes(normalized)) return { ok: true, value: false };
    return { ok: false, message: `${field.label} must be true/false, yes/no, or 1/0` };
  }
  if (field.type === "date") {
    return isValidDate(trimmed)
      ? { ok: true, value: trimmed }
      : { ok: false, message: `${field.label} must be a valid date in YYYY-MM-DD format` };
  }
  if (field.type === "select") {
    const option = field.options?.find(
      (candidate) =>
        candidate.value === trimmed || candidate.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
    );
    return option
      ? { ok: true, value: option.value }
      : { ok: false, message: `${field.label} must match a configured option` };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, message: `${field.label} must contain valid JSON` };
  }
}

export function prepareV2CsvLibraryImport(
  parsed: { headers: string[]; rows: V2ParsedCsvLibraryRow[] },
  rawMapping: V2CsvLibraryImportColumnMapping[],
  cardType: V2CardType,
  duplicatePolicy: V2CsvLibraryImportDuplicatePolicy
): {
  mapping: V2CsvLibraryImportColumnMapping[];
  rows: V2PreparedCsvLibraryRow[];
  invalidRowNumbers: Set<number>;
  issues: V2CsvLibraryImportIssue[];
} {
  const mapping = rawMapping.length > 0 ? rawMapping : suggestV2CsvLibraryImportMapping(parsed.headers, cardType);
  const issues: V2CsvLibraryImportIssue[] = [];
  const invalidRowNumbers = new Set<number>();
  const headerSet = new Set(parsed.headers);
  const mappedHeaders = new Set<string>();
  const mappedTargets = new Set<string>();
  const fieldsByKey = new Map(cardType.schema.fields.map((field) => [field.key, field]));
  const descriptionMapped = mapping.some((item) => item.target.kind === "description");
  const mappedFieldKeys = mapping.flatMap((item) =>
    item.target.kind === "field" && fieldsByKey.has(item.target.fieldKey)
      ? [item.target.fieldKey]
      : []
  );

  for (const item of mapping) {
    if (!headerSet.has(item.sourceHeader) || mappedHeaders.has(item.sourceHeader)) {
      issues.push({ rowNumber: null, sourceHeader: item.sourceHeader, message: "Mapping must cover each CSV header once" });
      continue;
    }
    mappedHeaders.add(item.sourceHeader);
    if (item.target.kind === "ignore") continue;
    const targetKey = item.target.kind === "field" ? `field:${item.target.fieldKey}` : item.target.kind;
    if (mappedTargets.has(targetKey)) {
      issues.push({ rowNumber: null, sourceHeader: item.sourceHeader, message: "Multiple columns cannot map to the same target" });
    }
    mappedTargets.add(targetKey);
    if (item.target.kind === "field" && !fieldsByKey.has(item.target.fieldKey)) {
      issues.push({ rowNumber: null, sourceHeader: item.sourceHeader, message: `Unknown schema field: ${item.target.fieldKey}` });
    }
  }
  if (mappedHeaders.size !== parsed.headers.length) {
    issues.push({ rowNumber: null, sourceHeader: null, message: "Map or ignore every CSV column" });
  }
  if (!mappedTargets.has("title")) {
    issues.push({ rowNumber: null, sourceHeader: null, message: "Choose one CSV column for the entry name" });
  }
  for (const field of cardType.schema.fields) {
    if (field.required && !mappedTargets.has(`field:${field.key}`)) {
      issues.push({ rowNumber: null, sourceHeader: null, message: `Map the required field: ${field.label}` });
    }
  }
  if (duplicatePolicy.mode !== "create_new") {
    const duplicateTarget = duplicatePolicy.key.kind === "title"
      ? "title"
      : `field:${duplicatePolicy.key.fieldKey}`;
    if (!mappedTargets.has(duplicateTarget)) {
      issues.push({ rowNumber: null, sourceHeader: null, message: "Duplicate matching must use a mapped title or field" });
    }
    if (duplicatePolicy.key.kind === "field") {
      const field = fieldsByKey.get(duplicatePolicy.key.fieldKey);
      if (!field) {
        issues.push({ rowNumber: null, sourceHeader: null, message: "Duplicate field does not exist on this card type" });
      } else if (field.type === "json") {
        issues.push({ rowNumber: null, sourceHeader: null, message: "JSON fields cannot be used for duplicate matching" });
      }
    }
  }

  const preparedRows = parsed.rows.map<V2PreparedCsvLibraryRow>((row) => {
    let title = "";
    let description = "";
    const data: Record<string, unknown> = {};
    const rowIssues: V2CsvLibraryImportIssue[] = [];
    for (const item of mapping) {
      const rawValue = row.values[item.sourceHeader] ?? "";
      if (item.target.kind === "ignore") continue;
      if (item.target.kind === "title") {
        title = rawValue.trim();
        if (!title) rowIssues.push({ rowNumber: row.rowNumber, sourceHeader: item.sourceHeader, message: "Entry name is required" });
        if (title.length > 240) rowIssues.push({ rowNumber: row.rowNumber, sourceHeader: item.sourceHeader, message: "Entry name cannot exceed 240 characters" });
        continue;
      }
      if (item.target.kind === "description") {
        description = rawValue;
        continue;
      }
      const field = fieldsByKey.get(item.target.fieldKey);
      if (!field) continue;
      const converted = convertFieldValue(rawValue, field);
      if (!converted.ok) {
        rowIssues.push({ rowNumber: row.rowNumber, sourceHeader: item.sourceHeader, message: converted.message });
      } else if (field.required && (converted.value === undefined || converted.value === null)) {
        rowIssues.push({ rowNumber: row.rowNumber, sourceHeader: item.sourceHeader, message: `${field.label} is required` });
      } else if (converted.value !== undefined) {
        data[field.key] = converted.value;
      }
    }
    if (rowIssues.length > 0) invalidRowNumbers.add(row.rowNumber);
    issues.push(...rowIssues);
    return { ...row, title, description, data, descriptionMapped, mappedFieldKeys };
  });

  if (issues.some((issue) => issue.rowNumber === null)) {
    for (const row of parsed.rows) invalidRowNumbers.add(row.rowNumber);
  }
  return { mapping, rows: preparedRows, invalidRowNumbers, issues };
}

function canonicalDuplicateValue(
  value: string | number | boolean | null | undefined
): string | null {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return null;
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : JSON.stringify(value);
}

export function v2CsvLibraryImportDuplicateValue(
  value: Pick<V2PreparedCsvLibraryRow, "title" | "data"> | V2CardLibraryEntry,
  key: V2CsvLibraryImportDuplicateKey
): string | null {
  return key.kind === "title"
    ? canonicalDuplicateValue(value.title)
    : canonicalDuplicateValue(value.data[key.fieldKey] as string | number | boolean | null | undefined);
}

export function planV2CsvLibraryImport(
  rows: V2PreparedCsvLibraryRow[],
  existingEntries: V2CardLibraryEntry[],
  duplicatePolicy: V2CsvLibraryImportDuplicatePolicy
): V2CsvLibraryImportPlan {
  if (duplicatePolicy.mode === "create_new") {
    return {
      operations: rows.map((row) => ({ kind: "create", row })),
      createRows: rows.length,
      updateRows: 0,
      skippedRows: 0,
      invalidRows: 0
    };
  }

  const byDuplicateValue = new Map<string, V2CardLibraryEntry[]>();
  for (const entry of existingEntries) {
    const value = v2CsvLibraryImportDuplicateValue(entry, duplicatePolicy.key);
    if (value) byDuplicateValue.set(value, [...(byDuplicateValue.get(value) ?? []), entry]);
  }
  const seenCsvValues = new Set<string>();
  const operations: V2CsvLibraryImportOperation[] = [];
  for (const row of rows) {
    const value = v2CsvLibraryImportDuplicateValue(row, duplicatePolicy.key);
    if (!value) {
      operations.push({ kind: "invalid", row, message: "Duplicate matching value is required" });
      continue;
    }
    const matches = byDuplicateValue.get(value) ?? [];
    if (duplicatePolicy.mode === "skip_existing") {
      if (matches.length > 0 || seenCsvValues.has(value)) {
        operations.push({ kind: "skipped", row });
      } else {
        operations.push({ kind: "create", row });
      }
      seenCsvValues.add(value);
      continue;
    }
    if (seenCsvValues.has(value)) {
      operations.push({ kind: "invalid", row, message: "Update matching values must be unique inside the CSV" });
    } else if (matches.length > 1) {
      operations.push({ kind: "invalid", row, message: "Multiple library entries match this update key" });
    } else if (matches[0]) {
      const mergedData = { ...matches[0].data };
      for (const fieldKey of row.mappedFieldKeys) delete mergedData[fieldKey];
      Object.assign(mergedData, row.data);
      operations.push({
        kind: "update",
        row: {
          ...row,
          description: row.descriptionMapped ? row.description : matches[0].description,
          data: mergedData
        },
        entry: matches[0]
      });
    } else {
      operations.push({ kind: "create", row });
    }
    seenCsvValues.add(value);
  }
  return {
    operations,
    createRows: operations.filter((operation) => operation.kind === "create").length,
    updateRows: operations.filter((operation) => operation.kind === "update").length,
    skippedRows: operations.filter((operation) => operation.kind === "skipped").length,
    invalidRows: operations.filter((operation) => operation.kind === "invalid").length
  };
}
