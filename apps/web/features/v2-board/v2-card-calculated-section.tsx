"use client";

import { Calculator } from "lucide-react";
import { formatV2UnitCode, type V2CalculationEvaluation, type V2Card } from "@yadraw/shared";

type Props = {
  card: V2Card;
  cardById: Map<string, V2Card>;
  evaluation: V2CalculationEvaluation | null;
  incidentConnectionIds: string[];
  isLoading: boolean;
  error: string | null;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);
}

export function V2CardCalculatedSection({
  card,
  cardById,
  evaluation,
  incidentConnectionIds,
  isLoading,
  error
}: Props) {
  const requiredComponents = evaluation?.results.filter(
    (result) => result.targetCardId === card.id
  ) ?? [];
  const demandTotals = evaluation?.totals.filter((total) => total.cardId === card.id) ?? [];
  const incidentConnectionIdSet = new Set(incidentConnectionIds);
  const warnings = evaluation?.warnings.filter(
    (warning) =>
      warning.cardId === card.id ||
      (warning.connectionId ? incidentConnectionIdSet.has(warning.connectionId) : false)
  ) ?? [];

  if (
    requiredComponents.length === 0 &&
    demandTotals.length === 0 &&
    warnings.length === 0 &&
    !isLoading &&
    !error
  ) {
    return null;
  }

  return (
    <section className="v2InspectorSection v2CalculatedSection" aria-labelledby="v2-calculated-title">
      <div className="v2InspectorSectionHeader">
        <div>
          <h3 id="v2-calculated-title">
            <Calculator size={13} aria-hidden="true" />
            Totals
          </h3>
          <span>Updates automatically from active relationships.</span>
        </div>
        {isLoading ? <span className="v2CalculatedStatus">Updating…</span> : null}
      </div>

      {error ? <p className="v2CalculatedError" role="status">{error}</p> : null}

      {requiredComponents.length > 0 ? (
        <div className="v2CalculatedGroup">
          <strong>Required components</strong>
          {requiredComponents.map((result) => (
            <div className="v2CalculatedRow" key={result.id}>
              <span className="v2CalculatedRowText">
                <span>{cardById.get(result.sourceCardId)?.title ?? "Unknown card"}</span>
                <small>{result.explanation}</small>
              </span>
              <b>{formatNumber(result.value)} {formatV2UnitCode(result.unitCode)}</b>
            </div>
          ))}
        </div>
      ) : null}

      {demandTotals.length > 0 ? (
        <div className="v2CalculatedGroup">
          <strong>Total demand</strong>
          {demandTotals.map((total) => (
            <div className="v2CalculatedRow" key={`${total.cardId}:${total.unitCode}`}>
              <span>Across active relationships</span>
              <b>{formatNumber(total.value)} {formatV2UnitCode(total.unitCode)}</b>
            </div>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="v2CalculatedWarnings" role="status">
          {warnings.map((warning, index) => (
            <p key={`${warning.code}:${warning.connectionId ?? warning.cardId ?? index}`}>
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
