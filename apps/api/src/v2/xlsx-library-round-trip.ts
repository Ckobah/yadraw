import { createHash } from "node:crypto";
import { posix } from "node:path";
import {
  v2UuidSchema,
  type V2CardLibraryEntry,
  type V2CardType,
  type V2CardTypeFieldSchema,
  type V2CardTypeFieldType,
  type V2XlsxLibraryImportIssue,
  type V2XlsxLibraryImportPreviewInput,
  type V2XlsxLibraryNewFieldInput,
  type V2XlsxLibraryNewFieldProposal,
  type V2XlsxLibraryWorkbookFile
} from "@yadraw/shared";
import { XMLParser } from "fast-xml-parser";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const V2_XLSX_LIBRARY_MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;
export const V2_XLSX_LIBRARY_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const V2_XLSX_LIBRARY_MAX_ROWS = 1000;
export const V2_XLSX_LIBRARY_MAX_COLUMNS = 50;
export const V2_XLSX_LIBRARY_MAX_NEW_FIELDS = 20;
export const V2_XLSX_LIBRARY_MAX_CELL_LENGTH = 10_000;
const V2_XLSX_LIBRARY_MAX_ZIP_ENTRIES = 2000;
const V2_XLSX_LIBRARY_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;
const WORKBOOK_FORMAT_VERSION = "1";
const LIBRARY_SHEET_NAME = "Library";
const METADATA_SHEET_NAME = "_Yadraw";
const V2_XLSX_LIBRARY_MAX_XML_PART_BYTES = 10 * 1024 * 1024;
const V2_XLSX_LIBRARY_MAX_XML_TAGS = 500_000;

type XmlRecord = Record<string, any>;
type ParsedCell = {
  value: string | number | boolean | null;
  formula: boolean;
  dateFormatted: boolean;
};

type ParsedSheet = {
  rows: Map<number, Map<number, ParsedCell>>;
  maximumRow: number;
  maximumColumn: number;
};

type WorkbookColumn = {
  index: number;
  header: string;
  definedName: string;
  kind: "title" | "description" | "archived" | "entry_id" | "version" | "field";
  fieldKey: string | null;
};

export type V2PreparedXlsxLibraryRow = {
  rowNumber: number;
  entryId: string | null;
  expectedVersion: number | null;
  title: string;
  description: string;
  data: Record<string, unknown>;
  archived: boolean;
};

export type V2XlsxLibraryImportOperation =
  | { kind: "create"; row: V2PreparedXlsxLibraryRow }
  | { kind: "update"; row: V2PreparedXlsxLibraryRow; entry: V2CardLibraryEntry }
  | { kind: "unchanged"; row: V2PreparedXlsxLibraryRow; entry: V2CardLibraryEntry }
  | { kind: "invalid"; rowNumber: number; entryId: string | null; title: string; issues: string[] };

export type V2XlsxLibraryImportPlan = {
  fingerprint: string;
  sourceHash: string;
  sourceSchemaUpdatedAt: string;
  schema: V2CardType["schema"];
  addedFields: V2CardTypeFieldSchema[];
  proposedFields: V2XlsxLibraryNewFieldProposal[];
  requiresFieldConfirmation: boolean;
  issues: V2XlsxLibraryImportIssue[];
  warnings: string[];
  operations: V2XlsxLibraryImportOperation[];
  totalRows: number;
  createRows: number;
  updateRows: number;
  unchangedRows: number;
  invalidRows: number;
};

export class V2XlsxLibraryError extends Error {}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: false
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function xmlEscape(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

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

function columnLetters(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function columnIndex(reference: string): number {
  const match = /^([A-Z]{1,3})[1-9][0-9]*$/i.exec(reference);
  if (!match) throw new V2XlsxLibraryError(`Invalid workbook cell reference: ${reference}`);
  return [...match[1]!.toUpperCase()].reduce(
    (total, character) => total * 26 + character.charCodeAt(0) - 64,
    0
  );
}

function cellReference(column: number, row: number): string {
  return `${columnLetters(column)}${row}`;
}

function readTextNode(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(readTextNode).join("");
  if (typeof value === "object") {
    const record = value as XmlRecord;
    if (record["#text"] !== undefined) return readTextNode(record["#text"]);
    if (record.t !== undefined) return readTextNode(record.t);
    if (record.r !== undefined) {
      return asArray(record.r).map((part) => readTextNode((part as XmlRecord).t)).join("");
    }
  }
  return "";
}

function parseXml(bytes: Uint8Array, label: string): XmlRecord {
  if (bytes.byteLength > V2_XLSX_LIBRARY_MAX_XML_PART_BYTES) {
    throw new V2XlsxLibraryError(`${label} exceeds the XML safety limit`);
  }
  const source = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new V2XlsxLibraryError(`${label} contains unsupported XML declarations`);
  }
  let tagCount = 0;
  for (let index = source.indexOf("<"); index !== -1; index = source.indexOf("<", index + 1)) {
    tagCount += 1;
    if (tagCount > V2_XLSX_LIBRARY_MAX_XML_TAGS) {
      throw new V2XlsxLibraryError(`${label} contains too many XML elements`);
    }
  }
  try {
    return xmlParser.parse(source) as XmlRecord;
  } catch {
    throw new V2XlsxLibraryError(`${label} contains invalid XML`);
  }
}

function validateBase64(value: string): Buffer {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new V2XlsxLibraryError("Workbook data is not valid base64");
  }
  const buffer = Buffer.from(value, "base64");
  if (buffer.length === 0) throw new V2XlsxLibraryError("Workbook is empty");
  if (buffer.length > V2_XLSX_LIBRARY_MAX_COMPRESSED_BYTES) {
    throw new V2XlsxLibraryError("XLSX workbooks cannot exceed 5 MiB");
  }
  return buffer;
}

function preflightZip(buffer: Buffer): void {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new V2XlsxLibraryError("File is not a valid XLSX ZIP package");
  }
  const searchStart = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) throw new V2XlsxLibraryError("Workbook ZIP directory is missing");
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const directoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const directorySize = buffer.readUInt32LE(endOffset + 12);
  const directoryOffset = buffer.readUInt32LE(endOffset + 16);
  if (diskNumber !== 0 || directoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new V2XlsxLibraryError("Multi-disk XLSX packages are not supported");
  }
  if (entryCount === 0 || entryCount > V2_XLSX_LIBRARY_MAX_ZIP_ENTRIES) {
    throw new V2XlsxLibraryError("Workbook contains too many ZIP entries");
  }
  if (directoryOffset + directorySize > endOffset) {
    throw new V2XlsxLibraryError("Workbook ZIP directory is invalid");
  }

  let offset = directoryOffset;
  let uncompressedTotal = 0;
  const filenames = new Set<string>();
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new V2XlsxLibraryError("Workbook ZIP entry is invalid");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + filenameLength + extraLength + commentLength;
    if (entryEnd > buffer.length || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new V2XlsxLibraryError("ZIP64 XLSX packages are not supported");
    }
    if ((flags & 0x1) !== 0) throw new V2XlsxLibraryError("Encrypted XLSX packages are not supported");
    if (compression !== 0 && compression !== 8) {
      throw new V2XlsxLibraryError("Workbook uses unsupported ZIP compression");
    }
    const filename = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");
    const normalized = filename.replaceAll("\\", "/");
    const lowered = normalized.toLocaleLowerCase();
    const unsafeSegments = new Set(["..", "__proto__", "prototype", "constructor"]);
    if (
      !normalized ||
      normalized.startsWith("/") ||
      normalized.includes("\0") ||
      normalized.split("/").some((part) => unsafeSegments.has(part.toLocaleLowerCase())) ||
      filenames.has(lowered)
    ) {
      throw new V2XlsxLibraryError("Workbook contains an unsafe ZIP path");
    }
    filenames.add(lowered);
    if (
      lowered.includes("vbaproject") ||
      lowered.includes("/externallinks/") ||
      lowered.includes("/activex/") ||
      lowered.includes("/embeddings/") ||
      lowered.includes("/oleobjects/")
    ) {
      throw new V2XlsxLibraryError("Macros, external links, and embedded objects are not supported");
    }
    uncompressedTotal += uncompressedSize;
    if (
      uncompressedSize > V2_XLSX_LIBRARY_MAX_UNCOMPRESSED_BYTES ||
      uncompressedTotal > V2_XLSX_LIBRARY_MAX_UNCOMPRESSED_BYTES
    ) {
      throw new V2XlsxLibraryError("Workbook expands beyond the 25 MiB safety limit");
    }
    offset = entryEnd;
  }
  if (offset !== directoryOffset + directorySize) {
    throw new V2XlsxLibraryError("Workbook ZIP directory length is invalid");
  }
}

function unzipWorkbook(buffer: Buffer): Record<string, Uint8Array> {
  preflightZip(buffer);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new V2XlsxLibraryError("Workbook ZIP data could not be read");
  }
  for (const [filename, bytes] of Object.entries(files)) {
    if (filename.endsWith(".rels") && /TargetMode\s*=\s*["']External["']/i.test(strFromU8(bytes))) {
      throw new V2XlsxLibraryError("External workbook relationships are not supported");
    }
  }
  return files;
}

function normalizeRelationshipTarget(target: string): string {
  const normalized = target.startsWith("/")
    ? posix.normalize(target.slice(1))
    : posix.normalize(posix.join("xl", target));
  if (!normalized.startsWith("xl/") || normalized.split("/").includes("..")) {
    throw new V2XlsxLibraryError("Workbook contains an unsafe relationship target");
  }
  return normalized;
}

function readWorkbookParts(files: Record<string, Uint8Array>): {
  workbook: XmlRecord;
  sheets: Map<string, ParsedSheet>;
  definedNames: Map<string, string>;
} {
  const workbookBytes = files["xl/workbook.xml"];
  const relationshipsBytes = files["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relationshipsBytes) {
    throw new V2XlsxLibraryError("Workbook is missing its OpenXML index");
  }
  const workbookDocument = parseXml(workbookBytes, "Workbook index");
  const workbook = workbookDocument.workbook as XmlRecord | undefined;
  if (!workbook) throw new V2XlsxLibraryError("Workbook index is invalid");
  const relationshipsDocument = parseXml(relationshipsBytes, "Workbook relationships");
  const relationships = new Map<string, string>();
  for (const relationship of asArray<XmlRecord>(relationshipsDocument.Relationships?.Relationship)) {
    if (relationship.TargetMode === "External") {
      throw new V2XlsxLibraryError("External workbook relationships are not supported");
    }
    if (relationship.Id && relationship.Target) {
      relationships.set(String(relationship.Id), normalizeRelationshipTarget(String(relationship.Target)));
    }
  }

  const sharedStrings = readSharedStrings(files["xl/sharedStrings.xml"]);
  const dateStyles = readDateStyles(files["xl/styles.xml"]);
  const date1904 = String(workbook.workbookPr?.date1904 ?? "0") === "1";
  const sheets = new Map<string, ParsedSheet>();
  for (const sheet of asArray<XmlRecord>(workbook.sheets?.sheet)) {
    const name = String(sheet.name ?? "");
    const target = relationships.get(String(sheet["r:id"] ?? ""));
    const bytes = target ? files[target] : undefined;
    if (!name || !bytes) throw new V2XlsxLibraryError("Workbook contains an unreadable sheet");
    sheets.set(name, readSheet(bytes, sharedStrings, dateStyles, date1904, name));
  }

  const definedNames = new Map<string, string>();
  for (const item of asArray<XmlRecord | string>(workbook.definedNames?.definedName)) {
    if (typeof item === "string") continue;
    const name = String(item.name ?? "");
    const reference = readTextNode(item);
    if (name && reference) definedNames.set(name, reference);
  }
  return { workbook, sheets, definedNames };
}

function readSharedStrings(bytes: Uint8Array | undefined): string[] {
  if (!bytes) return [];
  const document = parseXml(bytes, "Shared strings");
  return asArray<XmlRecord>(document.sst?.si).map(readTextNode);
}

function readDateStyles(bytes: Uint8Array | undefined): Set<number> {
  if (!bytes) return new Set();
  const document = parseXml(bytes, "Workbook styles");
  const styleSheet = document.styleSheet as XmlRecord | undefined;
  if (!styleSheet) return new Set();
  const customFormats = new Map<number, string>();
  for (const format of asArray<XmlRecord>(styleSheet.numFmts?.numFmt)) {
    const id = Number(format.numFmtId);
    if (Number.isInteger(id)) customFormats.set(id, String(format.formatCode ?? ""));
  }
  const standardDateFormats = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  const dateStyles = new Set<number>();
  asArray<XmlRecord>(styleSheet.cellXfs?.xf).forEach((style, index) => {
    const formatId = Number(style.numFmtId ?? 0);
    const custom = customFormats.get(formatId)
      ?.replace(/"[^"]*"/g, "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\\./g, "");
    if (standardDateFormats.has(formatId) || (custom && /[ymd]/i.test(custom))) {
      dateStyles.add(index);
    }
  });
  return dateStyles;
}

function excelSerialToIsoDate(value: number, date1904: boolean): string | null {
  if (!Number.isFinite(value)) return null;
  const wholeDays = Math.floor(value);
  const adjustedDays = date1904 ? wholeDays : wholeDays - (wholeDays >= 60 ? 1 : 0);
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const date = new Date(epoch + adjustedDays * 86_400_000);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function readSheet(
  bytes: Uint8Array,
  sharedStrings: string[],
  dateStyles: Set<number>,
  date1904: boolean,
  sheetName: string
): ParsedSheet {
  const document = parseXml(bytes, `${sheetName} sheet`);
  const worksheet = document.worksheet as XmlRecord | undefined;
  if (!worksheet) throw new V2XlsxLibraryError(`${sheetName} sheet is invalid`);
  if (sheetName === LIBRARY_SHEET_NAME && (worksheet.mergeCells || worksheet.hyperlinks)) {
    throw new V2XlsxLibraryError("The Library sheet cannot contain merged cells or hyperlinks");
  }
  const rows = new Map<number, Map<number, ParsedCell>>();
  let maximumRow = 0;
  let maximumColumn = 0;
  for (const rawRow of asArray<XmlRecord>(worksheet.sheetData?.row)) {
    const rowNumber = Number(rawRow.r);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    const cells = new Map<number, ParsedCell>();
    for (const rawCell of asArray<XmlRecord>(rawRow.c)) {
      const reference = String(rawCell.r ?? "");
      const index = columnIndex(reference);
      const formula = rawCell.f !== undefined;
      const type = String(rawCell.t ?? "n");
      const rawValue = readTextNode(rawCell.v);
      let value: ParsedCell["value"] = null;
      if (type === "inlineStr") value = readTextNode(rawCell.is);
      else if (type === "s") value = sharedStrings[Number(rawValue)] ?? "";
      else if (type === "b") value = rawValue === "1" || rawValue.toLocaleLowerCase() === "true";
      else if (type === "str" || type === "d" || type === "e") value = rawValue;
      else if (rawValue !== "") {
        const numberValue = Number(rawValue);
        value = Number.isFinite(numberValue) ? numberValue : rawValue;
      }
      const styleIndex = Number(rawCell.s ?? 0);
      const dateFormatted = Number.isInteger(styleIndex) && dateStyles.has(styleIndex);
      if (dateFormatted && typeof value === "number") {
        value = excelSerialToIsoDate(value, date1904) ?? value;
      }
      if (typeof value === "string" && value.length > V2_XLSX_LIBRARY_MAX_CELL_LENGTH) {
        throw new V2XlsxLibraryError(
          `${sheetName} cell ${reference} exceeds ${V2_XLSX_LIBRARY_MAX_CELL_LENGTH.toLocaleString()} characters`
        );
      }
      cells.set(index, { value, formula, dateFormatted });
      maximumColumn = Math.max(maximumColumn, index);
    }
    rows.set(rowNumber, cells);
    maximumRow = Math.max(maximumRow, rowNumber);
  }
  return { rows, maximumRow, maximumColumn };
}

function cellValue(sheet: ParsedSheet, row: number, column: number): ParsedCell {
  return sheet.rows.get(row)?.get(column) ?? { value: null, formula: false, dateFormatted: false };
}

function cellText(cell: ParsedCell): string {
  if (cell.value === null) return "";
  if (typeof cell.value === "boolean") return cell.value ? "Yes" : "No";
  return String(cell.value);
}

function meaningfulCell(cell: ParsedCell): boolean {
  return cell.value !== null && (typeof cell.value !== "string" || cell.value.trim() !== "");
}

function parseMetadata(sheet: ParsedSheet): {
  properties: Map<string, string>;
  columns: Map<string, { kind: WorkbookColumn["kind"]; fieldKey: string | null }>;
} {
  const properties = new Map<string, string>();
  const columns = new Map<string, { kind: WorkbookColumn["kind"]; fieldKey: string | null }>();
  for (let row = 2; row <= sheet.maximumRow; row += 1) {
    const recordType = cellText(cellValue(sheet, row, 1)).trim();
    if (recordType === "property") {
      properties.set(
        cellText(cellValue(sheet, row, 2)).trim(),
        cellText(cellValue(sheet, row, 3)).trim()
      );
    } else if (recordType === "column") {
      const definedName = cellText(cellValue(sheet, row, 2)).trim();
      const kind = cellText(cellValue(sheet, row, 3)).trim() as WorkbookColumn["kind"];
      const fieldKey = cellText(cellValue(sheet, row, 4)).trim() || null;
      if (
        !definedName ||
        !["title", "description", "archived", "entry_id", "version", "field"].includes(kind) ||
        columns.has(definedName)
      ) {
        throw new V2XlsxLibraryError("Yadraw workbook metadata is invalid");
      }
      columns.set(definedName, { kind, fieldKey });
    }
  }
  return { properties, columns };
}

function definedNameColumn(reference: string): number | null {
  const match = /^(?:'Library'|Library)!\$([A-Z]{1,3})\$1$/i.exec(reference.trim());
  if (!match) return null;
  return columnIndex(`${match[1]}1`);
}

function normalizeFieldKeyBase(header: string): string {
  const normalized = header
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (!normalized) return "field";
  return /^[a-z]/.test(normalized) ? normalized : `field_${normalized}`;
}

function proposedFieldKey(header: string, columnId: string, usedKeys: Set<string>): string {
  const base = normalizeFieldKeyBase(header);
  if (!usedKeys.has(base)) return base;
  const suffix = createHash("sha256").update(`${header}:${columnId}`).digest("hex").slice(0, 8);
  const candidate = `${base.slice(0, 105)}_${suffix}`;
  if (!usedKeys.has(candidate)) return candidate;
  let sequence = 2;
  while (usedKeys.has(`${candidate}_${sequence}`)) sequence += 1;
  return `${candidate}_${sequence}`;
}

function rawValueKey(value: ParsedCell["value"]): string | null {
  if (value === null || (typeof value === "string" && !value.trim())) return null;
  return typeof value === "string" ? value.trim() : String(value);
}

function inferFieldType(values: ParsedCell[]): V2CardTypeFieldType {
  const nonEmpty = values.filter(meaningfulCell);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every((cell) => typeof cell.value === "boolean" || parseBoolean(cell.value) !== null)) {
    return "boolean";
  }
  if (nonEmpty.every((cell) => typeof cell.value === "number" && Number.isFinite(cell.value))) {
    return "number";
  }
  if (nonEmpty.every((cell) => isValidDate(cellText(cell).trim()))) return "date";
  if (nonEmpty.every((cell) => {
    if (typeof cell.value !== "string") return false;
    try {
      const parsed = JSON.parse(cell.value);
      return parsed !== null && typeof parsed === "object";
    } catch {
      return false;
    }
  })) return "json";
  return "text";
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseBoolean(value: ParsedCell["value"]): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const normalized = String(value ?? "").trim().toLocaleLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return null;
}

function selectOptions(values: ParsedCell[]): NonNullable<V2CardTypeFieldSchema["options"]> | null {
  const distinct = new Map<string, string>();
  for (const cell of values) {
    const text = rawValueKey(cell.value);
    if (!text) continue;
    if (text.length > 120) return null;
    const canonical = text.toLocaleLowerCase();
    if (!distinct.has(canonical)) distinct.set(canonical, text);
    if (distinct.size > 50) return null;
  }
  return [...distinct.values()].map((value) => ({ value, label: value }));
}

function convertFieldValue(
  cell: ParsedCell,
  field: V2CardTypeFieldSchema
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (!meaningfulCell(cell)) return { ok: true, value: undefined };
  if (field.type === "text") return { ok: true, value: cellText(cell) };
  if (field.type === "number") {
    const value = typeof cell.value === "number" ? cell.value : Number(cellText(cell).trim());
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: `${field.label} must be a finite number` };
  }
  if (field.type === "boolean") {
    const value = parseBoolean(cell.value);
    return value === null
      ? { ok: false, message: `${field.label} must be true/false, yes/no, or 1/0` }
      : { ok: true, value };
  }
  if (field.type === "date") {
    const value = cellText(cell).trim();
    return isValidDate(value)
      ? { ok: true, value }
      : { ok: false, message: `${field.label} must be a valid date in YYYY-MM-DD format` };
  }
  if (field.type === "select") {
    const value = cellText(cell).trim();
    const option = field.options?.find(
      (candidate) => candidate.value === value || candidate.label.toLocaleLowerCase() === value.toLocaleLowerCase()
    );
    return option
      ? { ok: true, value: option.value }
      : { ok: false, message: `${field.label} must match a configured option` };
  }
  if (typeof cell.value !== "string") return { ok: true, value: cell.value };
  try {
    return { ok: true, value: JSON.parse(cell.value) };
  } catch {
    return { ok: false, message: `${field.label} must contain valid JSON` };
  }
}

function archiveIso(archived: boolean, existing: V2CardLibraryEntry | null): string | null {
  if (!archived) return null;
  return existing?.archivedAt ?? "1970-01-01T00:00:00.000Z";
}

function entriesEqual(
  row: V2PreparedXlsxLibraryRow,
  existing: V2CardLibraryEntry
): boolean {
  return (
    row.title === existing.title &&
    row.description === existing.description &&
    stableJson(row.data) === stableJson(existing.data) &&
    row.archived === (existing.archivedAt !== null)
  );
}

function workbookSourceHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function fingerprintPlan(
  sourceHash: string,
  cardType: V2CardType,
  addedFields: V2CardTypeFieldSchema[],
  operations: V2XlsxLibraryImportOperation[]
): string {
  return createHash("sha256")
    .update(stableJson({
      sourceHash,
      cardTypeUpdatedAt: cardType.updatedAt,
      schema: cardType.schema,
      addedFields,
      operations: operations.map((operation) => operation.kind === "invalid"
        ? operation
        : {
            kind: operation.kind,
            row: operation.row,
            ...(operation.kind !== "create"
              ? { entryId: operation.entry.id, entryVersion: operation.entry.version }
              : {})
          })
    }))
    .digest("hex");
}

export function prepareV2XlsxLibraryImport(
  cardType: V2CardType,
  existingEntries: V2CardLibraryEntry[],
  input: V2XlsxLibraryImportPreviewInput
): V2XlsxLibraryImportPlan {
  if (existingEntries.length > V2_XLSX_LIBRARY_MAX_ROWS) {
    throw new V2XlsxLibraryError("This library exceeds the current 1,000-entry workbook limit");
  }
  const buffer = validateBase64(input.workbookBase64);
  const files = unzipWorkbook(buffer);
  const { sheets, definedNames } = readWorkbookParts(files);
  const librarySheet = sheets.get(LIBRARY_SHEET_NAME);
  const metadataSheet = sheets.get(METADATA_SHEET_NAME);
  if (!librarySheet || !metadataSheet) {
    throw new V2XlsxLibraryError("Choose a workbook exported from this Yadraw library");
  }
  if (librarySheet.maximumColumn > V2_XLSX_LIBRARY_MAX_COLUMNS) {
    throw new V2XlsxLibraryError("Library workbooks cannot contain more than 50 columns");
  }
  if (librarySheet.maximumRow > V2_XLSX_LIBRARY_MAX_ROWS + 1) {
    throw new V2XlsxLibraryError("Library workbooks cannot contain more than 1,000 data rows");
  }

  const metadata = parseMetadata(metadataSheet);
  if (metadata.properties.get("format_version") !== WORKBOOK_FORMAT_VERSION) {
    throw new V2XlsxLibraryError("This Yadraw workbook format is not supported");
  }
  if (
    metadata.properties.get("workspace_id") !== cardType.workspaceId ||
    metadata.properties.get("card_type_id") !== cardType.id
  ) {
    throw new V2XlsxLibraryError("This workbook belongs to another workspace or card type");
  }
  const sourceSchemaUpdatedAt = metadata.properties.get("schema_updated_at") ?? "";
  const warnings: string[] = [];
  if (sourceSchemaUpdatedAt !== cardType.updatedAt) {
    warnings.push("This card type changed after the workbook was downloaded. Missing columns are preserved and the current schema is used.");
  }

  const columns: WorkbookColumn[] = [];
  const mappedColumnIndexes = new Set<number>();
  for (const [name, definition] of metadata.columns) {
    const reference = definedNames.get(name);
    const index = reference ? definedNameColumn(reference) : null;
    if (index === null) {
      if (definition.kind === "field") continue;
      throw new V2XlsxLibraryError("A required Yadraw workbook column was removed");
    }
    if (mappedColumnIndexes.has(index)) {
      throw new V2XlsxLibraryError("Workbook column identity is duplicated");
    }
    if (definition.kind === "field" && !cardType.schema.fields.some((field) => field.key === definition.fieldKey)) {
      throw new V2XlsxLibraryError(`Workbook references a field that no longer exists: ${definition.fieldKey ?? "unknown"}`);
    }
    const header = cellText(cellValue(librarySheet, 1, index)).trim();
    if (!header) throw new V2XlsxLibraryError("Workbook headers cannot be empty");
    columns.push({ index, header, definedName: name, ...definition });
    mappedColumnIndexes.add(index);
  }
  for (const requiredKind of ["title", "description", "archived", "entry_id", "version"] as const) {
    if (!columns.some((column) => column.kind === requiredKind)) {
      throw new V2XlsxLibraryError("A required Yadraw workbook column was removed");
    }
  }

  const nonEmptyRows: number[] = [];
  for (let row = 2; row <= librarySheet.maximumRow; row += 1) {
    if ([...Array(librarySheet.maximumColumn)].some((_, index) => meaningfulCell(cellValue(librarySheet, row, index + 1)))) {
      nonEmptyRows.push(row);
    }
  }
  if (nonEmptyRows.length > V2_XLSX_LIBRARY_MAX_ROWS) {
    throw new V2XlsxLibraryError("Library workbooks cannot contain more than 1,000 data rows");
  }

  const usedKeys = new Set(cardType.schema.fields.map((field) => field.key));
  const proposedFields: V2XlsxLibraryNewFieldProposal[] = [];
  const proposalCells = new Map<string, ParsedCell[]>();
  for (let index = 1; index <= librarySheet.maximumColumn; index += 1) {
    if (mappedColumnIndexes.has(index)) continue;
    const header = cellText(cellValue(librarySheet, 1, index)).trim();
    const values = nonEmptyRows.map((row) => cellValue(librarySheet, row, index));
    if (!header && values.some(meaningfulCell)) {
      throw new V2XlsxLibraryError(`Column ${columnLetters(index)} needs a header`);
    }
    if (!header) continue;
    if (header.length > 120) throw new V2XlsxLibraryError("Workbook headers cannot exceed 120 characters");
    const columnId = `column_${index}`;
    const fieldKey = proposedFieldKey(header, columnId, usedKeys);
    usedKeys.add(fieldKey);
    const distinct = [...new Set(values.map((cell) => rawValueKey(cell.value)).filter((value): value is string => value !== null))];
    proposedFields.push({
      columnId,
      header,
      fieldKey,
      suggestedType: inferFieldType(values),
      confirmedType: null,
      distinctValueCount: distinct.length,
      sampleValues: distinct.slice(0, 3).map((value) => value.slice(0, 240))
    });
    proposalCells.set(columnId, values);
  }
  if (proposedFields.length > V2_XLSX_LIBRARY_MAX_NEW_FIELDS) {
    throw new V2XlsxLibraryError("A workbook can add at most 20 new fields at once");
  }

  const confirmations = new Map<string, V2XlsxLibraryNewFieldInput>();
  for (const confirmation of input.newFields) {
    if (confirmations.has(confirmation.columnId)) {
      throw new V2XlsxLibraryError("New field confirmations must be unique");
    }
    confirmations.set(confirmation.columnId, confirmation);
  }
  for (const columnId of confirmations.keys()) {
    if (!proposedFields.some((proposal) => proposal.columnId === columnId)) {
      throw new V2XlsxLibraryError(`Unknown new field column: ${columnId}`);
    }
  }

  const issues: V2XlsxLibraryImportIssue[] = [];
  const addedFields: V2CardTypeFieldSchema[] = [];
  for (const proposal of proposedFields) {
    const confirmation = confirmations.get(proposal.columnId);
    proposal.confirmedType = confirmation?.type ?? null;
    if (!confirmation) {
      issues.push({ rowNumber: null, columnId: proposal.columnId, message: `Confirm a field type for ${proposal.header}` });
      continue;
    }
    const values = proposalCells.get(proposal.columnId) ?? [];
    const options = confirmation.type === "select" ? selectOptions(values) : undefined;
    if (confirmation.type === "select" && !options) {
      issues.push({
        rowNumber: null,
        columnId: proposal.columnId,
        message: `${proposal.header} needs 50 or fewer distinct values, each no longer than 120 characters, to become a choice field`
      });
      continue;
    }
    addedFields.push({
      key: proposal.fieldKey,
      label: proposal.header,
      type: confirmation.type,
      required: false,
      ...(options ? { options } : {})
    });
  }
  const schema = { fields: [...cardType.schema.fields, ...addedFields] };
  const fieldsByKey = new Map(schema.fields.map((field) => [field.key, field]));
  const existingById = new Map(existingEntries.map((entry) => [entry.id, entry]));
  const seenIds = new Map<string, number>();
  const operations: V2XlsxLibraryImportOperation[] = [];

  const titleColumn = columns.find((column) => column.kind === "title")!;
  const descriptionColumn = columns.find((column) => column.kind === "description")!;
  const archivedColumn = columns.find((column) => column.kind === "archived")!;
  const idColumn = columns.find((column) => column.kind === "entry_id")!;
  const versionColumn = columns.find((column) => column.kind === "version")!;
  const fieldColumns = columns.filter((column) => column.kind === "field");
  const newColumns = proposedFields.flatMap((proposal) => {
    const field = addedFields.find((candidate) => candidate.key === proposal.fieldKey);
    if (!field) return [];
    return [{ index: Number(proposal.columnId.slice("column_".length)), field }];
  });

  for (const rowNumber of nonEmptyRows) {
    const rowIssues: V2XlsxLibraryImportIssue[] = [];
    const formulaColumns = [...Array(librarySheet.maximumColumn)]
      .map((_, index) => index + 1)
      .filter((index) => cellValue(librarySheet, rowNumber, index).formula);
    for (const index of formulaColumns) {
      rowIssues.push({ rowNumber, columnId: `column_${index}`, message: "Formula cells are not allowed in library imports" });
    }

    const rawId = cellText(cellValue(librarySheet, rowNumber, idColumn.index)).trim();
    const rawVersion = cellText(cellValue(librarySheet, rowNumber, versionColumn.index)).trim();
    const entryId = rawId || null;
    let existing: V2CardLibraryEntry | null = null;
    let expectedVersion: number | null = null;
    if (entryId) {
      if (!v2UuidSchema.safeParse(entryId).success) {
        rowIssues.push({ rowNumber, columnId: `column_${idColumn.index}`, message: "Yadraw entry ID is invalid" });
      } else {
        existing = existingById.get(entryId) ?? null;
        if (!existing) rowIssues.push({ rowNumber, columnId: `column_${idColumn.index}`, message: "Yadraw entry ID does not belong to this library" });
        const firstRow = seenIds.get(entryId);
        if (firstRow) {
          rowIssues.push({ rowNumber, columnId: `column_${idColumn.index}`, message: `Yadraw entry ID is already used on row ${firstRow}` });
        } else {
          seenIds.set(entryId, rowNumber);
        }
      }
      const version = Number(rawVersion);
      if (!rawVersion || !Number.isInteger(version) || version < 1) {
        rowIssues.push({ rowNumber, columnId: `column_${versionColumn.index}`, message: "Existing rows need their Yadraw version" });
      } else {
        expectedVersion = version;
        if (existing && existing.version !== version) {
          rowIssues.push({ rowNumber, columnId: `column_${versionColumn.index}`, message: "This row is stale because the library entry changed after download" });
        }
      }
    } else if (rawVersion) {
      rowIssues.push({ rowNumber, columnId: `column_${versionColumn.index}`, message: "A new row cannot contain a Yadraw version" });
    }

    const title = cellText(cellValue(librarySheet, rowNumber, titleColumn.index)).trim();
    if (!title) rowIssues.push({ rowNumber, columnId: `column_${titleColumn.index}`, message: "Entry name is required" });
    if (title.length > 240) rowIssues.push({ rowNumber, columnId: `column_${titleColumn.index}`, message: "Entry name cannot exceed 240 characters" });
    const descriptionCell = cellValue(librarySheet, rowNumber, descriptionColumn.index);
    const description = cellText(descriptionCell);
    if (description.length > 10_000) {
      rowIssues.push({ rowNumber, columnId: `column_${descriptionColumn.index}`, message: "Description cannot exceed 10,000 characters" });
    }
    const archivedCell = cellValue(librarySheet, rowNumber, archivedColumn.index);
    let archived = existing?.archivedAt !== null && existing !== null;
    if (meaningfulCell(archivedCell)) {
      const parsedArchived = parseBoolean(archivedCell.value);
      if (parsedArchived === null) {
        rowIssues.push({ rowNumber, columnId: `column_${archivedColumn.index}`, message: "Archived must be yes/no, true/false, or 1/0" });
      } else {
        archived = parsedArchived;
      }
    } else if (!existing) archived = false;

    const data = existing ? { ...existing.data } : {};
    for (const column of fieldColumns) {
      const field = fieldsByKey.get(column.fieldKey ?? "");
      if (!field) continue;
      const converted = convertFieldValue(cellValue(librarySheet, rowNumber, column.index), field);
      if (!converted.ok) {
        rowIssues.push({ rowNumber, columnId: `column_${column.index}`, message: converted.message });
      } else if (converted.value === undefined) {
        delete data[field.key];
      } else {
        data[field.key] = converted.value;
      }
    }
    for (const column of newColumns) {
      const converted = convertFieldValue(cellValue(librarySheet, rowNumber, column.index), column.field);
      if (!converted.ok) {
        rowIssues.push({ rowNumber, columnId: `column_${column.index}`, message: converted.message });
      } else if (converted.value !== undefined) {
        data[column.field.key] = converted.value;
      }
    }
    for (const field of schema.fields) {
      const value = data[field.key];
      if (field.required && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) {
        rowIssues.push({ rowNumber, columnId: null, message: `${field.label} is required` });
      }
    }

    issues.push(...rowIssues);
    if (rowIssues.length > 0) {
      operations.push({ kind: "invalid", rowNumber, entryId, title, issues: rowIssues.map((issue) => issue.message) });
      continue;
    }
    const row: V2PreparedXlsxLibraryRow = {
      rowNumber,
      entryId,
      expectedVersion,
      title,
      description,
      data,
      archived
    };
    if (!existing) operations.push({ kind: "create", row });
    else if (entriesEqual(row, existing)) operations.push({ kind: "unchanged", row, entry: existing });
    else operations.push({ kind: "update", row, entry: existing });
  }

  const sourceHash = workbookSourceHash(buffer);
  const createRows = operations.filter((operation) => operation.kind === "create").length;
  if (existingEntries.length + createRows > V2_XLSX_LIBRARY_MAX_ROWS) {
    throw new V2XlsxLibraryError("This import would exceed the 1,000-entry workbook limit");
  }
  return {
    fingerprint: fingerprintPlan(sourceHash, cardType, addedFields, operations),
    sourceHash,
    sourceSchemaUpdatedAt,
    schema,
    addedFields,
    proposedFields,
    requiresFieldConfirmation: proposedFields.some((proposal) => !proposal.confirmedType),
    issues,
    warnings,
    operations,
    totalRows: operations.length,
    createRows,
    updateRows: operations.filter((operation) => operation.kind === "update").length,
    unchangedRows: operations.filter((operation) => operation.kind === "unchanged").length,
    invalidRows: operations.filter((operation) => operation.kind === "invalid").length
  };
}

function inlineStringCell(reference: string, value: string, style = 0): string {
  const styleAttribute = style > 0 ? ` s="${style}"` : "";
  return `<c r="${reference}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number, style = 0): string {
  const styleAttribute = style > 0 ? ` s="${style}"` : "";
  return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
}

function workbookCell(reference: string, value: unknown, style = 0): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return numberCell(reference, value, style);
  return inlineStringCell(reference, typeof value === "boolean" ? (value ? "Yes" : "No") : String(value), style);
}

function fieldWorkbookValue(field: V2CardTypeFieldSchema, value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (field.type === "boolean") return value === true ? "Yes" : value === false ? "No" : String(value);
  if (field.type === "select" && typeof value === "string") {
    return field.options?.find((option) => option.value === value)?.label ?? value;
  }
  if (field.type === "json") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (field.type === "number" && typeof value === "number" && Number.isFinite(value)) return value;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function safeFilename(cardType: V2CardType, now: Date): string {
  const name = cardType.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "library";
  return `yadraw-${name}-${now.toISOString().slice(0, 10)}.xlsx`;
}

function buildColumns(cardType: V2CardType): WorkbookColumn[] {
  const columns: WorkbookColumn[] = [{
    index: 1,
    header: "Name",
    definedName: "_yd_title",
    kind: "title",
    fieldKey: null
  }];
  for (const [fieldIndex, field] of cardType.schema.fields.entries()) {
    columns.push({
      index: columns.length + 1,
      header: field.label,
      definedName: `_yd_field_${fieldIndex + 1}`,
      kind: "field",
      fieldKey: field.key
    });
  }
  columns.push(
    { index: columns.length + 1, header: "Description", definedName: "_yd_description", kind: "description", fieldKey: null },
    { index: columns.length + 2, header: "Archived", definedName: "_yd_archived", kind: "archived", fieldKey: null },
    { index: columns.length + 3, header: "_Yadraw Entry ID", definedName: "_yd_entry_id", kind: "entry_id", fieldKey: null },
    { index: columns.length + 4, header: "_Yadraw Version", definedName: "_yd_version", kind: "version", fieldKey: null }
  );
  return columns;
}

function buildLibrarySheet(cardType: V2CardType, entries: V2CardLibraryEntry[], columns: WorkbookColumn[]): string {
  const fieldByKey = new Map(cardType.schema.fields.map((field) => [field.key, field]));
  const headerCells = columns.map((column) => inlineStringCell(cellReference(column.index, 1), column.header, 1)).join("");
  const rows = [`<row r="1" ht="28" customHeight="1">${headerCells}</row>`];
  for (const [entryIndex, entry] of entries.entries()) {
    const rowNumber = entryIndex + 2;
    const cells = columns.map((column) => {
      if (column.kind === "title") return workbookCell(cellReference(column.index, rowNumber), entry.title);
      if (column.kind === "description") return workbookCell(cellReference(column.index, rowNumber), entry.description, 3);
      if (column.kind === "archived") return workbookCell(cellReference(column.index, rowNumber), entry.archivedAt ? "Yes" : "No");
      if (column.kind === "entry_id") return workbookCell(cellReference(column.index, rowNumber), entry.id, 4);
      if (column.kind === "version") return numberCell(cellReference(column.index, rowNumber), entry.version, 4);
      const field = fieldByKey.get(column.fieldKey ?? "");
      return field
        ? workbookCell(cellReference(column.index, rowNumber), fieldWorkbookValue(field, entry.data[field.key]), field.type === "json" ? 3 : 0)
        : "";
    }).join("");
    rows.push(`<row r="${rowNumber}">${cells}</row>`);
  }

  const columnXml = columns.map((column) => {
    const field = column.fieldKey ? fieldByKey.get(column.fieldKey) : null;
    const hidden = column.kind === "entry_id" || column.kind === "version";
    const width = hidden ? (column.kind === "entry_id" ? 38 : 14) : field?.type === "json" ? 36 : column.kind === "description" ? 32 : 22;
    return `<col min="${column.index}" max="${column.index}" width="${width}" customWidth="1"${hidden ? ' hidden="1"' : ""}/>`;
  }).join("");
  const lastColumn = columnLetters(columns.length);
  const lastRow = Math.max(2, entries.length + 1);
  const validations: string[] = [];
  for (const column of columns) {
    const field = column.fieldKey ? fieldByKey.get(column.fieldKey) : null;
    const isBoolean = column.kind === "archived" || field?.type === "boolean";
    if (isBoolean) {
      validations.push(`<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Invalid value" error="Choose Yes or No" sqref="${columnLetters(column.index)}2:${columnLetters(column.index)}${V2_XLSX_LIBRARY_MAX_ROWS + 1}"><formula1>&quot;Yes,No&quot;</formula1></dataValidation>`);
    } else if (field?.type === "select" && field.options) {
      const labels = field.options.map((option) => option.label);
      const serialized = labels.join(",");
      if (serialized.length <= 200 && labels.every((label) => !/[,\"]/i.test(label))) {
        validations.push(`<dataValidation type="list" allowBlank="${field.required ? "0" : "1"}" showErrorMessage="1" errorTitle="Invalid choice" error="Choose a configured value" sqref="${columnLetters(column.index)}2:${columnLetters(column.index)}${V2_XLSX_LIBRARY_MAX_ROWS + 1}"><formula1>&quot;${xmlEscape(serialized)}&quot;</formula1></dataValidation>`);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columnXml}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  ${validations.length ? `<dataValidations count="${validations.length}">${validations.join("")}</dataValidations>` : ""}
</worksheet>`;
}

function buildInstructionsSheet(cardType: V2CardType): string {
  const lines = [
    ["Yadraw library workbook", 2],
    [`Card type: ${cardType.name}`, 4],
    ["Safe round trip", 1],
    ["Edit existing rows, add rows, or add columns on the Library sheet. Then upload this .xlsx file back to the same library.", 3],
    ["Existing rows", 1],
    ["Hidden Yadraw ID and version columns identify existing records. Do not reveal, edit, copy, or invent these values.", 3],
    ["New rows", 1],
    ["Leave hidden ID and version cells blank. Yadraw assigns them after import and returns a synchronized workbook.", 3],
    ["New columns", 1],
    ["Add a clear header. Yadraw asks you to confirm the field type before changing the card type. New fields are optional.", 3],
    ["No implicit deletion", 1],
    ["Removing a row does not delete a library record. Removing an existing field column does not delete that field.", 3],
    ["Supported values", 1],
    ["Numbers must be finite; booleans use Yes/No; dates use YYYY-MM-DD; JSON must be valid; choice values must match configured options.", 3],
    ["Safety limits", 1],
    ["Maximum 1,000 non-empty rows, 50 columns, 20 new fields, 10,000 characters per cell, and 5 MiB per file. Formula cells are rejected.", 3],
    ["Linked cards", 1],
    ["Updating a library record also updates cards linked to that canonical record.", 3]
  ] as const;
  const rows = lines.map(([text, style], index) => `<row r="${index + 1}" ht="${style === 2 ? 30 : style === 3 ? 34 : 22}" customHeight="1">${inlineStringCell(`A${index + 1}`, text, style)}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:A${lines.length}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="1" width="105" customWidth="1"/></cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

function buildMetadataSheet(cardType: V2CardType, columns: WorkbookColumn[], now: Date): string {
  const records: string[][] = [
    ["record_type", "name", "value_or_kind", "field_key"],
    ["property", "format_version", WORKBOOK_FORMAT_VERSION, ""],
    ["property", "workspace_id", cardType.workspaceId, ""],
    ["property", "card_type_id", cardType.id, ""],
    ["property", "schema_updated_at", cardType.updatedAt, ""],
    ["property", "exported_at", now.toISOString(), ""],
    ...columns.map((column) => ["column", column.definedName, column.kind, column.fieldKey ?? ""])
  ];
  const rows = records.map((record, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = record.map((value, columnIndex) => inlineStringCell(cellReference(columnIndex + 1, rowNumber), value, rowIndex === 0 ? 1 : 4)).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:D${records.length}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols><col min="1" max="4" width="34" customWidth="1"/></cols>
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

function workbookXml(columns: WorkbookColumn[]): string {
  const names = columns.map((column) => `<definedName name="${xmlEscape(column.definedName)}">'Library'!$${columnLetters(column.index)}$1</definedName>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="11000" activeTab="1"/></bookViews>
  <sheets>
    <sheet name="Instructions" sheetId="1" r:id="rId1"/>
    <sheet name="Library" sheetId="2" r:id="rId2"/>
    <sheet name="_Yadraw" sheetId="3" state="veryHidden" r:id="rId3"/>
  </sheets>
  <definedNames>${names}</definedNames>
  <calcPr calcId="0" fullCalcOnLoad="0"/>
</workbook>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF262626"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FF4318D1"/><name val="Aptos Display"/><family val="2"/></font>
  </fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2B2B2B"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildV2XlsxLibraryWorkbook(
  cardType: V2CardType,
  rawEntries: V2CardLibraryEntry[],
  now = new Date()
): V2XlsxLibraryWorkbookFile {
  if (rawEntries.length > V2_XLSX_LIBRARY_MAX_ROWS) {
    throw new V2XlsxLibraryError("A library workbook can contain at most 1,000 entries");
  }
  const columns = buildColumns(cardType);
  if (columns.length > V2_XLSX_LIBRARY_MAX_COLUMNS) {
    throw new V2XlsxLibraryError("This card type has too many fields for a library workbook");
  }
  const entries = [...rawEntries].sort(
    (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  );
  const createdAt = now.toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Yadraw</dc:creator><cp:lastModifiedBy>Yadraw</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Yadraw</Application><AppVersion>2.0</AppVersion></Properties>`),
    "xl/workbook.xml": strToU8(workbookXml(columns)),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(buildInstructionsSheet(cardType)),
    "xl/worksheets/sheet2.xml": strToU8(buildLibrarySheet(cardType, entries, columns)),
    "xl/worksheets/sheet3.xml": strToU8(buildMetadataSheet(cardType, columns, now))
  };
  const archive = Buffer.from(zipSync(files, { level: 6 }));
  if (archive.length > V2_XLSX_LIBRARY_MAX_COMPRESSED_BYTES) {
    throw new V2XlsxLibraryError("Generated workbook exceeds the 5 MiB safety limit");
  }
  return {
    filename: safeFilename(cardType, now),
    contentType: V2_XLSX_LIBRARY_CONTENT_TYPE,
    workbookBase64: archive.toString("base64"),
    entryCount: entries.length,
    fieldCount: cardType.schema.fields.length
  };
}

export function xlsxOperationArchiveTimestamp(
  row: V2PreparedXlsxLibraryRow,
  existing: V2CardLibraryEntry | null
): string | null {
  return archiveIso(row.archived, existing);
}
