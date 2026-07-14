"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, LoaderCircle, Search } from "lucide-react";
import type { V2Card, V2CardLibraryEntry, V2CardType } from "@yadraw/shared";
import {
  getV2CardLibraryEntry,
  listV2CardLibraryEntries,
  V2ApiError,
} from "./api";

type V2CardLibrarySelectorProps = {
  card: V2Card;
  cardType: V2CardType;
  onSetLibraryEntry: (
    cardId: string,
    libraryEntryId: string | null,
    expectedLibraryEntryId: string | null
  ) => Promise<void>;
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof V2ApiError)) return fallback;
  if (error.status === 409) {
    return "This card was changed elsewhere. Close and reopen it, then try again.";
  }
  const body = error.body;
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const apiError = body.error;
  if (!apiError || typeof apiError !== "object" || !("message" in apiError)) return fallback;
  return typeof apiError.message === "string" ? apiError.message : fallback;
}

function entryStatusLabel(entry: V2CardLibraryEntry): string | null {
  if (entry.archivedAt) return "archived";
  if (!entry.selectable) return "incomplete";
  return null;
}

export function V2CardLibrarySelector({
  card,
  cardType,
  onSetLibraryEntry,
}: V2CardLibrarySelectorProps) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<V2CardLibraryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<V2CardLibraryEntry | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQueryInput("");
    setQuery("");
    setError(null);
  }, [card.id, cardType.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [queryInput]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    void listV2CardLibraryEntries(
      card.workspaceId,
      cardType.id,
      {
        query: query || undefined,
        status: "active",
        limit: 100,
        sort: "title",
      },
      { signal: controller.signal }
    )
      .then((page) => {
        setEntries(page.entries.filter((entry) => entry.selectable));
        setNextCursor(page.nextCursor);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(apiErrorMessage(loadError, "Could not load this card library."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [card.workspaceId, cardType.id, query]);

  useEffect(() => {
    if (!card.libraryEntryId) {
      setCurrentEntry(null);
      setIsLoadingCurrent(false);
      return;
    }
    let cancelled = false;
    setIsLoadingCurrent(true);
    void getV2CardLibraryEntry(card.workspaceId, cardType.id, card.libraryEntryId)
      .then((entry) => {
        if (!cancelled) setCurrentEntry(entry);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setCurrentEntry(null);
        setError(apiErrorMessage(loadError, "Could not load the selected library record."));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCurrent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.libraryEntryId, card.workspaceId, cardType.id]);

  const optionEntries = useMemo(() => {
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    if (currentEntry) byId.set(currentEntry.id, currentEntry);
    return [...byId.values()].sort(
      (left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
    );
  }, [currentEntry, entries]);

  async function selectEntry(libraryEntryId: string | null) {
    const expectedLibraryEntryId = card.libraryEntryId ?? null;
    if (libraryEntryId === expectedLibraryEntryId || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSetLibraryEntry(card.id, libraryEntryId, expectedLibraryEntryId);
      setQueryInput("");
      setQuery("");
    } catch (saveError) {
      setError(apiErrorMessage(saveError, "Could not change the library record."));
    } finally {
      setIsSaving(false);
    }
  }

  const currentStatus = currentEntry ? entryStatusLabel(currentEntry) : null;
  const isBusy = isSaving || isLoadingCurrent;

  return (
    <section className="v2InspectorSection v2CardLibrarySelector">
      <div className="v2CardLibrarySelectorHeading">
        <div>
          <h3>Library record</h3>
          <p>Choose a reusable {cardType.name.toLocaleLowerCase()} record.</p>
        </div>
        {card.libraryEntryId ? <span><Link2 size={11} /> Linked</span> : null}
      </div>

      <label className="v2CardLibrarySelectorSearch">
        <Search size={13} aria-hidden="true" />
        <input
          value={queryInput}
          placeholder={`Search ${cardType.name.toLocaleLowerCase()} library`}
          aria-label={`Search ${cardType.name} library`}
          disabled={isSaving}
          onChange={(event) => setQueryInput(event.target.value)}
        />
        {isLoading ? <LoaderCircle size={13} className="v2CardLibrarySpinner" aria-label="Loading records" /> : null}
      </label>

      <select
        className="v2CardLibrarySelectorSelect"
        value={card.libraryEntryId ?? ""}
        aria-label={`${cardType.name} library record`}
        aria-busy={isBusy}
        disabled={isBusy}
        onChange={(event) => void selectEntry(event.target.value || null)}
      >
        <option value="">Local card (no library record)</option>
        {card.libraryEntryId && !optionEntries.some((entry) => entry.id === card.libraryEntryId) ? (
          <option value={card.libraryEntryId}>
            {isLoadingCurrent ? "Loading selected record…" : card.title}
          </option>
        ) : null}
        {optionEntries.map((entry) => {
          const status = entryStatusLabel(entry);
          return (
            <option
              key={entry.id}
              value={entry.id}
              disabled={!entry.selectable && entry.id !== card.libraryEntryId}
            >
              {entry.title}{status ? ` (${status})` : ""}
            </option>
          );
        })}
      </select>

      {isSaving ? (
        <p className="v2CardLibrarySelectorStatus"><LoaderCircle size={11} className="v2CardLibrarySpinner" /> Updating card…</p>
      ) : error ? (
        <p className="v2CardLibrarySelectorError" role="alert">{error}</p>
      ) : nextCursor ? (
        <p className="v2CardLibrarySelectorStatus">More records match. Refine the search to find them.</p>
      ) : card.libraryEntryId ? (
        <p className="v2CardLibrarySelectorStatus">
          {currentStatus
            ? `This ${currentStatus} record remains linked. Choose another record or unlink it.`
            : "Title, description, and fields stay synchronized with this library record."}
        </p>
      ) : optionEntries.length === 0 && !isLoading ? (
        <p className="v2CardLibrarySelectorStatus">No selectable library records found.</p>
      ) : null}
    </section>
  );
}
