"use client";

import { useEffect, useRef, useState } from "react";
import type { V2Card } from "@yadraw/shared";
import type { SaveStatus } from "./v2-card-inspector-helpers";

type V2CardBasicsSectionProps = {
  card: V2Card;
  saveStatus: SaveStatus;
  readOnly?: boolean;
  onUpdateCardBasics: (
    cardId: string,
    input: { title?: string; description?: string | null }
  ) => Promise<void>;
};

export function V2CardBasicsSection({
  card,
  saveStatus,
  readOnly = false,
  onUpdateCardBasics,
}: V2CardBasicsSectionProps) {
  const [draftTitle, setDraftTitle] = useState(card.title ?? "");
  const [draftDescription, setDraftDescription] = useState(card.description ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const cardIdentity = `${card.id}:${card.libraryEntryId ?? "local"}`;
  const cardIdentityRef = useRef(cardIdentity);

  const hasTitleChanges = draftTitle !== (card.title ?? "");
  const hasDescriptionChanges = draftDescription !== (card.description ?? "");
  const hasChanges = hasTitleChanges || hasDescriptionChanges;

  useEffect(() => {
    const cardChanged = cardIdentityRef.current !== cardIdentity;
    if (!cardChanged && (hasChanges || saveStatus === "saving")) return;
    cardIdentityRef.current = cardIdentity;
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }, [card.description, card.title, cardIdentity, hasChanges, saveStatus]);

  useEffect(() => {
    if (readOnly || !hasChanges || saveStatus === "saving") return;
    const timeout = window.setTimeout(() => void saveAll(), 600);
    return () => window.clearTimeout(timeout);
  }, [draftTitle, draftDescription, card.id, card.title, card.description, readOnly, saveStatus]);

  async function saveAll() {
    if (readOnly) return;
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
      className={`v2InspectorHero v2InspectorEditor${readOnly ? " v2InspectorLibraryReadOnly" : ""}`}
      onBlur={(event) => {
        if (!readOnly && !event.currentTarget.contains(event.relatedTarget)) void saveAll();
      }}
    >
      <div className="v2InspectorField">
        <label htmlFor={`v2-title-${card.id}`}>Title</label>
        <input
          id={`v2-title-${card.id}`}
          className="v2InspectorTextInput"
          value={draftTitle}
          placeholder="Card title"
          readOnly={readOnly}
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
          readOnly={readOnly}
          onChange={(event) => setDraftDescription(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void saveAll();
            }
          }}
        />
      </div>
      {!readOnly && (fieldError || saveStatus === "error") ? <div className="v2InspectorEditFooter">
        <span className="v2InspectorSaveStatusError">
          {fieldError ?? "Save failed"}
        </span>
      </div> : null}
    </section>
  );
}
