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

  async function saveTitle() {
    const nextTitle = draftTitle.trim();
    if (nextTitle === card.title) return;
    if (!nextTitle) {
      setDraftTitle(card.title ?? "");
      setFieldError("Название не может быть пустым");
      return;
    }

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, { title: nextTitle });
    } catch {
      setFieldError("Не удалось сохранить название");
    }
  }

  async function saveDescription() {
    const currentDescription = card.description ?? "";
    if (draftDescription === currentDescription) return;

    setFieldError(null);
    try {
      await onUpdateCardBasics(card.id, { description: draftDescription });
    } catch {
      setFieldError("Не удалось сохранить описание");
    }
  }

  async function saveAll() {
    const input: { title?: string; description?: string } = {};
    const nextTitle = draftTitle.trim();
    if (nextTitle !== card.title) {
      if (!nextTitle) {
        setDraftTitle(card.title ?? "");
        setFieldError("Название не может быть пустым");
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
      setFieldError("Не удалось сохранить изменения");
    }
  }

  function cancelDraft() {
    setDraftTitle(card.title ?? "");
    setDraftDescription(card.description ?? "");
    setFieldError(null);
  }

  function getSaveStatusLabel() {
    if (fieldError) return fieldError;
    if (saveStatus === "saving") return "Saving...";
    if (saveStatus === "saved") return "Saved";
    if (saveStatus === "error") return "Save failed";
    return hasChanges ? "Unsaved changes" : "Saved";
  }

  return (
    <section className="v2InspectorHero v2InspectorEditor">
      <div className="v2InspectorField">
        <label htmlFor={`v2-title-${card.id}`}>Название</label>
        <input
          id={`v2-title-${card.id}`}
          className="v2InspectorTextInput"
          value={draftTitle}
          placeholder="Название карточки"
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void saveTitle();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftTitle(card.title ?? "");
              setFieldError(null);
            }
          }}
        />
      </div>
      <div className="v2InspectorField">
        <label htmlFor={`v2-description-${card.id}`}>Описание</label>
        <textarea
          id={`v2-description-${card.id}`}
          className="v2InspectorTextarea"
          value={draftDescription}
          placeholder="Краткое описание"
          onChange={(event) => setDraftDescription(event.target.value)}
          onBlur={() => void saveDescription()}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              void saveDescription();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftDescription(card.description ?? "");
              setFieldError(null);
            }
          }}
        />
      </div>
      <div className="v2InspectorEditFooter">
        <span className={fieldError ? "v2InspectorSaveStatusError" : ""}>
          {getSaveStatusLabel()}
        </span>
        <div className="v2InspectorEditActions">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={cancelDraft}
            disabled={!hasChanges || saveStatus === "saving"}
          >
            Отменить
          </button>
          <button
            type="button"
            className="v2InspectorPrimaryAction"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void saveAll()}
            disabled={!hasChanges || saveStatus === "saving"}
          >
            Сохранить
          </button>
        </div>
      </div>
    </section>
  );
}
