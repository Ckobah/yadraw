import type { V2CardTypePort } from "@yadraw/shared";

export type V2ConnectorSlotType = "input" | "output" | "receiver";

export type V2ConnectorSlotSide = "top" | "right" | "bottom" | "left";

export type V2ConnectorSlot = {
  id: string;
  portKey: string;
  type: V2ConnectorSlotType;
  side: V2ConnectorSlotSide;
  offset: number;
  label?: string;
};

export type V2PersistedConnectorSlot = Omit<V2ConnectorSlot, "portKey">;

export type V2ConnectorSlotValidationResult =
  | { ok: true; slots: V2PersistedConnectorSlot[] }
  | { ok: false; message: string };

type LoosePort = V2CardTypePort & {
  type?: unknown;
  direction?: unknown;
};

const MIN_SLOT_OFFSET = 0.15;
const MAX_SLOT_OFFSET = 0.85;
const VALID_SLOT_TYPES = new Set<V2ConnectorSlotType>(["input", "output", "receiver"]);
const VALID_SLOT_SIDES = new Set<V2ConnectorSlotSide>(["top", "right", "bottom", "left"]);

function clampSlotOffset(offset: number): number {
  return Math.min(MAX_SLOT_OFFSET, Math.max(MIN_SLOT_OFFSET, offset));
}

export function clampEditableSlotOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0.5;
  return Math.min(1, Math.max(0, offset));
}

function readPortKind(port: V2CardTypePort): string {
  const loosePort = port as LoosePort;
  const rawKind = loosePort.type ?? loosePort.direction;
  return typeof rawKind === "string" ? rawKind.toLowerCase() : "";
}

function getFallbackSlotType(port: V2CardTypePort): V2ConnectorSlotType {
  const kind = readPortKind(port);
  if (kind === "output") return "output";
  if (
    kind === "receiver" ||
    kind === "bidirectional" ||
    kind === "io" ||
    kind === "input_output"
  ) {
    return "receiver";
  }
  return "input";
}

function getFallbackSlotSide(type: V2ConnectorSlotType): V2ConnectorSlotSide {
  if (type === "output") return "right";
  if (type === "receiver") return "bottom";
  return "left";
}

function distributeOffsets(count: number): number[] {
  if (count <= 1) return [0.5];

  return Array.from({ length: count }, (_item, index) =>
    clampSlotOffset((index + 1) / (count + 1))
  );
}

export function buildV2ConnectorSlotsFromPorts(
  ports: V2CardTypePort[]
): V2ConnectorSlot[] {
  const slots = ports.map((port) => {
    const type = getFallbackSlotType(port);
    return {
      id: port.key,
      portKey: port.key,
      type,
      side: getFallbackSlotSide(type),
      offset: 0.5,
      label: port.label,
    } satisfies V2ConnectorSlot;
  });

  const slotsBySide = new Map<V2ConnectorSlotSide, V2ConnectorSlot[]>();
  for (const slot of slots) {
    const sideSlots = slotsBySide.get(slot.side) ?? [];
    sideSlots.push(slot);
    slotsBySide.set(slot.side, sideSlots);
  }

  for (const sideSlots of slotsBySide.values()) {
    const offsets = distributeOffsets(sideSlots.length);
    sideSlots.forEach((slot, index) => {
      slot.offset = offsets[index] ?? 0.5;
    });
  }

  return slots;
}

export function toPersistedV2ConnectorSlot(
  slot: V2ConnectorSlot
): V2PersistedConnectorSlot {
  return {
    id: slot.id,
    type: slot.type,
    side: slot.side,
    offset: clampEditableSlotOffset(slot.offset),
    ...(slot.label !== undefined ? { label: slot.label } : {}),
  };
}

export function toRuntimeV2ConnectorSlot(
  slot: V2PersistedConnectorSlot
): V2ConnectorSlot {
  return {
    ...slot,
    portKey: slot.id,
    offset: clampEditableSlotOffset(slot.offset),
  };
}

export function validateV2ConnectorSlots(
  slots: V2PersistedConnectorSlot[]
): V2ConnectorSlotValidationResult {
  const seenIds = new Set<string>();

  for (const slot of slots) {
    const id = typeof slot.id === "string" ? slot.id.trim() : "";
    if (!id) return { ok: false, message: "Every connector slot needs an id." };
    if (seenIds.has(id)) {
      return { ok: false, message: `Connector slot id "${id}" is duplicated.` };
    }
    seenIds.add(id);

    if (!VALID_SLOT_TYPES.has(slot.type)) {
      return { ok: false, message: `Connector slot "${id}" has an invalid type.` };
    }
    if (!VALID_SLOT_SIDES.has(slot.side)) {
      return { ok: false, message: `Connector slot "${id}" has an invalid side.` };
    }
    if (!Number.isFinite(slot.offset) || slot.offset < 0 || slot.offset > 1) {
      return { ok: false, message: `Connector slot "${id}" offset must be between 0 and 1.` };
    }
    if (slot.label !== undefined && typeof slot.label !== "string") {
      return { ok: false, message: `Connector slot "${id}" has an invalid label.` };
    }
  }

  return {
    ok: true,
    slots: slots.map((slot) => {
      const label = slot.label?.trim();
      return {
        id: slot.id.trim(),
        type: slot.type,
        side: slot.side,
        offset: clampEditableSlotOffset(slot.offset),
        ...(label ? { label } : {}),
      };
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVisualStyleConnectorSlots(
  visualStyle: unknown
): unknown[] | null {
  if (!isRecord(visualStyle)) return null;
  return Array.isArray(visualStyle.connectorSlots)
    ? visualStyle.connectorSlots
    : null;
}

function sanitizeSavedConnectorSlot(value: unknown): V2ConnectorSlot | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.type !== "string") return null;
  if (typeof value.side !== "string") return null;
  if (typeof value.offset !== "number") return null;
  if (!Number.isFinite(value.offset) || value.offset < 0 || value.offset > 1) return null;

  const id = value.id.trim();
  if (!id) return null;

  const type = value.type as V2ConnectorSlotType;
  const side = value.side as V2ConnectorSlotSide;
  if (!VALID_SLOT_TYPES.has(type) || !VALID_SLOT_SIDES.has(side)) return null;

  const label = typeof value.label === "string" ? value.label : undefined;

  return {
    id,
    portKey: id,
    type,
    side,
    offset: clampEditableSlotOffset(value.offset),
    ...(label !== undefined ? { label } : {})
  };
}

function buildV2ConnectorSlotsFromVisualStyle(
  visualStyle: unknown
): V2ConnectorSlot[] | null {
  const rawSlots = readVisualStyleConnectorSlots(visualStyle);
  if (!rawSlots) return null;
  if (rawSlots.length === 0) return [];

  const slots = rawSlots
    .map((rawSlot) => sanitizeSavedConnectorSlot(rawSlot))
    .filter((slot): slot is V2ConnectorSlot => slot !== null);

  return slots.length === rawSlots.length ? slots : null;
}

export function buildV2ConnectorSlots(params: {
  visualStyle?: unknown;
  ports: V2CardTypePort[];
}): V2ConnectorSlot[] {
  const savedSlots = buildV2ConnectorSlotsFromVisualStyle(params.visualStyle);
  return savedSlots !== null
    ? savedSlots
    : buildV2ConnectorSlotsFromPorts(params.ports);
}
