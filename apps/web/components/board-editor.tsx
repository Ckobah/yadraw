"use client";

import {
  applyNodeChanges,
  Background,
  ReactFlow,
  type Edge,
  type NodeChange,
  type NodeTypes
} from "@xyflow/react";
import {
  CheckCircle2,
  FileText,
  Grid2X2,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  boardSchema,
  cardTemplates as fallbackCardTemplates,
  type Board,
  type Card,
  type CardStatus,
  type CardTemplate,
  type FileRef,
  type UpdateCardInput
} from "@yadraw/shared";
import { WorkflowCardNode, type WorkflowNode } from "./workflow-node";

const nodeTypes: NodeTypes = {
  workflowCard: WorkflowCardNode
};

const defaultCardTemplate = fallbackCardTemplates[0] as CardTemplate;

type ActiveView = "board" | "files" | "trash";

type BoardFile = FileRef & {
  cardId: string;
  cardTitle: string;
  cardTypeKey: string;
  cardStatus: CardStatus;
};

function LeftSidebar({
  activeView,
  onOpenBoard,
  onOpenFiles,
  onOpenSearch,
  onOpenTrash
}: {
  activeView: ActiveView;
  onOpenBoard: () => void;
  onOpenFiles: () => void;
  onOpenSearch: () => void;
  onOpenTrash: () => void;
}) {
  return (
    <aside className="leftSidebar">
      <div className="brandRow">
        <div className="brandMark">Y</div>
      </div>

      <nav className="primaryNav" aria-label="Primary">
        <button className={`navItem ${activeView === "board" ? "navItemActive" : ""}`} type="button" onClick={onOpenBoard}>
          <Grid2X2 size={18} />
          Board
        </button>
        <button className={`navItem ${activeView === "files" ? "navItemActive" : ""}`} type="button" onClick={onOpenFiles}>
          <FileText size={18} />
          Files
        </button>
        <button className="navItem" type="button" onClick={onOpenSearch}>
          <Search size={18} />
          Search
        </button>
        <button className={`navItem ${activeView === "trash" ? "navItemActive" : ""}`} type="button" onClick={onOpenTrash}>
          <Trash2 size={18} />
          Trash
        </button>
      </nav>
    </aside>
  );
}

function TopBar({
  boardName,
  syncStatus,
  onOpenSearch
}: {
  boardName: string;
  syncStatus: string;
  onOpenSearch: () => void;
}) {
  return (
    <header className="topBar">
      <h1 className="boardTitle">{boardName}</h1>

      <div className="topActions">
        <button className="searchBox" type="button" onClick={onOpenSearch}>
          <Search size={17} />
          Search
          <kbd>⌘K</kbd>
        </button>
        <span className="syncStatus">{syncStatus}</span>
      </div>
    </header>
  );
}

function CanvasToolbar({ onAddCard }: { onAddCard: () => void }) {
  return (
    <div className="canvasToolbar">
      <button className="toolButton addButton" type="button" onClick={onAddCard}>
        <Plus size={18} />
        Add
      </button>
    </div>
  );
}

function TemplatePickerDialog({
  templates,
  isOpen,
  isLoading,
  error,
  isCreating,
  onClose,
  onCreate
}: {
  templates: CardTemplate[];
  isOpen: boolean;
  isLoading: boolean;
  error: string;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (template: CardTemplate) => Promise<void>;
}) {
  const [selectedKey, setSelectedKey] = useState(fallbackCardTemplates[1]?.key ?? defaultCardTemplate.key);
  const selectedTemplate = templates.find((template) => template.key === selectedKey) ?? templates[0] ?? defaultCardTemplate;
  const dataPreview = JSON.stringify(selectedTemplate.defaults.data ?? {}, null, 2);

  useEffect(() => {
    if (!isOpen) return;
    if (!templates.some((template) => template.key === selectedKey)) {
      setSelectedKey(templates[0]?.key ?? defaultCardTemplate.key);
    }
  }, [isOpen, selectedKey, templates]);

  if (!isOpen) return null;

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="templateDialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose card type"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="templateDialogHeader">
          <div>
            <span className="eyebrow">Card types</span>
            <h2>Create card</h2>
            <p>Choose a typed starting point with predefined fields, handles, tags and visual style.</p>
          </div>
          <button className="miniIconButton" type="button" aria-label="Close templates" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        <div className="templateDialogBody">
          <div className="templateList" role="listbox" aria-label="Card templates">
            {(templates.length > 0 ? templates : fallbackCardTemplates).map((template) => (
              <button
                className={`templateOption templateOption${template.color[0]?.toUpperCase()}${template.color.slice(1)} ${selectedTemplate.key === template.key ? "templateOptionActive" : ""}`}
                type="button"
                role="option"
                aria-selected={selectedTemplate.key === template.key}
                key={template.key}
                onClick={() => setSelectedKey(template.key)}
              >
                <span className="templateOptionIcon">
                  {template.name[0]}
                </span>
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
              </button>
            ))}
          </div>

          <aside className="templatePreview" aria-label="Template preview">
            <div className={`templatePreviewIcon templatePreviewIcon${selectedTemplate.color[0]?.toUpperCase()}${selectedTemplate.color.slice(1)}`}>
              {selectedTemplate.name[0]}
            </div>
            <h3>{selectedTemplate.name}</h3>
            <p>{selectedTemplate.description}</p>

            <dl className="templatePreviewMeta">
              <div>
                <dt>Type key</dt>
                <dd>{selectedTemplate.key}</dd>
              </div>
              <div>
                <dt>Inputs</dt>
                <dd>{selectedTemplate.defaults.inputs?.join(", ") || "None"}</dd>
              </div>
              <div>
                <dt>Outputs</dt>
                <dd>{selectedTemplate.defaults.outputs?.join(", ") || "None"}</dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>{selectedTemplate.defaults.tags?.join(", ") || "None"}</dd>
              </div>
            </dl>

            <div className="templateDataPreview">
              <span>Default data</span>
              <pre>{dataPreview}</pre>
            </div>

            {error ? <div className="templateError" role="alert">{error}</div> : null}

            <button
              className="primaryButton templateCreateButton"
              type="button"
              disabled={isCreating || isLoading || !selectedTemplate}
              onClick={() => void onCreate(selectedTemplate)}
            >
              <Plus size={16} />
              {isCreating ? "Creating" : `Create ${selectedTemplate.name}`}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Inspector({
  card,
  onClose,
  onDeleteCard,
  attachNotice,
  onAttachFile,
  onSaveCard
}: {
  card: Card;
  onClose: () => void;
  onDeleteCard: (card: Card) => Promise<void>;
  attachNotice: { cardId: string; kind: "success" | "error"; message: string } | null;
  onAttachFile: (cardId: string, file: File) => Promise<Card | null>;
  onSaveCard: (cardId: string, input: UpdateCardInput) => Promise<Card | null>;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [status, setStatus] = useState<CardStatus>(card.status);
  const [positionX, setPositionX] = useState(String(Math.round(card.position.x)));
  const [positionY, setPositionY] = useState(String(Math.round(card.position.y)));
  const [tags, setTags] = useState(card.tags);
  const [newTag, setNewTag] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachFeedback, setAttachFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setStatus(card.status);
    setPositionX(String(Math.round(card.position.x)));
    setPositionY(String(Math.round(card.position.y)));
    setTags(card.tags);
    setNewTag("");
    setAttachFeedback(null);
    setIsDeleteConfirming(false);
  }, [card.id, card.title, card.description, card.status, card.position.x, card.position.y, card.tags]);

  useEffect(() => {
    setSaveFeedback("");
  }, [card.id]);

  const nextPosition = {
    x: Number(positionX),
    y: Number(positionY)
  };
  const hasValidPosition = Number.isFinite(nextPosition.x) && Number.isFinite(nextPosition.y);
  const normalizedNewTag = newTag.trim().replace(/\s+/g, "-").toLowerCase();
  const canAddTag = Boolean(normalizedNewTag) && !tags.includes(normalizedNewTag);
  const tagsKey = tags.join("\n");
  const savedTagsKey = card.tags.join("\n");
  const isDirty =
    title !== card.title ||
    description !== (card.description ?? "") ||
    status !== card.status ||
    tagsKey !== savedTagsKey ||
    nextPosition.x !== card.position.x ||
    nextPosition.y !== card.position.y;
  const visibleAttachFeedback = attachFeedback ?? (attachNotice?.cardId === card.id ? attachNotice : null);

  function addTag() {
    if (!canAddTag) return;
    setTags((current) => [...current, normalizedNewTag]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  async function saveProperties() {
    if (!hasValidPosition) return;

    setIsSaving(true);
    setSaveFeedback("");
    try {
      const savedCard = await onSaveCard(card.id, {
        title,
        description,
        status,
        tags,
        position: nextPosition
      });

      if (savedCard) {
        setTitle(savedCard.title);
        setDescription(savedCard.description ?? "");
        setStatus(savedCard.status);
        setPositionX(String(Math.round(savedCard.position.x)));
        setPositionY(String(Math.round(savedCard.position.y)));
        setTags(savedCard.tags);
        setSaveFeedback("Saved");
      } else {
        setSaveFeedback("Save failed");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function moveToTrash() {
    setIsDeleting(true);
    try {
      await onDeleteCard(card);
    } finally {
      setIsDeleting(false);
    }
  }

  async function attachSelectedFile(file: File | undefined) {
    if (!file) return;

    if (file.size > 25_000_000) {
      setAttachFeedback({ kind: "error", message: "File is larger than 25 MB" });
      return;
    }

    setIsAttaching(true);
    setAttachFeedback(null);
    try {
      const savedCard = await onAttachFile(card.id, file);
      setAttachFeedback(savedCard
        ? { kind: "success", message: "File attached" }
        : { kind: "error", message: "Attach failed" });
    } finally {
      setIsAttaching(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <aside className="inspector">
      <header className="inspectorHeader">
        <div>
          <h2>{card.title}</h2>
        </div>
        <button className="miniIconButton" type="button" aria-label="Close inspector" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      <section className="propertySection">
        <h3>Properties</h3>
        <dl className="propertyList">
          <div>
            <dt>Type</dt>
            <dd><span className="pill">{card.typeKey}</span></dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>
              <input
                className="formControl"
                aria-label="Card title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>
              <textarea
                className="formControl textAreaControl"
                aria-label="Card description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <select
                className="formControl"
                aria-label="Card status"
                value={status}
                onChange={(event) => setStatus(event.target.value as CardStatus)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="approved">Approved</option>
                <option value="archived">Archived</option>
                <option value="error">Error</option>
              </select>
            </dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd className="positionGrid">
              <label>
                X
                <input
                  className="formControl"
                  type="number"
                  aria-label="Card X position"
                  value={positionX}
                  onChange={(event) => setPositionX(event.target.value)}
                />
              </label>
              <label>
                Y
                <input
                  className="formControl"
                  type="number"
                  aria-label="Card Y position"
                  value={positionY}
                  onChange={(event) => setPositionY(event.target.value)}
                />
              </label>
            </dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd className="tagEditor">
              <div className="tagList">
                {tags.map((tag) => (
                  <button className="tagChip" type="button" key={tag} aria-label={`Remove ${tag} tag`} onClick={() => removeTag(tag)}>
                    {tag}
                    <X size={12} />
                  </button>
                ))}
              </div>
              <form
                className="tagForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTag();
                }}
              >
                <input
                  className="formControl"
                  aria-label="New tag"
                  value={newTag}
                  placeholder="Add tag"
                  onChange={(event) => setNewTag(event.target.value)}
                />
                <button type="submit" aria-label="Add tag" disabled={!canAddTag}>
                  <Plus size={14} />
                </button>
              </form>
            </dd>
          </div>
        </dl>
        <button
          className="savePropertiesButton"
          type="button"
          disabled={!isDirty || isSaving || !hasValidPosition}
          onMouseDown={(event) => {
            event.preventDefault();
            void saveProperties();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void saveProperties();
            }
          }}
        >
          {isSaving ? "Saving" : "Save changes"}
        </button>
        {saveFeedback ? <div className="saveFeedback"><CheckCircle2 size={14} />{saveFeedback}</div> : null}
      </section>

      <section className="ioSection">
        <h3>Input</h3>
        {card.inputs.map((input) => <div className="ioRow" key={input}><span />{input}</div>)}
        <h3>Output</h3>
        {card.outputs.map((output) => <div className="ioRow ioRowOutput" key={output}><span />{output}</div>)}
      </section>

      <section className="filesSection">
        <h3>Files</h3>
        {card.files.map((file) => (
          <div className="fileRow" key={file.id}>
            <FileText size={17} />
            <span>{file.filename}</span>
            {file.sizeBytes ? <small>{(file.sizeBytes / 1000).toFixed(1)} KB</small> : null}
          </div>
        ))}
        <input
          className="visuallyHidden"
          ref={fileInputRef}
          type="file"
          aria-label="Choose file to attach"
          onChange={(event) => void attachSelectedFile(event.target.files?.[0])}
        />
        <button
          className="attachButton"
          type="button"
          disabled={isAttaching}
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={15} />
          {isAttaching ? "Attaching" : "Attach file"}
        </button>
        {visibleAttachFeedback ? (
          <div className={`attachFeedback ${visibleAttachFeedback.kind === "error" ? "attachFeedbackError" : ""}`}>
            <CheckCircle2 size={14} />
            {visibleAttachFeedback.message}
          </div>
        ) : null}
      </section>

      <footer className="inspectorMeta">
        <button
          className="dangerButton"
          type="button"
          disabled={isDeleting}
          onClick={() => setIsDeleteConfirming(true)}
        >
          <Trash2 size={15} />
          Move to Trash
        </button>
        {isDeleteConfirming ? (
          <div className="confirmBox" role="alert">
            <strong>Move this card to Trash?</strong>
            <p>You can restore it from the Trash screen.</p>
            <div className="confirmActions">
              <button className="secondaryButton" type="button" onClick={() => setIsDeleteConfirming(false)}>
                Cancel
              </button>
              <button className="dangerButton" type="button" disabled={isDeleting} onClick={() => void moveToTrash()}>
                {isDeleting ? "Moving" : "Move"}
              </button>
            </div>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}

function TrashPanel({
  cards,
  isLoading,
  onOpenBoard,
  onRestoreCard
}: {
  cards: Card[];
  isLoading: boolean;
  onOpenBoard: () => void;
  onRestoreCard: (card: Card) => Promise<void>;
}) {
  return (
    <section className="trashPanel" aria-label="Trash">
      <header className="trashHeader">
        <div>
          <span className="eyebrow">Safe deletion</span>
          <h1>Trash</h1>
          <p>Deleted cards stay here until they are restored. Permanent deletion is intentionally not exposed yet.</p>
        </div>
        <button className="secondaryButton" type="button" onClick={onOpenBoard}>
          Back to board
        </button>
      </header>

      {isLoading ? <div className="trashState">Loading deleted cards</div> : null}
      {!isLoading && cards.length === 0 ? <div className="trashState">Trash is empty</div> : null}
      {!isLoading && cards.length > 0 ? (
        <div className="trashList">
          {cards.map((card) => (
            <article className="trashItem" key={card.id}>
              <div>
                <strong>{card.title}</strong>
                <span>{card.typeKey} · moved to Trash</span>
                {card.description ? <p>{card.description}</p> : null}
              </div>
              <button className="secondaryButton" type="button" onClick={() => void onRestoreCard(card)}>
                Restore
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return "Unknown size";
  if (sizeBytes < 1000) return `${sizeBytes} B`;
  if (sizeBytes < 1_000_000) return `${(sizeBytes / 1000).toFixed(1)} KB`;
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

function FilesPanel({
  files,
  isLoading,
  error,
  onOpenBoard,
  onSelectCard
}: {
  files: BoardFile[];
  isLoading: boolean;
  error: string;
  onOpenBoard: () => void;
  onSelectCard: (cardId: string) => void;
}) {
  const [selectedFileId, setSelectedFileId] = useState<string | undefined>();
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? files[0];

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileId(undefined);
      return;
    }

    if (!files.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(files[0]?.id);
    }
  }, [files, selectedFileId]);

  return (
    <section className="filesPanel" aria-label="Files">
      <header className="filesHeader">
        <div>
          <span className="eyebrow">Board assets</span>
          <h1>Files</h1>
          <p>Read-only inventory of files currently linked to cards on this board.</p>
        </div>
        <button className="secondaryButton" type="button" onClick={onOpenBoard}>
          Back to board
        </button>
      </header>

      {isLoading ? <div className="filesState">Loading files</div> : null}
      {!isLoading && error ? <div className="filesState filesStateError">{error}</div> : null}
      {!isLoading && !error && files.length === 0 ? <div className="filesState">No linked files yet</div> : null}
      {!isLoading && !error && files.length > 0 ? (
        <div className="filesLayout">
          <div className="filesTable" role="table" aria-label="Board files">
            <div className="filesTableHeader" role="row">
              <span>File</span>
              <span>Role</span>
              <span>Size</span>
              <span>Linked card</span>
              <span>Status</span>
            </div>
            {files.map((file) => (
              <button
                className={`filesTableRow ${selectedFile?.id === file.id ? "filesTableRowActive" : ""}`}
                type="button"
                role="row"
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
              >
                <span><FileText size={16} />{file.filename}</span>
                <span>{file.role}</span>
                <span>{formatFileSize(file.sizeBytes)}</span>
                <span>{file.cardTitle}</span>
                <span>Linked</span>
              </button>
            ))}
          </div>

          {selectedFile ? (
            <aside className="fileDetail" aria-label="File details">
              <FileText size={22} />
              <h2>{selectedFile.filename}</h2>
              <dl>
                <div>
                  <dt>Role</dt>
                  <dd>{selectedFile.role}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{selectedFile.mimeType ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatFileSize(selectedFile.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>Linked card</dt>
                  <dd>{selectedFile.cardTitle}</dd>
                </div>
                <div>
                  <dt>Card type</dt>
                  <dd>{selectedFile.cardTypeKey}</dd>
                </div>
                <div>
                  <dt>Card status</dt>
                  <dd>{selectedFile.cardStatus}</dd>
                </div>
              </dl>
              <button className="secondaryButton" type="button" onClick={() => onSelectCard(selectedFile.cardId)}>
                Open linked card
              </button>
            </aside>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BoardBrief({ board }: { board: Board }) {
  const activeCards = board.cards.filter((card) => card.status === "active").length;

  return (
    <section className="boardBrief" aria-label="Board summary">
      <h1>{board.name}</h1>
      <p>{board.description}</p>
      <div className="briefStats">
        <span>{board.cards.length} cards</span>
        <span>{board.connections.length} connections</span>
        <span>{activeCards} active</span>
      </div>
    </section>
  );
}

function SearchDialog({
  board,
  isOpen,
  onClose,
  onSelectCard
}: {
  board: Board;
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (cardId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[]>(board.cards);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const fallbackResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return board.cards;

    return board.cards.filter((card) => {
      const haystack = [
        card.title,
        card.description,
        card.typeKey,
        card.status,
        card.tags.join(" "),
        JSON.stringify(card.data)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [board.cards, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults(board.cards);
      setSearchError("");
      setIsSearching(false);
    }
  }, [board.cards, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    async function searchCards() {
      setIsSearching(true);
      setSearchError("");

      try {
        const params = new URLSearchParams();
        params.set("q", query.trim());

        const response = await fetch(`${apiBaseUrl}/boards/${board.id}/search?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Search request failed with ${response.status}`);
        }

        const payload = (await response.json()) as { cards?: Card[] };
        setResults(payload.cards ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults(fallbackResults);
        setSearchError("Search is using local board data while the API is unavailable.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void searchCards();
    }, 160);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [board.id, fallbackResults, isOpen, query]);

  if (!isOpen) return null;

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="searchDialog" role="dialog" aria-modal="true" aria-label="Search board" onMouseDown={(event) => event.stopPropagation()}>
        <header className="searchDialogHeader">
          <Search size={18} />
          <input
            autoFocus
            aria-label="Search cards"
            value={query}
            placeholder="Search cards, tags, data"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="miniIconButton" type="button" aria-label="Close search" onClick={onClose}>
            <X size={15} />
          </button>
        </header>
        {isSearching || searchError ? (
          <div className={`searchState ${searchError ? "searchStateError" : ""}`}>
            {searchError || "Searching"}
          </div>
        ) : null}
        <div className="searchResults">
          {results.map((card) => (
            <button
              className="searchResult"
              type="button"
              key={card.id}
              onClick={() => {
                onSelectCard(card.id);
                onClose();
              }}
            >
              <strong>{card.title}</strong>
              <span>{card.typeKey} · {card.status}</span>
              {card.description ? <p>{card.description}</p> : null}
            </button>
          ))}
          {results.length === 0 ? <div className="emptySearch">No cards found</div> : null}
        </div>
      </section>
    </div>
  );
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export function BoardEditor({
  board: initialBoard,
  initialSyncStatus = "Loaded"
}: {
  board: Board;
  initialSyncStatus?: string;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [activeView, setActiveView] = useState<ActiveView>("board");
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>(fallbackCardTemplates);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [boardFiles, setBoardFiles] = useState<BoardFile[]>([]);
  const [attachNotice, setAttachNotice] = useState<{ cardId: string; kind: "success" | "error"; message: string } | null>(null);
  const [isFilesLoading, setIsFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [deletedCards, setDeletedCards] = useState<Card[]>([]);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(initialSyncStatus);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      setSyncStatus("Loading");

      try {
        const response = await fetch(`${apiBaseUrl}/boards/${initialBoard.id}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Board request failed with ${response.status}`);
        }

        const nextBoard = boardSchema.parse(await response.json());
        if (cancelled) return;

        setBoard(nextBoard);
        setSyncStatus("Synced");
      } catch {
        if (!cancelled) {
          setSyncStatus("Refresh failed");
        }
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [initialBoard.id]);

  async function loadCardTemplates() {
    setIsTemplatesLoading(true);
    setTemplatesError("");

    try {
      const response = await fetch(`${apiBaseUrl}/boards/${board.id}/card-types`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Card templates request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { templates?: CardTemplate[] };
      const nextTemplates = payload.templates?.length ? payload.templates : fallbackCardTemplates;
      setCardTemplates(nextTemplates);
    } catch {
      setCardTemplates(fallbackCardTemplates);
      setTemplatesError("Using local templates while the API is unavailable.");
    } finally {
      setIsTemplatesLoading(false);
    }
  }

  function openTemplatePicker() {
    setActiveView("board");
    setTemplatesError("");
    setIsTemplatePickerOpen(true);
    void loadCardTemplates();
  }

  async function addCard(template: CardTemplate) {
    setSyncStatus("Saving");
    setIsCreatingCard(true);
    setTemplatesError("");

    try {
      const response = await fetch(`${apiBaseUrl}/boards/${board.id}/cards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          templateKey: template.key
        })
      });

      if (!response.ok) {
        throw new Error(`Create card failed with ${response.status}`);
      }

      const card = (await response.json()) as Card;
      setBoard((current) => ({
        ...current,
        cards: [...current.cards, card]
      }));
      setSelectedCardId(card.id);
      setIsTemplatePickerOpen(false);
      setSyncStatus("Synced");
    } catch {
      setSyncStatus("Save failed");
      setTemplatesError("Could not create this card. Check the API and try again.");
    } finally {
      setIsCreatingCard(false);
    }
  }

  async function updateCard(cardId: string, input: UpdateCardInput): Promise<Card | null> {
    setSyncStatus("Saving");

    try {
      const response = await fetch(`${apiBaseUrl}/cards/${cardId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Update card failed with ${response.status}`);
      }

      const card = (await response.json()) as Card;
      setBoard((current) => ({
        ...current,
        cards: current.cards.map((item) => (item.id === card.id ? card : item))
      }));
      setSyncStatus("Synced");
      return card;
    } catch {
      setSyncStatus("Save failed");
      return null;
    }
  }

  async function loadTrash() {
    setIsTrashLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/boards/${board.id}/trash`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Trash request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { cards?: Card[] };
      setDeletedCards(payload.cards ?? []);
      setSyncStatus("Synced");
    } catch {
      setSyncStatus("Trash unavailable");
    } finally {
      setIsTrashLoading(false);
    }
  }

  async function loadFiles() {
    setIsFilesLoading(true);
    setFilesError("");
    try {
      const response = await fetch(`${apiBaseUrl}/boards/${board.id}/files`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Files request failed with ${response.status}`);
      }

      const payload = (await response.json()) as { files?: BoardFile[] };
      setBoardFiles(payload.files ?? []);
      setSyncStatus("Synced");
    } catch {
      setFilesError("Files are unavailable right now");
      setSyncStatus("Files unavailable");
    } finally {
      setIsFilesLoading(false);
    }
  }

  async function attachFile(cardId: string, file: File): Promise<Card | null> {
    setSyncStatus("Saving");
    setAttachNotice(null);

    try {
      const response = await fetch(`${apiBaseUrl}/cards/${cardId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || undefined,
          sizeBytes: file.size,
          role: "attachment"
        })
      });

      if (!response.ok) {
        throw new Error(`Attach file failed with ${response.status}`);
      }

      const card = (await response.json()) as Card;
      setBoard((current) => ({
        ...current,
        cards: current.cards.map((item) => (item.id === card.id ? card : item))
      }));
      setBoardFiles((current) => [
        ...current.filter((item) => item.cardId !== card.id),
        ...card.files.map((item) => ({
          ...item,
          cardId: card.id,
          cardTitle: card.title,
          cardTypeKey: card.typeKey,
          cardStatus: card.status
        }))
      ]);
      setAttachNotice({ cardId, kind: "success", message: "File attached" });
      setSyncStatus("Synced");
      return card;
    } catch {
      setAttachNotice({ cardId, kind: "error", message: "Attach failed" });
      setSyncStatus("Attach failed");
      return null;
    }
  }

  async function deleteCard(card: Card) {
    setSyncStatus("Saving");

    try {
      const response = await fetch(`${apiBaseUrl}/cards/${card.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(`Delete card failed with ${response.status}`);
      }

      setBoard((current) => ({
        ...current,
        cards: current.cards.filter((item) => item.id !== card.id)
      }));
      setBoardFiles((current) => current.filter((file) => file.cardId !== card.id));
      setDeletedCards((current) => [card, ...current.filter((item) => item.id !== card.id)]);
      setSelectedCardId(undefined);
      setActiveView("trash");
      setSyncStatus("Synced");
    } catch {
      setSyncStatus("Delete failed");
    }
  }

  async function restoreCard(card: Card) {
    setSyncStatus("Saving");

    try {
      const response = await fetch(`${apiBaseUrl}/cards/${card.id}/restore`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Restore card failed with ${response.status}`);
      }

      const restoredCard = (await response.json()) as Card;
      setBoard((current) => ({
        ...current,
        cards: [...current.cards.filter((item) => item.id !== restoredCard.id), restoredCard]
      }));
      setDeletedCards((current) => current.filter((item) => item.id !== restoredCard.id));
      setSelectedCardId(restoredCard.id);
      setActiveView("board");
      setSyncStatus("Synced");
    } catch {
      setSyncStatus("Restore failed");
    }
  }

  function updateCardPositionLocally(cardId: string, position: Card["position"]) {
    setBoard((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === cardId ? { ...card, position } : card))
    }));
  }

  const nodes = useMemo<WorkflowNode[]>(
    () =>
      board.cards.map((card) => ({
        id: card.id,
        type: "workflowCard",
        position: card.position,
        data: { card },
        selected: card.id === selectedCardId
      })),
    [board.cards, selectedCardId]
  );

  const edges = useMemo<Edge[]>(
    () =>
      board.connections.map((connection) => ({
        id: connection.id,
        source: connection.sourceCardId,
        target: connection.targetCardId,
        label: connection.label,
        type: "smoothstep",
        animated: connection.status === "active",
        style: { stroke: "#8e99ad", strokeWidth: 1.8 }
      })),
    [board.connections]
  );

  const selectedCard = board.cards.find((card) => card.id === selectedCardId);

  useEffect(() => {
    if (activeView === "files") {
      void loadFiles();
    }

    if (activeView === "trash") {
      void loadTrash();
    }
  }, [activeView]);

  function handleNodesChange(changes: NodeChange<WorkflowNode>[]) {
    const nextNodes = applyNodeChanges(changes, nodes);

    setBoard((current) => ({
      ...current,
      cards: current.cards.map((card) => {
        const nextNode = nextNodes.find((node) => node.id === card.id);
        return nextNode ? { ...card, position: nextNode.position } : card;
      })
    }));
  }

  return (
    <>
    <div className="mobileFallback">
      <div className="brandMark">Y</div>
      <h1>Yadraw</h1>
      <p>The canvas is optimized for desktop workspaces. Open it on a wider screen to edit workflow boards.</p>
    </div>
    <main className={`appShell ${selectedCard ? "" : "appShellNoInspector"}`}>
      <LeftSidebar
        activeView={activeView}
        onOpenBoard={() => {
          setActiveView("board");
        }}
        onOpenFiles={() => {
          setSelectedCardId(undefined);
          setActiveView("files");
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenTrash={() => {
          setSelectedCardId(undefined);
          setActiveView("trash");
        }}
      />
      <section className="mainArea">
        <TopBar
          boardName={board.name}
          syncStatus={syncStatus}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
        <div className="boardSurface">
          {activeView === "board" ? (
            <>
              {!selectedCard ? <BoardBrief board={board} /> : null}
              <CanvasToolbar onAddCard={openTemplatePicker} />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                defaultViewport={{ x: 300, y: -20, zoom: 0.72 }}
                minZoom={0.45}
                maxZoom={1.4}
                nodesDraggable
                elementsSelectable
                onNodesChange={handleNodesChange}
                onNodeClick={(_, node) => setSelectedCardId(node.id)}
                onNodeDragStop={(_, node) => {
                  updateCardPositionLocally(node.id, node.position);
                  void updateCard(node.id, { position: node.position });
                }}
              >
                <Background color="#d8dde8" gap={24} size={1} />
              </ReactFlow>
            </>
          ) : activeView === "files" ? (
            <FilesPanel
              files={boardFiles}
              isLoading={isFilesLoading}
              error={filesError}
              onOpenBoard={() => setActiveView("board")}
              onSelectCard={(cardId) => {
                setSelectedCardId(cardId);
                setActiveView("board");
              }}
            />
          ) : (
            <TrashPanel
              cards={deletedCards}
              isLoading={isTrashLoading}
              onOpenBoard={() => setActiveView("board")}
              onRestoreCard={restoreCard}
            />
          )}
        </div>
      </section>
      {activeView === "board" && selectedCard ? (
        <Inspector
          card={selectedCard}
          onClose={() => setSelectedCardId(undefined)}
          onDeleteCard={deleteCard}
          attachNotice={attachNotice}
          onAttachFile={attachFile}
          onSaveCard={updateCard}
        />
      ) : null}
    </main>
    <SearchDialog
      board={board}
      isOpen={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      onSelectCard={setSelectedCardId}
    />
    <TemplatePickerDialog
      templates={cardTemplates}
      isOpen={isTemplatePickerOpen}
      isLoading={isTemplatesLoading}
      error={templatesError}
      isCreating={isCreatingCard}
      onClose={() => {
        if (!isCreatingCard) {
          setIsTemplatePickerOpen(false);
        }
      }}
      onCreate={addCard}
    />
    </>
  );
}
