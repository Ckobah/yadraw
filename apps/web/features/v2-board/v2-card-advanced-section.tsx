import type { V2Card, V2CardType } from "@yadraw/shared";
import { formatInspectorDate } from "./v2-card-inspector-helpers";

type V2CardAdvancedSectionProps = {
  card: V2Card;
  cardType: V2CardType | null;
};

export function V2CardAdvancedSection({
  card,
  cardType,
}: V2CardAdvancedSectionProps) {
  return (
    <section className="v2InspectorSection">
      <details className="v2InspectorDetails">
        <summary>Advanced</summary>
        <dl className="v2InspectorAdvancedList">
          <div>
            <dt>Card id</dt>
            <dd>{card.id}</dd>
          </div>
          <div>
            <dt>Type key</dt>
            <dd>{cardType?.key ?? "unknown"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{card.status}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{Math.round(card.size.width)} x {Math.round(card.size.height)}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>{Math.round(card.position.x)}, {Math.round(card.position.y)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{formatInspectorDate(card.updatedAt)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
