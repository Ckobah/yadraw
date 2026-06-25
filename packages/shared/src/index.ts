import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const positionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "editor",
  "viewer",
  "guest",
  "service"
]);

export const cardStatusSchema = z.enum([
  "draft",
  "active",
  "approved",
  "archived",
  "error",
  "deleted"
]);

export const connectionStatusSchema = z.enum([
  "draft",
  "active",
  "disabled",
  "error",
  "deleted"
]);

export const cardTypeSchema = z.object({
  id: uuidSchema,
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional()
});

export const fileRefSchema = z.object({
  id: uuidSchema,
  filename: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  role: z.string().default("attachment")
});

export const cardSchema = z.object({
  id: uuidSchema,
  boardId: uuidSchema,
  typeKey: z.string().min(1),
  title: z.string(),
  description: z.string().optional(),
  status: cardStatusSchema.default("draft"),
  data: jsonObjectSchema.default({}),
  position: positionSchema,
  size: sizeSchema.default({ width: 320, height: 180 }),
  style: jsonObjectSchema.default({}),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  files: z.array(fileRefSchema).default([]),
  tags: z.array(z.string()).default([])
});

export const connectionSchema = z.object({
  id: uuidSchema,
  boardId: uuidSchema,
  sourceCardId: uuidSchema,
  targetCardId: uuidSchema,
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  status: connectionStatusSchema.default("draft"),
  contract: jsonObjectSchema.default({}),
  mapping: jsonObjectSchema.default({}),
  condition: jsonObjectSchema.default({}),
  style: jsonObjectSchema.default({})
});

export const boardSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  projectId: uuidSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  viewport: jsonObjectSchema.default({}),
  settings: jsonObjectSchema.default({}),
  cards: z.array(cardSchema).default([]),
  connections: z.array(connectionSchema).default([])
});

export const createCardInputSchema = cardSchema
  .omit({ id: true, boardId: true })
  .partial();

export const updateCardInputSchema = createCardInputSchema.partial();

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type CardStatus = z.infer<typeof cardStatusSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type CardType = z.infer<typeof cardTypeSchema>;
export type FileRef = z.infer<typeof fileRefSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Board = z.infer<typeof boardSchema>;
export type CreateCardInput = z.infer<typeof createCardInputSchema>;
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

export const demoIds = {
  workspace: "3cce8c2f-3d0f-49aa-89da-9f2f1f655b33",
  project: "8bdcdb31-40d7-4f66-b2b3-7f972e7f07d3",
  board: "b4f94635-6fd5-4a6b-8608-61a69c81fbe2"
} as const;

export const demoBoard: Board = {
  id: demoIds.board,
  workspaceId: demoIds.workspace,
  projectId: demoIds.project,
  name: "Main Board",
  description: "Product pipeline workflow",
  viewport: { x: 0, y: 0, zoom: 1 },
  settings: { snapToGrid: true },
  cards: [
    {
      id: "67d1c197-2a85-47d1-9e32-8b03c32ff8d0",
      boardId: demoIds.board,
      typeKey: "trigger",
      title: "1. Webhook Trigger",
      description: "Receives an external order payload.",
      status: "active",
      data: { endpoint: "/webhook", method: "POST" },
      position: { x: 120, y: 140 },
      size: { width: 280, height: 170 },
      style: { accent: "green" },
      inputs: [],
      outputs: ["payload"],
      files: [{ id: "8bf62d90-5fb9-48ae-b242-121988499d68", filename: "schema.json", role: "source_document" }],
      tags: ["trigger"]
    },
    {
      id: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
      boardId: demoIds.board,
      typeKey: "ai_action",
      title: "2. Enrich Data",
      description: "AI analyzes order data, fills gaps, and classifies items.",
      status: "active",
      data: { model: "gpt", mode: "suggest_changes" },
      position: { x: 470, y: 138 },
      size: { width: 300, height: 190 },
      style: { accent: "blue" },
      inputs: ["payload"],
      outputs: ["enriched_order", "items"],
      files: [{ id: "63830d13-3317-4148-94ff-31005ef48e55", filename: "prompt.md", role: "source_document", sizeBytes: 2100 }],
      tags: ["ai", "enrich"]
    },
    {
      id: "a67a335e-2bc2-4af7-a926-070c80a7a352",
      boardId: demoIds.board,
      typeKey: "database",
      title: "3. Save to Database",
      description: "Persists enriched order and item records.",
      status: "active",
      data: { table: "orders" },
      position: { x: 850, y: 140 },
      size: { width: 300, height: 170 },
      style: { accent: "purple" },
      inputs: ["enriched_order", "items"],
      outputs: ["order_id"],
      files: [{ id: "7f0672e7-6f51-4178-b840-22d955137428", filename: "insert.sql", role: "source_document" }],
      tags: ["database"]
    },
    {
      id: "9d99f039-b747-4c89-bd40-4756407aa8c4",
      boardId: demoIds.board,
      typeKey: "ai_action",
      title: "4. Generate Embedding",
      description: "Builds embeddings for semantic retrieval.",
      status: "active",
      data: { objectType: "card" },
      position: { x: 180, y: 430 },
      size: { width: 300, height: 185 },
      style: { accent: "orange" },
      inputs: ["enriched_order"],
      outputs: ["embedding"],
      files: [{ id: "464d260e-4462-4e86-bc09-c51cf9d4c524", filename: "embedding.json", role: "generated_document" }],
      tags: ["ai", "embedding"]
    },
    {
      id: "1e6fa19e-0480-463f-b6bb-80983564246b",
      boardId: demoIds.board,
      typeKey: "vector_store",
      title: "5. Vector Store",
      description: "Stores searchable vector chunks.",
      status: "active",
      data: { index: "orders" },
      position: { x: 560, y: 430 },
      size: { width: 300, height: 185 },
      style: { accent: "teal" },
      inputs: ["embedding", "order_id"],
      outputs: ["indexed"],
      files: [{ id: "d448846d-2bf9-4f5b-89bb-a989a8ae9fb8", filename: "index.json", role: "generated_document" }],
      tags: ["vector_store"]
    },
    {
      id: "86c367b6-4504-4f8c-867f-b66cfd9a63ac",
      boardId: demoIds.board,
      typeKey: "storage",
      title: "6. File Storage",
      description: "Stores files related to the order.",
      status: "active",
      data: { bucket: "workspace-files", fileCount: 12 },
      position: { x: 900, y: 430 },
      size: { width: 300, height: 175 },
      style: { accent: "pink" },
      inputs: ["files", "order_id"],
      outputs: [],
      files: [],
      tags: ["storage"]
    }
  ],
  connections: [
    {
      id: "eb8530de-8d60-49de-bb63-bdd7b4131232",
      boardId: demoIds.board,
      sourceCardId: "67d1c197-2a85-47d1-9e32-8b03c32ff8d0",
      targetCardId: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
      sourceHandle: "payload",
      targetHandle: "payload",
      label: "payload",
      status: "active",
      contract: { relation: "triggers" },
      mapping: {},
      condition: {},
      style: {}
    },
    {
      id: "c2e29d44-2532-4700-9820-1f9e8966c0be",
      boardId: demoIds.board,
      sourceCardId: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
      targetCardId: "a67a335e-2bc2-4af7-a926-070c80a7a352",
      sourceHandle: "enriched_order",
      targetHandle: "enriched_order",
      label: "save order",
      status: "active",
      contract: { relation: "provides_data_to" },
      mapping: { enriched_order: "orders.payload" },
      condition: {},
      style: {}
    },
    {
      id: "e1fb98f8-ed9f-44d8-88c6-99b39e4f0c8e",
      boardId: demoIds.board,
      sourceCardId: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
      targetCardId: "9d99f039-b747-4c89-bd40-4756407aa8c4",
      sourceHandle: "enriched_order",
      targetHandle: "enriched_order",
      label: "embed",
      status: "active",
      contract: { relation: "generates" },
      mapping: {},
      condition: {},
      style: {}
    },
    {
      id: "7d278d2b-190d-4e66-aa68-425ebfece20d",
      boardId: demoIds.board,
      sourceCardId: "9d99f039-b747-4c89-bd40-4756407aa8c4",
      targetCardId: "1e6fa19e-0480-463f-b6bb-80983564246b",
      sourceHandle: "embedding",
      targetHandle: "embedding",
      label: "index",
      status: "active",
      contract: { relation: "provides_data_to" },
      mapping: {},
      condition: {},
      style: {}
    },
    {
      id: "5daa0bb9-9b07-4b4a-9da8-96ac035b4fa1",
      boardId: demoIds.board,
      sourceCardId: "1e6fa19e-0480-463f-b6bb-80983564246b",
      targetCardId: "86c367b6-4504-4f8c-867f-b66cfd9a63ac",
      sourceHandle: "indexed",
      targetHandle: "order_id",
      label: "attach files",
      status: "active",
      contract: { relation: "references" },
      mapping: {},
      condition: {},
      style: {}
    }
  ]
};
