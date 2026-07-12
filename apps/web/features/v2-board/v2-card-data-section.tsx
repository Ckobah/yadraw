"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { V2Card, V2CardType } from "@yadraw/shared";
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

type V2CardDataSectionProps = {
  card: V2Card;
  cardType: V2CardType | null;
  saveStatus: SaveStatus;
  onUpdateCardData: (
    cardId: string,
    data: Record<string, unknown>
  ) => Promise<void>;
};

export function V2CardDataSection({
  card,
  cardType,
  saveStatus,
  onUpdateCardData,
}: V2CardDataSectionProps) {
  const schemaFields = useMemo(() => cardType?.schema?.fields ?? [], [cardType?.schema?.fields]);
  const hasSchemaFields = schemaFields.length > 0;
  const { schemaKeys, extraData } = splitSchemaAndExtraData(schemaFields, card.data);
  const dataRecordForDraft = hasSchemaFields ? extraData : card.data;
  const [dataDraftFields, setDataDraftFields] = useState<DataFieldDraft[]>(
    () => createDataDraftFromRecord(dataRecordForDraft)
  );
  const [schemaDraftFields, setSchemaDraftFields] = useState<SchemaFieldDraft[]>(
    () => createSchemaDraftFromData(schemaFields, card.data)
  );
  const [dataFieldErrors, setDataFieldErrors] = useState<Record<string, string>>({});
  const [schemaFieldErrors, setSchemaFieldErrors] = useState<Record<string, string>>({});
  const [dataError, setDataError] = useState<string | null>(null);
  const editorIdentity = `${card.id}:${JSON.stringify(schemaFields)}`;
  const editorIdentityRef = useRef(editorIdentity);

  const dataBaseline = normalizeDataDraftForCompare(
    createDataDraftFromRecord(dataRecordForDraft)
  );
  const schemaBaseline = normalizeSchemaDraftForCompare(
    createSchemaDraftFromData(schemaFields, card.data)
  );
  const hasDataChanges =
    normalizeDataDraftForCompare(dataDraftFields) !== dataBaseline ||
    normalizeSchemaDraftForCompare(schemaDraftFields) !== schemaBaseline;

  useEffect(() => {
    const editorChanged = editorIdentityRef.current !== editorIdentity;
    if (!editorChanged && (hasDataChanges || saveStatus === "saving")) return;
    editorIdentityRef.current = editorIdentity;
    const nextSplit = splitSchemaAndExtraData(schemaFields, card.data);
    setDataDraftFields(createDataDraftFromRecord(hasSchemaFields ? nextSplit.extraData : card.data));
    setSchemaDraftFields(createSchemaDraftFromData(schemaFields, card.data));
    setDataFieldErrors({});
    setSchemaFieldErrors({});
    setDataError(null);
  }, [card.data, editorIdentity, hasDataChanges, hasSchemaFields, saveStatus, schemaFields]);

  useEffect(() => {
    if (!hasDataChanges || saveStatus === "saving") return;
    const timeout = window.setTimeout(() => void saveDataDraft(), 600);
    return () => window.clearTimeout(timeout);
  }, [dataDraftFields, schemaDraftFields, card.id, card.data, saveStatus]);

  function updateSchemaField(
    fieldId: string,
    patch: Partial<Pick<SchemaFieldDraft, "value">>
  ) {
    setSchemaDraftFields((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    );
    setSchemaFieldErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setDataError(null);
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

  async function saveDataDraft() {
    const parsedSchema = hasSchemaFields
      ? validateAndBuildSchemaDataRecord(schemaDraftFields)
      : { ok: true as const, data: {} };
    const parsed = validateAndBuildDataRecord(
      dataDraftFields,
      hasSchemaFields ? { reservedKeys: schemaKeys } : {}
    );
    if (!parsedSchema.ok) {
      setSchemaFieldErrors(parsedSchema.errors);
    } else {
      setSchemaFieldErrors({});
    }
    if (!parsed.ok) {
      setDataFieldErrors(parsed.errors);
      setDataError("Fix data errors");
      return;
    } else {
      setDataFieldErrors({});
    }

    if (!parsedSchema.ok) {
      setDataError("Fix schema field errors");
      return;
    }

    setDataError(null);
    try {
      await onUpdateCardData(card.id, {
        ...parsedSchema.data,
        ...parsed.data,
      });
    } catch {
      setDataError("Could not save data");
    }
  }

  return (
    <div
      className="v2InspectorDataSections"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void saveDataDraft();
      }}
    >
      {hasSchemaFields ? (
        <section className="v2InspectorSection">
          <h3>Fields</h3>
          <div className="v2InspectorDataEditor">
            {schemaDraftFields.map((field) => (
              <div key={field.id} className="v2InspectorDataRow">
                <div className="v2InspectorSchemaFieldHeader">
                  <div>
                    <strong>{field.label}</strong>
                  </div>
                  {field.required ? <em aria-label="Required">*</em> : null}
                </div>
                <SchemaFieldInput field={field} onChange={updateSchemaField} />
                {schemaFieldErrors[field.id] ? (
                  <p className="v2InspectorDataError">{schemaFieldErrors[field.id]}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="v2InspectorSection">
        <h3>{hasSchemaFields ? "Extra data" : "Data"}</h3>
        {dataDraftFields.length === 0 ? (
          null
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
          {dataError ? <span className="v2InspectorSaveStatusError">{dataError}</span> : <span />}
          <div className="v2InspectorEditActions">
            <button className="v2InspectorIconAction"
              type="button"
              aria-label="Add field"
              title="Add field"
              onMouseDown={(event) => event.preventDefault()}
              onClick={addDataField}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SchemaFieldInput({
  field,
  onChange,
}: {
  field: SchemaFieldDraft;
  onChange: (fieldId: string, patch: Partial<Pick<SchemaFieldDraft, "value">>) => void;
}) {
  if (field.type === "json") {
    return (
      <textarea
        className="v2InspectorDataValue v2InspectorDataJsonValue"
        value={field.value}
        placeholder={field.placeholder ?? "{}"}
        aria-label={`${field.label} value`}
        onChange={(event) => onChange(field.id, { value: event.target.value })}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <select
        className="v2InspectorDataValue"
        value={field.value === "true" ? "true" : "false"}
        aria-label={`${field.label} value`}
        onChange={(event) => onChange(field.id, { value: event.target.value })}
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
        onChange={(event) => onChange(field.id, { value: event.target.value })}
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

  return (
    <input
      className="v2InspectorDataValue"
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={field.value}
      placeholder={field.placeholder ?? (field.type === "number" ? "0" : "value")}
      aria-label={`${field.label} value`}
      onChange={(event) => onChange(field.id, { value: event.target.value })}
    />
  );
}
