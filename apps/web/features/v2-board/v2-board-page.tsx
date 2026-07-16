"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Download, ListChecks } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { V2BoardCanvas } from "./v2-board-canvas";
import type { V2BoardDetail, V2CalculationEvaluation } from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import { createYadrawThemeVariables, lightYadrawTheme } from "./v2-theme-tokens";
import { V2BoardEmptyState } from "./v2-board-empty-state";
import { V2BoardOnboarding } from "./v2-board-onboarding";

type Props = {
  boardDetail: V2BoardDetail;
  initialCalculationEvaluation: V2CalculationEvaluation | null;
};

export function V2BoardPage({ boardDetail, initialCalculationEvaluation }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [cardPickerRequest, setCardPickerRequest] = useState(0);
  const [cardInspectorRequest, setCardInspectorRequest] = useState(0);
  const [guideOpenRequest, setGuideOpenRequest] = useState(0);
  const [fieldEditRequest, setFieldEditRequest] = useState(0);
  const [exportRequest, setExportRequest] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const { board, cards, connections } = boardDetail;
  const [contentCounts, setContentCounts] = useState({
    cardCount: cards.length,
    connectionCount: connections.length,
  });
  const exportUrl = `/v2/actions/boards/${encodeURIComponent(board.id)}/export`;

  useEffect(() => {
    setContentCounts({
      cardCount: cards.length,
      connectionCount: connections.length,
    });
  }, [board.id, cards.length, connections.length]);

  const handleContentCountsChange = useCallback(
    (counts: { cardCount: number; connectionCount: number }) => {
      setContentCounts((current) =>
        current.cardCount === counts.cardCount &&
        current.connectionCount === counts.connectionCount
          ? current
          : counts
      );
    },
    []
  );

  const handleCardDataSaved = useCallback(() => {
    setFieldEditRequest((request) => request + 1);
  }, []);

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
            {contentCounts.cardCount} card{contentCounts.cardCount !== 1 ? "s" : ""}
            {contentCounts.connectionCount > 0 &&
              ` · ${contentCounts.connectionCount} connection${contentCounts.connectionCount !== 1 ? "s" : ""}`}
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
        <nav className="v2BoardHeaderActions" aria-label="Board actions">
          <button
            type="button"
            className="v2BoardHeaderAction"
            title="Open getting started guide"
            aria-label="Open getting started guide"
            onClick={() => setGuideOpenRequest((request) => request + 1)}
          >
            <ListChecks size={14} strokeWidth={2.2} />
            <span>Guide</span>
          </button>
          <a
            href={exportUrl}
            className="v2BoardHeaderAction"
            title="Export board as JSON"
            download
            onClick={() => setExportRequest((request) => request + 1)}
          >
            <Download size={14} strokeWidth={2.2} />
            <span>Export JSON</span>
          </a>
          <a href="/v2/dashboard" className="v2BoardHomeLink">
            Dashboard
          </a>
        </nav>
      </header>

      {/* Canvas area */}
      <div className="v2BoardCanvasArea">
        {contentCounts.cardCount === 0 ? (
          <V2BoardEmptyState
            workspaceId={board.workspaceId}
            onStartBlank={() => setCardPickerRequest((request) => request + 1)}
          />
        ) : null}
        <V2BoardOnboarding
          key={board.id}
          cardCount={contentCounts.cardCount}
          connectionCount={contentCounts.connectionCount}
          exportUrl={exportUrl}
          openRequest={guideOpenRequest}
          fieldEditRequest={fieldEditRequest}
          exportRequest={exportRequest}
          suspended={editorOpen}
          onAddCard={() => setCardPickerRequest((request) => request + 1)}
          onEditCard={() => setCardInspectorRequest((request) => request + 1)}
        />
        <ReactFlowProvider>
          <V2BoardCanvas
            boardDetail={boardDetail}
            initialCalculationEvaluation={initialCalculationEvaluation}
            onSaveStatusChange={setSaveStatus}
            cardPickerRequest={cardPickerRequest}
            cardInspectorRequest={cardInspectorRequest}
            onContentCountsChange={handleContentCountsChange}
            onCardDataSaved={handleCardDataSaved}
            onEditorOpenChange={setEditorOpen}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
