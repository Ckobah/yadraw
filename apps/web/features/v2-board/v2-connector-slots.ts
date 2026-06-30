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

type LoosePort = V2CardTypePort & {
  type?: unknown;
  direction?: unknown;
};

const MIN_SLOT_OFFSET = 0.15;
const MAX_SLOT_OFFSET = 0.85;

function clampSlotOffset(offset: number): number {
  return Math.min(MAX_SLOT_OFFSET, Math.max(MIN_SLOT_OFFSET, offset));
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
