"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Plus, Trash2, X } from "lucide-react";
import type { V2Card, V2Connection, V2ConnectionType } from "@yadraw/shared";
import {
  createDataDraftFromRecord,
  createLocalFieldId,
  createSchemaDraftFromData,
  normalizeDataDraftForCompare,
  normalizeSchemaDraftForCompare,
  splitSchemaAndExtraData,
  validateAndBuildDataRecord,
  validateAndBuildSchemaDataRecord,
  type DataFieldDraft,
  type DataFieldType,
  type SaveStatus,
  type SchemaFieldDraft,
} from "./v2-card-inspector-helpers";
import { V2ConnectorFilesSection } from "./v2-connector-files-section";

type V2ConnectorInspectorProps = {
  connection: V2Connection;
  connectionType: V2ConnectionType | null;
  connectionTypes: V2ConnectionType[];
  sourceCard: V2Card | null;
  targetCard: V2Card | null;
  saveStatus: SaveStatus;
  onUpdateConnection: (
    connectionId: string,
    patch: {
      title?: string | null;
      description?: string | null;
      connectionTypeId?: string | null;
      data?: Record<string, unknown>;
    }
  ) => Promise<void>;
  onDeleteConnection: (connectionId: string) => Promise<void>;
  onManageConnectionType: (connectionTypeId?: string | null) => void;
  onClose: () => void;
};

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function cardTitle(card: V2Card | null, fallbackId: string): string {
  return card?.title?.trim() || `Card ${shortId(fallbackId)}`;
}

function formatSaveStatus(saveStatus: SaveStatus, fallback = "Unsaved changes"): string {
  if (saveStatus === "saving") return "Saving...";
  if (saveStatus === "saved") return "Saved";
  if (saveStatus === "error") return "Save failed";
  return fallback;
}

function formatDataValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";

  try {
    return JSON.stringify(value);
  } catch {
    return "Unsupported value";
  }
}

export function V2ConnectorInspector({
  connection,
  connectionType,
  connectionTypes,
  sourceCard,
  targetCard,
  saveStatus,
  onUpdateConnection,
  onDeleteConnection,
  onManageConnectionType,
  onClose,
}: V2ConnectorInspectorProps) {
  const [titleDraft, setTitleDraft] = useState(connection.title ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(connection.description ?? "");
  const [basicError, setBasicError] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [isTypeSaving, setIsTypeSaving] = useState(false);
  const schemaFields = useMemo(
    () => connectionType?.schema?.fields ?? [],
    [connectionType]
  );
  const sortedConnectionTypes = useMemo(
    () => [...connectionTypes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [connectionTypes]
  );
  const connectionTypeIds = useMemo(
    () => new Set(connectionTypes.map((item) => item.id)),
    [connectionTypes]
  );
  const genericConnectionType = useMemo(
    () => connectionTypes.find((item) => item.key === "generic") ?? null,
    [connectionTypes]
  );
  const selectedConnectionTypeValue =
    connection.connectionTypeId && connectionTypeIds.has(connection.connectionTypeId)
      ? connection.connectionTypeId
      : genericConnectionType?.id ?? "";
  const hasSchemaFields = schemaFields.length > 0;
  const { schemaKeys, extraData } = splitSchemaAndExtraData(schemaFields, connection.data);
  const dataRecordForDraft = hasSchemaFields ? extraData : connection.data;
  const [dataDraft, setDataDraft] = useState<DataFieldDraft[]>(() =>
    createDataDraftFromRecord(dataRecordForDraft)
  );
  const [schemaDraftFields, setSchemaDraftFields] = useState<SchemaFieldDraft[]>(() =>
    createSchemaDraftFromData(schemaFields, connection.data)
  );
  const [isDataEditing, setIsDataEditing] = useState(false);
  const [dataFieldErrors, setDataFieldErrors] = useState<Record<string, string>>({});
  const [schemaFieldErrors, setSchemaFieldErrors] = useState<Record<string, string>>({});
  const [dataError, setDataError] = useState<string | null>(null);

  const initialDataSignature = useMemo(
    () => normalizeDataDraftForCompare(createDataDraftFromRecord(dataRecordForDraft)),
    [dataRecordForDraft]
  );
  const initialSchemaSignature = useMemo(
    () => normalizeSchemaDraftForCompare(createSchemaDraftFromData(schemaFields, connection.data)),
    [connection.data, schemaFields]
  );
  const currentDataSignature = useMemo(
    () => normalizeDataDraftForCompare(dataDraft),
    [dataDraft]
  );
  const currentSchemaSignature = useMemo(
    () => normalizeSchemaDraftForCompare(schemaDraftFields),
    [schemaDraftFields]
  );
  const connectionDataEntries = useMemo(
    () => Object.entries(connection.data ?? {}),
    [connection.data]
  );
  const basicDirty =
    titleDraft !== (connection.title ?? "") ||
    descriptionDraft !== (connection.description ?? "");
  const dataDirty =
    currentDataSignature !== initialDataSignature ||
    (hasSchemaFields && currentSchemaSignature !== initialSchemaSignature);

  useEffect(() => {
    setTitleDraft(connection.title ?? "");
    setDescriptionDraft(connection.description ?? "");
    setBasicError(null);
    setTypeError(null);
    const nextSplit = splitSchemaAndExtraData(schemaFields, connection.data);
    setDataDraft(createDataDraftFromRecord(hasSchemaFields ? nextSplit.extraData : connection.data));
    setSchemaDraftFields(createSchemaDraftFromData(schemaFields, connection.data));
    setIsDataEditing(false);
    setDataFieldErrors({});
    setSchemaFieldErrors({});
    setDataError(null);
  }, [connection.id, connection.title, connection.description, connection.data, hasSchemaFields, schemaFields]);

  async function saveBasics() {
    setBasicError(null);
    try {
      await onUpdateConnection(connection.id, {
        title: titleDraft.trim() || null,
        description: descriptionDraft.trim() || null,
      });
    } catch {
      setBasicError("Could not save connector details.");
    }
  }

  function cancelBasics() {
    setTitleDraft(connection.title ?? "");
    setDescriptionDraft(connection.description ?? "");
    setBasicError(null);
  }

  async function updateConnectionTypeSelection(connectionTypeId: string) {
    if (!connectionTypeId) {
      setTypeError("Select a connection type.");
      return;
    }
    if (!connectionTypeIds.has(connectionTypeId)) {
      setTypeError("Connection type is not available.");
      return;
    }
    if (connectionTypeId === connection.connectionTypeId) {
      setTypeError(null);
      return;
    }

    setIsTypeSaving(true);
    setTypeError(null);
    try {
      await onUpdateConnection(connection.id, { connectionTypeId });
    } catch {
      setTypeError("Could not update connection type.");
    } finally {
      setIsTypeSaving(false);
    }
  }

  function updateDataField(
    fieldId: string,
    patch: Partial<Pick<DataFieldDraft, "key" | "type" | "value">>
  ) {
    setDataDraft((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
              ...(patch.type && patch.type !== field.type ? { value: patch.type === "boolean" ? "false" : "" } : {}),
            }
          : field
      )
    );
    setDataFieldErrors((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
  }

  function updateSchemaField(
    fieldId: string,
    patch: Partial<Pick<SchemaFieldDraft, "value">>
  ) {
    setSchemaDraftFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    );
    setSchemaFieldErrors((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
  }

  function addDataField() {
    setIsDataEditing(true);
    setDataDraft((current) => [
      ...current,
      {
        id: createLocalFieldId(),
        key: "",
        type: "text",
        value: "",
      },
    ]);
  }

  function deleteDataField(fieldId: string) {
    setDataDraft((current) => current.filter((field) => field.id !== fieldId));
    setDataFieldErrors((current) => {
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
  }

  async function saveData() {
    const schemaResult = hasSchemaFields
      ? validateAndBuildSchemaDataRecord(schemaDraftFields)
      : { ok: true as const, data: {} };
    const result = validateAndBuildDataRecord(
      dataDraft,
      hasSchemaFields ? { reservedKeys: schemaKeys } : {}
    );
    if (!schemaResult.ok) {
      setSchemaFieldErrors(schemaResult.errors);
    } else {
      setSchemaFieldErrors({});
    }
    if (!result.ok) {
      setDataFieldErrors(result.errors);
      setDataError("Fix invalid fields before saving.");
      return;
    }
    if (!schemaResult.ok) {
      setDataError("Fix relationship fields before saving.");
      return;
    }

    setDataFieldErrors({});
    setDataError(null);
    try {
      await onUpdateConnection(connection.id, {
        data: {
          ...schemaResult.data,
          ...result.data,
        },
      });
      setIsDataEditing(false);
    } catch {
      setDataError("Could not save connector data.");
    }
  }

  function cancelData() {
    const nextSplit = splitSchemaAndExtraData(schemaFields, connection.data);
    setDataDraft(createDataDraftFromRecord(hasSchemaFields ? nextSplit.extraData : connection.data));
    setSchemaDraftFields(createSchemaDraftFromData(schemaFields, connection.data));
    setIsDataEditing(false);
    setDataFieldErrors({});
    setSchemaFieldErrors({});
    setDataError(null);
  }

  function startDataEditing() {
    setIsDataEditing(true);
    setDataError(null);
  }

  function renderValueControl(field: DataFieldDraft) {
    if (field.type === "boolean") {
      return (
        <select
          className="v2InspectorDataValue"
          value={field.value === "true" ? "true" : "false"}
          onChange={(event) => updateDataField(field.id, { value: event.target.value })}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (field.type === "json") {
      return (
        <textarea
          className="v2InspectorDataValue v2InspectorDataJsonValue"
          rows={4}
          value={field.value}
          placeholder='{"key":"value"}'
          onChange={(event) => updateDataField(field.id, { value: event.target.value })}
        />
      );
    }

    return (
      <input
        className="v2InspectorDataValue"
        type={field.type === "number" ? "number" : "text"}
        value={field.value}
        placeholder={field.type === "number" ? "0" : "Value"}
        onChange={(event) => updateDataField(field.id, { value: event.target.value })}
      />
    );
  }

  function renderSchemaValueControl(field: SchemaFieldDraft) {
    if (field.type === "boolean") {
      return (
        <select
          className="v2InspectorDataValue"
          value={field.value === "true" ? "true" : "false"}
          aria-label={`${field.label} value`}
          onChange={(event) => updateSchemaField(field.id, { value: event.target.value })}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (field.type === "select") {
      return (
        <select
          className="v2InspectorDataValue"
          value={field.value}
          aria-label={`${field.label} value`}
          onChange={(event) => updateSchemaField(field.id, { value: event.target.value })}
        >
          <option value="">Choose value</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "json") {
      return (
        <textarea
          className="v2InspectorDataValue v2InspectorDataJsonValue"
          rows={4}
          value={field.value}
          placeholder={field.placeholder ?? "{}"}
          aria-label={`${field.label} value`}
          onChange={(event) => updateSchemaField(field.id, { value: event.target.value })}
        />
      );
    }

    return (
      <input
        className="v2InspectorDataValue"
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={field.value}
        placeholder={field.placeholder ?? (field.type === "number" ? "0" : "Value")}
        aria-label={`${field.label} value`}
        onChange={(event) => updateSchemaField(field.id, { value: event.target.value })}
      />
    );
  }

  return (
    <aside
      className="v2CardInspector v2ConnectorInspector"
      aria-label="Connector inspector"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="v2InspectorHeader">
        <span className="v2InspectorTypeIcon v2ConnectorInspectorIcon" aria-hidden="true">
          <GitBranch size={18} strokeWidth={2.1} />
        </span>
        <div className="v2InspectorHeaderText">
          <span>{connection.title?.trim() || "Connector"}</span>
          <strong>{shortId(connection.id)}</strong>
        </div>
        <button
          type="button"
          className="v2InspectorDeleteButton v2ConnectorInspectorDeleteButton"
          onClick={() => void onDeleteConnection(connection.id).catch(() => {})}
        >
          <Trash2 size={14} strokeWidth={2.2} />
          <span>Delete</span>
        </button>
        <button
          type="button"
          className="v2InspectorCloseButton"
          aria-label="Close connector inspector"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      <div className="v2InspectorContent">
        <section className="v2InspectorHero v2InspectorEditor">
          <div className="v2InspectorField">
            <label htmlFor={`connector-title-${connection.id}`}>Name</label>
            <input
              id={`connector-title-${connection.id}`}
              className="v2InspectorTextInput"
              value={titleDraft}
              placeholder="Connector"
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveBasics();
                if (event.key === "Escape") cancelBasics();
              }}
            />
          </div>
          <div className="v2InspectorField">
            <label htmlFor={`connector-description-${connection.id}`}>Transfers / payload description</label>
            <textarea
              id={`connector-description-${connection.id}`}
              className="v2InspectorTextarea"
              rows={4}
              value={descriptionDraft}
              placeholder="Describe what information this connector transfers"
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void saveBasics();
                if (event.key === "Escape") cancelBasics();
              }}
            />
          </div>
          <div className="v2InspectorEditFooter">
            <span className={basicError ? "v2InspectorSaveStatusError" : ""}>
              {basicError ?? (basicDirty ? formatSaveStatus(saveStatus) : "No changes")}
            </span>
            <div className="v2InspectorEditActions">
              <button type="button" disabled={!basicDirty} onClick={cancelBasics}>
                Cancel
              </button>
              <button
                type="button"
                className="v2InspectorPrimaryAction"
                disabled={!basicDirty || saveStatus === "saving"}
                onClick={() => void saveBasics()}
              >
                Save
              </button>
            </div>
          </div>
        </section>

        <section className="v2InspectorSection">
          <h3>Route</h3>
          <div className="v2ConnectorRouteFlow">
            <strong>{cardTitle(sourceCard, connection.sourceCardId)}</strong>
            <span aria-hidden="true">→</span>
            <strong>{cardTitle(targetCard, connection.targetCardId)}</strong>
          </div>
          <dl className="v2InspectorAdvancedList">
            <div>
              <dt>From card</dt>
              <dd>{cardTitle(sourceCard, connection.sourceCardId)}</dd>
            </div>
            <div>
              <dt>Source slot</dt>
              <dd>{connection.sourcePortKey}</dd>
            </div>
            <div>
              <dt>To card</dt>
              <dd>{cardTitle(targetCard, connection.targetCardId)}</dd>
            </div>
            <div>
              <dt>Target slot</dt>
              <dd>{connection.targetPortKey}</dd>
            </div>
          </dl>
        </section>

        <section className="v2InspectorSection">
          <div className="v2InspectorSectionHeader">
            <div>
              <h3>Connection type</h3>
              <span>Choose which relationship schema this connector uses.</span>
            </div>
            <button
              type="button"
              className="v2InspectorAttachButton"
              onClick={() => onManageConnectionType(connectionType?.id ?? (selectedConnectionTypeValue || null))}
            >
              Manage type
            </button>
          </div>
          <label className="v2ConnectorTypeSelector">
            <span>Type</span>
            <select
              className="v2InspectorDataValue"
              value={selectedConnectionTypeValue}
              disabled={isTypeSaving || sortedConnectionTypes.length === 0}
              onChange={(event) => void updateConnectionTypeSelection(event.target.value)}
            >
              {connection.connectionTypeId && !connectionTypeIds.has(connection.connectionTypeId) ? (
                <option value="">Missing type</option>
              ) : null}
              {sortedConnectionTypes.length === 0 ? (
                <option value="">No connection types available</option>
              ) : null}
              {sortedConnectionTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.key})
                </option>
              ))}
            </select>
          </label>
          <p className={typeError ? "v2InspectorDataError" : "v2ConnectorTypeHint"}>
            {typeError ??
              (isTypeSaving
                ? "Saving type..."
                : "Retyping preserves connector data, files, route, and visual style.")}
          </p>
        </section>

        <section className="v2InspectorSection">
          <div className="v2InspectorSectionHeader">
            <div>
              <h3>{hasSchemaFields ? "Relationship fields" : "Relationship data"}</h3>
              <span>{connectionType?.name ?? "Generic"} type</span>
            </div>
            <div className="v2InspectorSectionActions">
              {hasSchemaFields || isDataEditing ? (
                <button type="button" className="v2InspectorAttachButton" onClick={addDataField}>
                  <Plus size={14} strokeWidth={2.2} />
                  Add extra field
                </button>
              ) : (
                <button
                  type="button"
                  className="v2InspectorAttachButton"
                  onClick={connectionDataEntries.length === 0 ? addDataField : startDataEditing}
                >
                  <Plus size={14} strokeWidth={2.2} />
                  {connectionDataEntries.length === 0 ? "Add field" : "Edit"}
                </button>
              )}
            </div>
          </div>
          {hasSchemaFields ? (
            <>
              <div className="v2InspectorDataEditor">
                {schemaDraftFields.map((field) => (
                  <div key={field.id} className="v2InspectorDataRow">
                    <div className="v2InspectorSchemaFieldHeader">
                      <div>
                        <strong>
                          {field.label}
                          {field.required ? <span aria-label="required"> *</span> : null}
                        </strong>
                        <span>{field.key}</span>
                      </div>
                      <em>{field.type}</em>
                    </div>
                    {field.description ? (
                      <p className="v2InspectorSchemaFieldDescription">{field.description}</p>
                    ) : null}
                    {renderSchemaValueControl(field)}
                    {schemaFieldErrors[field.id] ? (
                      <p className="v2InspectorDataError">{schemaFieldErrors[field.id]}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="v2InspectorSubsectionHeader">
                <h4>Extra data</h4>
              </div>
              {dataDraft.length === 0 ? (
                <p className="v2InspectorEmpty">No extra data</p>
              ) : (
                <div className="v2InspectorDataEditor">
                  {dataDraft.map((field) => (
                    <div key={field.id} className="v2InspectorDataRow">
                      <div className="v2InspectorDataRowGrid">
                        <input
                          className="v2InspectorDataKeyInput"
                          value={field.key}
                          placeholder="key"
                          onChange={(event) => updateDataField(field.id, { key: event.target.value })}
                        />
                        <select
                          className="v2InspectorDataTypeSelect"
                          value={field.type}
                          onChange={(event) =>
                            updateDataField(field.id, { type: event.target.value as DataFieldType })
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
                          aria-label="Delete extra connector data field"
                          onClick={() => deleteDataField(field.id)}
                        >
                          <Trash2 size={14} strokeWidth={2.1} />
                        </button>
                      </div>
                      {renderValueControl(field)}
                      {dataFieldErrors[field.id] ? (
                        <p className="v2InspectorDataError">{dataFieldErrors[field.id]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <div className="v2InspectorDataFooter">
                <span className={dataError ? "v2InspectorSaveStatusError" : ""}>
                  {dataError ?? (dataDirty ? formatSaveStatus(saveStatus) : "No changes")}
                </span>
                <div className="v2InspectorEditActions">
                  <button type="button" disabled={!dataDirty} onClick={cancelData}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="v2InspectorPrimaryAction"
                    disabled={!dataDirty || saveStatus === "saving"}
                    onClick={() => void saveData()}
                  >
                    Save
                  </button>
                </div>
              </div>
            </>
          ) : !isDataEditing ? (
            connectionDataEntries.length === 0 ? (
              <p className="v2InspectorEmpty">No relationship data</p>
            ) : (
              <div className="v2InspectorDataReadList">
                {connectionDataEntries.map(([key, value]) => (
                  <div key={key} className="v2InspectorDataReadRow">
                    <strong>{key}</strong>
                    <span>{formatDataValue(value)}</span>
                  </div>
                ))}
              </div>
            )
          ) : dataDraft.length === 0 ? (
            <p className="v2InspectorEmpty">No relationship data</p>
          ) : (
            <div className="v2InspectorDataEditor">
              {dataDraft.map((field) => (
                <div key={field.id} className="v2InspectorDataRow">
                  <div className="v2InspectorDataRowGrid">
                    <input
                      className="v2InspectorDataKeyInput"
                      value={field.key}
                      placeholder="key"
                      onChange={(event) => updateDataField(field.id, { key: event.target.value })}
                    />
                    <select
                      className="v2InspectorDataTypeSelect"
                      value={field.type}
                      onChange={(event) =>
                        updateDataField(field.id, { type: event.target.value as DataFieldType })
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
                      aria-label="Delete connector data field"
                      onClick={() => deleteDataField(field.id)}
                    >
                      <Trash2 size={14} strokeWidth={2.1} />
                    </button>
                  </div>
                  {renderValueControl(field)}
                  {dataFieldErrors[field.id] ? (
                    <p className="v2InspectorDataError">{dataFieldErrors[field.id]}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {!hasSchemaFields && isDataEditing ? (
            <div className="v2InspectorDataFooter">
              <span className={dataError ? "v2InspectorSaveStatusError" : ""}>
                {dataError ?? (dataDirty ? formatSaveStatus(saveStatus) : "No changes")}
              </span>
              <div className="v2InspectorEditActions">
                <button type="button" disabled={!dataDirty} onClick={cancelData}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="v2InspectorPrimaryAction"
                  disabled={!dataDirty || saveStatus === "saving"}
                  onClick={() => void saveData()}
                >
                  Save
                </button>
              </div>
            </div>
          ) : null}
          <p className="v2InspectorHint">
            Use fields like quantity, unit, note, or role. Formulas are a future layer on top of relationship data.
          </p>
        </section>

        <V2ConnectorFilesSection connectionId={connection.id} />

        <section className="v2InspectorSection">
          <details className="v2InspectorDetails">
            <summary>Advanced</summary>
            <dl className="v2InspectorAdvancedList">
              <div>
                <dt>connection id</dt>
                <dd>{connection.id}</dd>
              </div>
              <div>
                <dt>sourceCardId</dt>
                <dd>{connection.sourceCardId}</dd>
              </div>
              <div>
                <dt>targetCardId</dt>
                <dd>{connection.targetCardId}</dd>
              </div>
              <div>
                <dt>sourcePortKey</dt>
                <dd>{connection.sourcePortKey}</dd>
              </div>
              <div>
                <dt>targetPortKey</dt>
                <dd>{connection.targetPortKey}</dd>
              </div>
            </dl>
          </details>
        </section>
      </div>
    </aside>
  );
}
