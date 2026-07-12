"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftToLine, ArrowRightToLine, CircleAlert, LoaderCircle, Minus, RotateCcw, Spline, Waypoints, X } from "lucide-react";
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
}: Props) {
  const [draft, setDraft] = useState<VisualStyleDraft>(() =>
    normalizeStyle(connection.visualStyle)
  );
  const [error, setError] = useState<string | null>(null);
  const connectionIdRef = useRef(connection.id);

  const savedSignature = useMemo(
    () => styleSignature(connection.visualStyle),
    [connection.visualStyle]
  );
  const draftSignature = useMemo(() => styleSignature(draft), [draft]);
  const isDirty = draftSignature !== savedSignature;

  useEffect(() => {
    const connectionChanged = connectionIdRef.current !== connection.id;
    if (!connectionChanged && (isDirty || saveStatus === "saving")) return;
    connectionIdRef.current = connection.id;
    setDraft(normalizeStyle(connection.visualStyle));
    setError(null);
  }, [connection.id, connection.visualStyle, isDirty, saveStatus]);

  useEffect(() => {
    if (!isDirty || saveStatus === "saving") return;
    const timeout = window.setTimeout(() => {
      setError(null);
      void onSave(connection.id, draft).catch(() => setError("Could not save connector style."));
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draftSignature, connection.id, savedSignature, saveStatus, onSave]);

  function updateDraft(patch: Partial<VisualStyleDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onPreview(connection.id, next);
      return next;
    });
    setError(null);
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

  async function closeEditor() {
    if (isDirty) {
      try {
        await onSave(connection.id, draft);
      } catch {
        setError("Could not save connector style.");
        return;
      }
    }
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
          <input
            type="color"
            aria-label="Color"
            value={draft.strokeColor}
            onChange={(event) => updateDraft({ strokeColor: event.target.value })}
          />
        </label>
        <label className="v2ConnectorVisualTool" title="Width">
          <Minus aria-hidden="true" size={14} />
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
          <Spline aria-hidden="true" size={14} />
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
          <ArrowLeftToLine aria-hidden="true" size={14} />
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
          <ArrowRightToLine aria-hidden="true" size={14} />
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
          <Waypoints aria-hidden="true" size={14} />
          <span className="visuallyHidden">Geometry</span>
        </button>
        <button
          type="button"
          className="v2ConnectorVisualIconButton"
          title="Reset route"
          disabled={saveStatus === "saving" || (draft.routeMode === "auto" && draft.waypoints.length === 0)}
          onClick={() => void resetRoute()}
        >
          <RotateCcw aria-hidden="true" size={14} />
          <span className="visuallyHidden">Reset route</span>
        </button>
        {(saveStatus === "saving" || isDirty) ? <LoaderCircle className="v2InspectorSpinner" size={15} aria-label="Saving" /> : null}
        {error ? <CircleAlert className="v2ConnectorVisualEditError" size={15} aria-label={error} /> : null}
        <button
          type="button"
          className="v2ConnectorVisualIconButton"
          title="Close"
          aria-label="Close connector visual editor"
          onClick={() => void closeEditor()}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}
