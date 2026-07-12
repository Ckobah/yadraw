"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import type { V2CardType, V2CardTypePort, V2Position } from "@yadraw/shared";
import { getV2CardTypeAccentColor } from "./v2-card-node";
import { getV2CardTypeIcon } from "./v2-card-type-icons";

type V2CardCreateToolbarProps = {
  cardTypes: V2CardType[];
  onCreateCard: (
    cardType: V2CardType,
    position: V2Position
  ) => Promise<void>;
  onManageCardTypes: (cardTypeId?: string | null) => void;
  connectorControl?: ReactNode;
};

export function V2CardCreateToolbar({
  cardTypes,
  onCreateCard,
  onManageCardTypes,
  connectorControl,
}: V2CardCreateToolbarProps) {
  const { screenToFlowPosition } = useReactFlow();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCardTypeId, setActiveCardTypeId] = useState<string | null>(
    cardTypes[0]?.id ?? null
  );
  const [pendingCardType, setPendingCardType] = useState<V2CardType | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const filteredCardTypes = cardTypes.filter((cardType) =>
    matchesCardTypeSearch(cardType, query)
  );
  const activeCardType =
    filteredCardTypes.find((cardType) => cardType.id === activeCardTypeId) ??
    filteredCardTypes[0] ??
    null;

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (
        event.target instanceof globalThis.Node &&
        !toolbarRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveCardTypeId((current) =>
      current && filteredCardTypes.some((cardType) => cardType.id === current)
        ? current
        : filteredCardTypes[0]?.id ?? null
    );
  }, [filteredCardTypes, isOpen]);

  useEffect(() => {
    if (!pendingCardType) return;
    document.body.classList.add("v2CardPlacementActive");

    const handlePointerMove = (event: PointerEvent) => {
      setCursorPosition({ x: event.clientX, y: event.clientY });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isCreating) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".react-flow__pane")) return;
      event.preventDefault();
      event.stopPropagation();
      const center = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const position: V2Position = {
        x: center.x - pendingCardType.defaultSize.width / 2,
        y: center.y - pendingCardType.defaultSize.height / 2,
      };
      setIsCreating(true);
      setError(null);
      void onCreateCard(pendingCardType, position)
        .then(() => setPendingCardType(null))
        .catch(() => setError("Could not create card"))
        .finally(() => setIsCreating(false));
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingCardType(null);
        setError(null);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("v2CardPlacementActive");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreating, onCreateCard, pendingCardType, screenToFlowPosition]);

  function beginPlacement(cardType: V2CardType, event: ReactMouseEvent<HTMLButtonElement>) {
    setCursorPosition({ x: event.clientX, y: event.clientY });
    setPendingCardType(cardType);
    setIsOpen(false);
    setError(null);
  }

  function handleManageCardTypes() {
    setIsOpen(false);
    onManageCardTypes(activeCardType?.id ?? null);
  }

  return (
    <div
      ref={toolbarRef}
      className="v2CreateToolbar nodrag nopan"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="v2CreateToolbarPrimaryRow">
        <button
          type="button"
          className="v2CreateToolbarButton"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => {
            setError(null);
            setQuery("");
            setIsOpen((current) => !current);
          }}
          disabled={isCreating}
        >
          <Plus size={15} strokeWidth={2.4} />
          <span>Card</span>
          <ChevronDown size={14} strokeWidth={2.2} />
        </button>
        {connectorControl}
      </div>

      {isOpen ? (
        <div className="v2CreateToolbarPopover v2CardTypePicker" role="menu">
          <div className="v2CardTypePickerHeader">
            <span className="v2CreateToolbarTitle">Card type</span>
            <label className="v2CardTypeSearch">
              <Search size={13} strokeWidth={2.2} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search types"
                aria-label="Search card types"
              />
            </label>
          </div>
          {cardTypes.length === 0 ? (
            <p className="v2CardTypeEmptyState">No card types available.</p>
          ) : filteredCardTypes.length === 0 ? (
            <p className="v2CardTypeEmptyState">No matching card types.</p>
          ) : (
            <div className="v2CardTypePickerBody">
              <div className="v2CardTypeList">
                {filteredCardTypes.map((cardType) => {
                  const accentColor = getV2CardTypeAccentColor(cardType);
                  const summary = summarizePorts(cardType.ports);
                  const isActive = activeCardType?.id === cardType.id;
                  return (
                    <button
                      key={cardType.id}
                      type="button"
                      role="menuitem"
                      className={`v2CardTypeRow${isActive ? " v2CardTypeRowActive" : ""}`}
                      onMouseEnter={() => setActiveCardTypeId(cardType.id)}
                      onFocus={() => setActiveCardTypeId(cardType.id)}
                      onClick={(event) => beginPlacement(cardType, event)}
                      disabled={isCreating}
                      style={{ ["--v2-create-accent" as string]: accentColor }}
                    >
                      <span className="v2CardTypeColorDot" aria-hidden="true" />
                      <span className="v2CardTypeMeta">
                        <strong>{cardType.name}</strong>
                        <em>key: {cardType.key}</em>
                        {cardType.description ? <small>{cardType.description}</small> : null}
                        <span className="v2CardTypePortsSummary">
                          ports: {summary.inputs} {pluralize("input", summary.inputs)} ·{" "}
                          {summary.outputs} {pluralize("output", summary.outputs)} ·{" "}
                          {summary.receivers} {pluralize("receiver", summary.receivers)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <CardTypePreview cardType={activeCardType} />
            </div>
          )}
          <div className="v2CardTypePickerFooter">
            <button
              type="button"
              onClick={handleManageCardTypes}
            >
              Manage card types
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="v2CreateToolbarError">{error}</p> : null}
      {pendingCardType && typeof document !== "undefined"
        ? createPortal(
            <CardPlacementPreview
              cardType={pendingCardType}
              x={cursorPosition.x}
              y={cursorPosition.y}
              saving={isCreating}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function CardPlacementPreview({
  cardType,
  x,
  y,
  saving,
}: {
  cardType: V2CardType;
  x: number;
  y: number;
  saving: boolean;
}) {
  const Icon = getV2CardTypeIcon(cardType);
  return (
    <div
      className={`v2CardPlacementPreview${saving ? " v2CardPlacementPreviewSaving" : ""}`}
      style={{
        left: x,
        top: y,
        width: cardType.defaultSize.width,
        height: cardType.defaultSize.height,
        ["--v2-create-accent" as string]: getV2CardTypeAccentColor(cardType),
      }}
      aria-hidden="true"
    >
      <div><Icon size={16} /><strong>{cardType.name}</strong></div>
      <span>New card</span>
    </div>
  );
}

function CardTypePreview({ cardType }: { cardType: V2CardType | null }) {
  if (!cardType) {
    return (
      <aside className="v2CardTypePreview">
        <p>Select a type to preview its ports.</p>
      </aside>
    );
  }

  const accentColor = getV2CardTypeAccentColor(cardType);
  const groupedPorts = groupPorts(cardType.ports);

  return (
    <aside
      className="v2CardTypePreview"
      style={{ ["--v2-create-accent" as string]: accentColor }}
    >
      <div className="v2CardTypePreviewHeader">
        <span className="v2CardTypePreviewColor" aria-hidden="true" />
        <div>
          <strong>{cardType.name}</strong>
          <em>{cardType.key}</em>
        </div>
      </div>
      {cardType.description ? (
        <p className="v2CardTypePreviewDescription">{cardType.description}</p>
      ) : null}
      <div className="v2CardTypePreviewPorts">
        <PortGroup title="Inputs" ports={groupedPorts.inputs} />
        <PortGroup title="Outputs" ports={groupedPorts.outputs} />
        <PortGroup title="Receivers" ports={groupedPorts.receivers} />
      </div>
    </aside>
  );
}

function PortGroup({ title, ports }: { title: string; ports: V2CardTypePort[] }) {
  return (
    <section>
      <h4>{title}</h4>
      {ports.length > 0 ? (
        <ul>
          {ports.map((port) => (
            <li key={port.id}>
              <strong>{port.key}</strong>
              {port.label ? <span>{port.label}</span> : null}
              <em>{readPortKind(port) || "input"}</em>
            </li>
          ))}
        </ul>
      ) : (
        <p>No ports</p>
      )}
    </section>
  );
}

function matchesCardTypeSearch(cardType: V2CardType, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const searchable = [
    cardType.name,
    cardType.key,
    cardType.description ?? "",
    ...cardType.ports.flatMap((port) => [
      port.key,
      port.label ?? "",
      readPortKind(port),
    ]),
  ];

  return searchable.some((value) => value.toLowerCase().includes(normalizedQuery));
}

function summarizePorts(ports: V2CardTypePort[]) {
  const grouped = groupPorts(ports);
  return {
    inputs: grouped.inputs.length,
    outputs: grouped.outputs.length,
    receivers: grouped.receivers.length,
  };
}

function groupPorts(ports: V2CardTypePort[]): {
  inputs: V2CardTypePort[];
  outputs: V2CardTypePort[];
  receivers: V2CardTypePort[];
} {
  return ports.reduce(
    (groups, port) => {
      const kind = readPortKind(port);
      if (kind === "output") {
        groups.outputs.push(port);
      } else if (
        kind === "receiver" ||
        kind === "bidirectional" ||
        kind === "io" ||
        kind === "input_output"
      ) {
        groups.receivers.push(port);
      } else {
        groups.inputs.push(port);
      }
      return groups;
    },
    { inputs: [], outputs: [], receivers: [] } as {
      inputs: V2CardTypePort[];
      outputs: V2CardTypePort[];
      receivers: V2CardTypePort[];
    }
  );
}

function readPortKind(port: V2CardTypePort): string {
  const loosePort = port as V2CardTypePort & { type?: unknown; direction?: unknown };
  const kind = loosePort.type ?? loosePort.direction;
  return typeof kind === "string" ? kind.toLowerCase() : "";
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
