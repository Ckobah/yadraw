import type {
  V2Card,
  V2CardType,
  V2ContainerTheme,
  V2ContainerVariant,
} from "@yadraw/shared";

export const V2_CONTAINER_SIZES: Record<
  V2ContainerVariant,
  { width: number; height: number }
> = {
  box: { width: 480, height: 320 },
  sticky: { width: 320, height: 220 },
  frame: { width: 720, height: 480 },
};

export const V2_BOX_CONTENT_PADDING = 24;

export const V2_CONTAINER_THEMES: Record<
  V2ContainerTheme,
  { label: string; fillColor: string; borderColor: string }
> = {
  yellow: { label: "Yellow", fillColor: "#fff7c2", borderColor: "#e4c94f" },
  white: { label: "White", fillColor: "#ffffff", borderColor: "#d0d5dd" },
  blue: { label: "Blue", fillColor: "#e7f1ff", borderColor: "#78a9e6" },
  green: { label: "Green", fillColor: "#e7f7ea", borderColor: "#78b987" },
  pink: { label: "Pink", fillColor: "#fdebf3", borderColor: "#d98cac" },
  gray: { label: "Gray", fillColor: "#f1f3f5", borderColor: "#9aa4b2" },
};

export function isV2ContainerType(cardType: V2CardType | null | undefined): boolean {
  return cardType?.kind === "container";
}

export function isV2ContainerCard(
  card: V2Card,
  cardType?: V2CardType | null
): boolean {
  return isV2ContainerType(cardType) || card.visualStyle.containerVariant !== undefined;
}

export function isV2CardPinnedToContainer(card: V2Card): boolean {
  return Boolean(card.containerId) && card.visualStyle.containerPinned !== false;
}

export function getV2ContainerVariant(card: V2Card): V2ContainerVariant {
  return card.visualStyle.containerVariant ?? "box";
}

export function getV2ContainerTheme(card: V2Card): V2ContainerTheme {
  return (
    card.visualStyle.containerTheme ??
    (getV2ContainerVariant(card) === "frame" ? "white" : "yellow")
  );
}

export function isV2CardCenterInsideContainer(container: V2Card, card: V2Card): boolean {
  const left = container.position.x;
  const right = left + container.size.width;
  const top = container.position.y;
  const bottom = container.position.y + container.size.height;
  const centerX = card.position.x + card.size.width / 2;
  const centerY = card.position.y + card.size.height / 2;
  return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
}

export type V2BoxGeometry = Pick<V2Card, "position" | "size">;

function getContentBounds(cards: V2Card[], padding: number): V2BoxGeometry | null {
  if (cards.length === 0) return null;
  const left = Math.min(...cards.map((card) => card.position.x)) - padding;
  const top = Math.min(...cards.map((card) => card.position.y)) - padding;
  const right = Math.max(...cards.map((card) => card.position.x + card.size.width)) + padding;
  const bottom = Math.max(...cards.map((card) => card.position.y + card.size.height)) + padding;
  return {
    position: { x: left, y: top },
    size: {
      width: Math.max(220, right - left),
      height: Math.max(160, bottom - top),
    },
  };
}

export function getV2BoxFitGeometry(
  cards: V2Card[],
  padding = V2_BOX_CONTENT_PADDING
): V2BoxGeometry | null {
  return getContentBounds(cards, padding);
}

export function getExpandedV2BoxGeometry(
  box: V2Card,
  cards: V2Card[],
  padding = V2_BOX_CONTENT_PADDING
): V2BoxGeometry | null {
  const contentBounds = getContentBounds(cards, padding);
  if (!contentBounds) return null;
  const left = Math.min(box.position.x, contentBounds.position.x);
  const top = Math.min(box.position.y, contentBounds.position.y);
  const right = Math.max(
    box.position.x + box.size.width,
    contentBounds.position.x + contentBounds.size.width
  );
  const bottom = Math.max(
    box.position.y + box.size.height,
    contentBounds.position.y + contentBounds.size.height
  );
  if (
    left === box.position.x &&
    top === box.position.y &&
    right === box.position.x + box.size.width &&
    bottom === box.position.y + box.size.height
  ) {
    return null;
  }
  return {
    position: { x: left, y: top },
    size: { width: right - left, height: bottom - top },
  };
}

export function buildV2ContainerFallbackType(
  card: V2Card,
  workspaceId: string
): V2CardType {
  return {
    id: card.cardTypeId,
    workspaceId,
    key: "yadraw_system_container",
    kind: "container",
    name: "Box",
    description: "Spatial group for cards",
    defaultData: {},
    schema: { fields: [] },
    defaultVisualStyle: {},
    defaultSize: V2_CONTAINER_SIZES[getV2ContainerVariant(card)],
    ports: [],
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
