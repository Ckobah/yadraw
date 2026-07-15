import { createHash, randomUUID } from "node:crypto";
import {
  buildV2ConnectionDefaultData,
  buildV2SemanticGraph,
  evaluateV2QuantitativeGraph,
  validateV2ConnectionData,
  v2BootstrapSessionBodySchema,
  v2CreateBoardBodySchema,
  v2DuplicateBoardBodySchema,
  type V2CardAttachment,
  type V2ConnectionAttachment,
  type V2CreateCardTypeRequest,
  type V2CreateConnectionTypeRequest,
  type V2CreateLinkedFieldBindingRequest,
  v2CreateCardBodySchema,
  v2CreateCardLibraryEntryBodySchema,
  v2CreateCardTypeBodySchema,
  v2CreateConnectionBodySchema,
  v2CreateConnectionTypeBodySchema,
  v2CreateLinkedFieldBindingBodySchema,
  v2CardLibraryEntrySchema,
  v2ConnectorSlotSchema,
  v2DemoIds,
  v2DeleteCardLibraryEntryQuerySchema,
  v2EvaluateCalculationsBodySchema,
  v2RunDryRunBodySchema,
  v2ListCardLibraryEntriesQuerySchema,
  v2SetCardLibraryEntryBodySchema,
  v2UpdateBoardLayoutBodySchema,
  v2UpdateBoardBodySchema,
  v2UpdateCardTypeSchemaBodySchema,
  v2UpdateCardBodySchema,
  v2UpdateCardLibraryEntryBodySchema,
  v2UpdateConnectionBodySchema,
  v2UpdateLinkedFieldBindingBodySchema,
  v2UuidSchema,
  type V2BoardDetail,
  type V2BoardExport,
  type V2BoardSummary,
  type V2BootstrapSessionRequest,
  type V2BootstrapSessionResponse,
  type V2Card,
  type V2CardLibraryEntry,
  type V2CardLibraryEntryListResponse,
  type V2CardLibraryEntryValidationIssue,
  type V2CardType,
  type V2ConnectionType,
  type V2CardTypePortInput,
  type V2Connection,
  type V2CalculationEvaluation,
  type V2CreateCardRequest,
  type V2CreateCardLibraryEntryRequest,
  type V2CreateConnectionRequest,
  type V2DryRunResult,
  type V2EvaluateCalculationsRequest,
  type V2LinkedFieldBinding,
  type V2ListCardLibraryEntriesQueryRequest,
  type V2RunDryRunRequest,
  type V2SemanticGraph,
  type V2SetCardLibraryEntryRequest,
  type V2UpdateCardTypeRequest,
  type V2UpdateBoardLayoutRequest,
  type V2UpdateBoardLayoutResponse,
  type V2UpdateConnectionTypeRequest,
  type V2UpdateCardRequest,
  type V2UpdateCardLibraryEntryRequest,
  v2UpdateCardTypeBodySchema,
  type V2UpdateCardTypeSchemaRequest,
  type V2UpdateConnectionRequest,
  v2UpdateConnectionTypeBodySchema,
  type V2UpdateLinkedFieldBindingRequest,
  type V2WorkspaceSummary
} from "@yadraw/shared";
import type { RequestContext } from "../context.js";
import { z } from "zod";
import { hasV2WorkspaceAccess, type V2AccessLevel } from "./policy.js";
import type {
  V2CreateCardAttachmentRecordInput,
  V2CreateConnectionAttachmentRecordInput,
  V2BootstrapUserInput,
  V2FileDownloadRecord,
  V2Repository
} from "./repository.js";
import type { GetObjectResult, V2ObjectStorage } from "./storage.js";

export const V2_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type V2ServiceErrorCode =
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "forbidden"
  | "storage_unavailable";

export class V2ServiceError extends Error {
  constructor(
    readonly code: V2ServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "V2ServiceError";
  }
}

export type V2BoardService = {
  bootstrapSession(
    context: RequestContext,
    input: V2BootstrapSessionRequest
  ): Promise<V2BootstrapSessionResponse>;
  listWorkspaces(context: RequestContext): Promise<{ workspaces: V2WorkspaceSummary[] }>;
  listWorkspaceBoards(
    context: RequestContext,
    workspaceId: string
  ): Promise<{ boards: V2BoardSummary[] }>;
  createBoard(
    context: RequestContext,
    workspaceId: string,
    input: { name: string }
  ): Promise<V2BoardSummary>;
  updateBoard(context: RequestContext, boardId: string, input: unknown): Promise<V2BoardSummary>;
  duplicateBoard(context: RequestContext, boardId: string, input: unknown): Promise<V2BoardSummary>;
  deleteBoard(context: RequestContext, boardId: string): Promise<{ deleted: true; id: string }>;
  exportBoard(context: RequestContext, boardId: string): Promise<V2BoardExport>;
  deleteAccount(context: RequestContext): Promise<{ deleted: true; id: string }>;
  getLegalAcceptance(context: RequestContext): Promise<import("./legal.js").V2LegalAcceptanceStatus>;
  acceptLegalTerms(
    context: RequestContext,
    input: unknown
  ): Promise<import("./legal.js").V2LegalAcceptanceStatus>;
  getBoard(context: RequestContext, boardId: string): Promise<V2BoardDetail>;
  getSemanticGraph(context: RequestContext, boardId: string): Promise<V2SemanticGraph>;
  evaluateBoardCalculations(
    context: RequestContext,
    boardId: string,
    input?: V2EvaluateCalculationsRequest
  ): Promise<V2CalculationEvaluation>;
  updateBoardLayout(
    context: RequestContext,
    boardId: string,
    input: V2UpdateBoardLayoutRequest
  ): Promise<V2UpdateBoardLayoutResponse>;
  listCardTypes(context: RequestContext, workspaceId: string): Promise<{ cardTypes: V2CardType[] }>;
  createCardType(
    context: RequestContext,
    boardId: string,
    input: V2CreateCardTypeRequest
  ): Promise<V2CardType>;
  updateCardType(
    context: RequestContext,
    boardId: string,
    cardTypeId: string,
    input: V2UpdateCardTypeRequest
  ): Promise<V2CardType>;
  updateCardTypeSchema(
    context: RequestContext,
    boardId: string,
    cardTypeId: string,
    input: V2UpdateCardTypeSchemaRequest
  ): Promise<V2CardType>;
  deleteCardType(
    context: RequestContext,
    boardId: string,
    cardTypeId: string
  ): Promise<{ deleted: true; id: string }>;
  listCardLibraryEntries(
    context: RequestContext,
    workspaceId: string,
    cardTypeId: string,
    query: V2ListCardLibraryEntriesQueryRequest
  ): Promise<V2CardLibraryEntryListResponse>;
  getCardLibraryEntry(
    context: RequestContext,
    workspaceId: string,
    cardTypeId: string,
    libraryEntryId: string
  ): Promise<V2CardLibraryEntry>;
  createCardLibraryEntry(
    context: RequestContext,
    workspaceId: string,
    cardTypeId: string,
    input: V2CreateCardLibraryEntryRequest
  ): Promise<V2CardLibraryEntry>;
  updateCardLibraryEntry(
    context: RequestContext,
    workspaceId: string,
    cardTypeId: string,
    libraryEntryId: string,
    input: V2UpdateCardLibraryEntryRequest
  ): Promise<V2CardLibraryEntry>;
  deleteCardLibraryEntry(
    context: RequestContext,
    workspaceId: string,
    cardTypeId: string,
    libraryEntryId: string,
    query: unknown
  ): Promise<{ deleted: true; id: string }>;
  listConnectionTypes(context: RequestContext, boardId: string): Promise<{ connectionTypes: V2ConnectionType[] }>;
  createConnectionType(
    context: RequestContext,
    boardId: string,
    input: V2CreateConnectionTypeRequest
  ): Promise<V2ConnectionType>;
  updateConnectionType(
    context: RequestContext,
    boardId: string,
    connectionTypeId: string,
    input: V2UpdateConnectionTypeRequest
  ): Promise<V2ConnectionType>;
  runBoardDryRun(context: RequestContext, boardId: string, input?: V2RunDryRunRequest): Promise<V2DryRunResult>;
  listLinkedFieldBindings(context: RequestContext, boardId: string): Promise<{ fieldBindings: V2LinkedFieldBinding[] }>;
  createLinkedFieldBinding(
    context: RequestContext,
    boardId: string,
    input: V2CreateLinkedFieldBindingRequest
  ): Promise<V2LinkedFieldBinding>;
  updateLinkedFieldBinding(
    context: RequestContext,
    boardId: string,
    bindingId: string,
    input: V2UpdateLinkedFieldBindingRequest
  ): Promise<V2LinkedFieldBinding>;
  deleteLinkedFieldBinding(
    context: RequestContext,
    boardId: string,
    bindingId: string
  ): Promise<{ deleted: true; id: string }>;
  createCard(context: RequestContext, boardId: string, input: V2CreateCardRequest): Promise<V2Card>;
  duplicateCard(context: RequestContext, cardId: string): Promise<V2Card>;
  updateCard(context: RequestContext, cardId: string, input: V2UpdateCardRequest): Promise<V2Card>;
  setCardLibraryEntry(
    context: RequestContext,
    cardId: string,
    input: V2SetCardLibraryEntryRequest
  ): Promise<V2Card>;
  deleteCard(context: RequestContext, cardId: string): Promise<{ deleted: true; id: string }>;
  createConnection(context: RequestContext, boardId: string, input: V2CreateConnectionRequest): Promise<V2Connection>;
  updateConnection(context: RequestContext, connectionId: string, input: V2UpdateConnectionRequest): Promise<V2Connection>;
  deleteConnection(context: RequestContext, connectionId: string): Promise<{ deleted: true; id: string }>;
  listCardAttachments(context: RequestContext, cardId: string): Promise<V2CardAttachment[]>;
  uploadCardAttachment(
    context: RequestContext,
    cardId: string,
    input: {
      filename: string;
      body: Buffer;
      mimeType?: string | null;
      role?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<V2CardAttachment>;
  downloadFile(
    context: RequestContext,
    fileId: string
  ): Promise<{
    filename: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    object: GetObjectResult;
  }>;
  detachCardAttachment(
    context: RequestContext,
    cardId: string,
    attachmentId: string
  ): Promise<{ deleted: true; id: string }>;
  listConnectionAttachments(context: RequestContext, connectionId: string): Promise<V2ConnectionAttachment[]>;
  uploadConnectionAttachment(
    context: RequestContext,
    connectionId: string,
    input: {
      filename: string;
      body: Buffer;
      mimeType?: string | null;
      role?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<V2ConnectionAttachment>;
  detachConnectionAttachment(
    context: RequestContext,
    connectionId: string,
    attachmentId: string
  ): Promise<{ deleted: true; id: string }>;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireV2Uuid(value: string, label: string): void {
  if (!v2UuidSchema.safeParse(value).success) validationFailed(`Invalid ${label}`);
}

function validateCardLibraryEntryData(
  cardType: V2CardType,
  data: Record<string, unknown>
): V2CardLibraryEntryValidationIssue[] {
  const issues: V2CardLibraryEntryValidationIssue[] = [];
  const fieldsByKey = new Map(cardType.schema.fields.map((field) => [field.key, field]));

  for (const key of Object.keys(data)) {
    if (!fieldsByKey.has(key)) {
      issues.push({
        code: "unknown_field",
        fieldKey: key,
        message: `Unknown field: ${key}`
      });
    }
  }

  for (const field of cardType.schema.fields) {
    const value = data[field.key];
    const missing =
      value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    if (missing) {
      if (field.required) {
        issues.push({
          code: "required",
          fieldKey: field.key,
          message: `${field.label} is required`
        });
      }
      continue;
    }

    const validType =
      (field.type === "text" && typeof value === "string") ||
      (field.type === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (field.type === "boolean" && typeof value === "boolean") ||
      (field.type === "select" && typeof value === "string") ||
      (field.type === "date" && typeof value === "string") ||
      field.type === "json";
    if (!validType) {
      issues.push({
        code: "invalid_type",
        fieldKey: field.key,
        message: `${field.label} has an invalid value type`
      });
      continue;
    }

    if (
      field.type === "select" &&
      !field.options?.some((option) => option.value === value)
    ) {
      issues.push({
        code: "invalid_option",
        fieldKey: field.key,
        message: `${field.label} must use one of the configured options`
      });
    }

    if (field.type === "date" && typeof value === "string") {
      const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const parsedDate = match ? new Date(`${value}T00:00:00.000Z`) : null;
      if (!parsedDate || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value) {
        issues.push({
          code: "invalid_type",
          fieldKey: field.key,
          message: `${field.label} must be a valid date in YYYY-MM-DD format`
        });
      }
    }
  }

  return issues;
}

function decorateCardLibraryEntry(
  entry: V2CardLibraryEntry,
  cardType: V2CardType
): V2CardLibraryEntry {
  const validationIssues = validateCardLibraryEntryData(cardType, entry.data);
  return v2CardLibraryEntrySchema.parse({
    ...entry,
    validationIssues,
    selectable: undefined
  });
}

function rejectInvalidCardLibraryEntryData(issues: V2CardLibraryEntryValidationIssue[]): void {
  const invalid = issues.find((issue) => issue.code !== "required");
  if (invalid) validationFailed(invalid.message);
}

function notFound(message: string): never {
  throw new V2ServiceError("not_found", message);
}

function validationFailed(message: string): never {
  throw new V2ServiceError("validation_failed", message);
}

function conflict(message: string): never {
  throw new V2ServiceError("conflict", message);
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "23503"
  );
}

function forbidden(): never {
  throw new V2ServiceError("forbidden", "Forbidden");
}

function storageUnavailable(): never {
  throw new V2ServiceError("storage_unavailable", "V2 object storage is not configured");
}

function safeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[\\\/]+/g, "-")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .trim()
    .slice(0, 160);

  return sanitized || "file";
}

function buildStoragePath(workspaceId: string, cardId: string, fileId: string, filename: string): string {
  return `workspaces/${workspaceId}/cards/${cardId}/${fileId}-${safeFilename(filename)}`;
}

function buildConnectionStoragePath(
  workspaceId: string,
  connectionId: string,
  fileId: string,
  filename: string
): string {
  return `workspaces/${workspaceId}/connections/${connectionId}/${fileId}-${safeFilename(filename)}`;
}

type ConnectionSlotRole = "source" | "target";

function isValidVisualConnectorSlot(
  card: V2Card,
  portKey: string,
  role: ConnectionSlotRole
): boolean {
  const rawSlots = card.visualStyle.connectorSlots;
  if (!Array.isArray(rawSlots)) return false;

  return rawSlots.some((rawSlot) => {
    const parsed = v2ConnectorSlotSchema.safeParse(rawSlot);
    if (!parsed.success) return false;

    const slot = parsed.data;
    if (slot.id !== portKey) return false;

    return role === "source"
      ? slot.type === "output" || slot.type === "receiver"
      : slot.type === "input" || slot.type === "receiver";
  });
}

function isValidConnectionPort(
  card: V2Card,
  cardType: V2CardType,
  portKey: string,
  role: ConnectionSlotRole
): boolean {
  const semanticDirection = role === "source" ? "output" : "input";
  const semanticPort = cardType.ports.find(
    (port) => port.direction === semanticDirection && port.key === portKey
  );

  return Boolean(semanticPort) || isValidVisualConnectorSlot(card, portKey, role);
}

function sha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, canonicalizeJson(entryValue)])
  );
}

function createSemanticGraphRevision(board: V2BoardDetail): string {
  const payload = {
    boardId: board.board.id,
    cards: [...board.cards]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((card) => ({
        id: card.id,
        cardTypeId: card.cardTypeId,
        title: card.title,
        description: card.description,
        data: card.data,
        status: card.status,
        updatedAt: card.updatedAt
      })),
    connections: [...board.connections]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((connection) => ({
        id: connection.id,
        connectionTypeId: connection.connectionTypeId,
        sourceCardId: connection.sourceCardId,
        targetCardId: connection.targetCardId,
        sourcePortKey: connection.sourcePortKey,
        targetPortKey: connection.targetPortKey,
        type: connection.type,
        title: connection.title,
        description: connection.description,
        data: connection.data,
        status: connection.status,
        updatedAt: connection.updatedAt
      })),
    cardTypes: [...board.cardTypes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((cardType) => ({
        id: cardType.id,
        key: cardType.key,
        name: cardType.name,
        schema: cardType.schema,
        updatedAt: cardType.updatedAt
      })),
    connectionTypes: [...board.connectionTypes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((connectionType) => ({
        id: connectionType.id,
        key: connectionType.key,
        name: connectionType.name,
        description: connectionType.description,
        schema: connectionType.schema,
        updatedAt: connectionType.updatedAt
      }))
  };

  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(payload)))
    .digest("hex")}`;
}

function compareNullableIso(a?: string | null, b?: string | null): number {
  if (a && b && a !== b) return a.localeCompare(b);
  if (a && !b) return -1;
  if (!a && b) return 1;
  return 0;
}

function compareDryRunConnection(
  a: V2Connection,
  b: V2Connection,
  cardById: Map<string, V2Card>
): number {
  return (
    compareNullableIso(a.createdAt, b.createdAt) ||
    a.id.localeCompare(b.id) ||
    (cardById.get(a.targetCardId)?.title ?? "").localeCompare(cardById.get(b.targetCardId)?.title ?? "") ||
    a.targetCardId.localeCompare(b.targetCardId)
  );
}

export function createV2BoardService(
  repository: V2Repository,
  options: {
    objectStorage?: V2ObjectStorage | null;
    storageBucket?: string | null;
  } = {}
): V2BoardService {
  async function requireCurrentLegalAcceptance(context: RequestContext) {
    // Non-Postgres test adapters do not implement legal storage. Production V2 does.
    if (!repository.getLegalAcceptance) return;
    const acceptance = await repository.getLegalAcceptance(context.userId);
    if (!acceptance.current) {
      throw new V2ServiceError("forbidden", "Current legal terms must be accepted");
    }
  }

  async function authorizeWorkspace(context: RequestContext, workspaceId: string, accessLevel: V2AccessLevel) {
    await requireCurrentLegalAcceptance(context);
    const role = await repository.getWorkspaceRole(context.userId, workspaceId);
    if (!hasV2WorkspaceAccess(role, accessLevel)) forbidden();
  }

  function requireStorage(): { objectStorage: V2ObjectStorage; bucket: string } {
    if (!options.objectStorage || !options.storageBucket) {
      storageUnavailable();
    }
    return {
      objectStorage: options.objectStorage,
      bucket: options.storageBucket
    };
  }

  function requireAttachmentRepository(): {
    listCardAttachments(cardId: string): Promise<V2CardAttachment[]>;
    createCardAttachment(input: V2CreateCardAttachmentRecordInput): Promise<V2CardAttachment>;
    listConnectionAttachments(connectionId: string): Promise<V2ConnectionAttachment[]>;
    createConnectionAttachment(input: V2CreateConnectionAttachmentRecordInput): Promise<V2ConnectionAttachment>;
    getFileForDownload(fileId: string): Promise<V2FileDownloadRecord | null>;
    detachCardAttachment(cardId: string, attachmentId: string): Promise<boolean>;
    detachConnectionAttachment(connectionId: string, attachmentId: string): Promise<boolean>;
  } {
    if (
      !repository.listCardAttachments ||
      !repository.createCardAttachment ||
      !repository.listConnectionAttachments ||
      !repository.createConnectionAttachment ||
      !repository.getFileForDownload ||
      !repository.detachCardAttachment ||
      !repository.detachConnectionAttachment
    ) {
      throw new V2ServiceError("storage_unavailable", "V2 attachment repository is not available");
    }

    return {
      listCardAttachments: repository.listCardAttachments.bind(repository),
      createCardAttachment: repository.createCardAttachment.bind(repository),
      listConnectionAttachments: repository.listConnectionAttachments.bind(repository),
      createConnectionAttachment: repository.createConnectionAttachment.bind(repository),
      getFileForDownload: repository.getFileForDownload.bind(repository),
      detachCardAttachment: repository.detachCardAttachment.bind(repository),
      detachConnectionAttachment: repository.detachConnectionAttachment.bind(repository)
    };
  }

  function requireLinkedFieldBindingRepository(): {
    listLinkedFieldBindings(boardId: string): Promise<V2LinkedFieldBinding[]>;
    getLinkedFieldBinding(bindingId: string): Promise<V2LinkedFieldBinding | null>;
    createLinkedFieldBinding(input: Parameters<NonNullable<V2Repository["createLinkedFieldBinding"]>>[0]): Promise<V2LinkedFieldBinding>;
    updateLinkedFieldBinding(
      bindingId: string,
      input: Parameters<NonNullable<V2Repository["updateLinkedFieldBinding"]>>[1]
    ): Promise<V2LinkedFieldBinding | null>;
    deleteLinkedFieldBinding(bindingId: string): Promise<boolean>;
  } {
    if (
      !repository.listLinkedFieldBindings ||
      !repository.getLinkedFieldBinding ||
      !repository.createLinkedFieldBinding ||
      !repository.updateLinkedFieldBinding ||
      !repository.deleteLinkedFieldBinding
    ) {
      throw new V2ServiceError("conflict", "V2 linked field binding repository is not available");
    }

    return {
      listLinkedFieldBindings: repository.listLinkedFieldBindings.bind(repository),
      getLinkedFieldBinding: repository.getLinkedFieldBinding.bind(repository),
      createLinkedFieldBinding: repository.createLinkedFieldBinding.bind(repository),
      updateLinkedFieldBinding: repository.updateLinkedFieldBinding.bind(repository),
      deleteLinkedFieldBinding: repository.deleteLinkedFieldBinding.bind(repository)
    };
  }

  function requireCardTypeSchemaRepository(): {
    createCardType(input: {
      workspaceId: string;
      key: string;
      name: string;
      description: string;
      schema: V2CardType["schema"];
      defaultSize: V2CardType["defaultSize"];
      defaultVisualStyle: V2CardType["defaultVisualStyle"];
      ports: V2CardTypePortInput[];
    }): Promise<V2CardType>;
    updateCardType(cardTypeId: string, input: V2UpdateCardTypeRequest): Promise<V2CardType | null>;
    updateCardTypeSchema(cardTypeId: string, schema: V2CardType["schema"]): Promise<V2CardType | null>;
    deleteCardType(
      cardTypeId: string
    ): ReturnType<NonNullable<V2Repository["deleteCardType"]>>;
  } {
    if (
      !repository.createCardType ||
      !repository.updateCardType ||
      !repository.updateCardTypeSchema ||
      !repository.deleteCardType
    ) {
      throw new V2ServiceError("conflict", "V2 card type schema repository is not available");
    }

    return {
      createCardType: repository.createCardType.bind(repository),
      updateCardType: repository.updateCardType.bind(repository),
      updateCardTypeSchema: repository.updateCardTypeSchema.bind(repository),
      deleteCardType: repository.deleteCardType.bind(repository)
    };
  }

  function requireCardLibraryRepository() {
    if (
      !repository.listCardLibraryEntries ||
      !repository.getCardLibraryEntry ||
      !repository.createCardLibraryEntry ||
      !repository.updateCardLibraryEntry ||
      !repository.deleteCardLibraryEntry ||
      !repository.setCardLibraryEntry
    ) {
      throw new V2ServiceError("conflict", "V2 card library repository is not available");
    }

    return {
      listCardLibraryEntries: repository.listCardLibraryEntries.bind(repository),
      getCardLibraryEntry: repository.getCardLibraryEntry.bind(repository),
      createCardLibraryEntry: repository.createCardLibraryEntry.bind(repository),
      updateCardLibraryEntry: repository.updateCardLibraryEntry.bind(repository),
      deleteCardLibraryEntry: repository.deleteCardLibraryEntry.bind(repository),
      setCardLibraryEntry: repository.setCardLibraryEntry.bind(repository)
    };
  }

  function requireDashboardRepository() {
    if (
      !repository.bootstrapPersonalWorkspace ||
      !repository.listUserWorkspaces ||
      !repository.listWorkspaceBoards ||
      !repository.createBoard ||
      !repository.updateBoard ||
      !repository.duplicateBoard ||
      !repository.deleteBoard
    ) {
      throw new V2ServiceError("storage_unavailable", "V2 dashboard repository is not available");
    }
    return {
      bootstrapPersonalWorkspace: repository.bootstrapPersonalWorkspace.bind(repository),
      listUserWorkspaces: repository.listUserWorkspaces.bind(repository),
      listWorkspaceBoards: repository.listWorkspaceBoards.bind(repository),
      createBoard: repository.createBoard.bind(repository),
      updateBoard: repository.updateBoard.bind(repository),
      duplicateBoard: repository.duplicateBoard.bind(repository),
      deleteBoard: repository.deleteBoard.bind(repository)
    };
  }

  function requireConnectionTypeRepository(): {
    listConnectionTypes(workspaceId: string): Promise<V2ConnectionType[]>;
    getConnectionType(connectionTypeId: string): Promise<V2ConnectionType | null>;
    createConnectionType(input: Parameters<NonNullable<V2Repository["createConnectionType"]>>[0]): Promise<V2ConnectionType>;
    updateConnectionType(
      connectionTypeId: string,
      input: Parameters<NonNullable<V2Repository["updateConnectionType"]>>[1]
    ): Promise<V2ConnectionType | null>;
  } {
    if (
      !repository.listConnectionTypes ||
      !repository.getConnectionType ||
      !repository.createConnectionType ||
      !repository.updateConnectionType
    ) {
      throw new V2ServiceError("conflict", "V2 connection type repository is not available");
    }

    return {
      listConnectionTypes: repository.listConnectionTypes.bind(repository),
      getConnectionType: repository.getConnectionType.bind(repository),
      createConnectionType: repository.createConnectionType.bind(repository),
      updateConnectionType: repository.updateConnectionType.bind(repository)
    };
  }

  async function resolveConnectionTypeId(
    workspaceId: string,
    connectionTypeId: string | null | undefined,
    options: { useGenericFallback: boolean }
  ): Promise<string | null> {
    const connectionTypeRepository = requireConnectionTypeRepository();
    if (connectionTypeId !== undefined) {
      if (connectionTypeId === null) return null;

      const connectionType = await connectionTypeRepository.getConnectionType(connectionTypeId);
      if (!connectionType || connectionType.workspaceId !== workspaceId) {
        validationFailed("Connection type does not belong to the board workspace");
      }
      return connectionType.id;
    }

    if (!options.useGenericFallback) return null;

    const generic = (await connectionTypeRepository.listConnectionTypes(workspaceId)).find(
      (connectionType) => connectionType.key === "generic"
    );
    return generic?.id ?? null;
  }

  function createDefaultConnectionTitle(
    typeName: string,
    connections: V2Connection[]
  ): string {
    const usedTitles = new Set(
      connections
        .map((connection) => connection.title?.trim().toLowerCase())
        .filter((title): title is string => Boolean(title))
    );
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 3).toUpperCase();
      const title = `${typeName} ${suffix}`;
      if (!usedTitles.has(title.toLowerCase())) return title;
    }
    return `${typeName} ${Date.now().toString(36).slice(-3).toUpperCase()}`;
  }

  async function requireBoardForAccess(
    context: RequestContext,
    boardId: string,
    accessLevel: V2AccessLevel
  ) {
    const board = await repository.getBoard(boardId);
    if (!board) {
      notFound("Board not found");
    }
    await authorizeWorkspace(context, board.workspaceId, accessLevel);
    return board;
  }

  async function requireCardOnBoard(cardId: string, boardId: string, label: string): Promise<V2Card> {
    const card = await repository.getCard(cardId);
    if (!card || card.boardId !== boardId) {
      notFound(`${label} card not found on board`);
    }
    return card;
  }

  async function ensureCardTypeKeyUnique(
    workspaceId: string,
    key: string,
    existingCardTypeId?: string
  ) {
    const cardTypes = await repository.listCardTypes(workspaceId);
    if (cardTypes.some((cardType) => cardType.key === key && cardType.id !== existingCardTypeId)) {
      throw new V2ServiceError("conflict", "Card type key already exists");
    }
  }

  async function ensureConnectionTypeKeyUnique(
    workspaceId: string,
    key: string,
    existingConnectionTypeId?: string
  ) {
    const connectionTypes = await requireConnectionTypeRepository().listConnectionTypes(workspaceId);
    if (
      connectionTypes.some(
        (connectionType) => connectionType.key === key && connectionType.id !== existingConnectionTypeId
      )
    ) {
      throw new V2ServiceError("conflict", "Connection type key already exists");
    }
  }

  async function validateLinkedFieldBindingInput(
    boardId: string,
    workspaceId: string,
    input: {
      targetCardId: string;
      sourceMode: "exactCard" | "connectedCard";
      sourceCardId?: string | null;
      sourceCardTypeId?: string | null;
    }
  ) {
    await requireCardOnBoard(input.targetCardId, boardId, "Target");

    if (input.sourceMode === "exactCard" && !input.sourceCardId) {
      validationFailed("Exact card mode requires sourceCardId");
    }

    if (input.sourceCardId) {
      await requireCardOnBoard(input.sourceCardId, boardId, "Source");
    }

    if (input.sourceCardTypeId) {
      const cardType = await repository.getCardType(input.sourceCardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        validationFailed("Source card type does not belong to the board workspace");
      }
    }
  }

  return {
    async bootstrapSession(context, rawInput) {
      const parsedInput = v2BootstrapSessionBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid authenticated user profile");
      const input: V2BootstrapUserInput = {
        userId: context.userId,
        email: parsedInput.data.email,
        name: parsedInput.data.name,
        avatarUrl: parsedInput.data.avatarUrl,
        authProvider: parsedInput.data.authProvider,
        demoBoardId: v2DemoIds.board
      };
      return requireDashboardRepository().bootstrapPersonalWorkspace(input);
    },

    async listWorkspaces(context) {
      await requireCurrentLegalAcceptance(context);
      return {
        workspaces: await requireDashboardRepository().listUserWorkspaces(context.userId)
      };
    },

    async listWorkspaceBoards(context, workspaceId) {
      await authorizeWorkspace(context, workspaceId, "read");
      return {
        boards: await requireDashboardRepository().listWorkspaceBoards(workspaceId)
      };
    },

    async createBoard(context, workspaceId, rawInput) {
      const parsedInput = v2CreateBoardBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid board payload");
      await authorizeWorkspace(context, workspaceId, "write");
      return requireDashboardRepository().createBoard(workspaceId, parsedInput.data.name);
    },

    async updateBoard(context, boardId, rawInput) {
      const parsedInput = v2UpdateBoardBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid board update payload");
      await requireBoardForAccess(context, boardId, "write");
      const board = await requireDashboardRepository().updateBoard(boardId, parsedInput.data);
      if (!board) notFound("Board not found");
      return board;
    },

    async duplicateBoard(context, boardId, rawInput) {
      const parsedInput = v2DuplicateBoardBodySchema.safeParse(rawInput ?? {});
      if (!parsedInput.success) validationFailed("Invalid board duplicate payload");
      await requireBoardForAccess(context, boardId, "write");
      const board = await requireDashboardRepository().duplicateBoard(boardId, parsedInput.data);
      if (!board) notFound("Board not found");
      return board;
    },

    async deleteBoard(context, boardId) {
      await requireBoardForAccess(context, boardId, "manage");
      if (!(await requireDashboardRepository().deleteBoard(boardId))) notFound("Board not found");
      return { deleted: true, id: boardId };
    },

    async exportBoard(context, boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) notFound("Board not found");
      await authorizeWorkspace(context, board.workspace.id, "read");
      const fieldBindings = repository.listLinkedFieldBindings
        ? await repository.listLinkedFieldBindings(boardId)
        : [];
      const cardAttachments = Object.fromEntries(
        await Promise.all(
          board.cards.map(async (card) => [
            card.id,
            repository.listCardAttachments ? await repository.listCardAttachments(card.id) : []
          ])
        )
      );
      const connectionAttachments = Object.fromEntries(
        await Promise.all(
          board.connections.map(async (connection) => [
            connection.id,
            repository.listConnectionAttachments
              ? await repository.listConnectionAttachments(connection.id)
              : []
          ])
        )
      );
      return {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        board,
        fieldBindings,
        cardAttachments,
        connectionAttachments,
        attachmentPolicy: "metadata-only"
      };
    },

    async deleteAccount(context) {
      if (!repository.deleteUserData) {
        throw new V2ServiceError("storage_unavailable", "Account deletion is unavailable");
      }
      if (!(await repository.deleteUserData(context.userId))) notFound("Account not found");
      return { deleted: true, id: context.userId };
    },

    async getLegalAcceptance(context) {
      if (!repository.getLegalAcceptance) {
        throw new V2ServiceError("storage_unavailable", "Legal acceptance storage is unavailable");
      }
      return repository.getLegalAcceptance(context.userId);
    },

    async acceptLegalTerms(context, rawInput) {
      const parsed = z.object({
        termsAccepted: z.literal(true),
        personalDataConsentAccepted: z.literal(true),
        ageConfirmed: z.literal(true),
        userAgent: z.string().trim().max(512).nullable().default(null)
      }).strict().safeParse(rawInput);
      if (!parsed.success) validationFailed("All required legal confirmations must be accepted");
      if (!repository.recordLegalAcceptance) {
        throw new V2ServiceError("storage_unavailable", "Legal acceptance storage is unavailable");
      }
      return repository.recordLegalAcceptance({
        userId: context.userId,
        source: "web",
        userAgent: parsed.data.userAgent
      });
    },

    async getBoard(context, boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspace.id, "read");

      return board;
    },

    async getSemanticGraph(context, boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) notFound("Board not found");
      await authorizeWorkspace(context, board.workspace.id, "read");

      return buildV2SemanticGraph(
        board,
        createSemanticGraphRevision(board),
        new Date().toISOString()
      );
    },

    async evaluateBoardCalculations(context, boardId, rawInput = {}) {
      const parsedInput = v2EvaluateCalculationsBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid calculation input");

      const board = await repository.getBoardDetail(boardId);
      if (!board) notFound("Board not found");
      await authorizeWorkspace(context, board.workspace.id, "read");

      const cardIds = new Set(board.cards.map((card) => card.id));
      if (parsedInput.data.overrides.some((override) => !cardIds.has(override.cardId))) {
        validationFailed("Calculation override references a card outside the board");
      }

      return evaluateV2QuantitativeGraph(board, {
        graphRevision: createSemanticGraphRevision(board),
        computedAt: new Date().toISOString(),
        overrides: parsedInput.data.overrides
      });
    },

    async updateBoardLayout(context, boardId, rawInput) {
      const input = v2UpdateBoardLayoutBodySchema.safeParse(rawInput);
      if (!input.success) validationFailed("Invalid board layout payload");
      await requireBoardForAccess(context, boardId, "write");
      if (!repository.updateBoardLayout) {
        throw new V2ServiceError("conflict", "Board layout updates are unavailable");
      }
      const result = await repository.updateBoardLayout(boardId, input.data);
      if (!result) conflict("Board layout contains missing or stale items");
      return result;
    },

    async listCardTypes(context, workspaceId) {
      await authorizeWorkspace(context, workspaceId, "read");
      return { cardTypes: await repository.listCardTypes(workspaceId) };
    },

    async createCardType(context, boardId, rawInput) {
      const parsedInput = v2CreateCardTypeBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid card type payload");
      }

      const board = await requireBoardForAccess(context, boardId, "write");
      await ensureCardTypeKeyUnique(board.workspaceId, parsedInput.data.key);

      return requireCardTypeSchemaRepository().createCardType({
        workspaceId: board.workspaceId,
        key: parsedInput.data.key,
        name: parsedInput.data.name,
        description: parsedInput.data.description ?? "",
        schema: parsedInput.data.schema,
        defaultSize: parsedInput.data.defaultSize ?? { width: 300, height: 180 },
        defaultVisualStyle: parsedInput.data.defaultVisualStyle,
        ports: parsedInput.data.ports
      });
    },

    async updateCardType(context, boardId, cardTypeId, rawInput) {
      const parsedInput = v2UpdateCardTypeBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid card type payload");
      }

      const board = await requireBoardForAccess(context, boardId, "write");
      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType) {
        notFound("Card type not found");
      }
      if (cardType.workspaceId !== board.workspaceId) {
        validationFailed("Card type does not belong to the board workspace");
      }
      if (parsedInput.data.key !== undefined) {
        await ensureCardTypeKeyUnique(board.workspaceId, parsedInput.data.key, cardType.id);
      }

      const updated = await requireCardTypeSchemaRepository().updateCardType(
        cardType.id,
        parsedInput.data
      );
      if (!updated) {
        notFound("Card type not found");
      }

      return updated;
    },

    async updateCardTypeSchema(context, boardId, cardTypeId, rawInput) {
      const parsedInput = v2UpdateCardTypeSchemaBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid card type schema payload");
      }
      const board = await requireBoardForAccess(context, boardId, "write");
      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType) {
        notFound("Card type not found");
      }
      if (cardType.workspaceId !== board.workspaceId) {
        validationFailed("Card type does not belong to the board workspace");
      }

      const updated = await requireCardTypeSchemaRepository().updateCardTypeSchema(
        cardType.id,
        parsedInput.data.schema
      );
      if (!updated) {
        notFound("Card type not found");
      }

      return updated;
    },

    async deleteCardType(context, boardId, cardTypeId) {
      const board = await requireBoardForAccess(context, boardId, "write");
      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType) {
        notFound("Card type not found");
      }
      if (cardType.workspaceId !== board.workspaceId) {
        validationFailed("Card type does not belong to the board workspace");
      }

      const result = await requireCardTypeSchemaRepository().deleteCardType(cardType.id);
      if (result.status === "not_found") {
        notFound("Card type not found");
      }
      if (result.status === "in_use") {
        const reasons = [
          result.cardCount > 0
            ? `${result.cardCount} ${result.cardCount === 1 ? "card" : "cards"}`
            : null,
          result.libraryEntryCount > 0
            ? `${result.libraryEntryCount} library ${
                result.libraryEntryCount === 1 ? "entry" : "entries"
              }`
            : null
        ].filter(Boolean);
        conflict(
          `Cannot delete this type because it is used by ${reasons.join(" and ")}. ` +
            "Delete or retype the cards and remove the library entries first."
        );
      }

      return { deleted: true, id: cardType.id };
    },

    async listCardLibraryEntries(context, workspaceId, cardTypeId, rawQuery) {
      requireV2Uuid(workspaceId, "workspace ID");
      requireV2Uuid(cardTypeId, "card type ID");
      const parsedQuery = v2ListCardLibraryEntriesQuerySchema.safeParse(rawQuery);
      if (!parsedQuery.success) validationFailed("Invalid card library query");
      await authorizeWorkspace(context, workspaceId, "read");

      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        notFound("Card type not found");
      }
      const page = await requireCardLibraryRepository().listCardLibraryEntries(
        workspaceId,
        cardTypeId,
        parsedQuery.data
      );
      if (!page) validationFailed("Invalid card library pagination cursor");
      return {
        entries: page.entries.map((entry) => decorateCardLibraryEntry(entry, cardType)),
        nextCursor: page.nextCursor
      };
    },

    async getCardLibraryEntry(context, workspaceId, cardTypeId, libraryEntryId) {
      requireV2Uuid(workspaceId, "workspace ID");
      requireV2Uuid(cardTypeId, "card type ID");
      requireV2Uuid(libraryEntryId, "card library entry ID");
      await authorizeWorkspace(context, workspaceId, "read");
      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        notFound("Card type not found");
      }
      const entry = await requireCardLibraryRepository().getCardLibraryEntry(libraryEntryId);
      if (
        !entry ||
        entry.workspaceId !== workspaceId ||
        entry.cardTypeId !== cardTypeId
      ) {
        notFound("Card library entry not found");
      }
      return decorateCardLibraryEntry(entry, cardType);
    },

    async createCardLibraryEntry(context, workspaceId, cardTypeId, rawInput) {
      requireV2Uuid(workspaceId, "workspace ID");
      requireV2Uuid(cardTypeId, "card type ID");
      const parsedInput = v2CreateCardLibraryEntryBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid card library entry payload");
      await authorizeWorkspace(context, workspaceId, "write");

      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        notFound("Card type not found");
      }
      const issues = validateCardLibraryEntryData(cardType, parsedInput.data.data);
      rejectInvalidCardLibraryEntryData(issues);
      const entry = await requireCardLibraryRepository().createCardLibraryEntry({
        workspaceId,
        cardTypeId,
        ...parsedInput.data
      });
      return decorateCardLibraryEntry(entry, cardType);
    },

    async updateCardLibraryEntry(
      context,
      workspaceId,
      cardTypeId,
      libraryEntryId,
      rawInput
    ) {
      requireV2Uuid(workspaceId, "workspace ID");
      requireV2Uuid(cardTypeId, "card type ID");
      requireV2Uuid(libraryEntryId, "card library entry ID");
      const parsedInput = v2UpdateCardLibraryEntryBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid card library entry payload");
      await authorizeWorkspace(context, workspaceId, "write");

      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        notFound("Card type not found");
      }
      const cardLibraryRepository = requireCardLibraryRepository();
      const existing = await cardLibraryRepository.getCardLibraryEntry(libraryEntryId);
      if (
        !existing ||
        existing.workspaceId !== workspaceId ||
        existing.cardTypeId !== cardTypeId
      ) {
        notFound("Card library entry not found");
      }
      const issues = validateCardLibraryEntryData(
        cardType,
        parsedInput.data.data ?? existing.data
      );
      rejectInvalidCardLibraryEntryData(issues);

      const result = await cardLibraryRepository.updateCardLibraryEntry(
        libraryEntryId,
        parsedInput.data
      );
      if (result.status === "not_found") notFound("Card library entry not found");
      if (result.status === "version_conflict") {
        conflict("Card library entry was changed elsewhere. Reload it and try again.");
      }
      return decorateCardLibraryEntry(result.entry, cardType);
    },

    async deleteCardLibraryEntry(
      context,
      workspaceId,
      cardTypeId,
      libraryEntryId,
      rawQuery
    ) {
      requireV2Uuid(workspaceId, "workspace ID");
      requireV2Uuid(cardTypeId, "card type ID");
      requireV2Uuid(libraryEntryId, "card library entry ID");
      const parsedQuery = v2DeleteCardLibraryEntryQuerySchema.safeParse(rawQuery);
      if (!parsedQuery.success) validationFailed("Invalid card library delete request");
      await authorizeWorkspace(context, workspaceId, "manage");

      const cardType = await repository.getCardType(cardTypeId);
      if (!cardType || cardType.workspaceId !== workspaceId) {
        notFound("Card type not found");
      }
      const cardLibraryRepository = requireCardLibraryRepository();
      const existing = await cardLibraryRepository.getCardLibraryEntry(libraryEntryId);
      if (
        !existing ||
        existing.workspaceId !== workspaceId ||
        existing.cardTypeId !== cardTypeId
      ) {
        notFound("Card library entry not found");
      }
      const result = await cardLibraryRepository.deleteCardLibraryEntry(
        libraryEntryId,
        parsedQuery.data.expectedVersion
      );
      if (result.status === "not_found") notFound("Card library entry not found");
      if (result.status === "version_conflict") {
        conflict("Card library entry was changed elsewhere. Reload it and try again.");
      }
      if (result.status === "in_use") {
        conflict(
          `Cannot delete this library entry because it is used by ${result.usageCount} ${
            result.usageCount === 1 ? "card" : "cards"
          }. Replace or unlink those cards first.`
        );
      }
      return { deleted: true, id: libraryEntryId };
    },

    async listConnectionTypes(context, boardId) {
      const board = await requireBoardForAccess(context, boardId, "read");
      return {
        connectionTypes: await requireConnectionTypeRepository().listConnectionTypes(board.workspaceId)
      };
    },

    async createConnectionType(context, boardId, rawInput) {
      const parsedInput = v2CreateConnectionTypeBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid connection type payload");
      }

      const board = await requireBoardForAccess(context, boardId, "write");
      await ensureConnectionTypeKeyUnique(board.workspaceId, parsedInput.data.key);

      return requireConnectionTypeRepository().createConnectionType({
        workspaceId: board.workspaceId,
        key: parsedInput.data.key,
        name: parsedInput.data.name,
        description: parsedInput.data.description ?? null,
        schema: parsedInput.data.schema,
        defaultVisualStyle: parsedInput.data.defaultVisualStyle
      });
    },

    async updateConnectionType(context, boardId, connectionTypeId, rawInput) {
      const parsedInput = v2UpdateConnectionTypeBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid connection type payload");
      }

      const board = await requireBoardForAccess(context, boardId, "write");
      const connectionTypeRepository = requireConnectionTypeRepository();
      const connectionType = await connectionTypeRepository.getConnectionType(connectionTypeId);
      if (!connectionType) {
        notFound("Connection type not found");
      }
      if (connectionType.workspaceId !== board.workspaceId) {
        validationFailed("Connection type does not belong to the board workspace");
      }
      if (parsedInput.data.key !== undefined) {
        await ensureConnectionTypeKeyUnique(board.workspaceId, parsedInput.data.key, connectionType.id);
      }

      const updated = await connectionTypeRepository.updateConnectionType(
        connectionType.id,
        parsedInput.data
      );
      if (!updated) {
        notFound("Connection type not found");
      }

      return updated;
    },

    async listLinkedFieldBindings(context, boardId) {
      await requireBoardForAccess(context, boardId, "read");
      const bindingRepository = requireLinkedFieldBindingRepository();
      return {
        fieldBindings: await bindingRepository.listLinkedFieldBindings(boardId)
      };
    },

    async createLinkedFieldBinding(context, boardId, rawInput) {
      const parsedInput = v2CreateLinkedFieldBindingBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid linked field binding payload");
      }
      const input = parsedInput.data;
      const board = await requireBoardForAccess(context, boardId, "write");
      await validateLinkedFieldBindingInput(board.id, board.workspaceId, input);
      const bindingRepository = requireLinkedFieldBindingRepository();

      return bindingRepository.createLinkedFieldBinding({
        workspaceId: board.workspaceId,
        boardId: board.id,
        targetCardId: input.targetCardId,
        targetField: input.targetField,
        sourceMode: input.sourceMode,
        direction: input.direction,
        sourceCardId: input.sourceCardId ?? null,
        sourceCardTypeId: input.sourceCardTypeId ?? null,
        sourceCardTypeKey: input.sourceCardTypeKey ?? null,
        sourceFieldPath: input.sourceFieldPath,
        onMissing: input.onMissing,
        onMultiple: input.onMultiple,
        status: "active"
      });
    },

    async updateLinkedFieldBinding(context, boardId, bindingId, rawInput) {
      const parsedInput = v2UpdateLinkedFieldBindingBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid linked field binding update payload");
      }
      const input = parsedInput.data;
      const board = await requireBoardForAccess(context, boardId, "write");
      const bindingRepository = requireLinkedFieldBindingRepository();
      const existing = await bindingRepository.getLinkedFieldBinding(bindingId);
      if (!existing || existing.boardId !== board.id) {
        notFound("Linked field binding not found");
      }

      const next = {
        targetCardId: input.targetCardId ?? existing.targetCardId,
        sourceMode: input.sourceMode ?? existing.sourceMode,
        sourceCardId: input.sourceCardId !== undefined ? input.sourceCardId : existing.sourceCardId ?? null,
        sourceCardTypeId:
          input.sourceCardTypeId !== undefined ? input.sourceCardTypeId : existing.sourceCardTypeId ?? null
      };
      await validateLinkedFieldBindingInput(board.id, board.workspaceId, next);

      const updated = await bindingRepository.updateLinkedFieldBinding(bindingId, input);
      if (!updated) {
        notFound("Linked field binding not found");
      }

      return updated;
    },

    async deleteLinkedFieldBinding(context, boardId, bindingId) {
      const board = await requireBoardForAccess(context, boardId, "write");
      const bindingRepository = requireLinkedFieldBindingRepository();
      const existing = await bindingRepository.getLinkedFieldBinding(bindingId);
      if (!existing || existing.boardId !== board.id) {
        notFound("Linked field binding not found");
      }
      const deleted = await bindingRepository.deleteLinkedFieldBinding(bindingId);
      if (!deleted) {
        notFound("Linked field binding not found");
      }

      return { deleted: true, id: bindingId };
    },

    async runBoardDryRun(context, boardId, rawInput = {}) {
      const input = v2RunDryRunBodySchema.parse(rawInput);
      const detail = await repository.getBoardDetail(boardId);
      if (!detail) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, detail.workspace.id, "read");

      const cardById = new Map(detail.cards.map((card) => [card.id, card]));
      const typeById = new Map(detail.cardTypes.map((cardType) => [cardType.id, cardType]));
      const startCardId = input.startCardId ?? detail.cards[0]?.id;
      const warnings: string[] = [];

      if (!startCardId) {
        return {
          ok: true,
          mode: "dry-run",
          boardId: detail.board.id,
          steps: [],
          warnings: ["Board has no cards to dry-run"]
        };
      }

      if (!cardById.has(startCardId)) {
        notFound("Start card not found on board");
      }

      const outgoingByCardId = new Map<string, V2Connection[]>();
      for (const connection of detail.connections.filter((item) => item.status === "active")) {
        const outgoing = outgoingByCardId.get(connection.sourceCardId) ?? [];
        outgoing.push(connection);
        outgoingByCardId.set(connection.sourceCardId, outgoing);
      }
      for (const outgoing of outgoingByCardId.values()) {
        outgoing.sort((a, b) => compareDryRunConnection(a, b, cardById));
      }

      const visited = new Set<string>();
      const queued = new Set<string>([startCardId]);
      const queue = [startCardId];
      const steps: V2DryRunResult["steps"] = [];

      while (queue.length > 0) {
        const currentCardId = queue.shift()!;
        queued.delete(currentCardId);
        if (visited.has(currentCardId)) continue;

        const card = cardById.get(currentCardId);
        if (!card) continue;

        visited.add(currentCardId);
        steps.push({
          cardId: card.id,
          title: card.title,
          type: typeById.get(card.cardTypeId)?.key ?? "unknown",
          status: "would_run",
          message: "Would process this card"
        });

        const outgoing = outgoingByCardId.get(currentCardId) ?? [];
        if (outgoing.length === 0) {
          warnings.push(`No outgoing connections from "${card.title}"`);
          continue;
        }

        for (const connection of outgoing) {
          const target = cardById.get(connection.targetCardId);
          if (!target) continue;

          if (visited.has(target.id)) {
            warnings.push(`Cycle detected: "${card.title}" -> "${target.title}"`);
            continue;
          }

          if (!queued.has(target.id)) {
            queue.push(target.id);
            queued.add(target.id);
          }
        }
      }

      return {
        ok: true,
        mode: "dry-run",
        boardId: detail.board.id,
        startCardId,
        steps,
        warnings
      };
    },

    async createCard(context, boardId, rawInput) {
      const input = v2CreateCardBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspaceId, "write");

      const cardType = await repository.getCardType(input.cardTypeId);
      if (!cardType) {
        notFound("Card type not found");
      }

      if (cardType.workspaceId !== board.workspaceId) {
        validationFailed("Card type does not belong to the board workspace");
      }

      let libraryEntry: V2CardLibraryEntry | null = null;
      if (input.libraryEntryId) {
        const entry = await requireCardLibraryRepository().getCardLibraryEntry(
          input.libraryEntryId
        );
        if (
          !entry ||
          entry.workspaceId !== board.workspaceId ||
          entry.cardTypeId !== cardType.id
        ) {
          validationFailed("Card library entry does not belong to this card type");
        }
        libraryEntry = decorateCardLibraryEntry(entry, cardType);
        if (!libraryEntry.selectable) {
          validationFailed("Card library entry is archived or incomplete");
        }
      }

      try {
        return await repository.createCard({
          workspaceId: board.workspaceId,
          boardId: board.id,
          cardTypeId: cardType.id,
          libraryEntryId: libraryEntry?.id ?? null,
          title: libraryEntry?.title ?? input.title ?? cardType.name,
          description: libraryEntry?.description ?? input.description ?? "",
          data: cloneJson(libraryEntry?.data ?? input.data ?? {}),
          position: input.position ?? { x: 0, y: 0 },
          size: input.size ?? cardType.defaultSize,
          visualStyle: cloneJson(input.visualStyle ?? {}),
          status: input.status ?? "active"
        });
      } catch (error) {
        if (libraryEntry && isForeignKeyViolation(error)) {
          validationFailed("Card library entry is unavailable for this card");
        }
        throw error;
      }
    },

    async duplicateCard(context, cardId) {
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");

      if (!repository.duplicateCard) {
        throw new V2ServiceError("conflict", "V2 duplicate repository is not available");
      }

      const duplicated = await repository.duplicateCard(cardId);
      if (!duplicated) {
        notFound("Card not found");
      }

      return duplicated;
    },

    async updateCard(context, cardId, rawInput) {
      const input = v2UpdateCardBodySchema.parse(rawInput);
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      if (
        existing.libraryEntryId &&
        (input.title !== undefined || input.description !== undefined || input.data !== undefined)
      ) {
        conflict(
          "Linked card content is managed by its library entry. Replace or unlink the entry first."
        );
      }
      const card = await repository.updateCard(cardId, input);
      if (!card) {
        notFound("Card not found");
      }

      return card;
    },

    async setCardLibraryEntry(context, cardId, rawInput) {
      requireV2Uuid(cardId, "card ID");
      const parsedInput = v2SetCardLibraryEntryBodySchema.safeParse(rawInput);
      if (!parsedInput.success) validationFailed("Invalid card library selection payload");

      const existing = await repository.getCard(cardId);
      if (!existing) notFound("Card not found");
      await authorizeWorkspace(context, existing.workspaceId, "write");

      if (parsedInput.data.libraryEntryId !== null) {
        const entry = await requireCardLibraryRepository().getCardLibraryEntry(
          parsedInput.data.libraryEntryId
        );
        if (
          !entry ||
          entry.workspaceId !== existing.workspaceId ||
          entry.cardTypeId !== existing.cardTypeId
        ) {
          validationFailed("Card library entry does not belong to this card type");
        }
        const cardType = await repository.getCardType(existing.cardTypeId);
        if (!cardType) notFound("Card type not found");
        if (!decorateCardLibraryEntry(entry, cardType).selectable) {
          validationFailed("Card library entry is archived or incomplete");
        }
      }

      const result = await requireCardLibraryRepository().setCardLibraryEntry(
        cardId,
        parsedInput.data.libraryEntryId,
        parsedInput.data.expectedLibraryEntryId
      );
      if (result.status === "card_not_found") notFound("Card not found");
      if (result.status === "entry_not_found") {
        validationFailed("Card library entry is unavailable for this card");
      }
      if (result.status === "conflict") {
        conflict("Card library selection was changed elsewhere. Reload the card and try again.");
      }
      return result.card;
    },

    async deleteCard(context, cardId) {
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      const deleted = await repository.deleteCard(cardId);
      if (!deleted) {
        notFound("Card not found");
      }

      return { deleted: true, id: cardId };
    },

    async createConnection(context, boardId, rawInput) {
      const input = v2CreateConnectionBodySchema.parse(rawInput);
      const board = await repository.getBoard(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspaceId, "write");

      if (input.sourceCardId === input.targetCardId) {
        validationFailed("Connection cannot link a card to itself");
      }

      const sourceCard = await repository.getCard(input.sourceCardId);
      const targetCard = await repository.getCard(input.targetCardId);

      if (!sourceCard || sourceCard.boardId !== board.id) {
        notFound("Source card not found on board");
      }

      if (!targetCard || targetCard.boardId !== board.id) {
        notFound("Target card not found on board");
      }

      if (sourceCard.workspaceId !== board.workspaceId || targetCard.workspaceId !== board.workspaceId) {
        validationFailed("Connection cards must belong to the board workspace");
      }

      const sourceType = await repository.getCardType(sourceCard.cardTypeId);
      const targetType = await repository.getCardType(targetCard.cardTypeId);

      if (!sourceType) {
        notFound("Source card type not found");
      }

      if (!targetType) {
        notFound("Target card type not found");
      }

      if (!isValidConnectionPort(sourceCard, sourceType, input.sourcePortKey, "source")) {
        validationFailed("Source port is not a valid output connector on the source card");
      }

      if (!isValidConnectionPort(targetCard, targetType, input.targetPortKey, "target")) {
        validationFailed("Target port is not a valid input connector on the target card");
      }

      const connectionTypeId = await resolveConnectionTypeId(board.workspaceId, input.connectionTypeId, {
        useGenericFallback: true
      });
      const connectionType = connectionTypeId
        ? await requireConnectionTypeRepository().getConnectionType(connectionTypeId)
        : null;
      const detail = await repository.getBoardDetail(board.id);
      const duplicate = detail?.connections.some(
        (connection) =>
          connection.sourceCardId === input.sourceCardId &&
          connection.targetCardId === input.targetCardId &&
          connection.sourcePortKey === input.sourcePortKey &&
          connection.targetPortKey === input.targetPortKey &&
          (connectionTypeId
            ? connection.connectionTypeId === connectionTypeId
            : connection.connectionTypeId === null && connection.type === input.type)
      );
      if (duplicate) {
        conflict("Connection already exists");
      }

      const data = {
        ...buildV2ConnectionDefaultData(connectionType),
        ...cloneJson(input.data ?? {})
      };
      const dataValidation = validateV2ConnectionData(connectionType, data);
      if (dataValidation.validity === "invalid") {
        validationFailed(dataValidation.issues[0]?.message ?? "Invalid connection data");
      }
      const title =
        input.title ??
        createDefaultConnectionTitle(connectionType?.name ?? "Connector", detail?.connections ?? []);

      try {
        return await repository.createConnection({
          workspaceId: board.workspaceId,
          boardId: board.id,
          connectionTypeId,
          sourceCardId: input.sourceCardId,
          targetCardId: input.targetCardId,
          sourcePortKey: input.sourcePortKey,
          targetPortKey: input.targetPortKey,
          type: input.type,
          label: input.label,
          title,
          data,
          visualStyle: input.visualStyle ?? connectionType?.defaultVisualStyle ?? {},
          status: dataValidation.validity === "incomplete" ? "draft" : "active"
        });
      } catch (error) {
        if (isUniqueViolation(error)) conflict("Connection already exists");
        throw error;
      }
    },

    async updateConnection(context, connectionId, rawInput) {
      const parsedInput = v2UpdateConnectionBodySchema.safeParse(rawInput);
      if (!parsedInput.success) {
        validationFailed("Invalid connection update payload");
      }
      const input = parsedInput.data;
      const existing = await repository.getConnection(connectionId);
      if (!existing) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");

      if (!repository.updateConnection) {
        throw new V2ServiceError("conflict", "V2 connection update repository is not available");
      }

      const nextConnectionTypeId =
        input.connectionTypeId !== undefined
          ? await resolveConnectionTypeId(existing.workspaceId, input.connectionTypeId, {
              useGenericFallback: false
            })
          : existing.connectionTypeId;
      const connectionTypeChanged = nextConnectionTypeId !== existing.connectionTypeId;
      const nextConnectionType = nextConnectionTypeId
        ? await requireConnectionTypeRepository().getConnectionType(nextConnectionTypeId)
        : null;
      if (nextConnectionTypeId && !nextConnectionType) {
        validationFailed("Connection type does not belong to the board workspace");
      }
      const nextData = connectionTypeChanged
        ? {
            ...buildV2ConnectionDefaultData(nextConnectionType),
            ...cloneJson(existing.data),
            ...cloneJson(input.data ?? {})
          }
        : cloneJson(input.data ?? existing.data);
      const dataValidation = validateV2ConnectionData(nextConnectionType, nextData);
      if (dataValidation.validity === "invalid" && !connectionTypeChanged) {
        validationFailed(dataValidation.issues[0]?.message ?? "Invalid connection data");
      }
      const nextStatus = existing.status === "disabled"
        ? "disabled"
        : dataValidation.validity !== "valid"
          ? "draft"
          : "active";

      const nextEndpoint = {
        sourceCardId: input.sourceCardId ?? existing.sourceCardId,
        targetCardId: input.targetCardId ?? existing.targetCardId,
        sourcePortKey: input.sourcePortKey ?? existing.sourcePortKey,
        targetPortKey: input.targetPortKey ?? existing.targetPortKey,
        type: existing.type
      };
      const endpointChanged =
        nextEndpoint.sourceCardId !== existing.sourceCardId ||
        nextEndpoint.targetCardId !== existing.targetCardId ||
        nextEndpoint.sourcePortKey !== existing.sourcePortKey ||
        nextEndpoint.targetPortKey !== existing.targetPortKey;

      if (endpointChanged) {
        const board = await repository.getBoard(existing.boardId);
        if (!board) {
          notFound("Board not found");
        }
        if (nextEndpoint.sourceCardId === nextEndpoint.targetCardId) {
          validationFailed("Connection cannot link a card to itself");
        }

        const sourceCard = await repository.getCard(nextEndpoint.sourceCardId);
        const targetCard = await repository.getCard(nextEndpoint.targetCardId);
        if (!sourceCard || sourceCard.boardId !== existing.boardId) {
          notFound("Source card not found on board");
        }
        if (!targetCard || targetCard.boardId !== existing.boardId) {
          notFound("Target card not found on board");
        }
        if (sourceCard.workspaceId !== existing.workspaceId || targetCard.workspaceId !== existing.workspaceId) {
          validationFailed("Connection cards must belong to the board workspace");
        }

        const sourceType = await repository.getCardType(sourceCard.cardTypeId);
        const targetType = await repository.getCardType(targetCard.cardTypeId);
        if (!sourceType) {
          notFound("Source card type not found");
        }
        if (!targetType) {
          notFound("Target card type not found");
        }

        if (!isValidConnectionPort(sourceCard, sourceType, nextEndpoint.sourcePortKey, "source")) {
          validationFailed("Source port is not a valid output connector on the source card");
        }
        if (!isValidConnectionPort(targetCard, targetType, nextEndpoint.targetPortKey, "target")) {
          validationFailed("Target port is not a valid input connector on the target card");
        }

      }

      if (endpointChanged || connectionTypeChanged) {
        const detail = await repository.getBoardDetail(existing.boardId);
        const duplicate = detail?.connections.some(
          (connection) =>
            connection.id !== existing.id &&
            connection.sourceCardId === nextEndpoint.sourceCardId &&
            connection.targetCardId === nextEndpoint.targetCardId &&
            connection.sourcePortKey === nextEndpoint.sourcePortKey &&
            connection.targetPortKey === nextEndpoint.targetPortKey &&
            (nextConnectionTypeId
              ? connection.connectionTypeId === nextConnectionTypeId
              : connection.connectionTypeId === null && connection.type === nextEndpoint.type)
        );
        if (duplicate) {
          conflict("Connection already exists");
        }
      }

      let updated: V2Connection | null;
      try {
        updated = await repository.updateConnection(connectionId, {
          ...input,
          data: nextData,
          status: nextStatus,
          ...(input.connectionTypeId !== undefined ? { connectionTypeId: nextConnectionTypeId } : {})
        });
      } catch (error) {
        if (isUniqueViolation(error)) conflict("Connection already exists");
        throw error;
      }
      if (!updated) {
        notFound("Connection not found");
      }

      return updated;
    },

    async deleteConnection(context, connectionId) {
      const existing = await repository.getConnection(connectionId);
      if (!existing) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "write");
      const deleted = await repository.deleteConnection(connectionId);
      if (!deleted) {
        notFound("Connection not found");
      }

      return { deleted: true, id: connectionId };
    },

    async listCardAttachments(context, cardId) {
      const existing = await repository.getCard(cardId);
      if (!existing) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "read");
      return requireAttachmentRepository().listCardAttachments(cardId);
    },

    async uploadCardAttachment(context, cardId, input) {
      const card = await repository.getCard(cardId);
      if (!card) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, card.workspaceId, "write");

      if (input.body.length === 0) {
        validationFailed("File is empty");
      }
      if (input.body.length > V2_MAX_ATTACHMENT_BYTES) {
        validationFailed("File exceeds 25MB limit");
      }

      const role = (input.role ?? "attachment").trim() || "attachment";
      const fileId = randomUUID();
      const filename = safeFilename(input.filename);
      const storage = requireStorage();
      const storagePath = buildStoragePath(card.workspaceId, card.id, fileId, filename);
      const mimeType = input.mimeType?.trim() || "application/octet-stream";
      const sha256 = sha256Hex(input.body);

      await storage.objectStorage.putObject({
        bucket: storage.bucket,
        key: storagePath,
        body: input.body,
        contentType: mimeType,
        metadata: {
          "yadraw-card-id": card.id,
          "yadraw-file-id": fileId
        }
      });

      try {
        return await requireAttachmentRepository().createCardAttachment({
          fileId,
          cardId: card.id,
          workspaceId: card.workspaceId,
          storageBucket: storage.bucket,
          storagePath,
          filename,
          mimeType,
          sizeBytes: input.body.length,
          sha256,
          role,
          metadata: cloneJson(input.metadata ?? {}),
          createdBy: context.userId
        });
      } catch (error) {
        await storage.objectStorage.deleteObject?.(storage.bucket, storagePath).catch(() => undefined);
        console.warn(
          {
            fileId,
            cardId: card.id,
            storageBucket: storage.bucket,
            storagePath
          },
          "V2 attachment DB insert failed after object upload"
        );
        throw error;
      }
    },

    async downloadFile(context, fileId) {
      const file = await requireAttachmentRepository().getFileForDownload(fileId);
      if (!file) {
        notFound("File not found");
      }
      await authorizeWorkspace(context, file.workspaceId, "read");
      const storage = requireStorage();
      const object = await storage.objectStorage.getObject(file.storageBucket, file.storagePath);

      return {
        filename: file.filename,
        mimeType: file.mimeType ?? object.contentType ?? "application/octet-stream",
        sizeBytes: object.contentLength ?? file.sizeBytes ?? null,
        object
      };
    },

    async detachCardAttachment(context, cardId, attachmentId) {
      const card = await repository.getCard(cardId);
      if (!card) {
        notFound("Card not found");
      }
      await authorizeWorkspace(context, card.workspaceId, "write");
      const deleted = await requireAttachmentRepository().detachCardAttachment(cardId, attachmentId);
      if (!deleted) {
        notFound("Attachment not found");
      }

      return { deleted: true, id: attachmentId };
    },

    async listConnectionAttachments(context, connectionId) {
      const existing = await repository.getConnection(connectionId);
      if (!existing) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, existing.workspaceId, "read");
      return requireAttachmentRepository().listConnectionAttachments(connectionId);
    },

    async uploadConnectionAttachment(context, connectionId, input) {
      const connection = await repository.getConnection(connectionId);
      if (!connection) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, connection.workspaceId, "write");

      if (input.body.length === 0) {
        validationFailed("File is empty");
      }
      if (input.body.length > V2_MAX_ATTACHMENT_BYTES) {
        validationFailed("File exceeds 25MB limit");
      }

      const role = (input.role ?? "attachment").trim() || "attachment";
      const fileId = randomUUID();
      const filename = safeFilename(input.filename);
      const storage = requireStorage();
      const storagePath = buildConnectionStoragePath(
        connection.workspaceId,
        connection.id,
        fileId,
        filename
      );
      const mimeType = input.mimeType?.trim() || "application/octet-stream";
      const sha256 = sha256Hex(input.body);

      await storage.objectStorage.putObject({
        bucket: storage.bucket,
        key: storagePath,
        body: input.body,
        contentType: mimeType,
        metadata: {
          "yadraw-connection-id": connection.id,
          "yadraw-file-id": fileId
        }
      });

      try {
        return await requireAttachmentRepository().createConnectionAttachment({
          fileId,
          connectionId: connection.id,
          workspaceId: connection.workspaceId,
          storageBucket: storage.bucket,
          storagePath,
          filename,
          mimeType,
          sizeBytes: input.body.length,
          sha256,
          role,
          metadata: cloneJson(input.metadata ?? {}),
          createdBy: context.userId
        });
      } catch (error) {
        await storage.objectStorage.deleteObject?.(storage.bucket, storagePath).catch(() => undefined);
        console.warn(
          {
            fileId,
            connectionId: connection.id,
            storageBucket: storage.bucket,
            storagePath
          },
          "V2 connection attachment DB insert failed after object upload"
        );
        throw error;
      }
    },

    async detachConnectionAttachment(context, connectionId, attachmentId) {
      const connection = await repository.getConnection(connectionId);
      if (!connection) {
        notFound("Connection not found");
      }
      await authorizeWorkspace(context, connection.workspaceId, "write");
      const deleted = await requireAttachmentRepository().detachConnectionAttachment(
        connectionId,
        attachmentId
      );
      if (!deleted) {
        notFound("Attachment not found");
      }

      return { deleted: true, id: attachmentId };
    }
  };
}
