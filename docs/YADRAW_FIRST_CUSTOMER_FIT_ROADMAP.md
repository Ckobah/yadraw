# Yadraw V2: roadmap достижения first-customer fit

Статус: реализация продолжается; выполняется этап 1.

Текущий прогресс:

- этап 0: baseline и рабочее дерево проверены; незавершённые quantitative-relationship изменения
  оставлены в своей области и не смешиваются с roadmap;
- этап 1: public product page реализована отдельным статическим web slice;
- этап 1: server-controlled `process_map_v1` и `typed_knowledge_graph_v1` реализованы отдельным
  stacked slice с транзакционным созданием board graph, dashboard chooser и новым empty-board
  onboarding;
- этап 1: contextual hints для первой карточки, первой связи, полей, filters и export остаются
  следующим slice; prospect validation gate ещё не пройден.

Это зонтичный roadmap, а не numbered task из `docs/plan`. Существующая очередь в
`docs/plan/00_SHARED_EXECUTION_RULES.md` не меняется. Перед реализацией каждый этап нужно
превратить в отдельный task-specific план и поставить в согласованное место очереди.

## Цель

Сделать Yadraw законченным инструментом для наиболее сильного раннего сегмента:

- индивидуальных process/data/solution architects;
- технических консультантов;
- knowledge modelers, которым нужны структурированные карточки и семантические отношения на
  визуальном холсте.

Первый полностью закрытый пользовательский цикл:

```text
начать с подходящей модели
  -> загрузить существующие данные
  -> смоделировать карточки и отношения
  -> найти, сравнить и проверить нужное
  -> поделиться или экспортировать результат
  -> вернуться и продолжить работу
```

Первый продуктовый wedge: **структурированное моделирование процессов и систем для архитекторов и
консультантов**. Не пытаться одновременно стать полной заменой Miro, Obsidian и ERD-редакторов.

## Почему этапы расположены именно так

Исследование First Customer Finder выявило четыре повторяющиеся потребности:

1. карточка должна быть записью с переиспользуемыми полями;
2. отношения должны иметь собственный смысл и данные;
3. нужен промежуточный слой между свободным рисунком и жёсткими data tools;
4. import, query и export определяют, станет ли модель рабочим инструментом, а не демо.

В Yadraw уже есть базовая модель schema-backed cards и typed relationships. Поэтому roadmap сначала
закрывает activation, data ingress, discovery, review и export, а не AI и general workflow execution.

## Критерии достижения first-customer fit

Roadmap считается успешным только после наблюдаемого использования, а не после выпуска функций:

- новый пользователь получает полезную заполненную доску менее чем за 10 минут;
- минимум три evidence-backed prospect проходят problem interview;
- минимум два prospect создают или импортируют реальную модель, а не только смотрят демо;
- минимум один design partner возвращается к той же доске ещё в два разных дня;
- минимум один design partner делится результатом или экспортирует его для реального review;
- segment-specific adapter попадает в core roadmap только после одинакового блокера минимум у трёх
  пользователей.

Если добавляется продуктовая аналитика, она должна быть first-party и privacy-minimal. Нельзя писать
в analytics events содержимое карточек и связей, filenames, поисковые запросы или attachment metadata.

## Общие границы реализации

- Только V2; legacy и V1 не затрагивать.
- Browser API остаётся same-origin под `/v2/actions/...`.
- Авторизация выполняется в Fastify service methods; скрытая кнопка не является защитой.
- В `card.data` остаются только business/user fields. Filters, saved views, import state, comments и
  analytics там не хранятся.
- Presentation settings остаются отдельно от semantic data.
- Import, layout и relationship rules не меняют существующие port keys, endpoint IDs и handle IDs.
- Templates, import и board duplication не копируют attachments.
- Сохраняется autosave; Save/Cancel в редакторы не добавляются.
- Миграция добавляется только для нового persistent entity, должна быть numbered, immutable и
  idempotent.
- Hardcoded product UI остаётся на английском.

## Этап 0. Стабилизация основы и подготовка проверки спроса

Цель: не строить новый roadmap поверх незаконченного или неверно понятого поведения.

### Работы

- Завершить или явно отложить текущие незаконченные изменения quantitative relationships отдельной
  задачей. Не смешивать их коммит с последующими этапами.
- Проверить production entry, регистрацию, dashboard onboarding, board creation, JSON export и
  persistence после reload.
- Зафиксировать исходные time-to-first-card и time-to-first-relationship на новом аккаунте.
- Подготовить два воспроизводимых 90-секундных walkthrough:
  - structured process map;
  - typed knowledge graph.
- Провести вручную три problem interview. Уточнить source data, обязательные поля, relationship types,
  review workflow, export format и первую отсутствующую функцию, делающую продукт непригодным.
- Не автоматизировать outreach и не обогащать private contact data.

### Критерии выхода

- текущая грязная работа завершена в своей задаче или изолирована;
- production entry не ведёт на inaccessible board и не содержит broken redirect;
- оба demo workflow и interview script воспроизводимы;
- у каждого последующего P0-этапа есть конкретная prospect need.

Deliverable: audit-only отчёт. Коммит продукта не требуется, если audit не выявил отдельный дефект,
который пользователь явно разрешил исправить.

## Этап 1. Activation, templates и полезное пустое состояние

Цель: показать ценность Yadraw до того, как пользователь настроит пустую систему вручную.

### Пользовательское поведение

- Добавить public product page: одно ясное обещание, screenshot или short demo, поддерживаемые use
  cases, beta limitations, privacy/support и прямое начало работы.
- Вместо тупика пустой доски предложить:
  - `Start with Process Map`;
  - `Start with Typed Knowledge Graph`;
  - `Start blank`.
- Добавить два server-controlled versioned blueprint:
  - **Process Map**: Activity с полями owner, system, problem, status; отношения Next, Depends on,
    Uses;
  - **Typed Knowledge Graph**: Source, Claim, Question, Decision; отношения Supports, Contradicts,
    Depends on, Follows.
- Создавать доску из blueprint одной авторизованной серверной операцией с rollback при частичном
  сбое.
- Добавить contextual onboarding для первой карточки, первой связи, редактирования полей, входа в
  фильтры и export. Не строить generic tour framework без необходимости.
- Предоставить reusable demo board или preview без копирования чужих user/workspace IDs.

### Технический подход

- На первом шаге использовать code-versioned server-side blueprints; не создавать marketplace и
  template database.
- Blueprint содержит только card types, ports, relationship types, example cards и layout.
- Blueprint не содержит attachments, users, auth data или постоянных workspace IDs.
- Использовать существующие ownership boundaries и same-origin proxy.

### Acceptance criteria

- новый пользователь создаёт любой blueprint и получает связанную заполненную доску;
- после reload сохраняются semantic и visual model;
- empty/loading/retry/partial-failure states дают понятное действие;
- пользователь без документации находит, где менять поля и отношения;
- проверены desktop и narrow viewport.

### Validation gate

Показать оба сценария трём prospects. Продолжать, если минимум двое без подсказки объясняют, чем
Yadraw card отличается от обычной whiteboard shape.

## Этап 2. CSV import и практичный tabular export

Цель: убрать ручной повторный ввод для process, org-chart, roadmap и metadata-heavy сценариев.

### Этап 2A. Импорт карточек из CSV

- Принимать UTF-8 CSV с документированным лимитом размера и количества строк.
- Позволять выбрать существующий card type или создать совместимый тип из headers.
- До mutation показывать preview: headers, inferred field types, mapping, invalid rows и количество
  создаваемых карточек.
- Требовать явный mapping для title и неоднозначных колонок.
- Поддержать text, number, boolean, choice, date и JSON с детерминированной validation.
- Явно выбрать duplicate policy: create new, skip by selected key или update matched library record.
  Никогда не выполнять silent merge.
- Импортировать транзакционно либо bounded resumable batches с точным partial-result report.
- Первая версия не импортирует attachments и не угадывает connections.

### Этап 2B. CSV export

- Экспортировать карточки выбранного card type в стабильном порядке schema fields.
- Включать title, description, schema fields и, по явному выбору, stable object IDs.
- Connection data экспортировать отдельным CSV: source/target IDs, port keys, relationship type,
  status и relationship fields.
- Сохранить текущий full-board JSON export как lossless metadata export.
- Экранировать spreadsheet formula prefixes в human-oriented CSV.

### Acceptance criteria

- preview count совпадает с final result;
- invalid values не обходят существующую schema validation;
- повторный импорт с `skip` не создаёт duplicates;
- Unicode сохраняется, CSV корректно открывается spreadsheet tools;
- JSON export и attachment boundaries не меняются.

### Validation gate

Один process-map prospect импортирует реальную или безопасно анонимизированную таблицу и получает
полезную доску без ручного создания каждой карточки.

## Этап 3. Board-wide discovery и data workbench

Цель: работать с моделью после того, как она перестала помещаться в одном viewport.

### Этап 3A. Search и filters

- Добавить один авторизованный backend contract для board-wide search/filter.
- Искать по title, description, schema fields и relationship fields без доступа к другой доске или
  workspace.
- Фильтровать по card type, relationship type, status, field presence/value, incoming/outgoing
  relation и validation state.
- Выбор результата фокусирует и подсвечивает соответствующую карточку или связь на canvas.
- Определить pagination и limits; не выгружать unbounded board в диалог.

### Этап 3B. Table view и bulk actions

- Добавить table view одного card type со schema-backed columns.
- Поддержать sort, filter, column visibility и bounded multi-row edit.
- Bulk changes идут через validated batch endpoint и точно сообщают partial failures.
- Переключение table/canvas не меняет semantic data и не сбрасывает viewport.

### Этап 3C. Saved views

- Хранить named filter/sort/columns как отдельную view entity или user preference.
- Saved view не живёт в `card.data`, connection data или visual style.
- До миграции явно решить, personal это view или shared.

### Acceptance criteria

- authorization проверена для query и batch operations;
- table и canvas используют одинаковую filter semantics;
- shortcuts не мутируют данные, пока focus находится в search/table editor;
- готовы empty/no-results/loading/retry states;
- large-board tests фиксируют поддерживаемый scale.

### Validation gate

Минимум два design partners используют filter или table view, чтобы ответить на реальный вопрос о
модели. Простое открытие функции не считается.

## Этап 4. Authenticated review и controlled sharing

Цель: дать архитектору или консультанту проверить модель с другим человеком без немедленного
строительства real-time collaboration.

### Этап 4A. Workspace invitations

- Реализовать lifecycle: create, rate-limited resend, accept, expire, revoke.
- Переиспользовать owner/admin/editor/viewer roles и проверять их в service methods.
- Viewer остаётся read-only для board, cards, connections, attachments, exports, semantic graph и
  calculations.
- Email delivery остаётся server-side; tokens и addresses не попадают в лишние logs.
- Добавить новую idempotent migration только при отсутствии подходящего persistent entity.

### Этап 4B. Асинхронный review

- Добавить lightweight comment/review-note model только после рабочего invitation flow.
- Comments являются отдельными entities и могут ссылаться на board/card/connection ID; в semantic
  JSON они не хранятся.
- Resolve/reopen и mentions добавлять только при подтверждённой необходимости review workflow.
- Presence cursors и conflict resolution отложить.

### Решение об anonymous read-only links

Не реализовывать автоматически. Сначала подтвердить, что demand оправдывает revocable tokens,
expiry, download policy, indexing protection, abuse controls, privacy copy и access audit.
Authenticated viewer invitation — безопасный default.

### Acceptance criteria

- expired/revoked invite не даёт доступа;
- viewer mutation отклоняется сервером;
- attachments и export используют те же role checks;
- membership другого workspace не раскрывается;
- same-origin и browser-secret checks остаются чистыми.

### Validation gate

Design partner приглашает реального reviewer, который открывает board и оставляет actionable review
signal либо принимает решение на основе модели.

## Этап 5. Relationship rules и видимые данные связей

Цель: закончить semantic-relationship promise для typed-link и metadata-heavy пользователей.

### Пользовательское поведение

- Ограничивать для relationship type допустимые source/target card types без изменения port keys.
- Добавить optional cardinality и uniqueness rules с понятным validation state.
- Поддержать directional и inverse display labels при одной canonical stored relation.
- Сделать incoming/outgoing relationships навигируемыми из контекста карточки.
- Позволить relationship type выбрать semantic fields для canvas label или compact metadata preview.
- Конфигурацию отображения label хранить вне connection business data.
- Одинаково показывать incomplete/invalid relation в inspector, canvas, search, semantic graph и
  calculations.
- Сохранить quantities/calculations как отдельную versioned semantic feature, не превращая этап в
  universal formula engine.

### Совместимость

- Existing relationship types без constraints остаются валидными.
- Existing connections сохраняют type, endpoint card IDs, port keys, waypoints и label position.
- Обновление schema/rules сообщает о violations, но не удаляет и не переподключает records.

### Acceptance criteria

- invalid endpoint combination отклоняется server-side;
- cardinality/uniqueness детерминированы при concurrent requests;
- relationship field labels безопасно рендерятся и доступны search/filter;
- manual/automatic connector invariants покрыты;
- semantic graph отдаёт structured rule/validity information без presentation state.

### Validation gate

Typed-link или metadata prospect создаёт минимум три разных relationship meanings и использует их
данные или constraints в реальной задаче.

## Этап 6. Layout и presentation completion

Цель: уменьшить ручную раскладку и сделать результат пригодным для внешнего использования.

### Работы

- Добавить deterministic layout commands:
  - hierarchy/org chart;
  - left-to-right process или decision tree;
  - dependency graph.
- Lanes/groups добавлять только после решения, являются ли они visual containers или semantic
  entities. Не кодировать lanes в `card.data` по умолчанию.
- Layout работает для selection или whole board и не меняет ports/relationship types.
- Manual routes сохраняются по выбору пользователя; автоматический reroute требует explicit option.
- Добавить PNG/SVG/PDF-oriented export с определённым поведением для offscreen content,
  background, labels и attachments.

### Acceptance criteria

- layout undoable и сохраняется после reload;
- group movement и manual connector invariants не ломаются;
- export не обрезает content на поддерживаемых размерах;
- desktop и narrow viewport остаются рабочими.

### Validation gate

Process/org-chart prospect предпочитает generated layout ручной раскладке и использует export в
реальном review или документе.

## Этап 7. Выбор одного segment adapter

Цель: углублять продукт только там, где repeated evidence подтверждает спрос. Это decision gate, а
не разрешение строить оба направления.

### Track A. Obsidian/Markdown knowledge graph

Начинать, только если минимум три active design partners называют vault import/export главным
блокером после этапов 1-5.

Возможный первый slice:

- Markdown/frontmatter import;
- wikilinks и ограниченный typed-link parsing;
- deterministic mapping к card/relationship types;
- backlinks и round-trip export rules;
- conflict/unsupported syntax report.

Не заявлять полную Obsidian plugin или Dataview compatibility без отдельных contracts/tests.

### Track B. SQL/DBML schema modeling

Начинать, только если минимум три active design partners требуют database schema workflow и
принимают structured-canvas модель Yadraw.

Возможный первый slice:

- DBML или один SQL dialect, но не все сразу;
- table/column/PK/FK/unique/nullability model;
- cardinality и crow's-foot presentation;
- deterministic DDL/DBML export;
- unsupported construct report и round-trip fixtures.

Не называть Yadraw ERD replacement до проверенного import/constraints/export round trip.

### Критерии выхода

- выбран один узкий versioned adapter contract;
- минимум два design partners дважды используют реальные imported data;
- adapter не превращает domain-specific system metadata в generic `card.data` и не ломает общую
  card/relationship model.

## Этап 8. Collaboration и automation только после retention

Кандидаты для поздней приоритизации:

- presence и real-time editing;
- conflict handling и version history;
- advanced formulas, rollups и recursive calculations;
- workflow execution;
- Jira/Azure DevOps integrations;
- AI-assisted schema/model suggestions.

Продвигать только одну функцию, блокирующую уже наблюдаемую retained-user работу. AI не заменяет
import, query, review и export.

## Рекомендуемая последовательность

```text
Этап 0: baseline
  -> Этап 1: activation/templates
  -> Этап 2: CSV import/export
  -> Этап 3: search/table/views
  -> Этап 4: authenticated review
  -> Этап 5: relationship rules
  -> Этап 6: layout/export
  -> Этап 7: один evidence-gated adapter
  -> Этап 8: retained-user platform features
```

Этапы 2 и 3 можно планировать вместе, но выпускать отдельными complete slices. Этап 4 может обогнать
этап 3, если активный design partner уже заблокирован review access. Этап 5 может обогнать этап 4,
если основным сегментом становятся typed-link users, а не process consultants.

## Шаблон реализации каждого этапа

Task-specific план перед реализацией должен содержать:

1. observed customer problem и validation cohort;
2. current-code audit и ownership boundaries;
3. API и persistence decision;
4. user-visible behavior, error states и accessibility;
5. backward compatibility и migration behavior;
6. affected workspace checks из `AGENTS.md`;
7. focused manual verification checklist;
8. release, measurement и design-partner validation gate;
9. rollback/disable strategy для import, sharing и schema rules.

Не объединять несколько major stages в одном commit или production push. Каждый этап должен быть
самостоятельно reviewable и deployable.

## Testing baseline

В разработке запускать проверки только затронутых workspaces, затем обязательный production build и
bundle secret scan для web changes. Добавить focused tests для:

- authorization/workspace isolation;
- CSV encoding, escaping, limits, validation и partial failure;
- filter semantics и pagination;
- batch atomicity или explicit partial-result behavior;
- invitation expiry/revocation и viewer write rejection;
- relationship-rule concurrency/backward compatibility;
- layout undo/reload и connector invariants;
- import/export round trip выбранного adapter.

Manual verification обязательна для onboarding clarity, import mapping, table/canvas handoff, review
flow, connector labels, layout quality и narrow viewport.

## Что намеренно не входит в P0

- real-time collaboration;
- anonymous public sharing;
- расширение AI assistant;
- general workflow execution;
- recursive BOM или universal formula engine;
- одновременные Miro, Obsidian, SQL и DBML integrations;
- template marketplace;
- broad visual redesign, не связанный с complete customer workflow.

P0-цель — один законченный повторяемый customer job, а не максимальная ширина функций.
