"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { V2Card } from "@yadraw/shared";
import {
  createDataDraftFromRecord,
  createLocalFieldId,
  normalizeDataDraftForCompare,
  validateAndBuildDataRecord,
  type DataFieldDraft,
  type DataFieldType,
  type SaveStatus,
} from "./v2-card-inspector-helpers";

type V2CardDataSectionProps = {
  card: V2Card;
  saveStatus: SaveStatus;
  onUpdateCardData: (
    cardId: string,
    data: Record<string, unknown>
  ) => Promise<void>;
};

export function V2CardDataSection({
  card,
  saveStatus,
  onUpdateCardData,
}: V2CardDataSectionProps) {
  const [dataDraftFields, setDataDraftFields] = useState<DataFieldDraft[]>(
    () => createDataDraftFromRecord(card.data)
  );
  const [dataFieldErrors, setDataFieldErrors] = useState<Record<string, string>>({});
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    setDataDraftFields(createDataDraftFromRecord(card.data));
    setDataFieldErrors({});
    setDataError(null);
  }, [card.id, card.data]);

  const dataBaseline = normalizeDataDraftForCompare(
    createDataDraftFromRecord(card.data)
  );
  const hasDataChanges =
    normalizeDataDraftForCompare(dataDraftFields) !== dataBaseline;

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
    setDataDraftFields(createDataDraftFromRecord(card.data));
    setDataFieldErrors({});
    setDataError(null);
  }

  async function saveDataDraft() {
    const parsed = validateAndBuildDataRecord(dataDraftFields);
    if (!parsed.ok) {
      setDataFieldErrors(parsed.errors);
      setDataError("Fix data errors");
      return;
    }

    setDataFieldErrors({});
    setDataError(null);
    try {
      await onUpdateCardData(card.id, parsed.data);
    } catch {
      setDataError("Could not save data");
    }
  }

  return (
    <section className="v2InspectorSection">
      <h3>Data</h3>
      {dataDraftFields.length === 0 ? (
        <p className="v2InspectorEmpty">No data</p>
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
            + Add field
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelDataDraft}
            disabled={!hasDataChanges || saveStatus === "saving"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="v2InspectorPrimaryAction"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void saveDataDraft()}
            disabled={!hasDataChanges || saveStatus === "saving"}
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
