"use client";

import { ReactFlowProvider } from "@xyflow/react";
import type { CSSProperties } from "react";
import { V2BoardCanvas } from "./v2-board-canvas";
import type { V2BoardDetail } from "@yadraw/shared";
import { createYadrawThemeVariables, lightYadrawTheme } from "./v2-theme-tokens";

type Props = {
  boardDetail: V2BoardDetail;
};

export function V2BoardPage({ boardDetail }: Props) {
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
        <a href="/v2/dashboard" className="v2BoardHomeLink">
          Dashboard
        </a>
      </header>

      {/* Canvas area */}
      <div className="v2BoardCanvasArea">
        <ReactFlowProvider>
          <V2BoardCanvas boardDetail={boardDetail} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
