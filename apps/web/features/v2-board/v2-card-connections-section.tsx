import type { V2Card, V2Connection } from "@yadraw/shared";

type ConnectionRowsProps = {
  connections: V2Connection[];
  cardById: Map<string, V2Card>;
  direction: "incoming" | "outgoing";
};

type V2CardConnectionsSectionProps = {
  incomingConnections: V2Connection[];
  outgoingConnections: V2Connection[];
  cardById: Map<string, V2Card>;
};

function ConnectionRows({
  connections,
  cardById,
  direction,
}: ConnectionRowsProps) {
  if (connections.length === 0) {
    return <p className="v2InspectorEmpty">Нет связей</p>;
  }

  return (
    <div className="v2InspectorConnectionList">
      {connections.map((connection) => {
        const relatedCardId =
          direction === "incoming"
            ? connection.sourceCardId
            : connection.targetCardId;
        const relatedCard = cardById.get(relatedCardId);
        const portText = `${connection.sourcePortKey} -> ${connection.targetPortKey}`;

        return (
          <div key={connection.id} className="v2InspectorConnectionRow">
            <span className="v2InspectorConnectionDirection">
              {direction === "incoming" ? "In" : "Out"}
            </span>
            <div className="v2InspectorConnectionText">
              <strong>{relatedCard?.title ?? "Unknown card"}</strong>
              <span>{connection.label || connection.type} · {portText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function V2CardConnectionsSection({
  incomingConnections,
  outgoingConnections,
  cardById,
}: V2CardConnectionsSectionProps) {
  const totalConnections = incomingConnections.length + outgoingConnections.length;

  return (
    <section className="v2InspectorSection">
      <h3>Связи · {totalConnections}</h3>
      <details className="v2InspectorDetails" open={totalConnections > 0}>
        <summary>Incoming {incomingConnections.length} / Outgoing {outgoingConnections.length}</summary>
        <div className="v2InspectorConnectionGroup">
          <span className="v2InspectorConnectionTitle">Incoming</span>
          <ConnectionRows
            connections={incomingConnections}
            cardById={cardById}
            direction="incoming"
          />
        </div>
        <div className="v2InspectorConnectionGroup">
          <span className="v2InspectorConnectionTitle">Outgoing</span>
          <ConnectionRows
            connections={outgoingConnections}
            cardById={cardById}
            direction="outgoing"
          />
        </div>
      </details>
    </section>
  );
}
