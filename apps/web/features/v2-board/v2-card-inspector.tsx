"use client";

import { useEffect, useState } from "react";
import { Database, X } from "lucide-react";
import type { V2Card, V2CardType, V2Connection } from "@yadraw/shared";
import { getV2CardAccentColor } from "./v2-card-node";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type DataFieldType = "text" | "number" | "boolean" | "json";
type DataFieldDraft = {
  id: string;
  key: string;
  type: DataFieldType;
  value: string;
};

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
  onUpdateCardData: (
    cardId: string,
    data: Record<string, unknown>
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

function createLocalFieldId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function detectDataFieldType(value: unknown): DataFieldType {
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

function stringifyDataFieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2) ?? "null";
}

function dataToDraftFields(data: V2Card["data"]): DataFieldDraft[] {
  return Object.entries(data).map(([key, value], index) => ({
    id: `field-${index}-${key}`,
    key,
    type: detectDataFieldType(value),
    value: stringifyDataFieldValue(value),
  }));
}

function normalizeDraftForCompare(fields: DataFieldDraft[]): string {
  return JSON.stringify(fields.map(({ key, type, value }) => ({ key, type, value })));
}

function parseDraftFields(fields: DataFieldDraft[]): {
  data: Record<string, unknown> | null;
  errors: Record<string, string>;
} {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const seenKeys = new Set<string>();

  for (const field of fields) {
    const normalizedKey = field.key.trim();
    if (!normalizedKey) {
      errors[field.id] = "Key is required";
      continue;
    }
    if (seenKeys.has(normalizedKey)) {
      errors[field.id] = "Duplicate key";
      continue;
    }
    seenKeys.add(normalizedKey);

    if (field.type === "text") {
      data[normalizedKey] = field.value;
      continue;
    }

    if (field.type === "number") {
      if (!field.value.trim()) {
        errors[field.id] = "Number is required";
        continue;
      }
      const nextNumber = Number(field.value);
      if (Number.isNaN(nextNumber)) {
        errors[field.id] = "Invalid number";
        continue;
      }
      data[normalizedKey] = nextNumber;
      continue;
    }

    if (field.type === "boolean") {
      data[normalizedKey] = field.value === "true";
      continue;
    }

    try {
      data[normalizedKey] = JSON.parse(field.value);
    } catch {
      errors[field.id] = "Invalid JSON";
    }
  }

  return {
    data: Object.keys(errors).length > 0 ? null : data,
    errors,
  };
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
  onUpdateCardData,
  onClose,
}: V2CardInspectorProps) {
  const accentColor = getV2CardAccentColor(cardType?.key);
  const [draftTitle, setDraftTitle] = useState(card.title ?? "");
  const [draftDescription, setDraftDescription] = useState(card.description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [dataDraftFields, setDataDraftFields] = useState<DataFieldDraft[]>(
    () => dataToDraftFields(card.data)
  );
  const [dataFieldErrors, setDataFieldErrors] = useState<Record<string, string>>({});
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }, [card.id, card.title, card.description]);

  useEffect(() => {
    setDataDraftFields(dataToDraftFields(card.data));
    setDataFieldErrors({});
    setDataError(null);
  }, [card.id, card.data]);

  const hasTitleChanges = draftTitle !== (card.title ?? "");
  const hasDescriptionChanges = draftDescription !== (card.description ?? "");
  const hasChanges = hasTitleChanges || hasDescriptionChanges;
  const dataBaseline = normalizeDraftForCompare(dataToDraftFields(card.data));
  const hasDataChanges = normalizeDraftForCompare(dataDraftFields) !== dataBaseline;

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

  function updateDataField(
    fieldId: string,
    patch: Partial<Omit<DataFieldDraft, "id">>
  ) {
    setDataDraftFields((current) =>
      current.map((field) => {
        if (field.id !== fieldId) return field;
        const nextType = patch.type ?? field.type;
        let nextValue = patch.value ?? field.value;
        if (patch.type === "boolean" && field.type !== "boolean") {
          nextValue = "false";
        }
        if (patch.type === "json" && field.type !== "json") {
          const sourceValue =
            field.type === "number"
              ? Number(field.value)
              : field.type === "boolean"
                ? field.value === "true"
                : field.value;
          nextValue = JSON.stringify(sourceValue, null, 2);
        }
        return {
          ...field,
          ...patch,
          type: nextType,
          value: nextValue,
        };
      })
    );
    setDataFieldErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
  }

  function addDataField() {
    setDataDraftFields((current) => [
      ...current,
      {
        id: createLocalFieldId(),
        key: "",
        type: "text",
        value: "",
      },
    ]);
    setDataError(null);
  }

  function deleteDataField(fieldId: string) {
    setDataDraftFields((current) => current.filter((field) => field.id !== fieldId));
    setDataFieldErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
  }

  function cancelDataDraft() {
    setDataDraftFields(dataToDraftFields(card.data));
    setDataFieldErrors({});
    setDataError(null);
  }

  async function saveDataDraft() {
    const parsed = parseDraftFields(dataDraftFields);
    setDataFieldErrors(parsed.errors);
    if (!parsed.data) {
      setDataError("Исправьте ошибки в данных");
      return;
    }

    setDataError(null);
    try {
      await onUpdateCardData(card.id, parsed.data);
    } catch {
      setDataError("Не удалось сохранить данные");
    }
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
          {dataDraftFields.length === 0 ? (
            <p className="v2InspectorEmpty">Нет данных</p>
          ) : (
            <div className="v2InspectorDataEditor">
              {dataDraftFields.map((field) => (
                <div key={field.id} className="v2InspectorDataRow">
                  <div className="v2InspectorDataRowGrid">
                    <input
                      className="v2InspectorDataKeyInput"
                      value={field.key}
                      placeholder="key"
                      aria-label="Data field key"
                      onChange={(event) =>
                        updateDataField(field.id, { key: event.target.value })
                      }
                    />
                    <select
                      className="v2InspectorDataTypeSelect"
                      value={field.type}
                      aria-label="Data field type"
                      onChange={(event) =>
                        updateDataField(field.id, {
                          type: event.target.value as DataFieldType,
                        })
                      }
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="json">json</option>
                    </select>
                    <button
                      type="button"
                      className="v2InspectorDataDeleteButton"
                      aria-label="Delete data field"
                      onClick={() => deleteDataField(field.id)}
                    >
                      <X size={14} strokeWidth={2.2} />
                    </button>
                  </div>
                  {field.type === "json" ? (
                    <textarea
                      className="v2InspectorDataValue v2InspectorDataJsonValue"
                      value={field.value}
                      placeholder='{"source":"manual"}'
                      aria-label="Data field JSON value"
                      onChange={(event) =>
                        updateDataField(field.id, { value: event.target.value })
                      }
                    />
                  ) : field.type === "boolean" ? (
                    <select
                      className="v2InspectorDataValue"
                      value={field.value === "true" ? "true" : "false"}
                      aria-label="Data field boolean value"
                      onChange={(event) =>
                        updateDataField(field.id, { value: event.target.value })
                      }
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      className="v2InspectorDataValue"
                      type={field.type === "number" ? "number" : "text"}
                      value={field.value}
                      placeholder={field.type === "number" ? "0" : "value"}
                      aria-label="Data field value"
                      onChange={(event) =>
                        updateDataField(field.id, { value: event.target.value })
                      }
                    />
                  )}
                  {dataFieldErrors[field.id] ? (
                    <p className="v2InspectorDataError">{dataFieldErrors[field.id]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div className="v2InspectorDataFooter">
            <span className={dataError ? "v2InspectorSaveStatusError" : ""}>
              {dataError ?? (hasDataChanges ? "Unsaved data changes" : "Data saved")}
            </span>
            <div className="v2InspectorEditActions">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={addDataField}
              >
                + Добавить поле
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={cancelDataDraft}
                disabled={!hasDataChanges || saveStatus === "saving"}
              >
                Отменить
              </button>
              <button
                type="button"
                className="v2InspectorPrimaryAction"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void saveDataDraft()}
                disabled={!hasDataChanges || saveStatus === "saving"}
              >
                Сохранить
              </button>
            </div>
          </div>
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
