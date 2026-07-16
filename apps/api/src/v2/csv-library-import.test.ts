import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { RequestContext } from "../context.js";
import {
  parseV2CsvLibraryImport,
  V2CsvLibraryImportError
} from "./csv-library-import.js";
import { createDefaultV2MemorySeed, createV2MemoryRepository } from "./repository.js";
import { registerV2Routes } from "./routes.js";
import { createV2BoardService } from "./service.js";

const ownerContext: RequestContext = {
  userId: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  source: "dev"
};
const viewerContext: RequestContext = {
  userId: "9f18a762-53e5-4922-9b0b-8f168921bb0f",
  source: "dev"
};

function createImportServer(context: RequestContext = ownerContext) {
  const seed = createDefaultV2MemorySeed();
  const cardType = seed.cardTypes.find((candidate) => candidate.key === "source");
  if (!cardType) throw new Error("Source type is missing from the v2 seed");
  cardType.schema = {
    fields: [
      { key: "supplierCode", label: "Supplier code", type: "text", required: true },
      { key: "amount", label: "Amount", type: "number" },
      { key: "active", label: "Active", type: "boolean" },
      {
        key: "tier",
        label: "Tier",
        type: "select",
        options: [
          { value: "preferred", label: "Preferred" },
          { value: "standard", label: "Standard" }
        ]
      },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "metadata", label: "Metadata", type: "json" }
    ]
  };
  const repository = createV2MemoryRepository(seed);
  const server = Fastify();
  server.addHook("preHandler", async (request) => {
    request.requestContext = context;
  });
  registerV2Routes(server, createV2BoardService(repository));
  const baseUrl = `/v2/workspaces/${seed.workspace.id}/card-types/${cardType.id}/library-entries`;
  return { server, baseUrl };
}

function expectedPreview(preview: Record<string, unknown>) {
  return {
    fingerprint: preview.fingerprint,
    totalRows: preview.totalRows,
    createRows: preview.createRows,
    updateRows: preview.updateRows,
    skippedRows: preview.skippedRows,
    invalidRows: preview.invalidRows
  };
}

describe("V2 CSV library import", () => {
  it("parses BOM, commas, escaped quotes, and quoted new lines", () => {
    const parsed = parseV2CsvLibraryImport(
      '\uFEFFName,Notes\r\n"Acme, GmbH","First line\nSecond ""quoted"" line"\r\n'
    );
    expect(parsed.headers).toEqual(["Name", "Notes"]);
    expect(parsed.rows).toEqual([
      {
        rowNumber: 2,
        values: {
          Name: "Acme, GmbH",
          Notes: 'First line\nSecond "quoted" line'
        }
      }
    ]);
    expect(() => parseV2CsvLibraryImport("Name\n")).toThrow(V2CsvLibraryImportError);
    expect(() => parseV2CsvLibraryImport('Name\n"unclosed')).toThrow(V2CsvLibraryImportError);
    expect(parseV2CsvLibraryImport("Name;Amount\nКонтрагент;12,5")).toMatchObject({
      headers: ["Name", "Amount"],
      rows: [{ values: { Name: "Контрагент", Amount: "12,5" } }]
    });
  });

  it("previews and atomically creates, skips, and updates reusable library records", async () => {
    const { server, baseUrl } = createImportServer();
    const firstCsv = [
      "Name,Supplier code,Amount,Active,Tier,Start date,Metadata",
      'Northwind,NW,10,yes,Preferred,2026-07-01,"{""region"":""EU""}"'
    ].join("\n");
    const firstPreviewResponse = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/preview`,
      payload: { csv: firstCsv }
    });
    expect(firstPreviewResponse.statusCode).toBe(200);
    const firstPreview = firstPreviewResponse.json();
    expect(firstPreview).toMatchObject({
      totalRows: 1,
      createRows: 1,
      updateRows: 0,
      skippedRows: 0,
      invalidRows: 0,
      issues: []
    });

    const firstCommit = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/commit`,
      payload: {
        csv: firstCsv,
        mapping: firstPreview.mapping,
        duplicatePolicy: { mode: "create_new" },
        expectedPreview: expectedPreview(firstPreview)
      }
    });
    expect(firstCommit.statusCode).toBe(201);
    expect(firstCommit.json()).toMatchObject({
      totalRows: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      entries: [
        expect.objectContaining({
          title: "Northwind",
          data: {
            supplierCode: "NW",
            amount: 10,
            active: true,
            tier: "preferred",
            startDate: "2026-07-01",
            metadata: { region: "EU" }
          }
        })
      ]
    });

    const skipPreviewResponse = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/preview`,
      payload: {
        csv: firstCsv,
        mapping: firstPreview.mapping,
        duplicatePolicy: { mode: "skip_existing", key: { kind: "title" } }
      }
    });
    const skipPreview = skipPreviewResponse.json();
    expect(skipPreview).toMatchObject({ createRows: 0, skippedRows: 1, invalidRows: 0 });
    const skipCommit = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/commit`,
      payload: {
        csv: firstCsv,
        mapping: firstPreview.mapping,
        duplicatePolicy: { mode: "skip_existing", key: { kind: "title" } },
        expectedPreview: expectedPreview(skipPreview)
      }
    });
    expect(skipCommit.statusCode).toBe(201);
    expect(skipCommit.json()).toMatchObject({ createdCount: 0, skippedCount: 1 });

    const updateCsv = [
      "Name,Supplier code,Amount,Active",
      "Northwind,NW-2,20,no",
      "Contoso,CO,3,yes"
    ].join("\n");
    const updatePreviewResponse = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/preview`,
      payload: {
        csv: updateCsv,
        duplicatePolicy: { mode: "update_existing", key: { kind: "title" } }
      }
    });
    const updatePreview = updatePreviewResponse.json();
    expect(updatePreview).toMatchObject({ createRows: 1, updateRows: 1, invalidRows: 0 });
    const updateCommit = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/commit`,
      payload: {
        csv: updateCsv,
        mapping: updatePreview.mapping,
        duplicatePolicy: { mode: "update_existing", key: { kind: "title" } },
        expectedPreview: expectedPreview(updatePreview)
      }
    });
    expect(updateCommit.statusCode).toBe(201);
    expect(updateCommit.json()).toMatchObject({ createdCount: 1, updatedCount: 1 });

    const list = await server.inject({ method: "GET", url: `${baseUrl}?status=all&limit=100` });
    expect(list.json().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Northwind",
          version: 2,
          data: expect.objectContaining({
            supplierCode: "NW-2",
            tier: "preferred",
            startDate: "2026-07-01",
            metadata: { region: "EU" }
          })
        }),
        expect.objectContaining({ title: "Contoso", version: 1, data: expect.objectContaining({ supplierCode: "CO" }) })
      ])
    );
    await server.close();
  });

  it("does not mutate on invalid rows or stale previews and requires write access", async () => {
    const { server, baseUrl } = createImportServer();
    const invalidCsv = "Name,Supplier code,Amount\nBroken,BR,not-a-number";
    const invalidPreviewResponse = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/preview`,
      payload: { csv: invalidCsv }
    });
    const invalidPreview = invalidPreviewResponse.json();
    expect(invalidPreview).toMatchObject({ createRows: 0, invalidRows: 1 });
    const invalidCommit = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/commit`,
      payload: {
        csv: invalidCsv,
        mapping: invalidPreview.mapping,
        duplicatePolicy: { mode: "create_new" },
        expectedPreview: expectedPreview(invalidPreview)
      }
    });
    expect(invalidCommit.statusCode).toBe(400);
    const emptyList = await server.inject({ method: "GET", url: `${baseUrl}?status=all&limit=100` });
    expect(emptyList.json().entries).toEqual([]);

    const validCsv = "Name,Supplier code\nNorthwind,NW";
    const previewResponse = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/preview`,
      payload: { csv: validCsv }
    });
    const preview = previewResponse.json();
    const changedCsvCommit = await server.inject({
      method: "POST",
      url: `${baseUrl}/imports/csv/commit`,
      payload: {
        csv: "Name,Supplier code\nChanged,CH",
        mapping: preview.mapping,
        duplicatePolicy: { mode: "create_new" },
        expectedPreview: expectedPreview(preview)
      }
    });
    expect(changedCsvCommit.statusCode).toBe(409);
    await server.close();

    const viewer = createImportServer(viewerContext);
    const forbidden = await viewer.server.inject({
      method: "POST",
      url: `${viewer.baseUrl}/imports/csv/preview`,
      payload: { csv: validCsv }
    });
    expect(forbidden.statusCode).toBe(403);
    await viewer.server.close();
  });
});
