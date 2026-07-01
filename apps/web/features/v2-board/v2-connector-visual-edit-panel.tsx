"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  V2Connection,
  V2ConnectionMarker,
  V2ConnectionRouteMode,
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

const markerOptions: Array<{ value: V2ConnectionMarker; label: string }> = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "reverseArrow", label: "Reverse arrow" },
  { value: "triangle", label: "Triangle" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
];

const routeModeOptions: Array<{ value: V2ConnectionRouteMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];

function normalizeStyle(style: V2ConnectionVisualStyle | undefined): Required<V2ConnectionVisualStyle> {
  return {
    strokeColor: style?.strokeColor ?? "#475467",
    strokeWidth: style?.strokeWidth ?? 2,
    cornerRadius: style?.cornerRadius ?? 12,
    markerStart: style?.markerStart ?? "none",
    markerEnd: style?.markerEnd ?? "arrow",
    routeMode: style?.routeMode ?? "auto",
    waypoints: Array.isArray(style?.waypoints) ? style.waypoints : [],
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
  const [draft, setDraft] = useState<Required<V2ConnectionVisualStyle>>(() =>
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

  function updateDraft(patch: Partial<Required<V2ConnectionVisualStyle>>) {
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
    const next = { ...draft, routeMode: "auto" as const, waypoints: [] };
    setDraft(next);
    setError(null);
    onPreview(connection.id, next);
    try {
      await onSave(connection.id, next);
    } catch {
      setError("Could not reset connector route.");
    }
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
      <header className="v2ConnectorVisualEditHeader">
        <div>
          <strong>Connector style</strong>
          <span>{saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Visual edit"}</span>
        </div>
        <button type="button" aria-label="Close connector visual editor" onClick={cancel}>
          <X size={15} strokeWidth={2.2} />
        </button>
      </header>

      <div className="v2ConnectorVisualEditGrid">
        <label>
          <span>Color</span>
          <input
            type="color"
            value={draft.strokeColor}
            onChange={(event) => updateDraft({ strokeColor: event.target.value })}
          />
        </label>
        <label>
          <span>Width</span>
          <input
            type="number"
            min={1}
            max={12}
            step={0.5}
            value={draft.strokeWidth}
            onChange={(event) =>
              updateDraft({ strokeWidth: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })
            }
          />
        </label>
        <label>
          <span>Corner radius</span>
          <input
            type="number"
            min={0}
            max={48}
            step={2}
            value={draft.cornerRadius}
            onChange={(event) =>
              updateDraft({ cornerRadius: Math.min(48, Math.max(0, Number(event.target.value) || 0)) })
            }
          />
        </label>
        <label>
          <span>Start</span>
          <select
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
        <label>
          <span>End</span>
          <select
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
      </div>

      <div className="v2ConnectorVisualEditGeometry">
        <div className="v2ConnectorVisualEditGeometryHeader">
          <div>
            <strong>Geometry</strong>
            <span>{draft.waypoints.length} bend point{draft.waypoints.length === 1 ? "" : "s"}</span>
          </div>
          <button
            type="button"
            className="v2ConnectorVisualEditReset"
            disabled={saveStatus === "saving" || (draft.routeMode === "auto" && draft.waypoints.length === 0)}
            onClick={() => void resetRoute()}
          >
            Reset route
          </button>
        </div>
        <label>
          <span>Route</span>
          <select
            value={draft.routeMode}
            onChange={(event) =>
              updateDraft({ routeMode: event.target.value as V2ConnectionRouteMode })
            }
          >
            {routeModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p>
          Double-click a connector segment to add a bend point. Drag points to reshape the route.
        </p>
      </div>

      <footer className="v2ConnectorVisualEditFooter">
        <span className={error ? "v2ConnectorVisualEditError" : ""}>
          {error ?? (isDirty ? "Unsaved changes" : "No changes")}
        </span>
        <div>
          <button type="button" disabled={!isDirty || saveStatus === "saving"} onClick={cancel}>
            Cancel
          </button>
          <button
            type="button"
            className="v2ConnectorVisualEditPrimary"
            disabled={!isDirty || saveStatus === "saving"}
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </footer>
    </section>
  );
}
