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
  sticky: { width: 320, height: 220 },
  frame: { width: 720, height: 480 },
};

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

export function getV2ContainerVariant(card: V2Card): V2ContainerVariant {
  return card.visualStyle.containerVariant ?? "sticky";
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

export function getV2CardsInsideContainer(
  container: V2Card,
  cards: V2Card[],
  cardTypeById: Map<string, V2CardType>
): V2Card[] {
  return cards.filter((card) => {
    if (card.id === container.id || isV2ContainerCard(card, cardTypeById.get(card.cardTypeId))) {
      return false;
    }
    return isV2CardCenterInsideContainer(container, card);
  });
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
    name: "Container",
    description: "Sticky notes and frames",
    defaultData: {},
    schema: { fields: [] },
    defaultVisualStyle: {},
    defaultSize: V2_CONTAINER_SIZES[getV2ContainerVariant(card)],
    ports: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        workspaceId,
        cardTypeId: card.cardTypeId,
        key: "in",
        label: "In",
        direction: "input",
        dataType: "json",
        required: false,
        sortOrder: 0,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        workspaceId,
        cardTypeId: card.cardTypeId,
        key: "out",
        label: "Out",
        direction: "output",
        dataType: "json",
        required: false,
        sortOrder: 1,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    ],
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
