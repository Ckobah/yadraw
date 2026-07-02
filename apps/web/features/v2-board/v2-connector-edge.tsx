"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { V2Connection, V2ConnectionVisualStyle, V2ConnectionWaypoint } from "@yadraw/shared";

export type V2ConnectorEdgeData = {
  connection: V2Connection;
  isVisualEditing?: boolean;
  onPreviewVisualStyle?: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => void;
  onSaveVisualStyle?: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => Promise<void> | void;
};

type V2ConnectorEdgeModel = Edge<V2ConnectorEdgeData>;

type Point = V2ConnectionWaypoint;

const MAX_WAYPOINTS = 20;

function isFinitePoint(point: V2ConnectionWaypoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function getWaypoints(visualStyle: V2ConnectionVisualStyle | undefined): Point[] {
  if (visualStyle?.routeMode !== "manual" || !Array.isArray(visualStyle.waypoints)) {
    return [];
  }

  return visualStyle.waypoints.filter(isFinitePoint).slice(0, MAX_WAYPOINTS);
}

function buildManualPath(points: Point[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  const rest = points.slice(1);
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")}`;
}

function buildSegmentPath(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

function getPolylineLabelPosition(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  if (points.length === 1) return first;

  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? first;
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return points[Math.floor(points.length / 2)] ?? first;

  let remaining = totalLength / 2;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index] ?? 0;
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) continue;
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    remaining -= length;
  }

  return points[points.length - 1] ?? first;
}

function getStrokeColor(visualStyle: V2ConnectionVisualStyle | undefined): string {
  return visualStyle?.strokeColor ?? "var(--line-strong)";
}

function getStrokeWidth(visualStyle: V2ConnectionVisualStyle | undefined): number {
  return visualStyle?.strokeWidth ?? 1.5;
}

function getCornerRadius(visualStyle: V2ConnectionVisualStyle | undefined): number {
  return visualStyle?.cornerRadius ?? 12;
}

function getEventFlowPoint(
  event: Pick<MouseEvent | PointerEvent, "clientX" | "clientY">,
  screenToFlowPosition: (point: Point) => Point
): Point {
  return screenToFlowPosition({ x: event.clientX, y: event.clientY });
}

export function V2ConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerStart,
  markerEnd,
  label,
  data,
}: EdgeProps<V2ConnectorEdgeModel>) {
  const { screenToFlowPosition } = useReactFlow();
  const connection = data?.connection;
  const visualStyle = connection?.visualStyle ?? {};
  const waypoints = getWaypoints(visualStyle);
  const isVisualEditing = Boolean(data?.isVisualEditing);
  const canEditGeometry = isVisualEditing && visualStyle.routeMode === "manual";
  const usesManualRoute = visualStyle.routeMode === "manual" && waypoints.length > 0;

  const automaticPathResult = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: getCornerRadius(visualStyle),
  });
  const automaticPath = automaticPathResult[0];
  const automaticLabel = { x: automaticPathResult[1], y: automaticPathResult[2] };
  const routePoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const manualPath = buildManualPath(routePoints);
  const labelPosition = usesManualRoute ? getPolylineLabelPosition(routePoints) : automaticLabel;
  const path = usesManualRoute ? manualPath : automaticPath;
  const baseStrokeWidth = getStrokeWidth(visualStyle);
  const strokeWidth = selected || isVisualEditing ? baseStrokeWidth + 1.25 : baseStrokeWidth;
  const edgeStyle: CSSProperties = {
    stroke: getStrokeColor(visualStyle),
    strokeWidth,
  };

  function previewWaypoints(nextWaypoints: Point[]) {
    if (!connection) return;
    data?.onPreviewVisualStyle?.(connection.id, {
      ...visualStyle,
      routeMode: nextWaypoints.length > 0 ? "manual" : "auto",
      waypoints: nextWaypoints,
    });
  }

  async function saveWaypoints(nextWaypoints: Point[]) {
    if (!connection) return;
    await data?.onSaveVisualStyle?.(connection.id, {
      ...visualStyle,
      routeMode: nextWaypoints.length > 0 ? "manual" : "auto",
      waypoints: nextWaypoints,
    });
  }

  function insertWaypoint(segmentIndex: number, point: Point): Point[] {
    const next = [...waypoints];
    const insertIndex = usesManualRoute
      ? Math.min(Math.max(segmentIndex, 0), next.length)
      : next.length;
    next.splice(insertIndex, 0, point);
    return next.slice(0, MAX_WAYPOINTS);
  }

  function handleSegmentDoubleClick(
    event: ReactMouseEvent<SVGPathElement>,
    segmentIndex: number
  ) {
    if (!canEditGeometry || !connection) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getEventFlowPoint(event.nativeEvent, screenToFlowPosition);
    const next = insertWaypoint(segmentIndex, point);
    previewWaypoints(next);
    void saveWaypoints(next);
  }

  function handleSegmentPointerDown(
    event: ReactPointerEvent<SVGPathElement>,
    segmentIndex: number
  ) {
    if (!canEditGeometry || !connection) return;
    event.preventDefault();
    event.stopPropagation();

    const start = { x: event.clientX, y: event.clientY };
    let dragIndex: number | null = null;
    let latestWaypoints = waypoints;
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
      if (distance < 3 && dragIndex === null) return;
      didDrag = true;
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);

      if (dragIndex === null) {
        const inserted = insertWaypoint(segmentIndex, point);
        dragIndex = usesManualRoute
          ? Math.min(Math.max(segmentIndex, 0), waypoints.length)
          : inserted.length - 1;
        latestWaypoints = inserted;
      } else {
        latestWaypoints = latestWaypoints.map((waypoint, index) =>
          index === dragIndex ? point : waypoint
        );
      }

      previewWaypoints(latestWaypoints);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (didDrag) {
        void saveWaypoints(latestWaypoints);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleWaypointPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    waypointIndex: number
  ) {
    if (!canEditGeometry || !connection) return;
    event.preventDefault();
    event.stopPropagation();

    let latestWaypoints = waypoints;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);
      latestWaypoints = waypoints.map((waypoint, index) =>
        index === waypointIndex ? point : waypoint
      );
      previewWaypoints(latestWaypoints);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      void saveWaypoints(latestWaypoints);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleWaypointDoubleClick(
    event: ReactMouseEvent<HTMLButtonElement>,
    waypointIndex: number
  ) {
    if (!canEditGeometry || !connection) return;
    event.preventDefault();
    event.stopPropagation();
    const next = waypoints.filter((_waypoint, index) => index !== waypointIndex);
    previewWaypoints(next);
    void saveWaypoints(next);
  }

  const segmentPaths = usesManualRoute
    ? routePoints.slice(0, -1).flatMap((point, index) => {
        const nextPoint = routePoints[index + 1];
        return nextPoint ? [buildSegmentPath(point, nextPoint)] : [];
      })
    : [automaticPath];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={edgeStyle}
        interactionWidth={24}
      />
      {segmentPaths.map((segmentPath, index) => (
        <path
          key={`${id}-segment-${index}`}
          className={canEditGeometry ? "v2ConnectorEdgeInteraction" : "v2ConnectorEdgeInteractionHidden"}
          d={segmentPath}
          fill="none"
          onDoubleClick={(event) => handleSegmentDoubleClick(event, index)}
          onPointerDown={(event) => handleSegmentPointerDown(event, index)}
        />
      ))}
      <EdgeLabelRenderer>
        {label ? (
          <div
            className="v2ConnectorEdgeLabel"
            style={{
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
            }}
          >
            {label}
          </div>
        ) : null}
        {canEditGeometry
          ? waypoints.map((waypoint, index) => (
              <button
                key={`${id}-waypoint-${index}`}
                type="button"
                className="v2ConnectorWaypointHandle nodrag nopan"
                aria-label={`Bend point ${index + 1}`}
                style={{
                  transform: `translate(-50%, -50%) translate(${waypoint.x}px, ${waypoint.y}px)`,
                }}
                onPointerDown={(event) => handleWaypointPointerDown(event, index)}
                onDoubleClick={(event) => handleWaypointDoubleClick(event, index)}
                onClick={(event) => event.stopPropagation()}
              />
            ))
          : null}
      </EdgeLabelRenderer>
    </>
  );
}
