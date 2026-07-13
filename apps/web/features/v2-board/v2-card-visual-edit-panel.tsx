"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  Italic,
  CircleAlert,
  Lock,
  LockOpen,
  Underline,
  X,
} from "lucide-react";
import type { V2Card, V2CardVisualStyle } from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";

type Props = {
  card: V2Card;
  saveStatus: SaveStatus;
  onUpdateVisualStyle: (cardId: string, patch: V2CardVisualStyle) => Promise<void> | void;
  onClose: () => void;
};

export function V2CardVisualEditPanel({
  card,
  saveStatus,
  onUpdateVisualStyle,
  onClose,
}: Props) {
  const visualStyle = card.visualStyle ?? {};

  function updateVisualStyle(patch: V2CardVisualStyle) {
    void Promise.resolve(onUpdateVisualStyle(card.id, patch)).catch(() => {});
  }

  return (
    <section
      className="v2ConnectorVisualEditPanel v2CardVisualEditPanel nodrag nopan"
      aria-label="Card visual editor"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="v2ConnectorVisualEditToolbar v2CardVisualEditToolbar" role="toolbar" aria-label="Card visual style">
        <div className="v2CardVisualToolGroup" aria-label="Horizontal alignment">
          {[
            { value: "left" as const, icon: AlignLeft, label: "Left" },
            { value: "center" as const, icon: AlignCenter, label: "Center" },
            { value: "right" as const, icon: AlignRight, label: "Right" },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = (visualStyle.textAlign ?? "left") === item.value;
            return (
              <button
                key={item.value}
                type="button"
                className={`v2ConnectorVisualIconButton${isActive ? " v2ConnectorVisualIconButtonActive" : ""}`}
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
                onClick={() => updateVisualStyle({ textAlign: item.value })}
              >
                <Icon size={14} strokeWidth={2.2} />
              </button>
            );
          })}
          <button
            type="button"
            className={`v2ConnectorVisualIconButton${visualStyle.bodyVerticalAlign === "center" ? " v2ConnectorVisualIconButtonActive" : ""}`}
            title="Vertical center"
            aria-label="Vertical center"
            aria-pressed={visualStyle.bodyVerticalAlign === "center"}
            onClick={() =>
              updateVisualStyle({
                bodyVerticalAlign: visualStyle.bodyVerticalAlign === "center" ? "top" : "center",
              })
            }
          >
            <ChevronsUpDown size={14} strokeWidth={2.2} />
          </button>
        </div>

        <label className="v2ConnectorVisualTool v2CardVisualFontTool" title="Font">
          <span className="visuallyHidden">Font</span>
          <select
            aria-label="Font"
            value={visualStyle.fontFamily ?? ""}
            onChange={(event) => updateVisualStyle({ fontFamily: event.target.value || undefined })}
          >
            <option value="">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="monospace">Mono</option>
          </select>
        </label>

        <div className="v2CardVisualToolGroup" aria-label="Text style">
          <button
            type="button"
            className={`v2ConnectorVisualIconButton${visualStyle.fontWeight === "700" ? " v2ConnectorVisualIconButtonActive" : ""}`}
            title="Bold"
            aria-label="Bold"
            aria-pressed={visualStyle.fontWeight === "700"}
            onClick={() => updateVisualStyle({ fontWeight: visualStyle.fontWeight === "700" ? undefined : "700" })}
          >
            <Bold size={14} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className={`v2ConnectorVisualIconButton${visualStyle.fontStyle === "italic" ? " v2ConnectorVisualIconButtonActive" : ""}`}
            title="Italic"
            aria-label="Italic"
            aria-pressed={visualStyle.fontStyle === "italic"}
            onClick={() => updateVisualStyle({ fontStyle: visualStyle.fontStyle === "italic" ? undefined : "italic" })}
          >
            <Italic size={14} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className={`v2ConnectorVisualIconButton${visualStyle.textDecoration === "underline" ? " v2ConnectorVisualIconButtonActive" : ""}`}
            title="Underline"
            aria-label="Underline"
            aria-pressed={visualStyle.textDecoration === "underline"}
            onClick={() =>
              updateVisualStyle({
                textDecoration: visualStyle.textDecoration === "underline" ? undefined : "underline",
              })
            }
          >
            <Underline size={14} strokeWidth={2.4} />
          </button>
        </div>

        <label className="v2ConnectorVisualTool v2ConnectorVisualColorTool" title="Text color">
          <span aria-hidden="true" className="v2ConnectorVisualIcon">A</span>
          <span className="visuallyHidden">Text color</span>
          <input
            type="color"
            aria-label="Text color"
            value={visualStyle.textColor ?? "#101828"}
            onChange={(event) => updateVisualStyle({ textColor: event.target.value })}
          />
        </label>

        <button
          type="button"
          className={`v2ConnectorVisualIconButton${visualStyle.locked ? " v2ConnectorVisualIconButtonActive" : ""}`}
          title={visualStyle.locked ? "Unlock card" : "Lock card"}
          aria-label={visualStyle.locked ? "Unlock card" : "Lock card"}
          aria-pressed={visualStyle.locked === true}
          onClick={() => updateVisualStyle({ locked: visualStyle.locked ? undefined : true })}
        >
          {visualStyle.locked ? (
            <Lock size={14} strokeWidth={2.3} />
          ) : (
            <LockOpen size={14} strokeWidth={2.3} />
          )}
        </button>

        {saveStatus === "error" ? <CircleAlert className="v2ConnectorVisualEditError" size={15} aria-label="Save failed" /> : null}

        <button
          type="button"
          className="v2ConnectorVisualIconButton"
          title="Close"
          aria-label="Close card visual editor"
          onClick={onClose}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}
