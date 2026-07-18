import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { v2CardLibraryEntrySchema, v2CardTypeSchema } from "@yadraw/shared";
import {
  buildV2XlsxLibraryWorkbook,
  prepareV2XlsxLibraryImport,
  V2XlsxLibraryError
} from "./xlsx-library-round-trip.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const cardTypeId = "44444444-4444-4444-8444-444444444444";
const entryId = "77777777-7777-4777-8777-777777777777";

function fixtures() {
  const cardType = v2CardTypeSchema.parse({
    id: cardTypeId,
    workspaceId,
    key: "customer",
    name: "Customer",
    description: "Reusable customer",
    defaultData: {},
    schema: {
      fields: [{ key: "segment", label: "Segment", type: "text", required: false }]
    },
    defaultVisualStyle: {},
    defaultSize: { width: 280, height: 180 },
    ports: [],
    createdAt: "2026-07-18T08:00:00.000Z",
    updatedAt: "2026-07-18T08:00:00.000Z"
  });
  const entry = v2CardLibraryEntrySchema.parse({
    id: entryId,
    workspaceId,
    cardTypeId,
    title: "Acme",
    description: "Existing account",
    data: { segment: "Enterprise" },
    version: 3,
    archivedAt: null,
    usageCount: 2,
    createdAt: "2026-07-18T08:00:00.000Z",
    updatedAt: "2026-07-18T08:00:00.000Z"
  });
  return { cardType, entry };
}

function rewriteWorkbook(
  workbookBase64: string,
  rewrite: (files: Record<string, Uint8Array>) => void
): string {
  const files = unzipSync(Buffer.from(workbookBase64, "base64"));
  rewrite(files);
  return Buffer.from(zipSync(files, { level: 6 })).toString("base64");
}

function addNewColumnAndRow(workbookBase64: string): string {
  return rewriteWorkbook(workbookBase64, (files) => {
    const path = "xl/worksheets/sheet2.xml";
    let sheet = strFromU8(files[path]!);
    const newColumn = "G";
    sheet = sheet.replace(
      /(<row r="1"[^>]*>)(.*?)(<\/row>)/,
      `$1$2<c r="${newColumn}1" t="inlineStr" s="1"><is><t>Owner</t></is></c>$3`
    );
    sheet = sheet.replace(">Acme<", ">Acme updated<");
    sheet = sheet.replace(
      /(<row r="2">)(.*?)(<\/row>)/,
      `$1$2<c r="${newColumn}2" t="inlineStr"><is><t>Alice</t></is></c>$3`
    );
    sheet = sheet.replace(
      "</sheetData>",
      `<row r="3"><c r="A3" t="inlineStr"><is><t>Beta</t></is></c><c r="D3" t="inlineStr"><is><t>No</t></is></c><c r="${newColumn}3" t="inlineStr"><is><t>Bob</t></is></c></row></sheetData>`
    );
    files[path] = strToU8(sheet);
  });
}

describe("V2 XLSX library round trip", () => {
  it("exports a safe Yadraw workbook and re-imports an unchanged row by hidden ID", () => {
    const { cardType, entry } = fixtures();
    const workbook = buildV2XlsxLibraryWorkbook(
      cardType,
      [entry],
      new Date("2026-07-18T09:00:00.000Z")
    );

    expect(workbook.filename).toBe("yadraw-customer-2026-07-18.xlsx");
    const files = unzipSync(Buffer.from(workbook.workbookBase64, "base64"));
    const workbookXml = strFromU8(files["xl/workbook.xml"]!);
    expect(workbookXml).toContain('name="_Yadraw" sheetId="3" state="veryHidden"');
    expect(workbookXml).toContain('<definedName name="_yd_entry_id">\'Library\'!$E$1</definedName>');
    expect(strFromU8(files["xl/worksheets/sheet2.xml"]!)).not.toContain("<f>");

    const plan = prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: workbook.filename,
      workbookBase64: workbook.workbookBase64,
      newFields: []
    });
    expect(plan).toMatchObject({
      totalRows: 1,
      createRows: 0,
      updateRows: 0,
      unchangedRows: 1,
      invalidRows: 0,
      requiresFieldConfirmation: false
    });
  });

  it("requires confirmation for a new column, then plans one update and one create", () => {
    const { cardType, entry } = fixtures();
    const exported = buildV2XlsxLibraryWorkbook(cardType, [entry]);
    const edited = addNewColumnAndRow(exported.workbookBase64);

    const discovery = prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: edited,
      newFields: []
    });
    expect(discovery.requiresFieldConfirmation).toBe(true);
    expect(discovery.proposedFields).toEqual([
      expect.objectContaining({ columnId: "column_7", header: "Owner", suggestedType: "text" })
    ]);

    const plan = prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: edited,
      newFields: [{ columnId: "column_7", type: "text" }]
    });
    expect(plan).toMatchObject({
      createRows: 1,
      updateRows: 1,
      unchangedRows: 0,
      invalidRows: 0,
      requiresFieldConfirmation: false
    });
    expect(plan.addedFields).toEqual([
      expect.objectContaining({ key: "owner", label: "Owner", type: "text", required: false })
    ]);
    expect(plan.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "update", row: expect.objectContaining({ title: "Acme updated", data: { segment: "Enterprise", owner: "Alice" } }) }),
      expect.objectContaining({ kind: "create", row: expect.objectContaining({ title: "Beta", data: { owner: "Bob" } }) })
    ]));
  });

  it("rejects formulas, foreign workbooks, and duplicate entry IDs", () => {
    const { cardType, entry } = fixtures();
    const exported = buildV2XlsxLibraryWorkbook(cardType, [entry]);
    const formulaWorkbook = rewriteWorkbook(exported.workbookBase64, (files) => {
      const path = "xl/worksheets/sheet2.xml";
      files[path] = strToU8(strFromU8(files[path]!).replace(
        "</row></sheetData>",
        '<c r="B2"><f>1+1</f><v>2</v></c></row></sheetData>'
      ));
    });
    const formulaPlan = prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: formulaWorkbook,
      newFields: []
    });
    expect(formulaPlan.invalidRows).toBe(1);
    expect(formulaPlan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "Formula cells are not allowed in library imports" })
    ]));

    const foreignWorkbook = rewriteWorkbook(exported.workbookBase64, (files) => {
      const path = "xl/worksheets/sheet3.xml";
      files[path] = strToU8(strFromU8(files[path]!).replace(
        cardTypeId,
        "55555555-5555-4555-8555-555555555555"
      ));
    });
    expect(() => prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: foreignWorkbook,
      newFields: []
    })).toThrowError(new V2XlsxLibraryError("This workbook belongs to another workspace or card type"));

    const duplicateWorkbook = rewriteWorkbook(exported.workbookBase64, (files) => {
      const path = "xl/worksheets/sheet2.xml";
      const sheet = strFromU8(files[path]!);
      const duplicateRow = `<row r="3"><c r="A3" t="inlineStr"><is><t>Duplicate</t></is></c><c r="D3" t="inlineStr"><is><t>No</t></is></c><c r="E3" t="inlineStr"><is><t>${entryId}</t></is></c><c r="F3"><v>3</v></c></row>`;
      files[path] = strToU8(sheet.replace("</sheetData>", `${duplicateRow}</sheetData>`));
    });
    const duplicatePlan = prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: duplicateWorkbook,
      newFields: []
    });
    expect(duplicatePlan.invalidRows).toBe(1);
    expect(duplicatePlan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "Yadraw entry ID is already used on row 2" })
    ]));
  });

  it("rejects macro-bearing and unsafe ZIP packages before XML parsing", () => {
    const { cardType, entry } = fixtures();
    const exported = buildV2XlsxLibraryWorkbook(cardType, [entry]);
    const macroWorkbook = rewriteWorkbook(exported.workbookBase64, (files) => {
      files["xl/vbaProject.bin"] = new Uint8Array([1, 2, 3]);
    });
    expect(() => prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: macroWorkbook,
      newFields: []
    })).toThrowError(new V2XlsxLibraryError("Macros, external links, and embedded objects are not supported"));

    const unsafeWorkbook = rewriteWorkbook(exported.workbookBase64, (files) => {
      files["../outside.xml"] = strToU8("<outside/>");
    });
    expect(() => prepareV2XlsxLibraryImport(cardType, [entry], {
      filename: exported.filename,
      workbookBase64: unsafeWorkbook,
      newFields: []
    })).toThrowError(new V2XlsxLibraryError("Workbook contains an unsafe ZIP path"));
  });
});
