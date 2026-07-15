"use client";

import { Frame, StickyNote } from "lucide-react";
import type {
  V2Card,
  V2CardVisualStyle,
  V2ContainerTheme,
  V2ContainerVariant,
} from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";
import {
  getV2ContainerTheme,
  getV2ContainerVariant,
  V2_CONTAINER_THEMES,
} from "./v2-containers";

type Props = {
  card: V2Card;
  saveStatus: SaveStatus;
  onUpdateVisualStyle: (cardId: string, patch: V2CardVisualStyle) => Promise<void>;
};

export function V2ContainerSettings({ card, saveStatus, onUpdateVisualStyle }: Props) {
  const variant = getV2ContainerVariant(card);
  const theme = getV2ContainerTheme(card);

  function updateVariant(nextVariant: V2ContainerVariant) {
    if (nextVariant === variant) return;
    void onUpdateVisualStyle(card.id, { containerVariant: nextVariant }).catch(() => {});
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
      <div className="v2InspectorSectionHeader">
        <div>
          <h3>Container</h3>
          <p>Cards are attached explicitly from the container menu.</p>
        </div>
        <span className="v2ContainerSaveState">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved" : ""}
        </span>
      </div>
      <div className="v2ContainerVariantChoice" role="group" aria-label="Container appearance">
        <button
          type="button"
          className={variant === "sticky" ? "active" : ""}
          aria-pressed={variant === "sticky"}
          onClick={() => updateVariant("sticky")}
        >
          <StickyNote size={16} />
          <span><strong>Sticky</strong><small>Filled group note</small></span>
        </button>
        <button
          type="button"
          className={variant === "frame" ? "active" : ""}
          aria-pressed={variant === "frame"}
          onClick={() => updateVariant("frame")}
        >
          <Frame size={16} />
          <span><strong>Frame</strong><small>Open grouping area</small></span>
        </button>
      </div>
      <div className="v2ContainerThemeChoice" role="group" aria-label="Container color">
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
    </section>
  );
}
