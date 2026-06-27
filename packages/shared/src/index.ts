import { z } from "zod";

export * from "./v2.js";

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

export const workspaceMemberSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string().min(1),
  email: z.string().email(),
  role: workspaceRoleSchema,
  status: z.enum(["active", "pending"]).default("active")
});

export const notificationSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  userId: uuidSchema,
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  objectType: z.string().optional(),
  objectId: uuidSchema.optional(),
  metadata: jsonObjectSchema.default({}),
  readAt: z.string().datetime().optional(),
  createdAt: z.string().datetime()
});

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

export const cardMetadataSchema = z.object({
  typeKey: z.string().min(1),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  files: z.array(fileRefSchema).default([])
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
  .partial()
  .extend({
    templateKey: z.string().min(1).optional()
  });

export const updateCardInputSchema = createCardInputSchema
  .omit({ templateKey: true })
  .partial();

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type CardStatus = z.infer<typeof cardStatusSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type CardType = z.infer<typeof cardTypeSchema>;
export type FileRef = z.infer<typeof fileRefSchema>;
export type CardMetadata = z.infer<typeof cardMetadataSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Board = z.infer<typeof boardSchema>;
export type CreateCardInput = z.infer<typeof createCardInputSchema>;
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>;

export type CardTemplate = {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaults: CreateCardInput;
};

export const cardTemplates: CardTemplate[] = [
  {
    key: "trigger",
    name: "Trigger",
    description: "Receives an external event and starts the workflow.",
    icon: "radio-tower",
    color: "green",
    defaults: {
      typeKey: "trigger",
      title: "New Trigger",
      description: "Receives an external event and starts the workflow.",
      status: "draft",
      data: { endpoint: "/webhook", method: "POST" },
      size: { width: 280, height: 170 },
      style: { accent: "green" },
      inputs: [],
      outputs: ["payload"],
      tags: ["trigger"]
    }
  },
  {
    key: "ai_action",
    name: "AI Action",
    description: "Runs a controlled AI step with explicit inputs and outputs.",
    icon: "sparkles",
    color: "blue",
    defaults: {
      typeKey: "ai_action",
      title: "New AI Action",
      description: "Runs a controlled AI step with explicit inputs and outputs.",
      status: "draft",
      data: { model: "gpt", mode: "draft" },
      size: { width: 300, height: 190 },
      style: { accent: "blue" },
      inputs: ["input"],
      outputs: ["result"],
      tags: ["ai"]
    }
  },
  {
    key: "database",
    name: "Database",
    description: "Reads or writes structured records.",
    icon: "database",
    color: "purple",
    defaults: {
      typeKey: "database",
      title: "New Database Step",
      description: "Reads or writes structured records.",
      status: "draft",
      data: { table: "records", operation: "insert" },
      size: { width: 300, height: 175 },
      style: { accent: "purple" },
      inputs: ["record"],
      outputs: ["record_id"],
      tags: ["database"]
    }
  },
  {
    key: "vector_store",
    name: "Vector Store",
    description: "Stores embeddings for retrieval and semantic search.",
    icon: "box",
    color: "teal",
    defaults: {
      typeKey: "vector_store",
      title: "New Vector Store",
      description: "Stores embeddings for retrieval and semantic search.",
      status: "draft",
      data: { index: "workspace-index" },
      size: { width: 300, height: 185 },
      style: { accent: "teal" },
      inputs: ["embedding", "metadata"],
      outputs: ["indexed"],
      tags: ["vector_store"]
    }
  },
  {
    key: "storage",
    name: "Storage",
    description: "Keeps files and references attached to workflow data.",
    icon: "file-text",
    color: "pink",
    defaults: {
      typeKey: "storage",
      title: "New File Storage",
      description: "Keeps files and references attached to workflow data.",
      status: "draft",
      data: { bucket: "workspace-files" },
      size: { width: 300, height: 175 },
      style: { accent: "pink" },
      inputs: ["files"],
      outputs: [],
      tags: ["storage"]
    }
  },
  {
    key: "note",
    name: "Note",
    description: "Captures free-form JSON notes and planning context.",
    icon: "file-text",
    color: "blue",
    defaults: {
      typeKey: "note",
      title: "New JSON Card",
      description: "Draft card created from a reusable template.",
      status: "draft",
      data: { kind: "note", source: "web" },
      size: { width: 300, height: 175 },
      style: { accent: "blue" },
      inputs: ["input"],
      outputs: ["output"],
      tags: ["draft"]
    }
  }
];

export function getCardTemplate(templateKey: string): CardTemplate | undefined {
  return cardTemplates.find((template) => template.key === templateKey);
}

export function buildCardInputFromTemplate(
  templateKey: string,
  options: { sequence: number; position?: Card["position"] }
): CreateCardInput | null {
  const template = getCardTemplate(templateKey);
  if (!template) return null;

  return {
    ...structuredClone(template.defaults),
    title: `${options.sequence}. ${template.defaults.title ?? template.name}`,
    position: options.position ?? {
      x: 180 + (options.sequence % 4) * 120,
      y: 180 + Math.floor(options.sequence / 4) * 110
    }
  };
}

export const demoIds = {
  workspace: "3cce8c2f-3d0f-49aa-89da-9f2f1f655b33",
  project: "8bdcdb31-40d7-4f66-b2b3-7f972e7f07d3",
  board: "b4f94635-6fd5-4a6b-8608-61a69c81fbe2"
} as const;

export const demoUserIds = {
  owner: "02f38bb1-0cde-4473-95ef-1d50db3467e4",
  editor: "bb7ef8c4-2d05-4699-b2de-d9c02d1c1ec4",
  viewer: "9f18a762-bf5b-4aa8-b934-f286cc51dc5b"
} as const;

export const demoWorkspaceMembers: WorkspaceMember[] = [
  {
    id: "fbb53c10-b74d-4e50-9088-608d60878a7d",
    userId: demoUserIds.owner,
    workspaceId: demoIds.workspace,
    name: "Alex Smith",
    email: "admin@acme.com",
    role: "owner",
    status: "active"
  },
  {
    id: "d8b569ac-3ced-43dc-85f4-193fd982fb1c",
    userId: demoUserIds.editor,
    workspaceId: demoIds.workspace,
    name: "Maya Chen",
    email: "maya@acme.com",
    role: "editor",
    status: "active"
  },
  {
    id: "27a26b32-b76d-41bc-9e38-07f7bbd8e059",
    userId: demoUserIds.viewer,
    workspaceId: demoIds.workspace,
    name: "Nikolai Petrov",
    email: "nikolai@acme.com",
    role: "viewer",
    status: "active"
  }
];

export const demoNotifications: Notification[] = [
  {
    id: "10d919f0-a73f-4317-a5bc-4579e276ca12",
    workspaceId: demoIds.workspace,
    userId: demoUserIds.owner,
    type: "file_uploaded",
    title: "File metadata attached",
    body: "prompt.md is linked to 2. Enrich Data.",
    objectType: "card",
    objectId: "6bb48e57-ed49-4fd6-bdbc-a449b2756be9",
    metadata: { filename: "prompt.md" },
    createdAt: "2026-06-26T06:10:00.000Z"
  },
  {
    id: "562ad694-e7fc-4132-b477-0779dc7fba99",
    workspaceId: demoIds.workspace,
    userId: demoUserIds.owner,
    type: "card_saved",
    title: "Board card saved",
    body: "5. Vector Store was updated on the board.",
    objectType: "card",
    objectId: "1e6fa19e-0480-463f-b6bb-80983564246b",
    metadata: { status: "active" },
    readAt: "2026-06-26T06:20:00.000Z",
    createdAt: "2026-06-26T06:05:00.000Z"
  },
  {
    id: "8a6bf90c-8bf6-4f0c-86db-32145530d59d",
    workspaceId: demoIds.workspace,
    userId: demoUserIds.editor,
    type: "share_invite",
    title: "Workspace access changed",
    body: "You were added to Acme Workspace as editor.",
    objectType: "workspace",
    objectId: demoIds.workspace,
    metadata: { role: "editor" },
    createdAt: "2026-06-26T06:00:00.000Z"
  }
];

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
