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

export const v2CardVisualStyleSchema = z.object({
  fontFamily: z.string().min(1).max(80).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textColor: z.string().min(1).max(32).optional(),
  bodyVerticalAlign: z.enum(["top", "center", "bottom"]).optional(),
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
  type: z.string().min(1),
  label: z.string(),
  status: v2ConnectionStatusSchema,
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
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
  deleteConnection: {
    method: "DELETE",
    path: "/v2/connections/{connectionId}",
    params: v2DeleteConnectionParamsSchema,
    response: v2DeleteResultSchema
  }
} as const;

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
export type V2CardTypePort = z.infer<typeof v2CardTypePortSchema>;
export type V2CardType = z.infer<typeof v2CardTypeSchema>;
export type V2Card = z.infer<typeof v2CardSchema>;
export type V2CardVisualStyle = z.infer<typeof v2CardVisualStyleSchema>;
export type V2Connection = z.infer<typeof v2ConnectionSchema>;
export type V2BoardDetail = z.infer<typeof v2BoardDetailSchema>;
export type V2CreateCardInput = z.infer<typeof v2CreateCardBodySchema>;
export type V2UpdateCardInput = z.infer<typeof v2UpdateCardBodySchema>;
export type V2CreateConnectionInput = z.infer<typeof v2CreateConnectionBodySchema>;
export type V2CreateCardRequest = z.input<typeof v2CreateCardBodySchema>;
export type V2UpdateCardRequest = z.input<typeof v2UpdateCardBodySchema>;
export type V2CreateConnectionRequest = z.input<typeof v2CreateConnectionBodySchema>;
