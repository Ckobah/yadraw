"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useState, type CSSProperties } from "react";
import { V2BoardCanvas } from "./v2-board-canvas";
import type { V2BoardDetail, V2CalculationEvaluation } from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import { createYadrawThemeVariables, lightYadrawTheme } from "./v2-theme-tokens";
import { V2BoardEmptyState } from "./v2-board-empty-state";

type Props = {
  boardDetail: V2BoardDetail;
  initialCalculationEvaluation: V2CalculationEvaluation | null;
};

export function V2BoardPage({ boardDetail, initialCalculationEvaluation }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [cardPickerRequest, setCardPickerRequest] = useState(0);
  const { board, cards, connections } = boardDetail;
  const cardCount = cards.length;
  const connCount = connections.length;

  const themeVariables = createYadrawThemeVariables(lightYadrawTheme) as CSSProperties;

  return (
    <div
      className="v2BoardShell"
      data-yadraw-theme={lightYadrawTheme.key}
      style={themeVariables}
    >
      {/* Minimal top header */}
      <header className="v2BoardHeader">
        <div className="v2BoardHeaderLeft">
          <h1 className="v2BoardTitle">{board.name}</h1>
          <span className="v2BoardMeta">
            {cardCount} card{cardCount !== 1 ? "s" : ""}
            {connCount > 0 && ` · ${connCount} connection${connCount !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div
          className={`v2BoardSaveIndicator v2BoardSaveIndicator-${saveStatus}`}
          role="status"
          aria-live="polite"
          title={
            saveStatus === "saving"
              ? "Saving changes"
              : saveStatus === "error"
                ? "Changes could not be saved"
                : "All changes saved"
          }
        >
          <span aria-hidden="true" />
          <span className="visuallyHidden">
            {saveStatus === "saving"
              ? "Saving changes"
              : saveStatus === "error"
                ? "Changes could not be saved"
                : "All changes saved"}
          </span>
        </div>
        <a href="/v2/dashboard" className="v2BoardHomeLink">
          Dashboard
        </a>
      </header>

      {/* Canvas area */}
      <div className="v2BoardCanvasArea">
        {cardCount === 0 ? (
          <V2BoardEmptyState
            workspaceId={board.workspaceId}
            onStartBlank={() => setCardPickerRequest((request) => request + 1)}
          />
        ) : null}
        <ReactFlowProvider>
          <V2BoardCanvas
            boardDetail={boardDetail}
            initialCalculationEvaluation={initialCalculationEvaluation}
            onSaveStatusChange={setSaveStatus}
            cardPickerRequest={cardPickerRequest}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
