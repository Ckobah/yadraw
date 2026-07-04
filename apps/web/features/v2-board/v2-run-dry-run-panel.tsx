"use client";

import { X } from "lucide-react";
import type { V2DryRunResult } from "@yadraw/shared";

type V2RunDryRunPanelProps = {
  result: V2DryRunResult;
  onClose: () => void;
};

export function V2RunDryRunPanel({ result, onClose }: V2RunDryRunPanelProps) {
  return (
    <aside className="v2DryRunPanel nodrag nopan" aria-label="Dry run result">
      <div className="v2DryRunPanelHeader">
        <div>
          <span>Dry run result</span>
          <strong>Mode: Dry-run</strong>
        </div>
        <button
          type="button"
          className="v2DryRunCloseButton"
          aria-label="Close dry run result"
          onClick={onClose}
        >
          <X size={15} strokeWidth={2.3} />
        </button>
      </div>

      <dl className="v2DryRunSummary">
        <div>
          <dt>Start card</dt>
          <dd>{result.startCardId ?? "None"}</dd>
        </div>
        <div>
          <dt>Steps count</dt>
          <dd>{result.steps.length}</dd>
        </div>
      </dl>

      <section className="v2DryRunSection">
        <h3>Steps</h3>
        {result.steps.length > 0 ? (
          <ol className="v2DryRunSteps">
            {result.steps.map((step) => (
              <li key={step.cardId}>
                <strong>{step.title}</strong>
                <span>{step.status.replace("_", " ")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No steps to preview.</p>
        )}
      </section>

      <section className="v2DryRunSection">
        <h3>Warnings</h3>
        {result.warnings.length > 0 ? (
          <ul className="v2DryRunWarnings">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No warnings.</p>
        )}
      </section>
    </aside>
  );
}
