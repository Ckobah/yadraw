import { z } from "zod";

export const v2UuidSchema = z.string().uuid();
export const v2TimestampSchema = z.string().datetime();

export const v2JsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => !Object.prototype.hasOwnProperty.call(value, "_yadraw"), {
    message: "Internal Yadraw metadata is not allowed in card data"
  });

export const v2PositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const v2SizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive()
});

export const v2ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive()
});

export const v2CardStatusSchema = z.enum(["draft", "active", "archived"]);
export const v2PortDirectionSchema = z.enum(["input", "output"]);
export const v2ConnectionStatusSchema = z.enum(["active", "disabled"]);
export const v2WorkspaceRoleSchema = z.enum(["owner", "admin", "editor", "viewer", "service"]);
export const v2FileProcessingStatusSchema = z.enum([
  "pending",
  "processing",
  "processed",
  "failed"
]);

export const v2ConnectorSlotTypeSchema = z.enum(["input", "output", "receiver"]);
export const v2ConnectorSlotSideSchema = z.enum(["top", "right", "bottom", "left"]);
export const v2ConnectorSlotSchema = z.object({
  id: z.string().trim().min(1),
  type: v2ConnectorSlotTypeSchema,
  side: v2ConnectorSlotSideSchema,
  offset: z.number().min(0).max(1),
  label: z.string().optional()
});

export const v2CardVisualStyleSchema = z.object({
  fontFamily: z.string().min(1).max(80).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textColor: z.string().min(1).max(32).optional(),
  fontWeight: z.enum(["400", "600", "700"]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textDecoration: z.enum(["none", "underline"]).optional(),
  bodyVerticalAlign: z.enum(["top", "center", "bottom"]).optional(),
  connectorSlots: z.array(v2ConnectorSlotSchema).optional()
});

export const v2ConnectionMarkerSchema = z.enum([
  "none",
  "arrow",
  "reverseArrow",
  "triangle",
  "circle",
  "square"
]);

export const v2ConnectionVisualStyleSchema = z.object({
  strokeColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  strokeWidth: z.number().min(1).max(12).optional(),
  cornerRadius: z.number().min(0).max(48).optional(),
  markerStart: v2ConnectionMarkerSchema.optional(),
  markerEnd: v2ConnectionMarkerSchema.optional()
});

export const v2WorkspaceSchema = z.object({
  id: v2UuidSchema,
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2ProjectSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  name: z.string().min(1),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2BoardSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  projectId: v2UuidSchema,
  name: z.string().min(1),
  viewport: v2ViewportSchema,
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2CardTypePortSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  cardTypeId: v2UuidSchema,
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  direction: v2PortDirectionSchema,
  dataType: z.string().min(1),
  required: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2CardTypeSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  description: z.string(),
  defaultData: v2JsonObjectSchema,
  defaultSize: v2SizeSchema,
  ports: z.array(v2CardTypePortSchema),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2CardSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  boardId: v2UuidSchema,
  cardTypeId: v2UuidSchema,
  title: z.string().min(1),
  description: z.string(),
  data: v2JsonObjectSchema,
  position: v2PositionSchema,
  size: v2SizeSchema,
  visualStyle: v2CardVisualStyleSchema.default({}),
  status: v2CardStatusSchema,
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2ConnectionSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  boardId: v2UuidSchema,
  sourceCardId: v2UuidSchema,
  targetCardId: v2UuidSchema,
  sourcePortKey: z.string().min(1),
  targetPortKey: z.string().min(1),
  title: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  data: v2JsonObjectSchema.default({}),
  visualStyle: v2ConnectionVisualStyleSchema.default({}),
  type: z.string().min(1),
  label: z.string(),
  status: v2ConnectionStatusSchema,
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2FileSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  storageBucket: z.string().min(1),
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  sha256: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  processingStatus: v2FileProcessingStatusSchema,
  processingError: z.record(z.string(), z.unknown()).nullable().optional(),
  createdBy: v2UuidSchema.nullable().optional(),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema,
  deletedAt: v2TimestampSchema.nullable().optional()
});

export const v2CardFileSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  cardId: v2UuidSchema,
  fileId: v2UuidSchema,
  role: z.string().min(1).default("attachment"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  file: v2FileSchema.optional(),
  createdBy: v2UuidSchema.nullable().optional(),
  createdAt: v2TimestampSchema,
  deletedAt: v2TimestampSchema.nullable().optional()
});

export const v2CardAttachmentSchema = z.object({
  id: v2UuidSchema,
  cardId: v2UuidSchema,
  fileId: v2UuidSchema,
  role: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  processingStatus: v2FileProcessingStatusSchema,
  createdAt: v2TimestampSchema
});

export const v2ConnectionFileSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  connectionId: v2UuidSchema,
  fileId: v2UuidSchema,
  role: z.string().min(1).default("attachment"),
  metadata: z.record(z.string(), z.unknown()).default({}),
  file: v2FileSchema.optional(),
  createdBy: v2UuidSchema.nullable().optional(),
  createdAt: v2TimestampSchema,
  deletedAt: v2TimestampSchema.nullable().optional()
});

export const v2ConnectionAttachmentSchema = z.object({
  id: v2UuidSchema,
  connectionId: v2UuidSchema,
  fileId: v2UuidSchema,
  role: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  filename: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  sha256: z.string().nullable().optional(),
  processingStatus: v2FileProcessingStatusSchema,
  createdAt: v2TimestampSchema
});

export const v2BoardDetailSchema = z.object({
  workspace: v2WorkspaceSchema,
  project: v2ProjectSchema,
  board: v2BoardSchema,
  cardTypes: z.array(v2CardTypeSchema),
  cards: z.array(v2CardSchema),
  connections: z.array(v2ConnectionSchema)
});

export const v2GetBoardParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2ListCardTypesParamsSchema = z.object({
  workspaceId: v2UuidSchema
});

export const v2CreateCardParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateCardBodySchema = z.object({
  cardTypeId: v2UuidSchema,
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  data: v2JsonObjectSchema.optional(),
  position: v2PositionSchema.optional(),
  size: v2SizeSchema.optional(),
  visualStyle: v2CardVisualStyleSchema.optional(),
  status: v2CardStatusSchema.optional()
});

export const v2UpdateCardParamsSchema = z.object({
  cardId: v2UuidSchema
});

export const v2UpdateCardBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    data: v2JsonObjectSchema.optional(),
    position: v2PositionSchema.optional(),
    size: v2SizeSchema.optional(),
    visualStyle: v2CardVisualStyleSchema.optional(),
    status: v2CardStatusSchema.optional()
  })
  .strict();

export const v2DeleteCardParamsSchema = z.object({
  cardId: v2UuidSchema
});

export const v2CreateConnectionParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateConnectionBodySchema = z.object({
  sourceCardId: v2UuidSchema,
  targetCardId: v2UuidSchema,
  sourcePortKey: z.string().trim().min(1),
  targetPortKey: z.string().trim().min(1),
  type: z.string().trim().min(1).default("data"),
  label: z.string().default("")
});

export const v2DeleteConnectionParamsSchema = z.object({
  connectionId: v2UuidSchema
});

export const v2UpdateConnectionParamsSchema = z.object({
  connectionId: v2UuidSchema
});

export const v2UpdateConnectionBodySchema = z
  .object({
    title: z.string().trim().nullable().optional(),
    description: z.string().nullable().optional(),
    data: v2JsonObjectSchema.optional(),
    visualStyle: v2ConnectionVisualStyleSchema.optional()
  })
  .strict();

export const v2DeleteResultSchema = z.object({
  deleted: z.literal(true),
  id: v2UuidSchema
});

export const v2ApiContracts = {
  getBoard: {
    method: "GET",
    path: "/v2/boards/{boardId}",
    params: v2GetBoardParamsSchema,
    response: v2BoardDetailSchema
  },
  listCardTypes: {
    method: "GET",
    path: "/v2/workspaces/{workspaceId}/card-types",
    params: v2ListCardTypesParamsSchema,
    response: z.object({ cardTypes: z.array(v2CardTypeSchema) })
  },
  createCard: {
    method: "POST",
    path: "/v2/boards/{boardId}/cards",
    params: v2CreateCardParamsSchema,
    body: v2CreateCardBodySchema,
    response: v2CardSchema
  },
  updateCard: {
    method: "PATCH",
    path: "/v2/cards/{cardId}",
    params: v2UpdateCardParamsSchema,
    body: v2UpdateCardBodySchema,
    response: v2CardSchema
  },
  deleteCard: {
    method: "DELETE",
    path: "/v2/cards/{cardId}",
    params: v2DeleteCardParamsSchema,
    response: v2DeleteResultSchema
  },
  createConnection: {
    method: "POST",
    path: "/v2/boards/{boardId}/connections",
    params: v2CreateConnectionParamsSchema,
    body: v2CreateConnectionBodySchema,
    response: v2ConnectionSchema
  },
  updateConnection: {
    method: "PATCH",
    path: "/v2/connections/{connectionId}",
    params: v2UpdateConnectionParamsSchema,
    body: v2UpdateConnectionBodySchema,
    response: v2ConnectionSchema
  },
  deleteConnection: {
    method: "DELETE",
    path: "/v2/connections/{connectionId}",
    params: v2DeleteConnectionParamsSchema,
    response: v2DeleteResultSchema
  }
} as const;

export const v2DemoIds = {
  workspace: "11111111-1111-4111-8111-111111111111",
  project: "22222222-2222-4222-8222-222222222222",
  board: "33333333-3333-4333-8333-333333333333",
  cardTypes: {
    source: "44444444-4444-4444-8444-444444444444",
    task: "55555555-5555-4555-8555-555555555555"
  }
} as const;

export const V2FileProcessingStatusSchema = v2FileProcessingStatusSchema;
export const V2FileSchema = v2FileSchema;
export const V2CardFileSchema = v2CardFileSchema;
export const V2CardAttachmentSchema = v2CardAttachmentSchema;
export const V2ConnectionFileSchema = v2ConnectionFileSchema;
export const V2ConnectionAttachmentSchema = v2ConnectionAttachmentSchema;
export const V2ConnectionVisualStyleSchema = v2ConnectionVisualStyleSchema;

export type V2Workspace = z.infer<typeof v2WorkspaceSchema>;
export type V2Project = z.infer<typeof v2ProjectSchema>;
export type V2Board = z.infer<typeof v2BoardSchema>;
export type V2JsonObject = z.infer<typeof v2JsonObjectSchema>;
export type V2Position = z.infer<typeof v2PositionSchema>;
export type V2Size = z.infer<typeof v2SizeSchema>;
export type V2Viewport = z.infer<typeof v2ViewportSchema>;
export type V2CardStatus = z.infer<typeof v2CardStatusSchema>;
export type V2PortDirection = z.infer<typeof v2PortDirectionSchema>;
export type V2ConnectionStatus = z.infer<typeof v2ConnectionStatusSchema>;
export type V2WorkspaceRole = z.infer<typeof v2WorkspaceRoleSchema>;
export type V2FileProcessingStatus = z.infer<typeof v2FileProcessingStatusSchema>;
export type V2ConnectorSlotType = z.infer<typeof v2ConnectorSlotTypeSchema>;
export type V2ConnectorSlotSide = z.infer<typeof v2ConnectorSlotSideSchema>;
export type V2ConnectorSlot = z.infer<typeof v2ConnectorSlotSchema>;
export type V2CardTypePort = z.infer<typeof v2CardTypePortSchema>;
export type V2CardType = z.infer<typeof v2CardTypeSchema>;
export type V2Card = z.infer<typeof v2CardSchema>;
export type V2CardVisualStyle = z.infer<typeof v2CardVisualStyleSchema>;
export type V2Connection = z.infer<typeof v2ConnectionSchema>;
export type V2ConnectionMarker = z.infer<typeof v2ConnectionMarkerSchema>;
export type V2ConnectionVisualStyle = z.infer<typeof v2ConnectionVisualStyleSchema>;
export type V2File = z.infer<typeof v2FileSchema>;
export type V2CardFile = z.infer<typeof v2CardFileSchema>;
export type V2CardAttachment = z.infer<typeof v2CardAttachmentSchema>;
export type V2ConnectionFile = z.infer<typeof v2ConnectionFileSchema>;
export type V2ConnectionAttachment = z.infer<typeof v2ConnectionAttachmentSchema>;
export type V2BoardDetail = z.infer<typeof v2BoardDetailSchema>;
export type V2CreateCardInput = z.infer<typeof v2CreateCardBodySchema>;
export type V2UpdateCardInput = z.infer<typeof v2UpdateCardBodySchema>;
export type V2CreateConnectionInput = z.infer<typeof v2CreateConnectionBodySchema>;
export type V2UpdateConnectionInput = z.infer<typeof v2UpdateConnectionBodySchema>;
export type V2CreateCardRequest = z.input<typeof v2CreateCardBodySchema>;
export type V2UpdateCardRequest = z.input<typeof v2UpdateCardBodySchema>;
export type V2CreateConnectionRequest = z.input<typeof v2CreateConnectionBodySchema>;
export type V2UpdateConnectionRequest = z.input<typeof v2UpdateConnectionBodySchema>;
