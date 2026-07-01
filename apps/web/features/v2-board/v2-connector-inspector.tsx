"use client";

import { GitBranch, X } from "lucide-react";
import type { V2Card, V2Connection } from "@yadraw/shared";

type V2ConnectorInspectorProps = {
  connection: V2Connection;
  sourceCard: V2Card | null;
  targetCard: V2Card | null;
  onClose: () => void;
};

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function cardTitle(card: V2Card | null, fallbackId: string): string {
  return card?.title?.trim() || `Card ${shortId(fallbackId)}`;
}

export function V2ConnectorInspector({
  connection,
  sourceCard,
  targetCard,
  onClose,
}: V2ConnectorInspectorProps) {
  return (
    <aside
      className="v2CardInspector v2ConnectorInspector"
      aria-label="Connector inspector"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="v2InspectorHeader">
        <span className="v2InspectorTypeIcon v2ConnectorInspectorIcon" aria-hidden="true">
          <GitBranch size={18} strokeWidth={2.1} />
        </span>
        <div className="v2InspectorHeaderText">
          <span>Коннектор</span>
          <strong>{shortId(connection.id)}</strong>
        </div>
        <button
          type="button"
          className="v2InspectorCloseButton"
          aria-label="Close connector inspector"
          onClick={onClose}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      </header>

      <div className="v2InspectorContent">
        <section className="v2InspectorHero v2ConnectorRoute">
          <span className="v2ConnectorRouteLabel">Direction</span>
          <div className="v2ConnectorRouteFlow">
            <strong>{cardTitle(sourceCard, connection.sourceCardId)}</strong>
            <span aria-hidden="true">→</span>
            <strong>{cardTitle(targetCard, connection.targetCardId)}</strong>
          </div>
          <p>
            {connection.sourcePortKey} → {connection.targetPortKey}
          </p>
        </section>

        <section className="v2InspectorSection">
          <h3>Route</h3>
          <dl className="v2InspectorAdvancedList">
            <div>
              <dt>From card</dt>
              <dd>{cardTitle(sourceCard, connection.sourceCardId)}</dd>
            </div>
            <div>
              <dt>From card id</dt>
              <dd>{connection.sourceCardId}</dd>
            </div>
            <div>
              <dt>Source slot</dt>
              <dd>{connection.sourcePortKey}</dd>
            </div>
            <div>
              <dt>To card</dt>
              <dd>{cardTitle(targetCard, connection.targetCardId)}</dd>
            </div>
            <div>
              <dt>To card id</dt>
              <dd>{connection.targetCardId}</dd>
            </div>
            <div>
              <dt>Target slot</dt>
              <dd>{connection.targetPortKey}</dd>
            </div>
          </dl>
        </section>

        <section className="v2InspectorSection">
          <h3>Data</h3>
          <p className="v2InspectorEmpty">
            Редактирование данных коннектора будет добавлено следующим этапом.
          </p>
        </section>

        <section className="v2InspectorSection">
          <h3>Files</h3>
          <p className="v2InspectorEmpty">
            Файлы коннектора будут отдельными от файлов карточек.
          </p>
        </section>

        <section className="v2InspectorSection">
          <details className="v2InspectorDetails">
            <summary>Advanced</summary>
            <dl className="v2InspectorAdvancedList">
              <div>
                <dt>connection id</dt>
                <dd>{connection.id}</dd>
              </div>
              <div>
                <dt>sourceCardId</dt>
                <dd>{connection.sourceCardId}</dd>
              </div>
              <div>
                <dt>targetCardId</dt>
                <dd>{connection.targetCardId}</dd>
              </div>
              <div>
                <dt>sourcePortKey</dt>
                <dd>{connection.sourcePortKey}</dd>
              </div>
              <div>
                <dt>targetPortKey</dt>
                <dd>{connection.targetPortKey}</dd>
              </div>
            </dl>
          </details>
        </section>
      </div>
    </aside>
  );
}
