import { createHash, randomUUID } from "node:crypto";
import {
  type V2CardAttachment,
  type V2ConnectionAttachment,
  type V2CreateCardTypeRequest,
  type V2CreateLinkedFieldBindingRequest,
  v2CreateCardBodySchema,
  v2CreateCardTypeBodySchema,
  v2CreateConnectionBodySchema,
  v2CreateLinkedFieldBindingBodySchema,
  v2ConnectorSlotSchema,
  v2RunDryRunBodySchema,
  v2UpdateCardTypeSchemaBodySchema,
  v2UpdateCardBodySchema,
  v2UpdateConnectionBodySchema,
  v2UpdateLinkedFieldBindingBodySchema,
  type V2BoardDetail,
  type V2Card,
  type V2CardType,
  type V2ConnectionType,
  type V2CardTypePortInput,
  type V2Connection,
  type V2CreateCardRequest,
  type V2CreateConnectionRequest,
  type V2DryRunResult,
  type V2LinkedFieldBinding,
  type V2RunDryRunRequest,
  type V2UpdateCardTypeRequest,
  type V2UpdateCardRequest,
  v2UpdateCardTypeBodySchema,
  type V2UpdateCardTypeSchemaRequest,
  type V2UpdateConnectionRequest,
  type V2UpdateLinkedFieldBindingRequest
} from "@yadraw/shared";
import type { RequestContext } from "../context.js";
import { hasV2WorkspaceAccess, type V2AccessLevel } from "./policy.js";
import type {
  V2CreateCardAttachmentRecordInput,
  V2CreateConnectionAttachmentRecordInput,
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
  getBoard(context: RequestContext, boardId: string): Promise<V2BoardDetail>;
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

function notFound(message: string): never {
  throw new V2ServiceError("not_found", message);
}

function validationFailed(message: string): never {
  throw new V2ServiceError("validation_failed", message);
}

function conflict(message: string): never {
  throw new V2ServiceError("conflict", message);
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
  async function authorizeWorkspace(context: RequestContext, workspaceId: string, accessLevel: V2AccessLevel) {
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
  } {
    if (!repository.createCardType || !repository.updateCardType || !repository.updateCardTypeSchema) {
      throw new V2ServiceError("conflict", "V2 card type schema repository is not available");
    }

    return {
      createCardType: repository.createCardType.bind(repository),
      updateCardType: repository.updateCardType.bind(repository),
      updateCardTypeSchema: repository.updateCardTypeSchema.bind(repository)
    };
  }

  function requireConnectionTypeRepository(): {
    listConnectionTypes(workspaceId: string): Promise<V2ConnectionType[]>;
    getConnectionType(connectionTypeId: string): Promise<V2ConnectionType | null>;
  } {
    if (!repository.listConnectionTypes || !repository.getConnectionType) {
      throw new V2ServiceError("conflict", "V2 connection type repository is not available");
    }

    return {
      listConnectionTypes: repository.listConnectionTypes.bind(repository),
      getConnectionType: repository.getConnectionType.bind(repository)
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
    async getBoard(context, boardId) {
      const board = await repository.getBoardDetail(boardId);
      if (!board) {
        notFound("Board not found");
      }
      await authorizeWorkspace(context, board.workspace.id, "read");

      return board;
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

      return repository.createCard({
        workspaceId: board.workspaceId,
        boardId: board.id,
        cardTypeId: cardType.id,
        title: input.title ?? cardType.name,
        description: input.description ?? "",
        data: cloneJson(input.data ?? {}),
        position: input.position ?? { x: 0, y: 0 },
        size: input.size ?? cardType.defaultSize,
        visualStyle: cloneJson(input.visualStyle ?? {}),
        status: input.status ?? "active"
      });
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
      const card = await repository.updateCard(cardId, input);
      if (!card) {
        notFound("Card not found");
      }

      return card;
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

      const detail = await repository.getBoardDetail(board.id);
      const duplicate = detail?.connections.some(
        (connection) =>
          connection.sourceCardId === input.sourceCardId &&
          connection.targetCardId === input.targetCardId &&
          connection.sourcePortKey === input.sourcePortKey &&
          connection.targetPortKey === input.targetPortKey &&
          connection.type === input.type
      );
      if (duplicate) {
        conflict("Connection already exists");
      }

      return repository.createConnection({
        workspaceId: board.workspaceId,
        boardId: board.id,
        connectionTypeId: await resolveConnectionTypeId(board.workspaceId, input.connectionTypeId, {
          useGenericFallback: true
        }),
        sourceCardId: input.sourceCardId,
        targetCardId: input.targetCardId,
        sourcePortKey: input.sourcePortKey,
        targetPortKey: input.targetPortKey,
        type: input.type,
        label: input.label,
        status: "active"
      });
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

        const detail = await repository.getBoardDetail(existing.boardId);
        const duplicate = detail?.connections.some(
          (connection) =>
            connection.id !== existing.id &&
            connection.sourceCardId === nextEndpoint.sourceCardId &&
            connection.targetCardId === nextEndpoint.targetCardId &&
            connection.sourcePortKey === nextEndpoint.sourcePortKey &&
            connection.targetPortKey === nextEndpoint.targetPortKey &&
            connection.type === nextEndpoint.type
        );
        if (duplicate) {
          conflict("Connection already exists");
        }
      }

      const updated = await repository.updateConnection(connectionId, {
        ...input,
        ...(input.connectionTypeId !== undefined ? { connectionTypeId: nextConnectionTypeId } : {})
      });
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
        console.warn(
          {
            fileId,
            cardId: card.id,
            storageBucket: storage.bucket,
            storagePath
          },
          "V2 attachment DB insert failed after object upload; orphan object may remain"
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
        console.warn(
          {
            fileId,
            connectionId: connection.id,
            storageBucket: storage.bucket,
            storagePath
          },
          "V2 connection attachment DB insert failed after object upload; orphan object may remain"
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
