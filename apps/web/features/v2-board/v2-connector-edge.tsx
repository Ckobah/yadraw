"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import {
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { V2Connection, V2ConnectionMarker, V2ConnectionVisualStyle, V2ConnectionWaypoint } from "@yadraw/shared";

export type V2ConnectorEdgeData = {
  connection: V2Connection;
  isVisualEditing?: boolean;
  onSelect?: (connectionId: string) => void;
  onOpenEditor?: (connectionId: string) => void;
  onPreviewVisualStyle?: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => void;
  onSaveVisualStyle?: (connectionId: string, visualStyle: V2ConnectionVisualStyle) => Promise<void> | void;
};

type V2ConnectorEdgeModel = Edge<V2ConnectorEdgeData>;

type Point = V2ConnectionWaypoint;

const MAX_WAYPOINTS = 20;
const DUPLICATE_POINT_DISTANCE = 6;
const SNAP_ANGLE_DEGREES = 5;
const SNAP_ANGLE_RADIANS = (SNAP_ANGLE_DEGREES * Math.PI) / 180;
const PORT_RADIUS = 8;

function markerClearance(marker: V2ConnectionMarker | undefined): number {
  if (marker === "circle" || marker === "square") return 4;
  return 0;
}

function offsetFromPort(point: Point, position: unknown, marker: V2ConnectionMarker | undefined): Point {
  const distance = PORT_RADIUS + markerClearance(marker);
  switch (String(position).toLowerCase()) {
    case "left": return { x: point.x - distance, y: point.y };
    case "right": return { x: point.x + distance, y: point.y };
    case "top": return { x: point.x, y: point.y - distance };
    case "bottom": return { x: point.x, y: point.y + distance };
    default: return point;
  }
}

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

function isNearHorizontal(dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false;
  const angle = Math.abs(Math.atan2(dy, dx));
  return angle <= SNAP_ANGLE_RADIANS || Math.PI - angle <= SNAP_ANGLE_RADIANS;
}

function isNearVertical(dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false;
  const angle = Math.abs(Math.atan2(dy, dx));
  return Math.abs(Math.PI / 2 - angle) <= SNAP_ANGLE_RADIANS;
}

function snapPointToNeighbor(point: Point, neighbor: Point): { point: Point; snapped: boolean } {
  const dx = point.x - neighbor.x;
  const dy = point.y - neighbor.y;
  if (isNearHorizontal(dx, dy)) {
    return { point: { x: point.x, y: neighbor.y }, snapped: true };
  }
  if (isNearVertical(dx, dy)) {
    return { point: { x: neighbor.x, y: point.y }, snapped: true };
  }
  return { point, snapped: false };
}

function snapBendPoint(point: Point, previous: Point | undefined, next: Point | undefined): { point: Point; snapped: boolean } {
  if (!previous && !next) return { point, snapped: false };

  let snapped = false;
  let nextPoint = point;
  if (previous) {
    const result = snapPointToNeighbor(nextPoint, previous);
    nextPoint = result.point;
    snapped ||= result.snapped;
  }
  if (next) {
    const result = snapPointToNeighbor(nextPoint, next);
    nextPoint = result.point;
    snapped ||= result.snapped;
  }
  return { point: nextPoint, snapped };
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
  const sourceSide = String(sourcePosition).toLowerCase();
  const targetSide = String(targetPosition).toLowerCase();
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
  return visualStyle?.strokeColor ?? "var(--yd-graph-connector)";
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

function clampSegmentIndex(index: number | null | undefined, segmentCount: number): number | null {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || segmentCount <= 0) {
    return null;
  }
  return Math.min(index, segmentCount - 1);
}

function moveWaypointSegment(waypoints: Point[], segmentIndex: number, delta: Point): Point[] {
  return normalizeWaypoints(
    waypoints.map((waypoint, index) => {
      const movePreviousEndpoint = index === segmentIndex - 1;
      const moveNextEndpoint = index === segmentIndex;
      return movePreviousEndpoint || moveNextEndpoint
        ? { x: waypoint.x + delta.x, y: waypoint.y + delta.y }
        : waypoint;
    })
  );
}

function getSegmentOrientation(start: Point, end: Point): "horizontal" | "vertical" {
  return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? "horizontal" : "vertical";
}

function projectPointToSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const ratio = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio,
  };
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
  const [isSnapActive, setIsSnapActive] = useState(false);
  const connection = data?.connection;
  const visualStyle = connection?.visualStyle ?? {};
  const storedWaypoints = getWaypoints(visualStyle);
  const isVisualEditing = Boolean(data?.isVisualEditing);
  const canEditGeometry = isVisualEditing;
  const visibleSourcePoint = offsetFromPort(
    { x: sourceX, y: sourceY },
    sourcePosition,
    visualStyle.markerStart ?? "none"
  );
  const visibleTargetPoint = offsetFromPort(
    { x: targetX, y: targetY },
    targetPosition,
    visualStyle.markerEnd ?? "arrow"
  );
  const sourcePoint = visibleSourcePoint;
  const targetPoint = visibleTargetPoint;

  const automaticPathResult = getSmoothStepPath({
    sourceX: visibleSourcePoint.x,
    sourceY: visibleSourcePoint.y,
    sourcePosition,
    targetX: visibleTargetPoint.x,
    targetY: visibleTargetPoint.y,
    targetPosition,
    borderRadius: getCornerRadius(visualStyle),
  });
  const automaticPath = automaticPathResult[0];
  const automaticLabel = { x: automaticPathResult[1], y: automaticPathResult[2] };
  const materializedAutoWaypoints = getAutoRouteWaypoints({
    sourceX: visibleSourcePoint.x,
    sourceY: visibleSourcePoint.y,
    targetX: visibleTargetPoint.x,
    targetY: visibleTargetPoint.y,
    sourcePosition,
    targetPosition,
  });
  const waypoints =
    visualStyle.routeMode === "manual" && storedWaypoints.length === 0
      ? materializedAutoWaypoints
      : storedWaypoints;
  const usesManualRoute = visualStyle.routeMode === "manual" && waypoints.length > 0;
  const routePoints = [visibleSourcePoint, ...waypoints, visibleTargetPoint];
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
    stroke: selected ? "var(--yd-graph-connector-selected)" : getStrokeColor(visualStyle),
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
    return [sourcePoint, ...nextWaypoints, targetPoint];
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
    const baseRoutePoints = getRoutePoints(baseWaypoints);
    const baseLabelPosition = savedLabelPosition ?? labelPosition;
    const baseLabelSegmentIndex =
      clampSegmentIndex(visualStyle.labelSegmentIndex, baseRoutePoints.length - 1) ??
      nearestSegmentIndex(baseRoutePoints, baseLabelPosition);
    const shouldMoveLabel = baseLabelSegmentIndex === segmentIndex;
    let latestWaypoints = baseWaypoints;
    let latestLabelPosition = baseLabelPosition;
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);
      if (dragDistance < 3 && !didDrag) return;
      didDrag = true;
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const delta = { x: point.x - startFlow.x, y: point.y - startFlow.y };
      latestWaypoints = moveWaypointSegment(baseWaypoints, segmentIndex, delta);
      setIsSnapActive(true);
      latestLabelPosition = shouldMoveLabel
        ? { x: baseLabelPosition.x + delta.x, y: baseLabelPosition.y + delta.y }
        : baseLabelPosition;

      previewVisualStyle({
        routeMode: "manual",
        waypoints: latestWaypoints,
        ...(shouldMoveLabel
          ? { labelPosition: latestLabelPosition, labelSegmentIndex: segmentIndex }
          : {}),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setIsSnapActive(false);
      if (didDrag) {
        void saveVisualStyle({
          routeMode: "manual",
          waypoints: latestWaypoints,
          ...(shouldMoveLabel
            ? { labelPosition: latestLabelPosition, labelSegmentIndex: segmentIndex }
            : {}),
        });
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
      const rawPoint = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const routeBeforeDrag = getRoutePoints(waypoints);
      const previous = routeBeforeDrag[waypointIndex];
      const next = routeBeforeDrag[waypointIndex + 2];
      const { point, snapped } = moveEvent.altKey
        ? { point: rawPoint, snapped: false }
        : snapBendPoint(rawPoint, previous, next);
      setIsSnapActive(snapped);
      latestWaypoints = waypoints.map((waypoint, index) =>
        index === waypointIndex ? point : waypoint
      );
      previewWaypoints(latestWaypoints);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setIsSnapActive(false);
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
    if (!connection) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    data?.onSelect?.(connection.id);

    const startClient = { x: event.clientX, y: event.clientY };
    const currentLabelPosition = savedLabelPosition ?? labelPosition;
    const baseWaypoints = getEditableWaypoints();
    const baseRoutePoints = getRoutePoints(baseWaypoints);
    const segmentIndex =
      clampSegmentIndex(visualStyle.labelSegmentIndex, baseRoutePoints.length - 1) ??
      nearestSegmentIndex(baseRoutePoints, currentLabelPosition);
    const segmentStart = baseRoutePoints[segmentIndex] ?? baseRoutePoints[0] ?? currentLabelPosition;
    const segmentEnd = baseRoutePoints[segmentIndex + 1] ?? segmentStart;
    const segmentOrientation = getSegmentOrientation(segmentStart, segmentEnd);
    let latestLabelPosition = currentLabelPosition;
    let latestWaypoints = baseWaypoints;
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);
      if (dragDistance < 3 && !didDrag) return;
      didDrag = true;
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const startFlow = getEventFlowPoint({ clientX: startClient.x, clientY: startClient.y }, screenToFlowPosition);
      const delta = { x: point.x - startFlow.x, y: point.y - startFlow.y };
      const segmentDelta =
        segmentOrientation === "horizontal"
          ? { x: 0, y: delta.y }
          : { x: delta.x, y: 0 };
      latestWaypoints = moveWaypointSegment(baseWaypoints, segmentIndex, segmentDelta);
      setIsSnapActive(true);
      const movedRoutePoints = getRoutePoints(latestWaypoints);
      const movedSegmentStart = movedRoutePoints[segmentIndex] ?? segmentStart;
      const movedSegmentEnd = movedRoutePoints[segmentIndex + 1] ?? movedSegmentStart;
      const requestedLabelPosition = {
        x: currentLabelPosition.x + delta.x,
        y: currentLabelPosition.y + delta.y,
      };
      latestLabelPosition = projectPointToSegment(
        requestedLabelPosition,
        movedSegmentStart,
        movedSegmentEnd
      );
      previewVisualStyle({
        routeMode: "manual",
        waypoints: latestWaypoints,
        labelPosition: latestLabelPosition,
        labelSegmentIndex: segmentIndex,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setIsSnapActive(false);
      if (didDrag) {
        void saveVisualStyle({
          routeMode: "manual",
          waypoints: latestWaypoints,
          labelPosition: latestLabelPosition,
          labelSegmentIndex: segmentIndex,
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
          className={
            canEditGeometry
              ? `v2ConnectorEdgeInteraction ${isSnapActive ? "v2ConnectorEdgeInteractionSnap" : ""}`
              : "v2ConnectorEdgeInteractionHidden"
          }
          d={segmentPath}
          fill="none"
          onClick={(event) => {
            event.stopPropagation();
            if (connection && !isVisualEditing) data?.onSelect?.(connection.id);
          }}
          onDoubleClick={(event) => handleSegmentDoubleClick(event, index)}
          onPointerDown={(event) => handleSegmentPointerDown(event, index)}
        />
      ))}
      <EdgeLabelRenderer>
        {isSnapActive ? (
          <div
            className="v2ConnectorSnapIndicator"
            style={{
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y - 24}px)`,
            }}
          >
            Snap
          </div>
        ) : null}
        {label && visualStyle.showLabel !== false ? (
          <div
            className="v2ConnectorEdgeLabel v2ConnectorEdgeLabelDraggable nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`,
            }}
            onPointerDown={handleLabelPointerDown}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (connection) data?.onOpenEditor?.(connection.id);
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
