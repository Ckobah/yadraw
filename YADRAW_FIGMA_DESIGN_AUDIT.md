# Yadraw Figma Design Audit

## Executive Summary

Аудит выполнен без изменений кода, без миграций, без коммита.

Текущий audited HEAD: `0aa28abe91733cb53c2fdaea6b904f78201dbabc`.

Yadraw сейчас фактически является V2 visual graph/card editor на одном основном экране: `/v2/boards/[boardId]`. UI уже содержит важную продуктовую логику: typed cards, schema fields, linked fields, card type manager, visual edit mode, connector slots, ручное редактирование линий, dry-run и deterministic AI Assistant.

Для Figma нужно проектировать не просто "красивую доску", а полноценную рабочую систему с несколькими режимами редактирования.

Главный вывод по дизайн-системе: основа токенов уже появилась в `v2-theme-tokens.ts` и применяется на root V2 board shell, но `globals.css` всё ещё содержит много старых/прямых HEX/RGBA стилей. Перед генерацией Figma лучше зафиксировать новую token model и отрисовать V2-компоненты вокруг неё, не копируя старый CSS буквально.

---

## 1. Архитектура UI

### Основные роуты

| Route | Назначение | Доказательство |
|---|---|---|
| `/` | сразу редиректит на demo V2 board | `apps/web/app/page.tsx` |
| `/boards/[boardId]` | legacy-friendly redirect на `/v2/boards/[boardId]` | `apps/web/app/boards/[boardId]/page.tsx` |
| `/v2/boards/[boardId]` | основной V2 board route, server-fetch board detail | `apps/web/app/v2/boards/[boardId]/page.tsx` |
| `/v2/actions/...` | same-origin Next proxy routes для browser API | `apps/web/app/v2/actions/...` |

### Layout

- Root layout только подключает `globals.css` и отдаёт `{children}`.
- Evidence: `apps/web/app/layout.tsx`.
- Глобальный CSS один: `apps/web/app/globals.css`.

### Где находится V2 Board

- Server route получает `V2BoardDetail` через `fetchV2Board`.
- UI входит через `V2BoardPage`.
- Evidence: `apps/web/app/v2/boards/[boardId]/page.tsx`.

### V2 layout

- `V2BoardPage` создаёт `.v2BoardShell`, `.v2BoardHeader`, `.v2BoardCanvasArea`.
- Theme variables применяются inline на `.v2BoardShell`.
- Evidence: `apps/web/features/v2-board/v2-board-page.tsx`.

### Главные UI-компоненты

- Canvas/orchestration: `apps/web/features/v2-board/v2-board-canvas.tsx`
- Card node: `apps/web/features/v2-board/v2-card-node.tsx`
- Card inspector: `apps/web/features/v2-board/v2-card-inspector.tsx`
- Card create toolbar/type picker: `apps/web/features/v2-board/v2-card-create-toolbar.tsx`
- Card Type Manager modal: `apps/web/features/v2-board/v2-card-type-manager.tsx`
- Connector edge/manual route: `apps/web/features/v2-board/v2-connector-edge.tsx`
- Connector inspector: `apps/web/features/v2-board/v2-connector-inspector.tsx`
- Connector visual toolbar: `apps/web/features/v2-board/v2-connector-visual-edit-panel.tsx`
- Linked fields mapping: `apps/web/features/v2-board/v2-linked-fields-preview.tsx`
- AI panel: `apps/web/features/v2-board/v2-ai-assistant-panel.tsx`
- Dry-run panel: `apps/web/features/v2-board/v2-run-dry-run-panel.tsx`

---

## 2. Текущая дизайн-система

### Theme/token foundation

Файл:

`apps/web/features/v2-board/v2-theme-tokens.ts`

Содержит:

- `YadrawTheme`
- `lightYadrawTheme`
- `draftYadrawThemes`
- `createYadrawThemeVariables`
- `resolveCardTypeAccentKey`

Тема применяется на V2 root, не глобально:

`apps/web/features/v2-board/v2-board-page.tsx`

```tsx
<div
  className="v2BoardShell"
  data-yadraw-theme={lightYadrawTheme.key}
  style={themeVariables}
>
```

### Основные `--yd-*` группы

Surface:

- `--yd-surface-app`
- `--yd-surface-board`
- `--yd-surface-card`
- `--yd-surface-card-header`
- `--yd-surface-panel`
- `--yd-surface-input`

Text:

- `--yd-text-primary`
- `--yd-text-secondary`
- `--yd-text-muted`
- `--yd-text-inverse`

Borders:

- `--yd-border-subtle`
- `--yd-border-default`
- `--yd-border-strong`
- `--yd-border-selected`

Card:

- `--yd-card-radius`
- `--yd-card-shadow`
- `--yd-card-selected-outline`

Panel:

- `--yd-panel-shadow`
- `--yd-panel-backdrop`

Form:

- `--yd-form-*`

Graph:

- `--yd-graph-connector`
- `--yd-graph-connector-selected`
- `--yd-graph-port-input`
- `--yd-graph-port-output`
- `--yd-graph-port-receiver`
- `--yd-graph-slot-label`

Accent:

- `--yd-accent-{blue|green|orange|red|purple|gray}-{soft|surface|solid|text|border}`

### Light/Dark

- Light theme реально используется.
- Dark/pastel/acid сейчас draft-only в `draftYadrawThemes`.
- UI Theme Manager отсутствует.
- Evidence: `apps/web/features/v2-board/v2-theme-tokens.ts`.

### Hardcoded styles

Поиск нашёл около `625` вхождений HEX/RGBA/color-mix в `globals.css` и V2 files.

Вывод: Figma не должна слепо копировать текущие цвета. Нужен token cleanup.

### CSS strategy

- Global CSS.
- CSS modules не обнаружены в V2.
- Tailwind dependency/`@tailwind` не обнаружены.
- Dynamic React inline styles используются для:
  - card accent CSS vars в `v2-card-node.tsx`;
  - minimap border/radius в `v2-board-canvas.tsx`;
  - React Flow node size;
  - connector label/waypoint transforms.

---

## 3. Экраны и состояния для Figma

### Нужно спроектировать

1. Dashboard/list boards
   - Сейчас полноценного dashboard нет.
   - `/` редиректит на demo board.
   - В `globals.css` есть старые dashboard/share/template/notification стили, но активный V2 route их не использует напрямую.

2. Board screen
   - Header.
   - Infinite canvas.
   - `+ Card` toolbar.
   - Right run/AI toolbar.
   - Minimap.
   - Controls.
   - Side inspector.

3. Empty board
   - `V2BoardEmptyState`.
   - Evidence: `apps/web/features/v2-board/v2-board-empty-state.tsx`.

4. Loading/error states
   - `V2BoardErrorState` есть.
   - Loading skeleton отдельным компонентом не найден.

5. Card states
   - normal;
   - selected;
   - visual edit mode;
   - resizing;
   - menu open;
   - pending duplicate/delete;
   - with data preview rows;
   - with linked fields preview rows.
   - Evidence: `apps/web/features/v2-board/v2-card-node.tsx`.

6. Visual edit mode
   - text toolbar;
   - resize handles;
   - connector slot add zones;
   - slot type popover;
   - locked connected slots.

7. Connector states
   - normal edge;
   - selected edge;
   - visual editing edge;
   - manual route with waypoint handles;
   - snap indicator;
   - draggable label.

8. Inspector panels
   - card inspector;
   - connector inspector;
   - files/attachments states;
   - advanced details;
   - schema fields / extra data;
   - linked fields mapping.

9. Modals/panels
   - Card Type Manager;
   - AI Assistant panel;
   - Dry-run result panel;
   - Card type picker popover.

10. Missing/not active but needed for future Figma
   - theme manager: no UI yet, only token foundation;
   - settings: no active settings screen;
   - auth/account: no active UI found in V2;
   - share/notifications/templates: CSS exists in `globals.css`, but active V2 components not found in `features/v2-board`.

---

## 4. Компонентная таблица

| Component | File | Назначение | Visual props/state | Tokens/styles | Consistency risk |
|---|---|---|---|---|---|
| `V2BoardPage` | `apps/web/features/v2-board/v2-board-page.tsx` | Shell/header/theme root | board name, counts | `--yd-*` vars inline | theme hardcoded to light |
| `V2BoardCanvas` | `apps/web/features/v2-board/v2-board-canvas.tsx` | React Flow orchestration | selected card/edge, visual edit, dry-run/AI open | React Flow + global CSS | very dense orchestration, many modes |
| `V2CardNodeComponent` | `apps/web/features/v2-board/v2-card-node.tsx` | Card rendering + card visual edit | selected, visualStyle, cardType accent/icon, connector slots | `--v2-card-*`, `--yd-accent-*` | inline style + CSS split; resize handles hardcoded black/white |
| `V2CardCreateToolbar` | `apps/web/features/v2-board/v2-card-create-toolbar.tsx` | `+ Card`, type picker | open/query/active type/isCreating | `.v2CreateToolbar*`, `--v2-create-accent` | popover dense, preview/list split |
| `V2CardInspector` | `apps/web/features/v2-board/v2-card-inspector.tsx` | Right card panel | card type accent, pending actions | `.v2CardInspector*` | overloaded: basics/data/linked/files/connections/advanced |
| `V2CardDataSection` | `apps/web/features/v2-board/v2-card-data-section.tsx` | Schema fields + extra data | schema fields, dirty/error/save | `.v2InspectorData*` | field rows are heavy, weak hierarchy |
| `V2LinkedFieldsPreview` | `apps/web/features/v2-board/v2-linked-fields-preview.tsx` | Linked field mapping + CRUD | IN/TARGET/OUT, drag/drop, warnings | `.v2Linked*` | complex UX squeezed inside inspector |
| `V2CardTypeManager` | `apps/web/features/v2-board/v2-card-type-manager.tsx` | Type definition editor | selected type/new type/isSaving | `.v2CardTypeManager*` | modal uses many direct HEX values |
| `V2CardTypeSchemaEditor` | `apps/web/features/v2-board/v2-card-type-schema-editor.tsx` | schema.fields editor | field drafts, select options | `.v2Schema*` | dense form, needs design system controls |
| `V2ConnectorEdge` | `apps/web/features/v2-board/v2-connector-edge.tsx` | Edge rendering/manual path | selected, routeMode, waypoints, label position | SVG + `.v2Connector*` | advanced interactions need clearer affordances |
| `V2ConnectorInspector` | `apps/web/features/v2-board/v2-connector-inspector.tsx` | Connector details/data/files | dirty/error/save | reuses inspector styles | card/connector inspectors look too similar |
| `V2ConnectorVisualEditPanel` | `apps/web/features/v2-board/v2-connector-visual-edit-panel.tsx` | Floating connector toolbar | color/width/radius/markers/manual | `.v2ConnectorVisual*` | uses symbol buttons, not all lucide/icon-system |
| `V2AiAssistantPanel` | `apps/web/features/v2-board/v2-ai-assistant-panel.tsx` | Deterministic Q&A | active question | `.v2AiAssistant*` | panel position competes with canvas |
| `V2RunDryRunPanel` | `apps/web/features/v2-board/v2-run-dry-run-panel.tsx` | Dry-run preview | steps/warnings | `.v2DryRun*` | right overlay may collide with inspector |
| Attachments sections | `v2-card-attachments-section.tsx`, `v2-connector-files-section.tsx` | file upload/download/remove | loading/uploading/removing/error | `.v2InspectorAttachment*` | uses native confirm; needs modal pattern later |

---

## 5. UI-релевантная модель данных

### Смысл/контент

- `card.title`
- `card.description`
- `card.data`
- `card.status`
- `connection.title`
- `connection.description`
- `connection.data`

Evidence:

`packages/shared/src/v2.ts`

### Визуальное оформление экземпляра

Card:

- `card.size`
- `card.position`
- `card.visualStyle`
  - `fontFamily`
  - `textAlign`
  - `textColor`
  - `fontWeight`
  - `fontStyle`
  - `textDecoration`
  - `bodyVerticalAlign`
  - `connectorSlots`

Connection:

- `connection.visualStyle`
  - `strokeColor`
  - `strokeWidth`
  - `cornerRadius`
  - markers
  - `routeMode`
  - `waypoints`
  - `labelPosition`
  - `labelSegmentIndex`

### Board-level presentation

- `board.viewport`
- browser viewport persistence:
  - key: `yadraw:v2-board:${boardId}:viewport`
  - Evidence: `readStoredBoardViewport/storeBoardViewport` in `v2-board-canvas.tsx`.

### Card type presentation

- `cardType.key`
- `cardType.name`
- `cardType.description`
- `cardType.schema.fields`
- `cardType.defaultSize`
- `cardType.defaultVisualStyle`
  - `accentKey`
  - `iconKey`
- `cardType.ports`

DB evidence:

- `card_types.default_width`
- `card_types.default_height`
- `card_types.schema`
- `card_types.default_visual_style`

### Theme-level tokens

Theme resolves concrete colors from `accentKey`.

Flow:

```text
card.cardTypeId
→ cardTypes
→ cardType.defaultVisualStyle.accentKey
→ --yd-accent-*
```

Evidence:

- `resolveCardTypeAccentKey` in `v2-theme-tokens.ts`
- `getMiniMapNodeColor` in `v2-board-canvas.tsx`
- card CSS vars in `v2-card-node.tsx`

### Important separation

- `card.data` = business JSON.
- `card.visualStyle` = per-card visual presentation.
- `card_types.schema` = type field definitions.
- `card_types.default_visual_style` = type-level visual defaults.
- `v2_card_field_bindings` = linked fields.
- Attachments are outside `card.data`.

---

## 6. Основные UX-флоу

### Создание карточки

1. User clicks `+ Card`.
2. `V2CardCreateToolbar` opens type picker.
3. User selects type.
4. New card created at canvas center using `screenToFlowPosition`.
5. Backend call via `/v2/actions/boards/:boardId/cards`.

### Редактирование карточки

1. Click card.
2. `selectedCardId` set in `V2BoardCanvas`.
3. `V2CardInspector` opens.
4. Basics save title/description on blur/enter.
5. Data saves schema fields + extra data into `card.data`.

### Visual edit mode

1. Double click card or menu action.
2. `visualEditingCardId` set.
3. Card shows text toolbar, resize handles, connector slot add zones.
4. Background click closes edit mode.
5. Evidence: `onPaneClick` clears `setVisualEditingCardId(null)` in `v2-board-canvas.tsx`.

### Resize

- React Flow `NodeResizer` visible only when `data.isVisualEditing`.
- Saves `card.size`.
- Min size from `V2_CARD_MIN_SIZE`.

### Text editing

- Floating toolbar inside card:
  - alignment;
  - vertical align;
  - font;
  - bold;
  - italic;
  - underline;
  - text color.
- Saves `card.visualStyle`, not `card.data`.

### Connector slots

- Generated from card type ports unless saved in `card.visualStyle.connectorSlots`.
- Double-click card perimeter in visual mode adds slot.
- Drag slot around perimeter.
- Connected slots cannot be deleted or type-changed.
- Evidence:
  - `"Cannot delete a connected slot."`
  - `"Cannot change type of a connected slot."`
  - file: `v2-card-node.tsx`

### Connector creation

- React Flow `onConnect`.
- Validates source/target slot directions through `isValidHandle`.
- Creates backend connection.
- Duplicate endpoint gets `Connection already exists.`

### Connector line editing

- Double-click edge enters connector visual edit.
- Floating toolbar edits stroke, width, radius, markers, route mode.
- Manual mode supports bend points, segment dragging, label dragging.
- Snap to horizontal/vertical when angle is <= 5 degrees.
- Evidence: `SNAP_ANGLE_DEGREES = 5` in `v2-connector-edge.tsx`.

### Card Type Manager

- Open from `+ Card → Manage card types` or inspector `Manage type`.
- Create/update type key/name/schema/default size/accent/icon/default ports.
- Schema edits affect type definition, not existing card data.

### Theme switching

- Not implemented as UI.
- Only light theme is applied in `V2BoardPage`.
- Draft themes exist in code.

### Save/load

- Board loaded server-side with `fetchV2Board`.
- Browser writes through `/v2/actions/...`.
- Viewport saved in localStorage.
- Card/connection changes use optimistic local updates + API save.

---

## 7. Ограничения и требования пользователя, найденные в коде/доках

- Visual edit mode is presentation-only, not semantic data.
  - Evidence: `AGENTS.md`.

- Browser must not import server auth/header logic.
  - Evidence: browser helper `api.ts` uses `/v2/actions/...`; server-only `server-api.ts` has `import "server-only"` and `V2_USER_ID`.

- `card.data` must not contain internal metadata.
  - Evidence: shared `v2JsonObjectSchema` rejects `_yadraw`; DB has `cards_data_no_internal_yadraw`.

- Theme should apply at V2 board root, not globally.
  - Evidence: `V2BoardPage` applies variables on `.v2BoardShell`.

- Background click closes selected/editing states.
  - Evidence: `onPaneClick` in `v2-board-canvas.tsx`.

- Connected connector slots are locked.
  - Evidence: `v2-card-node.tsx` connected slot checks.

- Manual line editing should snap near horizontal/vertical.
  - Evidence: `SNAP_ANGLE_DEGREES = 5`.

- Line label moves with selected segment when segment moves.
  - Evidence: `handleSegmentPointerDown` updates `labelPosition` when `shouldMoveLabel`.

- Minimap color uses card type accent.
  - Evidence: `getMiniMapNodeColor(node.data.cardType)`.

---

## 8. Визуальные проблемы и redesign risks

1. `globals.css` слишком большой и смешивает старые стили с V2.
   - Evidence: share/template/notification CSS есть, но активных V2 components рядом нет.

2. Неполная токенизация.
   - V2 shell/card частично на `--yd-*`, но менеджер типов, инспектор, connector toolbar, dry-run/AI используют много HEX/RGBA.

3. Слишком плотный inspector.
   - В одном правом panel: basics, schema fields, extra data, linked fields mapping, files, connections, advanced.

4. Linked fields mapping слишком сложный для узкой правой панели.
   - IN/TARGET/OUT layout нужен, но в inspector это перегружает вертикальный поток.

5. Разные button styles.
   - Create toolbar, inspector actions, card type manager, connector toolbar имеют разные радиусы, цвета, hover/focus.

6. Слабая системность overlay/panel placement.
   - AI panel снизу по центру, dry-run справа сверху, inspector справа, connector toolbar сверху. Нужна z-index/overlay стратегия в Figma.

7. Resize handles hardcoded black/white.
   - Evidence: inline `handleStyle` in `v2-card-node.tsx`.

8. Connector visual toolbar использует текстовые символы:
   - `━`
   - `⌜`
   - `⇤`
   - `⇥`
   - `⌁`
   - `↺`
   - вместо единого icon language.

9. Theme Manager отсутствует.
   - Дизайн должен предусмотреть будущий manager, но текущий код имеет только token data.

10. Dashboard отсутствует.
   - Для Figma нужен новый frame, но нельзя считать текущий `/` dashboard-экраном.

---

## 9. Figma Generation Brief

### Экраны для генерации

1. V2 Board main screen, realistic populated board.
2. Empty board.
3. Board loading/error.
4. Card selected with right inspector.
5. Card visual edit mode.
6. Connector visual edit mode.
7. Card Type Manager modal.
8. Card create type picker.
9. Linked fields mapping expanded state.
10. AI Assistant panel.
11. Dry-run result panel.
12. Future dashboard/list boards.
13. Future theme manager.

### Компоненты

- App shell/header.
- Board canvas background.
- Card node.
- Card header/type badge/icon.
- Card body data rows.
- Linked field rows.
- Connector handles/input/output/receiver.
- Connector line/label/waypoint/marker.
- Minimap.
- Toolbar button.
- Popover.
- Side inspector.
- Inspector section.
- Form input/select/textarea/checkbox.
- File row.
- Connection row.
- Modal overlay.
- Card Type Manager list/editor.
- Schema field editor row.
- AI/dry-run panels.

### Состояния

- default;
- hover;
- focus;
- disabled;
- active;
- card selected;
- visual editing;
- resizing;
- action pending;
- slot free;
- slot connected;
- slot locked;
- slot dragging;
- connector selected;
- manual editing;
- snap active;
- dirty;
- saved;
- saving;
- error;
- empty;
- loading;
- linked field resolved;
- linked field missing;
- linked field multiple;
- linked field duplicate target;
- type manager existing/new/saving/error.

### Design tokens to define in Figma

Surfaces:

- app;
- board;
- card;
- card header;
- panel;
- input.

Text:

- primary;
- secondary;
- muted;
- inverse.

Borders:

- subtle;
- default;
- strong;
- selected.

Accent scale per semantic key:

- blue;
- green;
- orange;
- red;
- purple;
- gray.

Graph:

- connector;
- connector selected;
- port input;
- port output;
- port receiver;
- slot label.

Card:

- radius;
- shadow;
- selected ring;
- header gradient/surface.

Panel/modal:

- shadow;
- backdrop.

Form:

- input bg;
- border;
- focus ring.

Spacing:

- 4;
- 6;
- 8;
- 10;
- 12;
- 16;
- 20;
- 24.

Typography:

- board title;
- card title;
- card type label;
- inspector label;
- row value;
- micro label.

### Recommended Figma file structure

1. `00 Foundations`
   - color tokens;
   - typography;
   - spacing;
   - radius;
   - shadows.

2. `01 Components / Cards`
   - card node variants.

3. `02 Components / Graph`
   - connectors;
   - handles;
   - minimap.

4. `03 Components / Forms`
   - inputs;
   - buttons;
   - panels;
   - modals.

5. `04 Screens / Board`
   - main board states.

6. `05 Screens / Managers`
   - Card Type Manager;
   - future Theme Manager.

7. `06 Screens / Empty/Error`
   - empty/loading/error.

8. `99 Legacy Reference`
   - screenshots of current implementation only.

### Screenshots to capture from current app

- Board with 3+ card types and semantic accents.
- Selected card with schema fields.
- Resized card with data rows.
- Card visual edit mode with text toolbar and handles.
- Connector visual edit mode with manual route and label.
- Linked fields mapping panel.
- Card Type Manager with schema + visual defaults.
- AI panel and dry-run panel.
- Empty/error state if easy.

### Recommended fixtures

Card types:

- SOURCE green;
- TASK blue;
- custom yellow/legal entity.

Cards:

- Supplier/source with `data.inn`, `data.phone`, `data.email`;
- Part/detail card with schema fields;
- Task card connected from source.

Connections:

- incoming and outgoing;
- one labeled connection;
- one manual route with bend points.

Linked fields:

- one resolved linked field;
- one missing source warning.

Files:

- one attached PDF/image-like filename.

States:

- one selected card;
- one card in visual edit.

---

## Prioritized Checklist

### 1. Сначала

Сгенерировать foundations + core board screen:

- token palette;
- board shell;
- card node variants;
- selected state;
- minimap;
- connector line basics.

### 2. Вторым этапом

Сгенерировать editing states:

- card visual edit mode;
- resize handles;
- text toolbar;
- connector slots;
- connector manual edit toolbar;
- waypoint/label movement states.

### 3. Третьим этапом

Сгенерировать product panels:

- card inspector;
- linked fields mapping;
- card type manager;
- create card picker;
- AI/dry-run panels;
- empty/error states.

### 4. После этого

Отдельно проектировать future screens:

- dashboard/list boards;
- theme manager;
- settings/account;
- share/notifications/templates, если они возвращаются в V2.

---

## Boundary Confirmation

- Код не изменялся.
- Миграции не запускались.
- Деплой не выполнялся.
- Коммит не создавался.
- Legacy/V1 не трогались.
- `card.data` boundary сохранён.
- Browser secrets не раскрывались.
