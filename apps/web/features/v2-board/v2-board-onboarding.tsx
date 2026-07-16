"use client";

import { Check, Download, Link2, PencilLine, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type StoredOnboardingState = {
  fieldsEdited: boolean;
  exported: boolean;
  dismissed: boolean;
};

type V2BoardOnboardingProps = {
  cardCount: number;
  connectionCount: number;
  exportUrl: string;
  openRequest: number;
  fieldEditRequest: number;
  exportRequest: number;
  suspended: boolean;
  onAddCard: () => void;
  onEditCard: () => void;
};

type OnboardingStep = {
  id: "card" | "connection" | "fields" | "export";
  label: string;
  complete: boolean;
  icon: ReactNode;
};

const EMPTY_STATE: StoredOnboardingState = {
  fieldsEdited: false,
  exported: false,
  dismissed: false,
};
const STORAGE_KEY = "yadraw:v2:board-guide:v1";

export function V2BoardOnboarding({
  cardCount,
  connectionCount,
  exportUrl,
  openRequest,
  fieldEditRequest,
  exportRequest,
  suspended,
  onAddCard,
  onEditCard,
}: V2BoardOnboardingProps) {
  const [storedState, setStoredState] = useState<StoredOnboardingState>(EMPTY_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const persistState = useCallback(
    (patch: Partial<StoredOnboardingState>) => {
      setStoredState((current) => ({ ...current, ...patch }));
    },
    []
  );

  useEffect(() => {
    const next = readStoredState();
    setStoredState(next);
    setIsLoaded(true);
    setIsOpen(cardCount > 0 && !next.dismissed);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    writeStoredState(storedState);
  }, [isLoaded, storedState]);

  useEffect(() => {
    if (!isLoaded || cardCount === 0 || storedState.dismissed) return;
    setIsOpen(true);
  }, [cardCount, isLoaded, storedState.dismissed]);

  useEffect(() => {
    if (!isLoaded || openRequest <= 0) return;
    persistState({ dismissed: false });
    setIsOpen(true);
  }, [isLoaded, openRequest, persistState]);

  useEffect(() => {
    if (!isLoaded || fieldEditRequest <= 0 || storedState.fieldsEdited) return;
    persistState({ fieldsEdited: true });
  }, [fieldEditRequest, isLoaded, persistState, storedState.fieldsEdited]);

  useEffect(() => {
    if (!isLoaded || exportRequest <= 0 || storedState.exported) return;
    persistState({ exported: true });
  }, [exportRequest, isLoaded, persistState, storedState.exported]);

  const steps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "card",
        label: "Add a card",
        complete: cardCount > 0,
        icon: <Plus size={14} strokeWidth={2.3} />,
      },
      {
        id: "connection",
        label: "Connect two cards",
        complete: connectionCount > 0,
        icon: <Link2 size={14} strokeWidth={2.3} />,
      },
      {
        id: "fields",
        label: "Edit structured fields",
        complete: storedState.fieldsEdited,
        icon: <PencilLine size={14} strokeWidth={2.3} />,
      },
      {
        id: "export",
        label: "Export the board",
        complete: storedState.exported,
        icon: <Download size={14} strokeWidth={2.3} />,
      },
    ],
    [cardCount, connectionCount, storedState.exported, storedState.fieldsEdited]
  );
  const currentStep = steps.find((step) => !step.complete) ?? null;
  const completedCount = steps.filter((step) => step.complete).length;

  if (!isLoaded || !isOpen || suspended) return null;

  return (
    <aside className="v2BoardOnboarding" aria-label="Getting started">
      <header className="v2BoardOnboardingHeader">
        <div>
          <strong>Getting started</strong>
          <span>{completedCount} of {steps.length} complete</span>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started guide"
          title="Dismiss guide"
          onClick={() => {
            persistState({ dismissed: true });
            setIsOpen(false);
          }}
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </header>

      <ol className="v2BoardOnboardingSteps">
        {steps.map((step) => (
          <li
            key={step.id}
            className={step.complete ? "isComplete" : step.id === currentStep?.id ? "isCurrent" : ""}
            aria-current={step.id === currentStep?.id ? "step" : undefined}
          >
            <span aria-hidden="true">
              {step.complete ? <Check size={14} strokeWidth={2.6} /> : step.icon}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="v2BoardOnboardingAction" aria-live="polite">
        {currentStep?.id === "card" ? (
          <>
            <p>Choose a card type, then place the card on the canvas.</p>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddCard();
              }}
            >
              Add card
            </button>
          </>
        ) : currentStep?.id === "connection" ? (
          <p>Hover a card, then drag from an output port to a compatible input port.</p>
        ) : currentStep?.id === "fields" ? (
          <>
            <p>Open a card and change one of its schema-backed fields. Changes save automatically.</p>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEditCard();
              }}
            >
              Open a card
            </button>
          </>
        ) : currentStep?.id === "export" ? (
          <>
            <p>Download the board’s lossless metadata JSON for backup or review.</p>
            <a
              href={exportUrl}
              download
              onClick={() => persistState({ exported: true })}
            >
              <Download size={14} strokeWidth={2.3} />
              Export JSON
            </a>
          </>
        ) : (
          <>
            <p>Your core board workflow is ready. Reopen Guide any time from the header.</p>
            <button type="button" onClick={() => setIsOpen(false)}>Done</button>
          </>
        )}
      </div>
    </aside>
  );
}

function readStoredState(): StoredOnboardingState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredOnboardingState> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY_STATE;
    return {
      fieldsEdited: parsed.fieldsEdited === true,
      exported: parsed.exported === true,
      dismissed: parsed.dismissed === true,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeStoredState(state: StoredOnboardingState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The guide remains usable when storage is blocked or full.
  }
}
