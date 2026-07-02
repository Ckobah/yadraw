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
const DUPLICATE_POINT_DISTANCE = 6;
const LABEL_WAYPOINT_DISTANCE = 28;

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

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeWaypoints(points: Point[]): Point[] {
  const normalized: Point[] = [];
  for (const point of points) {
    if (!isFinitePoint(point)) continue;
    const previous = normalized[normalized.length - 1];
    if (previous && distance(previous, point) < DUPLICATE_POINT_DISTANCE) continue;
    normalized.push(point);
    if (normalized.length >= MAX_WAYPOINTS) break;
  }
  return normalized;
}

function getAutoRouteWaypoints(params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: unknown;
  targetPosition: unknown;
}): Point[] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = params;
  const sourceSide = String(sourcePosition);
  const targetSide = String(targetPosition);
  const horizontal =
    sourceSide === "right" ||
    sourceSide === "left" ||
    targetSide === "right" ||
    targetSide === "left";

  if (horizontal) {
    const midX = sourceX + (targetX - sourceX) / 2;
    return normalizeWaypoints([
      { x: midX, y: sourceY },
      { x: midX, y: targetY },
    ]);
  }

  const midY = sourceY + (targetY - sourceY) / 2;
  return normalizeWaypoints([
    { x: sourceX, y: midY },
    { x: targetX, y: midY },
  ]);
}

function buildRoundedManualPath(points: Point[], radius: number): string {
  const first = points[0];
  if (!first) return "";
  if (points.length < 3 || radius <= 0) return buildManualPath(points);

  const parts = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    if (!previous || !corner || !next) continue;

    const previousLength = distance(previous, corner);
    const nextLength = distance(corner, next);
    const safeRadius = Math.min(radius, previousLength / 2, nextLength / 2);

    if (safeRadius <= 0.5 || previousLength <= 0 || nextLength <= 0) {
      parts.push(`L ${corner.x} ${corner.y}`);
      continue;
    }

    const beforeCorner = {
      x: corner.x + ((previous.x - corner.x) / previousLength) * safeRadius,
      y: corner.y + ((previous.y - corner.y) / previousLength) * safeRadius,
    };
    const afterCorner = {
      x: corner.x + ((next.x - corner.x) / nextLength) * safeRadius,
      y: corner.y + ((next.y - corner.y) / nextLength) * safeRadius,
    };

    parts.push(`L ${beforeCorner.x} ${beforeCorner.y}`);
    parts.push(`Q ${corner.x} ${corner.y} ${afterCorner.x} ${afterCorner.y}`);
  }

  const last = points[points.length - 1];
  if (last) parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
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

function nearestSegmentIndex(points: Point[], point: Point): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const projection = {
      x: start.x + dx * ratio,
      y: start.y + dy * ratio,
    };
    const currentDistance = distance(point, projection);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      bestIndex = index;
    }
  }

  return bestIndex;
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
  const storedWaypoints = getWaypoints(visualStyle);
  const isVisualEditing = Boolean(data?.isVisualEditing);
  const canEditGeometry = isVisualEditing && visualStyle.routeMode === "manual";

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
  const materializedAutoWaypoints = getAutoRouteWaypoints({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const waypoints =
    visualStyle.routeMode === "manual" && storedWaypoints.length === 0
      ? materializedAutoWaypoints
      : storedWaypoints;
  const usesManualRoute = visualStyle.routeMode === "manual" && waypoints.length > 0;
  const routePoints = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }];
  const manualPath = buildRoundedManualPath(routePoints, getCornerRadius(visualStyle));
  const savedLabelPosition =
    visualStyle.routeMode === "manual" && visualStyle.labelPosition && isFinitePoint(visualStyle.labelPosition)
      ? visualStyle.labelPosition
      : null;
  const labelPosition = savedLabelPosition ?? (usesManualRoute ? getPolylineLabelPosition(routePoints) : automaticLabel);
  const path = usesManualRoute ? manualPath : automaticPath;
  const baseStrokeWidth = getStrokeWidth(visualStyle);
  const strokeWidth = selected || isVisualEditing ? baseStrokeWidth + 1.25 : baseStrokeWidth;
  const edgeStyle: CSSProperties = {
    stroke: getStrokeColor(visualStyle),
    strokeWidth,
  };

  function previewVisualStyle(patch: V2ConnectionVisualStyle) {
    if (!connection) return;
    data?.onPreviewVisualStyle?.(connection.id, {
      ...visualStyle,
      ...patch,
    });
  }

  async function saveVisualStyle(patch: V2ConnectionVisualStyle) {
    if (!connection) return;
    await data?.onSaveVisualStyle?.(connection.id, {
      ...visualStyle,
      ...patch,
    });
  }

  function previewWaypoints(nextWaypoints: Point[]) {
    previewVisualStyle({
      routeMode: nextWaypoints.length > 0 ? "manual" : "auto",
      waypoints: normalizeWaypoints(nextWaypoints),
    });
  }

  async function saveWaypoints(nextWaypoints: Point[]) {
    await saveVisualStyle({
      routeMode: nextWaypoints.length > 0 ? "manual" : "auto",
      waypoints: normalizeWaypoints(nextWaypoints),
    });
  }

  function insertWaypoint(baseWaypoints: Point[], segmentIndex: number, point: Point): Point[] {
    const next = normalizeWaypoints(baseWaypoints);
    const insertIndex = Math.min(Math.max(segmentIndex, 0), next.length);
    next.splice(insertIndex, 0, point);
    return normalizeWaypoints(next).slice(0, MAX_WAYPOINTS);
  }

  function getEditableWaypoints(): Point[] {
    return normalizeWaypoints(waypoints.length > 0 ? waypoints : materializedAutoWaypoints);
  }

  function getRoutePoints(nextWaypoints: Point[]): Point[] {
    return [{ x: sourceX, y: sourceY }, ...nextWaypoints, { x: targetX, y: targetY }];
  }

  function updateLabelRoute(labelPoint: Point, baseWaypoints = getEditableWaypoints()): Point[] {
    const normalized = normalizeWaypoints(baseWaypoints);
    const nearestWaypointIndex = normalized.findIndex(
      (waypoint) => distance(waypoint, labelPoint) < LABEL_WAYPOINT_DISTANCE
    );

    if (nearestWaypointIndex >= 0) {
      return normalized.map((waypoint, index) =>
        index === nearestWaypointIndex ? labelPoint : waypoint
      );
    }

    const insertAfterSegment = nearestSegmentIndex(getRoutePoints(normalized), labelPoint);
    return insertWaypoint(normalized, insertAfterSegment, labelPoint);
  }

  function handleSegmentDoubleClick(
    event: ReactMouseEvent<SVGPathElement>,
    segmentIndex: number
  ) {
    if (!canEditGeometry || !connection) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getEventFlowPoint(event.nativeEvent, screenToFlowPosition);
    const next = insertWaypoint(getEditableWaypoints(), segmentIndex, point);
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

    const startClient = { x: event.clientX, y: event.clientY };
    const startFlow = getEventFlowPoint(event.nativeEvent, screenToFlowPosition);
    const baseWaypoints = getEditableWaypoints();
    let latestWaypoints = baseWaypoints;
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);
      if (dragDistance < 3 && !didDrag) return;
      didDrag = true;
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const delta = { x: point.x - startFlow.x, y: point.y - startFlow.y };
      const moved = baseWaypoints.map((waypoint, index) => {
        const movePreviousEndpoint = index === segmentIndex - 1;
        const moveNextEndpoint = index === segmentIndex;
        return movePreviousEndpoint || moveNextEndpoint
          ? { x: waypoint.x + delta.x, y: waypoint.y + delta.y }
          : waypoint;
      });
      latestWaypoints = normalizeWaypoints(moved);

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

  function handleLabelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isVisualEditing || !connection) return;
    event.preventDefault();
    event.stopPropagation();

    const startClient = { x: event.clientX, y: event.clientY };
    const currentLabelPosition = savedLabelPosition ?? labelPosition;
    const baseWaypoints = getEditableWaypoints();
    let latestLabelPosition = currentLabelPosition;
    let latestWaypoints = updateLabelRoute(currentLabelPosition, baseWaypoints);
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);
      if (dragDistance < 3 && !didDrag) return;
      didDrag = true;
      latestLabelPosition = getEventFlowPoint(moveEvent, screenToFlowPosition);
      latestWaypoints = updateLabelRoute(latestLabelPosition, baseWaypoints);
      previewVisualStyle({
        routeMode: "manual",
        waypoints: latestWaypoints,
        labelPosition: latestLabelPosition,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (didDrag) {
        void saveVisualStyle({
          routeMode: "manual",
          waypoints: latestWaypoints,
          labelPosition: latestLabelPosition,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
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
            className={`v2ConnectorEdgeLabel ${isVisualEditing ? "v2ConnectorEdgeLabelEditable nodrag nopan" : ""}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
            }}
            onPointerDown={handleLabelPointerDown}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
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
