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
export const v2CardTypeFieldTypeSchema = z.enum(["text", "number", "boolean", "select", "json", "date"]);
export const v2ConnectionTypeFieldTypeSchema = z.enum(["text", "number", "boolean", "select", "json", "date"]);
export const v2LinkedFieldSourceModeSchema = z.enum(["exactCard", "connectedCard"]);
export const v2LinkedFieldDirectionSchema = z.enum(["incoming", "outgoing"]);
export const v2LinkedFieldOnMissingSchema = z.enum(["empty"]);
export const v2LinkedFieldOnMultipleSchema = z.enum(["warning"]);
export const v2LinkedFieldStatusSchema = z.enum(["active", "deleted"]);
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
  label: z.string().optional(),
  showLabel: z.boolean().optional()
});

export const v2CardVisualStyleSchema = z.object({
  accentKey: z.string().trim().min(1).max(40).optional(),
  accentColor: z.string().min(1).max(32).optional(),
  iconKey: z.string().trim().min(1).max(40).optional(),
  fillColor: z.string().min(1).max(32).optional(),
  borderColor: z.string().min(1).max(32).optional(),
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

export const v2ConnectionRouteModeSchema = z.enum(["auto", "manual"]);

export const v2ConnectionWaypointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const v2ConnectionVisualStyleSchema = z.object({
  strokeColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  strokeWidth: z.number().min(1).max(12).optional(),
  cornerRadius: z.number().min(0).max(48).optional(),
  markerStart: v2ConnectionMarkerSchema.optional(),
  markerEnd: v2ConnectionMarkerSchema.optional(),
  routeMode: v2ConnectionRouteModeSchema.optional(),
  waypoints: z.array(v2ConnectionWaypointSchema).max(20).optional(),
  labelPosition: v2ConnectionWaypointSchema.nullable().optional(),
  labelSegmentIndex: z.number().int().nonnegative().nullable().optional()
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

export const v2CardTypePortInputSchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().trim().min(1),
    direction: v2PortDirectionSchema,
    dataType: z.string().trim().min(1).default("json"),
    required: z.boolean().default(false),
    sortOrder: z.number().int().default(0)
  })
  .strict();

export const v2DefaultCardTypePortsSchema = z.array(v2CardTypePortInputSchema).default([
  { key: "input", label: "Input", direction: "input", dataType: "json", required: false, sortOrder: 0 },
  { key: "output", label: "Output", direction: "output", dataType: "json", required: false, sortOrder: 1 }
]);

export const v2CardTypeFieldOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1)
});

export const v2CardTypeFieldSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    type: v2CardTypeFieldTypeSchema,
    required: z.boolean().optional(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
    options: z.array(v2CardTypeFieldOptionSchema).optional()
  })
  .strict()
  .transform((field) => ({
    ...field,
    label: field.label ?? field.key
  }));

export const v2CardTypeDefinitionSchema = z
  .object({
    fields: z.array(v2CardTypeFieldSchema).default([])
  })
  .strict()
  .superRefine((schema, context) => {
    const seenKeys = new Set<string>();
    for (const field of schema.fields) {
      if (seenKeys.has(field.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `Duplicate field key: ${field.key}`
        });
      }
      seenKeys.add(field.key);
    }
  });

export const v2ConnectionTypeFieldOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1)
});

export const v2ConnectionTypeFieldSchema = z
  .object({
    key: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
    type: v2ConnectionTypeFieldTypeSchema,
    required: z.boolean().optional(),
    description: z.string().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
    options: z.array(v2ConnectionTypeFieldOptionSchema).optional()
  })
  .strict()
  .transform((field) => ({
    ...field,
    label: field.label ?? field.key
  }));

export const v2ConnectionTypeDefinitionSchema = z
  .object({
    fields: z.array(v2ConnectionTypeFieldSchema).default([])
  })
  .strict()
  .superRefine((schema, context) => {
    const seenKeys = new Set<string>();
    for (const field of schema.fields) {
      if (seenKeys.has(field.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `Duplicate field key: ${field.key}`
        });
      }
      seenKeys.add(field.key);
    }
  });

export const v2CardTypeSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  description: z.string(),
  defaultData: v2JsonObjectSchema,
  schema: v2CardTypeDefinitionSchema.default({ fields: [] }),
  defaultVisualStyle: v2CardVisualStyleSchema.default({}),
  defaultSize: v2SizeSchema,
  ports: z.array(v2CardTypePortSchema),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2ConnectionTypeSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  schema: v2ConnectionTypeDefinitionSchema.default({ fields: [] }),
  defaultVisualStyle: z.record(z.string(), z.unknown()).default({}),
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
  connectionTypeId: v2UuidSchema.nullable().default(null),
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

export const v2LinkedFieldBindingSchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  boardId: v2UuidSchema,
  targetCardId: v2UuidSchema,
  targetField: z.string().trim().min(1),
  sourceMode: v2LinkedFieldSourceModeSchema,
  direction: v2LinkedFieldDirectionSchema,
  sourceCardId: v2UuidSchema.nullable().optional(),
  sourceCardTypeId: v2UuidSchema.nullable().optional(),
  sourceCardTypeKey: z.string().trim().min(1).nullable().optional(),
  sourceFieldPath: z.string().trim().min(1),
  onMissing: v2LinkedFieldOnMissingSchema,
  onMultiple: v2LinkedFieldOnMultipleSchema,
  status: z.literal("active"),
  createdAt: v2TimestampSchema,
  updatedAt: v2TimestampSchema
});

export const v2CreateLinkedFieldBindingBodySchema = z
  .object({
    targetCardId: v2UuidSchema,
    targetField: z.string().trim().min(1),
    sourceMode: v2LinkedFieldSourceModeSchema,
    direction: v2LinkedFieldDirectionSchema,
    sourceCardId: v2UuidSchema.nullable().optional(),
    sourceCardTypeId: v2UuidSchema.nullable().optional(),
    sourceCardTypeKey: z.string().trim().min(1).nullable().optional(),
    sourceFieldPath: z.string().trim().min(1),
    onMissing: v2LinkedFieldOnMissingSchema.default("empty"),
    onMultiple: v2LinkedFieldOnMultipleSchema.default("warning")
  })
  .strict();

export const v2UpdateLinkedFieldBindingBodySchema = z
  .object({
    targetCardId: v2UuidSchema.optional(),
    targetField: z.string().trim().min(1).optional(),
    sourceMode: v2LinkedFieldSourceModeSchema.optional(),
    direction: v2LinkedFieldDirectionSchema.optional(),
    sourceCardId: v2UuidSchema.nullable().optional(),
    sourceCardTypeId: v2UuidSchema.nullable().optional(),
    sourceCardTypeKey: z.string().trim().min(1).nullable().optional(),
    sourceFieldPath: z.string().trim().min(1).optional(),
    onMissing: v2LinkedFieldOnMissingSchema.optional(),
    onMultiple: v2LinkedFieldOnMultipleSchema.optional()
  })
  .strict();

export const v2LinkedFieldBindingListResponseSchema = z.object({
  fieldBindings: z.array(v2LinkedFieldBindingSchema)
});

export const v2BoardDetailSchema = z.object({
  workspace: v2WorkspaceSchema,
  project: v2ProjectSchema,
  board: v2BoardSchema,
  cardTypes: z.array(v2CardTypeSchema),
  connectionTypes: z.array(v2ConnectionTypeSchema).default([]),
  cards: z.array(v2CardSchema),
  connections: z.array(v2ConnectionSchema)
});

export const v2UserSummarySchema = z.object({
  id: v2UuidSchema,
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable()
});

export const v2WorkspaceSummarySchema = z.object({
  id: v2UuidSchema,
  name: z.string().min(1),
  slug: z.string().min(1),
  role: v2WorkspaceRoleSchema,
  updatedAt: v2TimestampSchema
});

export const v2BoardSummarySchema = z.object({
  id: v2UuidSchema,
  workspaceId: v2UuidSchema,
  name: z.string().min(1),
  updatedAt: v2TimestampSchema
});

export const v2ListWorkspacesResponseSchema = z.object({
  workspaces: z.array(v2WorkspaceSummarySchema)
});

export const v2ListWorkspaceBoardsParamsSchema = z.object({
  workspaceId: v2UuidSchema
});

export const v2ListWorkspaceBoardsResponseSchema = z.object({
  boards: z.array(v2BoardSummarySchema)
});

export const v2CreateBoardBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120)
  })
  .strict();

export const v2BootstrapSessionBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    name: z.string().trim().max(160).default(""),
    avatarUrl: z.string().url().nullable().default(null),
    authProvider: z.literal("supabase")
  })
  .strict();

export const v2BootstrapSessionResponseSchema = z.object({
  created: z.boolean(),
  user: v2UserSummarySchema,
  workspace: v2WorkspaceSummarySchema,
  board: v2BoardSummarySchema.nullable()
});

export const v2GetBoardParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2ListCardTypesParamsSchema = z.object({
  workspaceId: v2UuidSchema
});

export const v2CreateCardTypeParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateCardTypeBodySchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/),
    name: z.string().trim().min(1),
    description: z.string().optional(),
    schema: v2CardTypeDefinitionSchema.default({ fields: [] }),
    defaultSize: v2SizeSchema.optional(),
    defaultVisualStyle: v2CardVisualStyleSchema.default({}),
    ports: v2DefaultCardTypePortsSchema
  })
  .strict();

export const v2UpdateCardTypeParamsSchema = z.object({
  boardId: v2UuidSchema,
  cardTypeId: v2UuidSchema
});

export const v2DeleteCardTypeParamsSchema = v2UpdateCardTypeParamsSchema;

export const v2UpdateCardTypeBodySchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().optional(),
    schema: v2CardTypeDefinitionSchema.optional(),
    defaultSize: v2SizeSchema.optional(),
    defaultVisualStyle: v2CardVisualStyleSchema.optional(),
    ports: z.array(v2CardTypePortInputSchema).optional()
  })
  .strict();

export const v2UpdateCardTypeSchemaParamsSchema = z.object({
  boardId: v2UuidSchema,
  cardTypeId: v2UuidSchema
});

export const v2UpdateCardTypeSchemaBodySchema = z
  .object({
    schema: v2CardTypeDefinitionSchema
  })
  .strict();

export const v2ListConnectionTypesParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateConnectionTypeParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateConnectionTypeBodySchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/),
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    schema: v2ConnectionTypeDefinitionSchema.default({ fields: [] }),
    defaultVisualStyle: v2ConnectionVisualStyleSchema.default({})
  })
  .strict();

export const v2UpdateConnectionTypeParamsSchema = z.object({
  boardId: v2UuidSchema,
  connectionTypeId: v2UuidSchema
});

export const v2UpdateConnectionTypeBodySchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    schema: v2ConnectionTypeDefinitionSchema.optional(),
    defaultVisualStyle: v2ConnectionVisualStyleSchema.optional()
  })
  .strict();

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
  connectionTypeId: v2UuidSchema.nullable().optional(),
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
    connectionTypeId: v2UuidSchema.nullable().optional(),
    sourceCardId: v2UuidSchema.optional(),
    targetCardId: v2UuidSchema.optional(),
    sourcePortKey: z.string().trim().min(1).optional(),
    targetPortKey: z.string().trim().min(1).optional(),
    data: v2JsonObjectSchema.optional(),
    visualStyle: v2ConnectionVisualStyleSchema.optional()
  })
  .strict();

export const v2DeleteResultSchema = z.object({
  deleted: z.literal(true),
  id: v2UuidSchema
});

export const v2RunDryRunParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2ListLinkedFieldBindingsParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2CreateLinkedFieldBindingParamsSchema = z.object({
  boardId: v2UuidSchema
});

export const v2UpdateLinkedFieldBindingParamsSchema = z.object({
  boardId: v2UuidSchema,
  bindingId: v2UuidSchema
});

export const v2DeleteLinkedFieldBindingParamsSchema = z.object({
  boardId: v2UuidSchema,
  bindingId: v2UuidSchema
});

export const v2RunDryRunBodySchema = z
  .object({
    startCardId: v2UuidSchema.optional()
  })
  .strict();

export const v2DryRunStepSchema = z.object({
  cardId: v2UuidSchema,
  title: z.string().min(1),
  type: z.string().min(1),
  status: z.literal("would_run"),
  message: z.string().min(1)
});

export const v2DryRunResultSchema = z.object({
  ok: z.literal(true),
  mode: z.literal("dry-run"),
  boardId: v2UuidSchema,
  startCardId: v2UuidSchema.optional(),
  steps: z.array(v2DryRunStepSchema),
  warnings: z.array(z.string())
});

export const v2ApiContracts = {
  bootstrapSession: {
    method: "POST",
    path: "/v2/session/bootstrap",
    body: v2BootstrapSessionBodySchema,
    response: v2BootstrapSessionResponseSchema
  },
  listWorkspaces: {
    method: "GET",
    path: "/v2/workspaces",
    response: v2ListWorkspacesResponseSchema
  },
  listWorkspaceBoards: {
    method: "GET",
    path: "/v2/workspaces/{workspaceId}/boards",
    params: v2ListWorkspaceBoardsParamsSchema,
    response: v2ListWorkspaceBoardsResponseSchema
  },
  createBoard: {
    method: "POST",
    path: "/v2/workspaces/{workspaceId}/boards",
    params: v2ListWorkspaceBoardsParamsSchema,
    body: v2CreateBoardBodySchema,
    response: v2BoardSummarySchema
  },
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
  createCardType: {
    method: "POST",
    path: "/v2/boards/{boardId}/card-types",
    params: v2CreateCardTypeParamsSchema,
    body: v2CreateCardTypeBodySchema,
    response: v2CardTypeSchema
  },
  updateCardType: {
    method: "PATCH",
    path: "/v2/boards/{boardId}/card-types/{cardTypeId}",
    params: v2UpdateCardTypeParamsSchema,
    body: v2UpdateCardTypeBodySchema,
    response: v2CardTypeSchema
  },
  updateCardTypeSchema: {
    method: "PATCH",
    path: "/v2/boards/{boardId}/card-types/{cardTypeId}/schema",
    params: v2UpdateCardTypeSchemaParamsSchema,
    body: v2UpdateCardTypeSchemaBodySchema,
    response: v2CardTypeSchema
  },
  deleteCardType: {
    method: "DELETE",
    path: "/v2/boards/{boardId}/card-types/{cardTypeId}",
    params: v2DeleteCardTypeParamsSchema,
    response: z.object({ deleted: z.literal(true), id: v2UuidSchema })
  },
  listConnectionTypes: {
    method: "GET",
    path: "/v2/boards/{boardId}/connection-types",
    params: v2ListConnectionTypesParamsSchema,
    response: z.object({ connectionTypes: z.array(v2ConnectionTypeSchema) })
  },
  createConnectionType: {
    method: "POST",
    path: "/v2/boards/{boardId}/connection-types",
    params: v2CreateConnectionTypeParamsSchema,
    body: v2CreateConnectionTypeBodySchema,
    response: v2ConnectionTypeSchema
  },
  updateConnectionType: {
    method: "PATCH",
    path: "/v2/boards/{boardId}/connection-types/{connectionTypeId}",
    params: v2UpdateConnectionTypeParamsSchema,
    body: v2UpdateConnectionTypeBodySchema,
    response: v2ConnectionTypeSchema
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
  },
  runBoardDryRun: {
    method: "POST",
    path: "/v2/boards/{boardId}/run/dry-run",
    params: v2RunDryRunParamsSchema,
    body: v2RunDryRunBodySchema,
    response: v2DryRunResultSchema
  },
  listLinkedFieldBindings: {
    method: "GET",
    path: "/v2/boards/{boardId}/field-bindings",
    params: v2ListLinkedFieldBindingsParamsSchema,
    response: v2LinkedFieldBindingListResponseSchema
  },
  createLinkedFieldBinding: {
    method: "POST",
    path: "/v2/boards/{boardId}/field-bindings",
    params: v2CreateLinkedFieldBindingParamsSchema,
    body: v2CreateLinkedFieldBindingBodySchema,
    response: v2LinkedFieldBindingSchema
  },
  updateLinkedFieldBinding: {
    method: "PATCH",
    path: "/v2/boards/{boardId}/field-bindings/{bindingId}",
    params: v2UpdateLinkedFieldBindingParamsSchema,
    body: v2UpdateLinkedFieldBindingBodySchema,
    response: v2LinkedFieldBindingSchema
  },
  deleteLinkedFieldBinding: {
    method: "DELETE",
    path: "/v2/boards/{boardId}/field-bindings/{bindingId}",
    params: v2DeleteLinkedFieldBindingParamsSchema,
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
export const V2ConnectionTypeFieldSchema = v2ConnectionTypeFieldSchema;
export const V2ConnectionTypeSchema = v2ConnectionTypeSchema;
export const V2LinkedFieldBindingSchema = v2LinkedFieldBindingSchema;
export const V2CardTypeDefinitionSchema = v2CardTypeDefinitionSchema;
export const V2ConnectionTypeDefinitionSchema = v2ConnectionTypeDefinitionSchema;

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
export type V2CardTypeFieldType = z.infer<typeof v2CardTypeFieldTypeSchema>;
export type V2CardTypeFieldOption = z.infer<typeof v2CardTypeFieldOptionSchema>;
export type V2CardTypeFieldSchema = z.infer<typeof v2CardTypeFieldSchema>;
export type V2CardTypeSchema = z.infer<typeof v2CardTypeDefinitionSchema>;
export type V2ConnectionTypeFieldType = z.infer<typeof v2ConnectionTypeFieldTypeSchema>;
export type V2ConnectionTypeFieldOption = z.infer<typeof v2ConnectionTypeFieldOptionSchema>;
export type V2ConnectionTypeFieldSchema = z.infer<typeof v2ConnectionTypeFieldSchema>;
export type V2ConnectionTypeSchema = z.infer<typeof v2ConnectionTypeDefinitionSchema>;
export type V2CardTypePort = z.infer<typeof v2CardTypePortSchema>;
export type V2CardTypePortInput = z.infer<typeof v2CardTypePortInputSchema>;
export type V2CardType = z.infer<typeof v2CardTypeSchema>;
export type V2Card = z.infer<typeof v2CardSchema>;
export type V2CardVisualStyle = z.infer<typeof v2CardVisualStyleSchema>;
export type V2ConnectionType = z.infer<typeof v2ConnectionTypeSchema>;
export type V2Connection = z.infer<typeof v2ConnectionSchema>;
export type V2ConnectionMarker = z.infer<typeof v2ConnectionMarkerSchema>;
export type V2ConnectionRouteMode = z.infer<typeof v2ConnectionRouteModeSchema>;
export type V2ConnectionWaypoint = z.infer<typeof v2ConnectionWaypointSchema>;
export type V2ConnectionVisualStyle = z.infer<typeof v2ConnectionVisualStyleSchema>;
export type V2File = z.infer<typeof v2FileSchema>;
export type V2CardFile = z.infer<typeof v2CardFileSchema>;
export type V2CardAttachment = z.infer<typeof v2CardAttachmentSchema>;
export type V2ConnectionFile = z.infer<typeof v2ConnectionFileSchema>;
export type V2ConnectionAttachment = z.infer<typeof v2ConnectionAttachmentSchema>;
export type V2LinkedFieldSourceMode = z.infer<typeof v2LinkedFieldSourceModeSchema>;
export type V2LinkedFieldDirection = z.infer<typeof v2LinkedFieldDirectionSchema>;
export type V2LinkedFieldBinding = z.infer<typeof v2LinkedFieldBindingSchema>;
export type V2BoardDetail = z.infer<typeof v2BoardDetailSchema>;
export type V2UserSummary = z.infer<typeof v2UserSummarySchema>;
export type V2WorkspaceSummary = z.infer<typeof v2WorkspaceSummarySchema>;
export type V2BoardSummary = z.infer<typeof v2BoardSummarySchema>;
export type V2ListWorkspacesResponse = z.infer<typeof v2ListWorkspacesResponseSchema>;
export type V2ListWorkspaceBoardsResponse = z.infer<typeof v2ListWorkspaceBoardsResponseSchema>;
export type V2CreateBoardInput = z.infer<typeof v2CreateBoardBodySchema>;
export type V2CreateBoardRequest = z.input<typeof v2CreateBoardBodySchema>;
export type V2BootstrapSessionInput = z.infer<typeof v2BootstrapSessionBodySchema>;
export type V2BootstrapSessionRequest = z.input<typeof v2BootstrapSessionBodySchema>;
export type V2BootstrapSessionResponse = z.infer<typeof v2BootstrapSessionResponseSchema>;
export type V2CreateCardTypeInput = z.infer<typeof v2CreateCardTypeBodySchema>;
export type V2UpdateCardTypeInput = z.infer<typeof v2UpdateCardTypeBodySchema>;
export type V2CreateConnectionTypeInput = z.infer<typeof v2CreateConnectionTypeBodySchema>;
export type V2UpdateConnectionTypeInput = z.infer<typeof v2UpdateConnectionTypeBodySchema>;
export type V2CreateCardInput = z.infer<typeof v2CreateCardBodySchema>;
export type V2UpdateCardInput = z.infer<typeof v2UpdateCardBodySchema>;
export type V2UpdateCardTypeSchemaInput = z.infer<typeof v2UpdateCardTypeSchemaBodySchema>;
export type V2CreateConnectionInput = z.infer<typeof v2CreateConnectionBodySchema>;
export type V2UpdateConnectionInput = z.infer<typeof v2UpdateConnectionBodySchema>;
export type V2CreateLinkedFieldBindingInput = z.infer<typeof v2CreateLinkedFieldBindingBodySchema>;
export type V2UpdateLinkedFieldBindingInput = z.infer<typeof v2UpdateLinkedFieldBindingBodySchema>;
export type V2LinkedFieldBindingListResponse = z.infer<typeof v2LinkedFieldBindingListResponseSchema>;
export type V2RunDryRunInput = z.infer<typeof v2RunDryRunBodySchema>;
export type V2DryRunStep = z.infer<typeof v2DryRunStepSchema>;
export type V2DryRunResult = z.infer<typeof v2DryRunResultSchema>;
export type V2CreateCardTypeRequest = z.input<typeof v2CreateCardTypeBodySchema>;
export type V2UpdateCardTypeRequest = z.input<typeof v2UpdateCardTypeBodySchema>;
export type V2CreateConnectionTypeRequest = z.input<typeof v2CreateConnectionTypeBodySchema>;
export type V2UpdateConnectionTypeRequest = z.input<typeof v2UpdateConnectionTypeBodySchema>;
export type V2CreateCardRequest = z.input<typeof v2CreateCardBodySchema>;
export type V2UpdateCardRequest = z.input<typeof v2UpdateCardBodySchema>;
export type V2UpdateCardTypeSchemaRequest = z.input<typeof v2UpdateCardTypeSchemaBodySchema>;
export type V2CreateConnectionRequest = z.input<typeof v2CreateConnectionBodySchema>;
export type V2UpdateConnectionRequest = z.input<typeof v2UpdateConnectionBodySchema>;
export type V2CreateLinkedFieldBindingRequest = z.input<typeof v2CreateLinkedFieldBindingBodySchema>;
export type V2UpdateLinkedFieldBindingRequest = z.input<typeof v2UpdateLinkedFieldBindingBodySchema>;
export type V2RunDryRunRequest = z.input<typeof v2RunDryRunBodySchema>;
