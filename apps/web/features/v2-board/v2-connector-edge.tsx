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
  useEffect,
  useRef,
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
const ENDPOINT_GAP = 2;
const MARKER_FORWARD_LENGTH = 11;
const MANUAL_ENDPOINT_LEAD_LENGTH = MARKER_FORWARD_LENGTH * 2 + 2;
const ENDPOINT_ALIGNMENT_TOLERANCE = 0.5;

function markerClearance(marker: V2ConnectionMarker | undefined): number {
  if (marker && marker !== "none") return ENDPOINT_GAP + MARKER_FORWARD_LENGTH;
  return ENDPOINT_GAP;
}

function offsetFromPort(point: Point, position: unknown, marker: V2ConnectionMarker | undefined): Point {
  const distance = markerClearance(marker);
  switch (String(position).toLowerCase()) {
    case "left": return { x: point.x - distance, y: point.y };
    case "right": return { x: point.x + distance, y: point.y };
    case "top": return { x: point.x, y: point.y - distance };
    case "bottom": return { x: point.x, y: point.y + distance };
    default: return point;
  }
}

function getOutwardDirection(position: unknown): Point | null {
  switch (String(position).toLowerCase()) {
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
    case "top": return { x: 0, y: -1 };
    case "bottom": return { x: 0, y: 1 };
    default: return null;
  }
}

function getManualEndpointLeadPoint(
  endpoint: Point,
  position: unknown,
  adjacentWaypoint: Point | undefined
): Point {
  const direction = getOutwardDirection(position);
  if (!direction) return endpoint;

  if (adjacentWaypoint) {
    const delta = {
      x: adjacentWaypoint.x - endpoint.x,
      y: adjacentWaypoint.y - endpoint.y,
    };
    const outwardDistance = delta.x * direction.x + delta.y * direction.y;
    const lateralDistance = Math.abs(delta.x * direction.y - delta.y * direction.x);
    if (
      outwardDistance >= MARKER_FORWARD_LENGTH &&
      lateralDistance <= ENDPOINT_ALIGNMENT_TOLERANCE
    ) {
      return adjacentWaypoint;
    }
  }

  return {
    x: endpoint.x + direction.x * MANUAL_ENDPOINT_LEAD_LENGTH,
    y: endpoint.y + direction.y * MANUAL_ENDPOINT_LEAD_LENGTH,
  };
}

function buildManualRouteGeometry(
  sourcePoint: Point,
  sourcePosition: unknown,
  targetPoint: Point,
  targetPosition: unknown,
  waypoints: Point[]
): { routePoints: Point[]; editableRoutePoints: Point[] } {
  const sourceLead = getManualEndpointLeadPoint(sourcePoint, sourcePosition, waypoints[0]);
  const targetLead = getManualEndpointLeadPoint(
    targetPoint,
    targetPosition,
    waypoints[waypoints.length - 1]
  );
  return {
    routePoints: [sourcePoint, sourceLead, ...waypoints, targetLead, targetPoint],
    editableRoutePoints: [sourceLead, ...waypoints, targetLead],
  };
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

function getAutoRouteWaypoints(path: string): Point[] {
  const numberPattern = "-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
  const valuePattern = new RegExp(numberPattern, "gi");
  const commands = Array.from(path.matchAll(/([MLQ])([^MLQ]*)/gi), (match) => ({
    type: match[1]?.toUpperCase(),
    values: Array.from(match[2]?.matchAll(valuePattern) ?? [], (value) => Number(value[0])),
  }));
  const waypoints: Point[] = [];

  for (let index = 1; index < commands.length; index += 1) {
    const command = commands[index];
    if (!command) continue;
    if (command.type === "Q") {
      const [x, y] = command.values;
      if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
        waypoints.push({ x, y });
      }
      continue;
    }
    const nextCommand = commands[index + 1];
    const isFinalEndpoint = index === commands.length - 1;
    const isRoundedCornerApproach = nextCommand?.type === "Q";
    if (command.type === "L" && !isFinalEndpoint && !isRoundedCornerApproach) {
      const [x, y] = command.values;
      if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
        waypoints.push({ x, y });
      }
    }
  }
  return waypoints.slice(0, MAX_WAYPOINTS);
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

function resolveLabelAnchor(
  points: Point[],
  point: Point
): { position: Point; segmentIndex: number } | null {
  if (points.length < 2) return null;

  const segmentIndex = nearestSegmentIndex(points, point);
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  if (!start || !end) return null;

  return {
    position: projectPointToSegment(point, start, end),
    segmentIndex,
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
  const materializedRouteRef = useRef<string | null>(null);
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
  const materializedAutoWaypoints = getAutoRouteWaypoints(automaticPath);
  const waypoints =
    visualStyle.routeMode === "manual" && storedWaypoints.length === 0
      ? materializedAutoWaypoints
      : storedWaypoints;
  const usesManualRoute = visualStyle.routeMode === "manual" && waypoints.length > 0;
  const { routePoints, editableRoutePoints } = buildManualRouteGeometry(
    visibleSourcePoint,
    sourcePosition,
    visibleTargetPoint,
    targetPosition,
    waypoints
  );
  const manualPath = buildRoundedManualPath(routePoints, getCornerRadius(visualStyle));
  const savedLabelPosition =
    visualStyle.routeMode === "manual" && visualStyle.labelPosition && isFinitePoint(visualStyle.labelPosition)
      ? visualStyle.labelPosition
      : null;
  const savedLabelAnchor = savedLabelPosition
    ? resolveLabelAnchor(routePoints, savedLabelPosition)
    : null;
  const labelPosition =
    savedLabelAnchor?.position ?? (usesManualRoute ? getPolylineLabelPosition(routePoints) : automaticLabel);
  const path = usesManualRoute ? manualPath : automaticPath;
  const baseStrokeWidth = getStrokeWidth(visualStyle);
  const strokeWidth = selected || isVisualEditing ? baseStrokeWidth + 1.25 : baseStrokeWidth;
  const edgeStyle: CSSProperties = {
    stroke: selected ? "var(--yd-graph-connector-selected)" : getStrokeColor(visualStyle),
    strokeWidth,
    strokeLinecap: "butt",
  };

  const materializedRouteKey =
    connection &&
    isVisualEditing &&
    visualStyle.routeMode === "manual" &&
    storedWaypoints.length === 0 &&
    materializedAutoWaypoints.length > 0
      ? `${connection.id}:${JSON.stringify(materializedAutoWaypoints)}`
      : null;

  useEffect(() => {
    if (!connection || !materializedRouteKey) {
      materializedRouteRef.current = null;
      return;
    }
    if (materializedRouteRef.current === materializedRouteKey) return;
    materializedRouteRef.current = materializedRouteKey;
    void Promise.resolve(
      data?.onSaveVisualStyle?.(connection.id, {
        ...visualStyle,
        routeMode: "manual",
        waypoints: materializedAutoWaypoints,
      })
    ).catch(() => {
      if (materializedRouteRef.current === materializedRouteKey) {
        materializedRouteRef.current = null;
      }
    });
  }, [connection, data, materializedAutoWaypoints, materializedRouteKey, visualStyle]);

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

  function getSavedLabelPatch(
    nextWaypoints: Point[],
    requestedPosition: Point | null = savedLabelPosition
  ): Partial<Pick<V2ConnectionVisualStyle, "labelPosition" | "labelSegmentIndex">> {
    if (!requestedPosition) return {};
    const anchor = resolveLabelAnchor(getRoutePoints(nextWaypoints), requestedPosition);
    return anchor
      ? { labelPosition: anchor.position, labelSegmentIndex: anchor.segmentIndex }
      : {};
  }

  function previewWaypoints(nextWaypoints: Point[]) {
    const normalizedWaypoints = normalizeWaypoints(nextWaypoints);
    previewVisualStyle({
      routeMode: normalizedWaypoints.length > 0 ? "manual" : "auto",
      waypoints: normalizedWaypoints,
      ...getSavedLabelPatch(normalizedWaypoints),
    });
  }

  async function saveWaypoints(nextWaypoints: Point[]) {
    const normalizedWaypoints = normalizeWaypoints(nextWaypoints);
    await saveVisualStyle({
      routeMode: normalizedWaypoints.length > 0 ? "manual" : "auto",
      waypoints: normalizedWaypoints,
      ...getSavedLabelPatch(normalizedWaypoints),
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
    return buildManualRouteGeometry(
      sourcePoint,
      sourcePosition,
      targetPoint,
      targetPosition,
      nextWaypoints
    ).routePoints;
  }

  function getEditableRoutePoints(nextWaypoints: Point[]): Point[] {
    return buildManualRouteGeometry(
      sourcePoint,
      sourcePosition,
      targetPoint,
      targetPosition,
      nextWaypoints
    ).editableRoutePoints;
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
    const baseRoutePoints = getEditableRoutePoints(baseWaypoints);
    const baseLabelAnchor = savedLabelPosition
      ? resolveLabelAnchor(baseRoutePoints, savedLabelPosition)
      : null;
    let latestWaypoints = baseWaypoints;
    let latestLabelAnchor = baseLabelAnchor;
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(moveEvent.clientX - startClient.x, moveEvent.clientY - startClient.y);
      if (dragDistance < 3 && !didDrag) return;
      didDrag = true;
      const point = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const delta = { x: point.x - startFlow.x, y: point.y - startFlow.y };
      latestWaypoints = moveWaypointSegment(baseWaypoints, segmentIndex, delta);
      setIsSnapActive(true);
      const requestedLabelPosition = baseLabelAnchor
        ? baseLabelAnchor.segmentIndex === segmentIndex
          ? {
              x: baseLabelAnchor.position.x + delta.x,
              y: baseLabelAnchor.position.y + delta.y,
            }
          : baseLabelAnchor.position
        : null;
      latestLabelAnchor = requestedLabelPosition
        ? resolveLabelAnchor(getRoutePoints(latestWaypoints), requestedLabelPosition)
        : null;

      previewVisualStyle({
        routeMode: "manual",
        waypoints: latestWaypoints,
        ...(latestLabelAnchor
          ? {
              labelPosition: latestLabelAnchor.position,
              labelSegmentIndex: latestLabelAnchor.segmentIndex,
            }
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
          ...(latestLabelAnchor
            ? {
                labelPosition: latestLabelAnchor.position,
                labelSegmentIndex: latestLabelAnchor.segmentIndex,
              }
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

    const baseWaypoints = getEditableWaypoints();
    const routeBeforeDrag = getEditableRoutePoints(baseWaypoints);
    let latestWaypoints = baseWaypoints;
    const startClient = { x: event.clientX, y: event.clientY };
    let didDrag = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragDistance = Math.hypot(
        moveEvent.clientX - startClient.x,
        moveEvent.clientY - startClient.y
      );
      if (!didDrag && dragDistance < 3) {
        return;
      }
      didDrag = true;

      const rawPoint = getEventFlowPoint(moveEvent, screenToFlowPosition);
      const previous = routeBeforeDrag[waypointIndex];
      const next = routeBeforeDrag[waypointIndex + 2];
      const { point, snapped } = moveEvent.altKey
        ? { point: rawPoint, snapped: false }
        : snapBendPoint(rawPoint, previous, next);
      setIsSnapActive(snapped);
      latestWaypoints = baseWaypoints.map((waypoint, index) =>
        index === waypointIndex ? point : waypoint
      );
      previewWaypoints(latestWaypoints);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setIsSnapActive(false);
      if (didDrag) {
        void saveWaypoints(latestWaypoints);
      }
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
    const next = getEditableWaypoints().filter((_waypoint, index) => index !== waypointIndex);
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
    const baseRoutePoints = getEditableRoutePoints(baseWaypoints);
    const baseLabelAnchor = resolveLabelAnchor(baseRoutePoints, currentLabelPosition);
    const segmentIndex = baseLabelAnchor?.segmentIndex ?? 0;
    const segmentStart = baseRoutePoints[segmentIndex] ?? baseRoutePoints[0] ?? currentLabelPosition;
    const segmentEnd = baseRoutePoints[segmentIndex + 1] ?? segmentStart;
    const segmentOrientation = getSegmentOrientation(segmentStart, segmentEnd);
    let latestLabelPosition = currentLabelPosition;
    let latestLabelSegmentIndex = segmentIndex;
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
      const movedRoutePoints = getEditableRoutePoints(latestWaypoints);
      const movedSegmentStart = movedRoutePoints[segmentIndex] ?? segmentStart;
      const movedSegmentEnd = movedRoutePoints[segmentIndex + 1] ?? movedSegmentStart;
      const requestedLabelPosition = {
        x: currentLabelPosition.x + delta.x,
        y: currentLabelPosition.y + delta.y,
      };
      const latestLabelAnchor = resolveLabelAnchor(movedRoutePoints, requestedLabelPosition);
      latestLabelPosition = latestLabelAnchor?.position ?? projectPointToSegment(
        requestedLabelPosition,
        movedSegmentStart,
        movedSegmentEnd
      );
      latestLabelSegmentIndex = (latestLabelAnchor?.segmentIndex ?? segmentIndex) + 1;
      previewVisualStyle({
        routeMode: "manual",
        waypoints: latestWaypoints,
        labelPosition: latestLabelPosition,
        labelSegmentIndex: latestLabelSegmentIndex,
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
          labelSegmentIndex: latestLabelSegmentIndex,
        });
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  const segmentPaths = usesManualRoute
    ? editableRoutePoints.slice(0, -1).flatMap((point, index) => {
        const nextPoint = editableRoutePoints[index + 1];
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
