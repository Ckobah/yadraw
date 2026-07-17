"use client";

import { useEffect, useState } from "react";
import type {
  V2Card,
  V2CardVisualStyle,
  V2ContainerTheme,
} from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import {
  getV2ContainerTheme,
  V2_CONTAINER_THEMES,
} from "./v2-containers";

type Props = {
  card: V2Card;
  saveStatus: SaveStatus;
  contentCount: number;
  fitPending: boolean;
  onUpdateVisualStyle: (cardId: string, patch: V2CardVisualStyle) => Promise<void>;
  onFitToContent: (cardId: string) => Promise<void>;
};

export function V2ContainerSettings({
  card,
  saveStatus,
  contentCount,
  fitPending,
  onUpdateVisualStyle,
  onFitToContent,
}: Props) {
  const theme = getV2ContainerTheme(card);
  const savedOpacity = card.visualStyle.fillOpacity ?? 0.72;
  const [opacityDraft, setOpacityDraft] = useState(savedOpacity);
  const opacityDirty = opacityDraft !== savedOpacity;

  useEffect(() => {
    if (!opacityDirty || saveStatus === "saving") return;
    const timeout = window.setTimeout(() => void saveOpacity(), 400);
    return () => window.clearTimeout(timeout);
  }, [opacityDraft, savedOpacity, saveStatus]);

  useEffect(() => {
    setOpacityDraft(savedOpacity);
  }, [card.id, savedOpacity]);

  async function saveOpacity() {
    if (!opacityDirty) return;
    await onUpdateVisualStyle(card.id, { fillOpacity: opacityDraft }).catch(() => {});
  }

  function updateTheme(nextTheme: V2ContainerTheme) {
    if (nextTheme === theme) return;
    const appearance = V2_CONTAINER_THEMES[nextTheme];
    void onUpdateVisualStyle(card.id, {
      containerTheme: nextTheme,
      fillColor: appearance.fillColor,
      borderColor: appearance.borderColor,
    }).catch(() => {});
  }

  return (
    <section className="v2InspectorSection v2ContainerSettings">
      <div className="v2ContainerThemeChoice" role="group" aria-label="Box color">
        {Object.entries(V2_CONTAINER_THEMES).map(([key, appearance]) => (
          <button
            key={key}
            type="button"
            className={theme === key ? "active" : ""}
            aria-label={appearance.label}
            aria-pressed={theme === key}
            title={appearance.label}
            style={{
              ["--v2-container-theme" as string]: appearance.fillColor,
              ["--v2-container-theme-border" as string]: appearance.borderColor,
            }}
            onClick={() => updateTheme(key as V2ContainerTheme)}
          />
        ))}
      </div>
      <label
        className="v2ContainerOpacityControl"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) void saveOpacity();
        }}
      >
        <span>Opacity</span>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={Math.round(opacityDraft * 100)}
          onChange={(event) => setOpacityDraft(Number(event.target.value) / 100)}
          onPointerUp={() => void saveOpacity()}
          onKeyUp={() => void saveOpacity()}
        />
        <output>{Math.round(opacityDraft * 100)}%</output>
      </label>
      <button
        type="button"
        className="v2ContainerFitButton"
        disabled={fitPending || contentCount === 0}
        onClick={() => void onFitToContent(card.id).catch(() => {})}
      >
        {fitPending ? "Fitting…" : "Fit to content"}
      </button>
    </section>
  );
}
