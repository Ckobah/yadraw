"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  V2ConnectionType,
  V2ConnectionTypeSchema,
  V2CreateConnectionTypeRequest,
  V2UpdateConnectionTypeRequest,
} from "@yadraw/shared";
import {
  buildV2CardTypeSchemaFromDrafts,
  createV2CardTypeSchemaFieldDrafts,
  V2CardTypeSchemaEditor,
  type V2CardTypeSchemaFieldDraft,
} from "./v2-card-type-schema-editor";
import { useDialogFocus } from "./use-dialog-focus";

type ConnectionTypeManagerMode = "existing" | "new";

type ConnectionTypeDraft = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  fields: V2CardTypeSchemaFieldDraft[];
  defaultVisualStyle: Record<string, unknown>;
};

type V2ConnectionTypeManagerProps = {
  connectionTypes: V2ConnectionType[];
  initialConnectionTypeId?: string | null;
  onCreateConnectionType: (input: V2CreateConnectionTypeRequest) => Promise<V2ConnectionType>;
  onUpdateConnectionType: (
    connectionTypeId: string,
    input: V2UpdateConnectionTypeRequest
  ) => Promise<V2ConnectionType>;
  onClose: () => void;
};

const CONNECTION_TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function schemaDraftsFromConnectionSchema(
  schema: V2ConnectionTypeSchema | null | undefined
): V2CardTypeSchemaFieldDraft[] {
  return createV2CardTypeSchemaFieldDrafts(schema as Parameters<typeof createV2CardTypeSchemaFieldDrafts>[0]);
}

function buildConnectionSchemaFromDrafts(
  fields: V2CardTypeSchemaFieldDraft[]
): { ok: true; schema: V2ConnectionTypeSchema } | { ok: false; error: string } {
  const result = buildV2CardTypeSchemaFromDrafts(fields);
  if (!result.ok) return result;
  return { ok: true, schema: result.schema as V2ConnectionTypeSchema };
}

function draftFromConnectionType(connectionType: V2ConnectionType): ConnectionTypeDraft {
  return {
    id: connectionType.id,
    key: connectionType.key,
    name: connectionType.name,
    description: connectionType.description ?? "",
    fields: schemaDraftsFromConnectionSchema(connectionType.schema),
    defaultVisualStyle: connectionType.defaultVisualStyle ?? {},
  };
}

function emptyDraft(): ConnectionTypeDraft {
  return {
    id: null,
    key: "",
    name: "",
    description: "",
    fields: [],
    defaultVisualStyle: {},
  };
}

export function V2ConnectionTypeManager({
  connectionTypes,
  initialConnectionTypeId,
  onCreateConnectionType,
  onUpdateConnectionType,
  onClose,
}: V2ConnectionTypeManagerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => { void closeManager(); });
  const sortedConnectionTypes = useMemo(
    () => [...connectionTypes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [connectionTypes]
  );
  const initialType =
    sortedConnectionTypes.find((connectionType) => connectionType.id === initialConnectionTypeId) ??
    sortedConnectionTypes[0] ??
    null;
  const [mode, setMode] = useState<ConnectionTypeManagerMode>(initialType ? "existing" : "new");
  const [selectedConnectionTypeId, setSelectedConnectionTypeId] = useState<string | null>(
    initialType?.id ?? null
  );
  const [draft, setDraft] = useState<ConnectionTypeDraft>(() =>
    initialType ? draftFromConnectionType(initialType) : emptyDraft()
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedConnectionType =
    connectionTypes.find((connectionType) => connectionType.id === selectedConnectionTypeId) ?? null;
  const hasDraftChanges =
    mode === "existing" && selectedConnectionType
      ? JSON.stringify(draft) !== JSON.stringify(draftFromConnectionType(selectedConnectionType))
      : false;

  useEffect(() => {
    if (mode !== "existing" || !selectedConnectionTypeId) return;
    const selected = connectionTypes.find((connectionType) => connectionType.id === selectedConnectionTypeId);
    if (!selected) return;
    setDraft(draftFromConnectionType(selected));
  }, [connectionTypes, mode, selectedConnectionTypeId]);

  useEffect(() => {
    if (!hasDraftChanges || isSaving) return;
    const timeout = window.setTimeout(() => void saveDraft(), 700);
    return () => window.clearTimeout(timeout);
  }, [draft, mode, selectedConnectionTypeId, isSaving]);

  async function selectExisting(connectionType: V2ConnectionType) {
    if (isSaving) return;
    if (hasDraftChanges && !(await saveDraft())) return;
    setMode("existing");
    setSelectedConnectionTypeId(connectionType.id);
    setDraft(draftFromConnectionType(connectionType));
    setError(null);
    setMessage(null);
  }

  async function selectNewType() {
    if (isSaving) return;
    if (hasDraftChanges && !(await saveDraft())) return;
    setMode("new");
    setSelectedConnectionTypeId(null);
    setDraft(emptyDraft());
    setError(null);
    setMessage(null);
  }

  function updateDraft(patch: Partial<Omit<ConnectionTypeDraft, "id">>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
    setMessage(null);
  }

  function validateDraft() {
    const key = draft.key.trim();
    const name = draft.name.trim();
    if (!key) return "Key is required.";
    if (!CONNECTION_TYPE_KEY_PATTERN.test(key)) {
      return "Key must start with a lowercase letter and use lowercase letters, numbers, or underscores.";
    }
    if (!name) return "Name is required.";
    const duplicate = connectionTypes.some(
      (connectionType) => connectionType.key === key && connectionType.id !== draft.id
    );
    if (duplicate) return "Connection type key must be unique.";
    return null;
  }

  async function saveDraft(): Promise<boolean> {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return false;
    }
    const schemaResult = buildConnectionSchemaFromDrafts(draft.fields);
    if (!schemaResult.ok) {
      setError(schemaResult.error);
      return false;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "new") {
        const created = await onCreateConnectionType({
          key: draft.key.trim(),
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          schema: schemaResult.schema,
          defaultVisualStyle: draft.defaultVisualStyle,
        });
        setMode("existing");
        setSelectedConnectionTypeId(created.id);
        setDraft(draftFromConnectionType(created));
        setMessage("Connection type created.");
        return true;
      }

      if (!draft.id) {
        setError("Select a connection type to update.");
        return false;
      }
      const updated = await onUpdateConnectionType(draft.id, {
        key: draft.key.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        schema: schemaResult.schema,
        defaultVisualStyle: draft.defaultVisualStyle,
      });
      setDraft(draftFromConnectionType(updated));
      setMessage("Connection type saved.");
      return true;
    } catch {
      setError("Could not save connection type.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function closeManager() {
    if (hasDraftChanges) {
      if (!(await saveDraft())) return;
    }
    onClose();
  }

  return (
    <div
      ref={dialogRef}
      className="v2ModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Connection Type Manager"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          void closeManager();
        }
      }}
    >
      <section className="v2CardTypeManager" onPointerDown={(event) => event.stopPropagation()}>
        <header className="v2CardTypeManagerHeader">
          <div>
            <h2>Connection Type Manager</h2>
            <p>Edit relationship type schemas. Values remain on each connector.</p>
          </div>
          <button type="button" className="v2InspectorCloseButton" aria-label="Close manager" onClick={() => void closeManager()}>
            <X size={16} strokeWidth={2.2} />
          </button>
        </header>

        <div className="v2CardTypeManagerBody">
          <aside className="v2CardTypeManagerList" aria-label="Connection types">
            <button
              type="button"
              className={`v2CardTypeManagerNewButton${mode === "new" ? " v2CardTypeManagerRowActive" : ""}`}
              onClick={() => void selectNewType()}
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>New type</span>
            </button>
            {sortedConnectionTypes.length === 0 ? (
              <p className="v2InspectorEmpty">No connection types yet.</p>
            ) : (
              sortedConnectionTypes.map((connectionType) => (
                <button
                  key={connectionType.id}
                  type="button"
                  className={`v2CardTypeManagerRow${
                    selectedConnectionTypeId === connectionType.id && mode === "existing"
                      ? " v2CardTypeManagerRowActive"
                      : ""
                  }`}
                  onClick={() => void selectExisting(connectionType)}
                >
                  <strong>{connectionType.name}</strong>
                  <span>{connectionType.key}</span>
                </button>
              ))
            )}
          </aside>

          <div className="v2CardTypeManagerEditor">
            <section className="v2CardTypeManagerSection">
              <div className="v2CardTypeManagerSectionHeader">
                <div>
                  <h3>{mode === "new" ? "New connection type" : "Type details"}</h3>
                  <span>Definitions are stored in connection_types.schema, not connection.data.</span>
                </div>
              </div>
              <div className="v2CardTypeManagerDetailsGrid">
                <label>
                  <span>Key</span>
                  <input
                    className="v2InspectorDataValue"
                    value={draft.key}
                    placeholder="contains"
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ key: event.target.value })}
                  />
                </label>
                <label>
                  <span>Name</span>
                  <input
                    className="v2InspectorDataValue"
                    value={draft.name}
                    placeholder="Contains"
                    disabled={isSaving}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                  />
                </label>
              </div>
              <label className="v2CardTypeManagerDescriptionField">
                <span>Description</span>
                <textarea
                  className="v2InspectorDataValue v2InspectorDataJsonValue"
                  value={draft.description}
                  placeholder="Optional description"
                  disabled={isSaving}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
              </label>
            </section>

            <V2CardTypeSchemaEditor
              title="Relationship fields"
              description="Fields rendered in the connector inspector for this relationship type."
              fields={draft.fields}
              disabled={isSaving}
              onChange={(fields) => updateDraft({ fields })}
            />

            {error ? <p className="v2InspectorDataError">{error}</p> : null}
            {message ? <p className="v2CardTypeManagerSuccess">{message}</p> : null}

            <div className="v2InspectorEditActions v2CardTypeManagerActions">
              {mode === "existing" ? (
                <span>{error ? "Auto-save failed" : isSaving || hasDraftChanges ? "Saving..." : "Saved"}</span>
              ) : (
                <button
                  type="button"
                  className="v2InspectorPrimaryAction"
                  onClick={() => void saveDraft()}
                  disabled={isSaving}
                >
                  <Plus size={13} strokeWidth={2.2} />
                  <span>{isSaving ? "Creating..." : "Create connection type"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
