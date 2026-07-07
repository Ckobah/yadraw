"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import type {
  V2Connection,
  V2ConnectionMarker,
  V2ConnectionVisualStyle,
} from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";

type Props = {
  connection: V2Connection;
  saveStatus: SaveStatus;
  onPreview: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => void;
  onSave: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => Promise<void>;
  onCancel: () => void;
  onDelete: (connectionId: string) => Promise<void>;
};

type VisualStyleDraft = Required<Omit<V2ConnectionVisualStyle, "labelPosition" | "labelSegmentIndex">> & {
  labelPosition?: V2ConnectionVisualStyle["labelPosition"];
  labelSegmentIndex?: V2ConnectionVisualStyle["labelSegmentIndex"];
};

const markerOptions: Array<{ value: V2ConnectionMarker; label: string }> = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "reverseArrow", label: "Reverse arrow" },
  { value: "triangle", label: "Triangle" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
];

function normalizeStyle(style: V2ConnectionVisualStyle | undefined): VisualStyleDraft {
  return {
    strokeColor: style?.strokeColor ?? "#475467",
    strokeWidth: style?.strokeWidth ?? 2,
    cornerRadius: style?.cornerRadius ?? 12,
    markerStart: style?.markerStart ?? "none",
    markerEnd: style?.markerEnd ?? "arrow",
    routeMode: style?.routeMode ?? "auto",
    waypoints: Array.isArray(style?.waypoints) ? style.waypoints : [],
    ...(style?.routeMode === "manual" && style?.labelPosition ? { labelPosition: style.labelPosition } : {}),
    ...(style?.routeMode === "manual" && typeof style?.labelSegmentIndex === "number"
      ? { labelSegmentIndex: style.labelSegmentIndex }
      : {}),
  };
}

function styleSignature(style: V2ConnectionVisualStyle): string {
  return JSON.stringify(normalizeStyle(style));
}

export function V2ConnectorVisualEditPanel({
  connection,
  saveStatus,
  onPreview,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<VisualStyleDraft>(() =>
    normalizeStyle(connection.visualStyle)
  );
  const [error, setError] = useState<string | null>(null);

  const savedSignature = useMemo(
    () => styleSignature(connection.visualStyle),
    [connection.visualStyle]
  );
  const draftSignature = useMemo(() => styleSignature(draft), [draft]);
  const isDirty = draftSignature !== savedSignature;

  useEffect(() => {
    setDraft(normalizeStyle(connection.visualStyle));
    setError(null);
  }, [connection.id, connection.visualStyle]);

  function updateDraft(patch: Partial<VisualStyleDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onPreview(connection.id, next);
      return next;
    });
    setError(null);
  }

  async function save() {
    setError(null);
    try {
      await onSave(connection.id, draft);
    } catch {
      setError("Could not save connector style.");
    }
  }

  async function resetRoute() {
    const next = {
      ...draft,
      routeMode: "auto" as const,
      waypoints: [],
      labelPosition: null,
      labelSegmentIndex: null,
    };
    setDraft(next);
    setError(null);
    onPreview(connection.id, next);
    try {
      await onSave(connection.id, next);
    } catch {
      setError("Could not reset connector route.");
    }
  }

  function toggleGeometry() {
    updateDraft(
      draft.routeMode === "manual"
        ? { routeMode: "auto", labelPosition: null, labelSegmentIndex: null }
        : { routeMode: "manual" }
    );
  }

  function cancel() {
    const saved = normalizeStyle(connection.visualStyle);
    setDraft(saved);
    setError(null);
    onPreview(connection.id, saved);
    onCancel();
  }

  return (
    <section
      className="v2ConnectorVisualEditPanel nodrag nopan"
      aria-label="Connector visual editor"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="v2ConnectorVisualEditToolbar" role="toolbar" aria-label="Connector visual style">
        <label className="v2ConnectorVisualTool v2ConnectorVisualColorTool" title="Color">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">■</span>
          <span className="visuallyHidden">Color</span>
          <input
            type="color"
            aria-label="Color"
            value={draft.strokeColor}
            onChange={(event) => updateDraft({ strokeColor: event.target.value })}
          />
        </label>
        <label className="v2ConnectorVisualTool" title="Width">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">━</span>
          <span className="visuallyHidden">Width</span>
          <input
            type="number"
            aria-label="Width"
            min={1}
            max={12}
            step={0.5}
            value={draft.strokeWidth}
            onChange={(event) =>
              updateDraft({ strokeWidth: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })
            }
          />
        </label>
        <label className="v2ConnectorVisualTool" title="Corner radius">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">⌜</span>
          <span className="visuallyHidden">Corner radius</span>
          <input
            type="number"
            aria-label="Corner radius"
            min={0}
            max={48}
            step={2}
            value={draft.cornerRadius}
            onChange={(event) =>
              updateDraft({ cornerRadius: Math.min(48, Math.max(0, Number(event.target.value) || 0)) })
            }
          />
        </label>
        <label className="v2ConnectorVisualTool" title="Start marker">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">⇤</span>
          <span className="visuallyHidden">Start marker</span>
          <select
            aria-label="Start marker"
            value={draft.markerStart}
            onChange={(event) => updateDraft({ markerStart: event.target.value as V2ConnectionMarker })}
          >
            {markerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="v2ConnectorVisualTool" title="End marker">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">⇥</span>
          <span className="visuallyHidden">End marker</span>
          <select
            aria-label="End marker"
            value={draft.markerEnd}
            onChange={(event) => updateDraft({ markerEnd: event.target.value as V2ConnectionMarker })}
          >
            {markerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`v2ConnectorVisualIconButton ${draft.routeMode === "manual" ? "v2ConnectorVisualIconButtonActive" : ""}`}
          title={`Geometry ${draft.routeMode === "manual" ? "on" : "off"} · ${draft.waypoints.length} bend point${draft.waypoints.length === 1 ? "" : "s"}`}
          aria-pressed={draft.routeMode === "manual"}
          onClick={toggleGeometry}
        >
          <span aria-hidden="true">⌁</span>
          <span className="visuallyHidden">Geometry</span>
        </button>
        <button
          type="button"
          className="v2ConnectorVisualIconButton"
          title="Reset route"
          disabled={saveStatus === "saving" || (draft.routeMode === "auto" && draft.waypoints.length === 0)}
          onClick={() => void resetRoute()}
        >
          <span aria-hidden="true">↺</span>
          <span className="visuallyHidden">Reset route</span>
        </button>
        <span
          className={error ? "v2ConnectorVisualEditError" : "v2ConnectorVisualEditStatus"}
          title="Status"
        >
          {error ?? (saveStatus === "saving" ? "Saving..." : isDirty ? "Unsaved" : "Saved")}
        </span>
        <button
          type="button"
          className="v2ConnectorVisualTextButton"
          title="Cancel"
          disabled={!isDirty || saveStatus === "saving"}
          onClick={cancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`v2ConnectorVisualTextButton v2ConnectorVisualSaveButton ${isDirty ? "v2ConnectorVisualSaveButtonDirty" : ""}`}
          title="Save"
          disabled={!isDirty || saveStatus === "saving"}
          onClick={() => void save()}
        >
          Save
        </button>
        <button
          type="button"
          className="v2ConnectorVisualIconButton v2ConnectorVisualDeleteButton"
          title="Delete connector"
          aria-label="Delete connector"
          onClick={() => void onDelete(connection.id).catch(() => {})}
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="v2ConnectorVisualIconButton"
          title="Close"
          aria-label="Close connector visual editor"
          onClick={cancel}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}
