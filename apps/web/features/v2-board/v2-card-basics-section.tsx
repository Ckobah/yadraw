"use client";

import { useEffect, useState } from "react";
import type { V2Card } from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";

type V2CardBasicsSectionProps = {
  card: V2Card;
  saveStatus: SaveStatus;
  onUpdateCardBasics: (
    cardId: string,
    input: { title?: string; description?: string | null }
  ) => Promise<void>;
};

export function V2CardBasicsSection({
  card,
  saveStatus,
  onUpdateCardBasics,
}: V2CardBasicsSectionProps) {
  const [draftTitle, setDraftTitle] = useState(card.title ?? "");
  const [draftDescription, setDraftDescription] = useState(card.description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }, [card.id, card.title, card.description]);

  const hasTitleChanges = draftTitle !== (card.title ?? "");
  const hasDescriptionChanges = draftDescription !== (card.description ?? "");
  const hasChanges = hasTitleChanges || hasDescriptionChanges;

  useEffect(() => {
    if (!hasChanges || saveStatus === "saving") return;
    const timeout = window.setTimeout(() => void saveAll(), 600);
    return () => window.clearTimeout(timeout);
  }, [draftTitle, draftDescription, card.id, card.title, card.description, saveStatus]);

  async function saveAll() {
    const input: { title?: string; description?: string } = {};
    const nextTitle = draftTitle.trim();
    if (nextTitle !== card.title) {
      if (!nextTitle) {
        setDraftTitle(card.title ?? "");
        setFieldError("Title cannot be empty");
        return;
      }
      input.title = nextTitle;
    }
    if (draftDescription !== (card.description ?? "")) {
      input.description = draftDescription;
    }
    if (input.title === undefined && input.description === undefined) return;

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, input);
    } catch {
      setFieldError("Could not save changes");
    }
  }

  return (
    <section
      className="v2InspectorHero v2InspectorEditor"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) void saveAll();
      }}
    >
      <div className="v2InspectorField">
        <label htmlFor={`v2-title-${card.id}`}>Title</label>
        <input
          id={`v2-title-${card.id}`}
          className="v2InspectorTextInput"
          value={draftTitle}
          placeholder="Card title"
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveAll();
            }
          }}
        />
      </div>
      <div className="v2InspectorField">
        <label htmlFor={`v2-description-${card.id}`}>Description</label>
        <textarea
          id={`v2-description-${card.id}`}
          className="v2InspectorTextarea"
          value={draftDescription}
          placeholder="Brief description"
          onChange={(event) => setDraftDescription(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void saveAll();
            }
          }}
        />
      </div>
      {(fieldError || saveStatus === "error") ? <div className="v2InspectorEditFooter">
        <span className="v2InspectorSaveStatusError">
          {fieldError ?? "Save failed"}
        </span>
      </div> : null}
    </section>
  );
}
