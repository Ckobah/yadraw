"use client";

import { useEffect, useState } from "react";
import { Database, X } from "lucide-react";
import type { V2Card, V2CardType, V2Connection } from "@yadraw/shared";
import { getV2CardAccentColor } from "./v2-card-node";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type V2CardInspectorProps = {
  card: V2Card;
  cardType: V2CardType | null;
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
  saveStatus: SaveStatus;
  onUpdateCardBasics: (
    cardId: string,
    input: { title?: string; description?: string | null }
  ) => Promise<void>;
  onClose: () => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function compactJson(value: V2Card["data"]): string {
  if (Object.keys(value).length === 0) return "";
  const lines = JSON.stringify(value, null, 2).split("\n");
  if (lines.length <= 8) return lines.join("\n");
  return `${lines.slice(0, 8).join("\n")}\n...`;
}

function ConnectionRows({
  connections,
  cardById,
  direction,
}: {
  connections: V2Connection[];
  cardById: Map<string, V2Card>;
  direction: "incoming" | "outgoing";
}) {
  if (connections.length === 0) {
    return <p className="v2InspectorEmpty">Нет связей</p>;
  }

  return (
    <div className="v2InspectorConnectionList">
      {connections.map((connection) => {
        const relatedCardId =
          direction === "incoming"
            ? connection.sourceCardId
            : connection.targetCardId;
        const relatedCard = cardById.get(relatedCardId);
        const portText =
          direction === "incoming"
            ? `${connection.sourcePortKey} -> ${connection.targetPortKey}`
            : `${connection.sourcePortKey} -> ${connection.targetPortKey}`;

        return (
          <div key={connection.id} className="v2InspectorConnectionRow">
            <span className="v2InspectorConnectionDirection">
              {direction === "incoming" ? "In" : "Out"}
            </span>
            <div className="v2InspectorConnectionText">
              <strong>{relatedCard?.title ?? "Unknown card"}</strong>
              <span>{connection.label || connection.type} · {portText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function V2CardInspector({
  card,
  cardType,
  incomingConnections,
  outgoingConnections,
  cardById,
  saveStatus,
  onUpdateCardBasics,
  onClose,
}: V2CardInspectorProps) {
  const accentColor = getV2CardAccentColor(cardType?.key);
  const jsonPreview = compactJson(card.data);
  const [draftTitle, setDraftTitle] = useState(card.title ?? "");
  const [draftDescription, setDraftDescription] = useState(card.description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }, [card.id, card.title, card.description]);

  const hasTitleChanges = draftTitle !== (card.title ?? "");
  const hasDescriptionChanges = draftDescription !== (card.description ?? "");
  const hasChanges = hasTitleChanges || hasDescriptionChanges;

  async function saveTitle() {
    const nextTitle = draftTitle.trim();
    if (nextTitle === card.title) return;
    if (!nextTitle) {
      setDraftTitle(card.title ?? "");
      setFieldError("Название не может быть пустым");
      return;
    }

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, { title: nextTitle });
    } catch {
      setFieldError("Не удалось сохранить название");
    }
  }

  async function saveDescription() {
    const currentDescription = card.description ?? "";
    if (draftDescription === currentDescription) return;

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, { description: draftDescription });
    } catch {
      setFieldError("Не удалось сохранить описание");
    }
  }

  async function saveAll() {
    const input: { title?: string; description?: string } = {};
    const nextTitle = draftTitle.trim();
    if (nextTitle !== card.title) {
      if (!nextTitle) {
        setDraftTitle(card.title ?? "");
        setFieldError("Название не может быть пустым");
        return;
      }
      input.title = nextTitle;
    }
    if (draftDescription !== (card.description ?? "")) {
      input.description = draftDescription;
    }
    if (input.title === undefined && input.description === undefined) return;

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, input);
    } catch {
      setFieldError("Не удалось сохранить изменения");
    }
  }

  function cancelDraft() {
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }

  function getSaveStatusLabel() {
    if (fieldError) return fieldError;
    if (saveStatus === "saving") return "Saving...";
    if (saveStatus === "saved") return "Saved";
    if (saveStatus === "error") return "Save failed";
    return hasChanges ? "Unsaved changes" : "Saved";
  }

  return (
    <aside
      className="v2CardInspector"
      style={{ ["--v2-inspector-accent" as string]: accentColor }}
      aria-label="Card inspector"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="v2InspectorHeader">
        <span className="v2InspectorTypeIcon" aria-hidden="true">
          <Database size={18} strokeWidth={2.1} />
        </span>
        <div className="v2InspectorHeaderText">
          <span>{cardType?.name ?? "Unknown type"}</span>
          <strong>{cardType?.key ?? "unknown"}</strong>
        </div>
        <button
          type="button"
          className="v2InspectorCloseButton"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      <div className="v2InspectorContent">
        <section className="v2InspectorHero v2InspectorEditor">
          <div className="v2InspectorField">
            <label htmlFor={`v2-title-${card.id}`}>Название</label>
            <input
              id={`v2-title-${card.id}`}
              className="v2InspectorTextInput"
              value={draftTitle}
              placeholder="Название карточки"
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveTitle();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftTitle(card.title ?? "");
                  setFieldError(null);
                }
              }}
            />
          </div>
          <div className="v2InspectorField">
            <label htmlFor={`v2-description-${card.id}`}>Описание</label>
            <textarea
              id={`v2-description-${card.id}`}
              className="v2InspectorTextarea"
              value={draftDescription}
              placeholder="Краткое описание"
              onChange={(event) => setDraftDescription(event.target.value)}
              onBlur={() => void saveDescription()}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void saveDescription();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftDescription(card.description ?? "");
                  setFieldError(null);
                }
              }}
            />
          </div>
          <div className="v2InspectorEditFooter">
            <span className={fieldError ? "v2InspectorSaveStatusError" : ""}>
              {getSaveStatusLabel()}
            </span>
            <div className="v2InspectorEditActions">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={cancelDraft}
                disabled={!hasChanges || saveStatus === "saving"}
              >
                Отменить
              </button>
              <button
                type="button"
                className="v2InspectorPrimaryAction"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void saveAll()}
                disabled={!hasChanges || saveStatus === "saving"}
              >
                Сохранить
              </button>
            </div>
          </div>
        </section>

        <section className="v2InspectorSection">
          <h3>Основное</h3>
          <dl className="v2InspectorMetaGrid">
            <div>
              <dt>Status</dt>
              <dd>{card.status}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{Math.round(card.size.width)} x {Math.round(card.size.height)}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{Math.round(card.position.x)}, {Math.round(card.position.y)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(card.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="v2InspectorSection">
          <h3>Данные</h3>
          {jsonPreview ? (
            <pre className="v2InspectorJsonPreview">{jsonPreview}</pre>
          ) : (
            <p className="v2InspectorEmpty">Нет данных</p>
          )}
        </section>

        <section className="v2InspectorSection">
          <h3>Связи</h3>
          <div className="v2InspectorConnectionGroup">
            <span className="v2InspectorConnectionTitle">Incoming</span>
            <ConnectionRows
              connections={incomingConnections}
              cardById={cardById}
              direction="incoming"
            />
          </div>
          <div className="v2InspectorConnectionGroup">
            <span className="v2InspectorConnectionTitle">Outgoing</span>
            <ConnectionRows
              connections={outgoingConnections}
              cardById={cardById}
              direction="outgoing"
            />
          </div>
        </section>

        <section className="v2InspectorSection">
          <h3>Advanced</h3>
          <dl className="v2InspectorAdvancedList">
            <div>
              <dt>Card id</dt>
              <dd>{card.id}</dd>
            </div>
            <div>
              <dt>Type key</dt>
              <dd>{cardType?.key ?? "unknown"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </aside>
  );
}
