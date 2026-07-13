"use client";

import { useId } from "react";
import type { V2ConnectionMarker, V2ConnectionVisualStyle } from "@yadraw/shared";

type Props = {
  style?: V2ConnectionVisualStyle;
  className?: string;
  label?: string;
};

const DEFAULT_STYLE = {
  strokeColor: "#475467",
  strokeWidth: 2,
  cornerRadius: 12,
  markerStart: "none" as V2ConnectionMarker,
  markerEnd: "arrow" as V2ConnectionMarker,
};

function MarkerShape({ marker }: { marker: V2ConnectionMarker }) {
  if (marker === "circle") return <circle cx="7" cy="7" r="3.5" fill="context-stroke" />;
  if (marker === "square") return <rect x="3" y="3" width="8" height="8" rx="1" fill="context-stroke" />;
  if (marker === "triangle") return <path d="M 0 0 L 14 7 L 0 14 Z" fill="context-stroke" />;
  if (marker === "reverseArrow") {
    return <path d="M 14 0 L 0 7 L 14 14 Z" fill="context-stroke" />;
  }
  return <path d="M 0 0 L 14 7 L 0 14 Z" fill="context-stroke" />;
}

function markerReferenceX(marker: V2ConnectionMarker): number {
  if (marker === "reverseArrow") return 14;
  if (marker === "circle" || marker === "square") return 7;
  return 0;
}

export function V2ConnectorStylePreview({ style, className = "", label }: Props) {
  const id = useId().replace(/:/g, "");
  const strokeColor = style?.strokeColor ?? DEFAULT_STYLE.strokeColor;
  const strokeWidth = style?.strokeWidth ?? DEFAULT_STYLE.strokeWidth;
  const cornerRadius = style?.cornerRadius ?? DEFAULT_STYLE.cornerRadius;
  const markerStart = style?.markerStart ?? DEFAULT_STYLE.markerStart;
  const markerEnd = style?.markerEnd ?? DEFAULT_STYLE.markerEnd;
  const startId = `${id}-start`;
  const endId = `${id}-end`;
  const bend = Math.max(0, Math.min(20, cornerRadius));
  const path = bend === 0
    ? "M 18 28 L 60 28 L 60 12 L 104 12"
    : `M 18 28 L ${60 - bend} 28 Q 60 28 60 ${28 - bend} L 60 ${12 + bend} Q 60 12 ${60 + bend} 12 L 104 12`;

  return (
    <div className={`v2ConnectorStylePreview ${className}`.trim()}>
      <svg viewBox="0 0 122 40" role="img" aria-label={label ?? "Connector preview"}>
        <defs>
          {markerStart !== "none" ? (
            <marker id={startId} viewBox="0 0 14 14" refX={markerReferenceX(markerStart)} refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <MarkerShape marker={markerStart} />
            </marker>
          ) : null}
          {markerEnd !== "none" ? (
            <marker id={endId} viewBox="0 0 14 14" refX={markerReferenceX(markerEnd)} refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto">
              <MarkerShape marker={markerEnd} />
            </marker>
          ) : null}
        </defs>
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          markerStart={markerStart === "none" ? undefined : `url(#${startId})`}
          markerEnd={markerEnd === "none" ? undefined : `url(#${endId})`}
        />
      </svg>
    </div>
  );
}
