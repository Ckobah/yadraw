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
  Bell,
  Bot,
  Boxes,
  ChevronDown,
  FileText,
  Grid2X2,
  History,
  Layers3,
  MousePointer2,
  Play,
  Plus,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  X,
  ZoomIn
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { boardSchema, type Board, type Card, type CardStatus, type UpdateCardInput } from "@yadraw/shared";
import { WorkflowCardNode, type WorkflowNode } from "./workflow-node";

const nodeTypes: NodeTypes = {
  workflowCard: WorkflowCardNode
};

const projectItems = [
  ["P", "Product Pipeline", "projectPurple"],
  ["M", "Marketing Plan", "projectGreen"],
  ["C", "Customer Support", "projectOrange"],
  ["D", "Data Sync Flow", "projectBlue"]
] as const;

function AvatarStack() {
  return (
    <div className="avatarStack" aria-label="Collaborators">
      <span className="avatar avatarOne" />
      <span className="avatar avatarTwo" />
      <span className="avatar avatarThree" />
      <span className="avatarMore">+2</span>
    </div>
  );
}

function LeftSidebar() {
  return (
    <aside className="leftSidebar">
      <div className="brandRow">
        <div className="brandMark">Y</div>
        <button className="workspaceButton" type="button">
          Acme Workspace
          <ChevronDown size={15} />
        </button>
      </div>

      <nav className="primaryNav" aria-label="Primary">
        <a className="navItem navItemActive" href="#">
          <Grid2X2 size={18} />
          Board
        </a>
        <a className="navItem" href="#">
          <FileText size={18} />
          Files
        </a>
        <a className="navItem" href="#">
          <Search size={18} />
          Search
        </a>
        <a className="navItem" href="#">
          <Sparkles size={18} />
          AI Assistant
        </a>
      </nav>

      <div className="sidebarSection">
        <div className="sectionHeader">
          <span>Projects</span>
          <button className="miniIconButton" type="button" aria-label="Add project">
            <Plus size={15} />
          </button>
        </div>
        {projectItems.map(([letter, label, className]) => (
          <a className="projectItem" href="#" key={label}>
            <span className={`projectBadge ${className}`}>{letter}</span>
            {label}
          </a>
        ))}
      </div>

      <div className="sidebarFooterNav">
        <a className="navItem" href="#">
          <Layers3 size={18} />
          Templates
        </a>
        <a className="navItem" href="#">
          <Trash2 size={18} />
          Trash
        </a>
      </div>

      <div className="assistantPrompt">
        <button className="miniIconButton closePrompt" type="button" aria-label="Close assistant">
          <X size={14} />
        </button>
        <strong>
          <Sparkles size={15} />
          AI Assistant
        </strong>
        <p>Ask anything about your board</p>
        <button className="primaryButton" type="button">Ask AI</button>
      </div>

      <div className="accountRow">
        <span className="accountAvatar" />
        <div>
          <strong>Alex Smith</strong>
          <small>admin@acme.com</small>
        </div>
        <ChevronDown size={15} />
      </div>
    </aside>
  );
}

function TopBar({ syncStatus }: { syncStatus: string }) {
  return (
    <header className="topBar">
      <div className="breadcrumbs">
        <span>Projects</span>
        <span>/</span>
        <span>Product Pipeline</span>
        <span>/</span>
        <button type="button">
          Main Board
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="topActions">
        <AvatarStack />
        <button className="shareButton" type="button">
          <Share2 size={17} />
          Share
        </button>
        <button className="squareButton" type="button" aria-label="Run workflow">
          <Play size={18} />
        </button>
        <button className="searchBox" type="button">
          <Search size={17} />
          Search
          <kbd>⌘K</kbd>
        </button>
        <button className="squareButton" type="button" aria-label="Notifications">
          <Bell size={18} />
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
      <span className="toolGroup">
        <button className="toolIconActive" type="button" aria-label="Select">
          <MousePointer2 size={17} />
        </button>
        <button type="button" aria-label="Pan">
          <Upload size={17} />
        </button>
        <button type="button" aria-label="Zoom">
          <ZoomIn size={17} />
        </button>
      </span>
    </div>
  );
}

function BoardMiniPreview({ board }: { board: Board }) {
  if (board.cards.length === 0) {
    return null;
  }

  const minX = Math.min(...board.cards.map((card) => card.position.x));
  const minY = Math.min(...board.cards.map((card) => card.position.y));
  const maxX = Math.max(...board.cards.map((card) => card.position.x + card.size.width));
  const maxY = Math.max(...board.cards.map((card) => card.position.y + card.size.height));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return (
    <div className="boardMiniPreview" aria-label="Board mini map">
      <div className="miniPreviewInner">
        {board.cards.map((card) => {
          const accent = String(card.style.accent ?? "blue");
          return (
            <span
              className={`miniNode miniNode${accent[0]?.toUpperCase()}${accent.slice(1)}`}
              key={card.id}
              style={{
                left: `${((card.position.x - minX) / width) * 82 + 6}%`,
                top: `${((card.position.y - minY) / height) * 66 + 10}%`,
                width: `${Math.max((card.size.width / width) * 70, 14)}%`,
                height: `${Math.max((card.size.height / height) * 48, 12)}%`
              }}
            />
          );
        })}
      </div>
      <div className="miniPreviewControls">
        <button type="button" aria-label="Zoom out">−</button>
        <button type="button" aria-label="Zoom in">+</button>
        <button type="button" aria-label="Fit board">⌘</button>
      </div>
    </div>
  );
}

function Inspector({
  card,
  board,
  onSaveCard
}: {
  card: Card;
  board: Board;
  onSaveCard: (cardId: string, input: UpdateCardInput) => Promise<void>;
}) {
  const incoming = board.connections.filter((connection) => connection.targetCardId === card.id);
  const outgoing = board.connections.filter((connection) => connection.sourceCardId === card.id);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [status, setStatus] = useState<CardStatus>(card.status);
  const [positionX, setPositionX] = useState(String(Math.round(card.position.x)));
  const [positionY, setPositionY] = useState(String(Math.round(card.position.y)));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description ?? "");
    setStatus(card.status);
    setPositionX(String(Math.round(card.position.x)));
    setPositionY(String(Math.round(card.position.y)));
  }, [card.id, card.title, card.description, card.status, card.position.x, card.position.y]);

  const nextPosition = {
    x: Number(positionX),
    y: Number(positionY)
  };
  const hasValidPosition = Number.isFinite(nextPosition.x) && Number.isFinite(nextPosition.y);
  const isDirty =
    title !== card.title ||
    description !== (card.description ?? "") ||
    status !== card.status ||
    nextPosition.x !== card.position.x ||
    nextPosition.y !== card.position.y;

  async function saveProperties() {
    if (!hasValidPosition) return;

    setIsSaving(true);
    try {
      await onSaveCard(card.id, {
        title,
        description,
        status,
        position: nextPosition
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="inspector">
      <header className="inspectorHeader">
        <div>
          <h2>{card.title}</h2>
        </div>
        <button className="miniIconButton" type="button" aria-label="Close inspector">
          <X size={16} />
        </button>
      </header>

      <div className="tabs">
        <button className="tabActive" type="button">Details</button>
        <button type="button">Connections ({incoming.length + outgoing.length})</button>
        <button type="button">History</button>
      </div>

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
                  value={positionX}
                  onChange={(event) => setPositionX(event.target.value)}
                />
              </label>
              <label>
                Y
                <input
                  className="formControl"
                  type="number"
                  value={positionY}
                  onChange={(event) => setPositionY(event.target.value)}
                />
              </label>
            </dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd className="tagList">
              {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
              <button type="button" aria-label="Add tag"><Plus size={14} /></button>
            </dd>
          </div>
        </dl>
        <button
          className="savePropertiesButton"
          type="button"
          disabled={!isDirty || isSaving || !hasValidPosition}
          onClick={saveProperties}
        >
          {isSaving ? "Saving" : "Save changes"}
        </button>
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
        <button className="attachButton" type="button">
          <Plus size={15} />
          Attach file
        </button>
      </section>

      <footer className="inspectorMeta">
        <span>Created</span>
        <strong>Jun 24, 2026, 10:23</strong>
        <span>Updated</span>
        <strong>Today, 09:41</strong>
      </footer>
    </aside>
  );
}

function DetailPanel({ card, board }: { card: Card; board: Board }) {
  const incoming = board.connections
    .filter((connection) => connection.targetCardId === card.id)
    .map((connection) => board.cards.find((item) => item.id === connection.sourceCardId)?.title)
    .filter(Boolean);
  const outgoing = board.connections
    .filter((connection) => connection.sourceCardId === card.id)
    .map((connection) => board.cards.find((item) => item.id === connection.targetCardId)?.title)
    .filter(Boolean);

  return (
    <section className="detailPanel">
      <header className="detailHeader">
        <div className="detailTitle">
          <Sparkles size={18} />
          <strong>{card.title}</strong>
          <span className="pill">{card.typeKey}</span>
          <span className="statusDot" />
          <span>{card.status}</span>
        </div>
        <div>
          <button className="miniIconButton" type="button" aria-label="Settings">
            <Settings2 size={15} />
          </button>
          <button className="miniIconButton" type="button" aria-label="History">
            <History size={15} />
          </button>
        </div>
      </header>

      <div className="detailTabs">
        <button className="tabActive" type="button">Overview</button>
        <button type="button">Input / Output</button>
        <button type="button">Files ({card.files.length})</button>
        <button type="button">Settings</button>
        <button type="button">History</button>
      </div>

      <div className="detailGrid">
        <div>
          <h3>Description</h3>
          <p>{card.description}</p>
          <h3>Status</h3>
          <span className="successBadge">{card.status}</span>
        </div>
        <div>
          <h3>Input</h3>
          {card.inputs.map((input) => <div className="compactRow" key={input}>{input}<span>object</span></div>)}
          <h3>Output</h3>
          {card.outputs.map((output) => <div className="compactRow" key={output}>{output}<span>object</span></div>)}
        </div>
        <div>
          <h3>Connections</h3>
          <span className="mutedLabel">Incoming</span>
          {incoming.map((title) => <div className="connectionRow" key={title}>{title}</div>)}
          <span className="mutedLabel">Outgoing</span>
          {outgoing.map((title) => <div className="connectionRow" key={title}>{title}</div>)}
        </div>
      </div>
    </section>
  );
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export function BoardEditor({ board: initialBoard }: { board: Board }) {
  const [board, setBoard] = useState(initialBoard);
  const [selectedCardId, setSelectedCardId] = useState(initialBoard.cards[1]?.id ?? initialBoard.cards[0]?.id);
  const [syncStatus, setSyncStatus] = useState("Local demo");

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
        setSelectedCardId((current) => current ?? nextBoard.cards[1]?.id ?? nextBoard.cards[0]?.id);
        setSyncStatus("Synced");
      } catch {
        if (!cancelled) {
          setSyncStatus("Offline demo");
        }
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [initialBoard.id]);

  async function addCard() {
    const nextNumber = board.cards.length + 1;
    setSyncStatus("Saving");

    try {
      const response = await fetch(`${apiBaseUrl}/boards/${board.id}/cards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          typeKey: "note",
          title: `${nextNumber}. New JSON Card`,
          description: "Draft card created from the board editor.",
          status: "draft",
          data: {
            kind: "note",
            source: "web"
          },
          position: {
            x: 180 + (nextNumber % 4) * 120,
            y: 180 + Math.floor(nextNumber / 4) * 110
          },
          size: {
            width: 300,
            height: 175
          },
          style: {
            accent: "blue"
          },
          inputs: ["input"],
          outputs: ["output"],
          tags: ["draft"]
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
      setSyncStatus("Synced");
    } catch {
      setSyncStatus("Save failed");
    }
  }

  async function updateCard(cardId: string, input: UpdateCardInput) {
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
    } catch {
      setSyncStatus("Save failed");
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

  const selectedCard = board.cards.find((card) => card.id === selectedCardId) ?? board.cards[0];

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
    <main className="appShell">
      <LeftSidebar />
      <section className="mainArea">
        <TopBar syncStatus={syncStatus} />
        <div className="boardSurface">
          <CanvasToolbar onAddCard={addCard} />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
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
          <BoardMiniPreview board={board} />
          {selectedCard ? <DetailPanel card={selectedCard} board={board} /> : null}
        </div>
      </section>
      {selectedCard ? <Inspector card={selectedCard} board={board} onSaveCard={updateCard} /> : null}
    </main>
  );
}
