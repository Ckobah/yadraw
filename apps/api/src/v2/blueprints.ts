import type {
  V2BoardBlueprintKey,
  V2CardStatus,
  V2CardTypePortInput,
  V2CardTypeSchema,
  V2CardVisualStyle,
  V2ConnectionStatus,
  V2ConnectionTypeSchema,
  V2ConnectionVisualStyle,
  V2JsonObject,
  V2Size,
  V2Viewport
} from "@yadraw/shared";

export type V2BoardBlueprintCardType = {
  key: string;
  name: string;
  description: string;
  defaultData: V2JsonObject;
  schema: V2CardTypeSchema;
  defaultSize: V2Size;
  defaultVisualStyle: V2CardVisualStyle;
  ports: readonly V2CardTypePortInput[];
};

export type V2BoardBlueprintConnectionType = {
  key: string;
  name: string;
  description: string;
  schema: V2ConnectionTypeSchema;
  defaultVisualStyle: V2ConnectionVisualStyle;
};

export type V2BoardBlueprintCard = {
  localKey: string;
  cardTypeKey: string;
  title: string;
  description: string;
  data: V2JsonObject;
  position: { x: number; y: number };
  size?: V2Size;
  visualStyle?: V2CardVisualStyle;
  status: V2CardStatus;
};

export type V2BoardBlueprintConnection = {
  connectionTypeKey: string;
  sourceCardKey: string;
  targetCardKey: string;
  sourcePortKey: string;
  targetPortKey: string;
  type: string;
  label: string;
  title: string;
  description: string;
  data: V2JsonObject;
  visualStyle?: V2ConnectionVisualStyle;
  status: V2ConnectionStatus;
};

export type V2BoardBlueprint = {
  key: V2BoardBlueprintKey;
  version: 1;
  viewport: V2Viewport;
  cardTypes: readonly V2BoardBlueprintCardType[];
  connectionTypes: readonly V2BoardBlueprintConnectionType[];
  cards: readonly V2BoardBlueprintCard[];
  connections: readonly V2BoardBlueprintConnection[];
};

const PROCESS_ACTIVITY_PORTS: readonly V2CardTypePortInput[] = [
  { key: "previous", label: "Previous", direction: "input", dataType: "json", required: false, sortOrder: 0 },
  { key: "dependency", label: "Dependency", direction: "input", dataType: "json", required: false, sortOrder: 1 },
  { key: "used_by", label: "Used by", direction: "input", dataType: "json", required: false, sortOrder: 2 },
  { key: "next", label: "Next", direction: "output", dataType: "json", required: false, sortOrder: 3 },
  { key: "depends_on", label: "Depends on", direction: "output", dataType: "json", required: false, sortOrder: 4 },
  { key: "uses", label: "Uses", direction: "output", dataType: "json", required: false, sortOrder: 5 }
];

const KNOWLEDGE_PORTS: readonly V2CardTypePortInput[] = [
  { key: "supported_by", label: "Supported by", direction: "input", dataType: "json", required: false, sortOrder: 0 },
  { key: "contradicted_by", label: "Contradicted by", direction: "input", dataType: "json", required: false, sortOrder: 1 },
  { key: "dependency", label: "Dependency", direction: "input", dataType: "json", required: false, sortOrder: 2 },
  { key: "previous", label: "Previous", direction: "input", dataType: "json", required: false, sortOrder: 3 },
  { key: "supports", label: "Supports", direction: "output", dataType: "json", required: false, sortOrder: 4 },
  { key: "contradicts", label: "Contradicts", direction: "output", dataType: "json", required: false, sortOrder: 5 },
  { key: "depends_on", label: "Depends on", direction: "output", dataType: "json", required: false, sortOrder: 6 },
  { key: "follows", label: "Follows", direction: "output", dataType: "json", required: false, sortOrder: 7 }
];

const processMapBlueprint: V2BoardBlueprint = {
  key: "process_map_v1",
  version: 1,
  viewport: { x: 70, y: 210, zoom: 0.68 },
  cardTypes: [
    {
      key: "process_activity_v1",
      name: "Activity",
      description: "A structured step in a business or delivery process.",
      defaultData: { status: "not_started" },
      schema: {
        fields: [
          { key: "owner", label: "Owner", type: "text", placeholder: "Person or role" },
          { key: "system", label: "System", type: "text", placeholder: "Tool or system" },
          { key: "problem", label: "Problem", type: "text", placeholder: "Risk or friction" },
          {
            key: "status",
            label: "Status",
            type: "select",
            defaultValue: "not_started",
            options: [
              { value: "not_started", label: "Not started" },
              { value: "in_progress", label: "In progress" },
              { value: "blocked", label: "Blocked" },
              { value: "done", label: "Done" }
            ]
          }
        ]
      },
      defaultSize: { width: 264, height: 184 },
      defaultVisualStyle: {
        accentColor: "#2E90FA",
        fillColor: "#FFFFFF",
        borderColor: "#B2DDFF",
        iconKey: "workflow"
      },
      ports: PROCESS_ACTIVITY_PORTS
    }
  ],
  connectionTypes: [
    {
      key: "process_next_v1",
      name: "Next",
      description: "The process continues with the target activity.",
      schema: {
        fields: [
          { key: "handoff", label: "Handoff", type: "text", placeholder: "What moves forward?" }
        ],
        semantics: { version: 1, kind: "custom", sourceRole: "predecessor", targetRole: "successor" }
      },
      defaultVisualStyle: { strokeColor: "#2E90FA", markerEnd: "arrow", showLabel: true }
    },
    {
      key: "process_depends_on_v1",
      name: "Depends on",
      description: "The source activity cannot complete without the target activity.",
      schema: {
        fields: [
          { key: "reason", label: "Reason", type: "text", placeholder: "Why is it required?" },
          { key: "critical", label: "Critical", type: "boolean", defaultValue: false }
        ],
        semantics: { version: 1, kind: "needs", sourceRole: "dependent", targetRole: "dependency" }
      },
      defaultVisualStyle: { strokeColor: "#F79009", markerEnd: "arrow", showLabel: true }
    },
    {
      key: "process_uses_v1",
      name: "Uses",
      description: "The source activity uses the target activity's output or context.",
      schema: {
        fields: [
          { key: "context", label: "Context", type: "text", placeholder: "How is it used?" }
        ],
        semantics: { version: 1, kind: "uses", sourceRole: "consumer", targetRole: "resource" }
      },
      defaultVisualStyle: { strokeColor: "#7F56D9", markerEnd: "arrow", showLabel: true }
    }
  ],
  cards: [
    {
      localKey: "capture_request",
      cardTypeKey: "process_activity_v1",
      title: "Capture client request",
      description: "Record the goal, context, and expected outcome.",
      data: { owner: "Consultant", system: "Intake", problem: "Missing context", status: "done" },
      position: { x: 0, y: 80 },
      status: "active"
    },
    {
      localKey: "clarify_requirements",
      cardTypeKey: "process_activity_v1",
      title: "Clarify requirements",
      description: "Resolve assumptions and define the review criteria.",
      data: { owner: "Architect", system: "Workshop", problem: "Ambiguous scope", status: "in_progress" },
      position: { x: 330, y: 80 },
      status: "active"
    },
    {
      localKey: "design_solution",
      cardTypeKey: "process_activity_v1",
      title: "Design solution",
      description: "Model the proposed process, systems, and decisions.",
      data: { owner: "Architect", system: "Yadraw", problem: "Competing constraints", status: "not_started" },
      position: { x: 660, y: 80 },
      status: "active"
    },
    {
      localKey: "review_client",
      cardTypeKey: "process_activity_v1",
      title: "Review with client",
      description: "Check the model against real work and collect decisions.",
      data: { owner: "Consultant", system: "Review session", problem: "Unresolved feedback", status: "not_started" },
      position: { x: 990, y: 80 },
      status: "active"
    },
    {
      localKey: "approve_next_step",
      cardTypeKey: "process_activity_v1",
      title: "Approve next step",
      description: "Confirm ownership and the next concrete action.",
      data: { owner: "Client owner", system: "Decision log", problem: "No accountable owner", status: "not_started" },
      position: { x: 1320, y: 80 },
      status: "active"
    }
  ],
  connections: [
    {
      connectionTypeKey: "process_next_v1",
      sourceCardKey: "capture_request",
      targetCardKey: "clarify_requirements",
      sourcePortKey: "next",
      targetPortKey: "previous",
      type: "process",
      label: "Next",
      title: "Request captured",
      description: "The request is ready for clarification.",
      data: { handoff: "Goal and context" },
      status: "active"
    },
    {
      connectionTypeKey: "process_next_v1",
      sourceCardKey: "clarify_requirements",
      targetCardKey: "design_solution",
      sourcePortKey: "next",
      targetPortKey: "previous",
      type: "process",
      label: "Next",
      title: "Scope agreed",
      description: "Agreed requirements start the design work.",
      data: { handoff: "Requirements and review criteria" },
      status: "active"
    },
    {
      connectionTypeKey: "process_next_v1",
      sourceCardKey: "design_solution",
      targetCardKey: "review_client",
      sourcePortKey: "next",
      targetPortKey: "previous",
      type: "process",
      label: "Next",
      title: "Model ready",
      description: "The solution model is ready for review.",
      data: { handoff: "Structured model" },
      status: "active"
    },
    {
      connectionTypeKey: "process_next_v1",
      sourceCardKey: "review_client",
      targetCardKey: "approve_next_step",
      sourcePortKey: "next",
      targetPortKey: "previous",
      type: "process",
      label: "Next",
      title: "Review complete",
      description: "Review findings are ready for a decision.",
      data: { handoff: "Findings and open decisions" },
      status: "active"
    },
    {
      connectionTypeKey: "process_depends_on_v1",
      sourceCardKey: "design_solution",
      targetCardKey: "clarify_requirements",
      sourcePortKey: "depends_on",
      targetPortKey: "dependency",
      type: "dependency",
      label: "Depends on",
      title: "Requirements dependency",
      description: "The solution must reflect agreed requirements.",
      data: { reason: "Scope must be explicit before design", critical: true },
      status: "active"
    },
    {
      connectionTypeKey: "process_uses_v1",
      sourceCardKey: "review_client",
      targetCardKey: "design_solution",
      sourcePortKey: "uses",
      targetPortKey: "used_by",
      type: "reference",
      label: "Uses",
      title: "Review uses model",
      description: "The client review is grounded in the structured model.",
      data: { context: "Walk through the proposed process" },
      status: "active"
    }
  ]
};

const knowledgeCardTypes: readonly V2BoardBlueprintCardType[] = [
  {
    key: "knowledge_source_v1",
    name: "Source",
    description: "Evidence, document, interview, or other traceable input.",
    defaultData: { credibility: "unrated" },
    schema: {
      fields: [
        { key: "url", label: "URL", type: "text", placeholder: "https://" },
        { key: "author", label: "Author", type: "text" },
        { key: "published_on", label: "Published on", type: "date" },
        {
          key: "credibility",
          label: "Credibility",
          type: "select",
          defaultValue: "unrated",
          options: [
            { value: "unrated", label: "Unrated" },
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" }
          ]
        }
      ]
    },
    defaultSize: { width: 270, height: 190 },
    defaultVisualStyle: { accentColor: "#1570EF", fillColor: "#EFF8FF", borderColor: "#B2DDFF", iconKey: "source" },
    ports: KNOWLEDGE_PORTS
  },
  {
    key: "knowledge_claim_v1",
    name: "Claim",
    description: "A statement that can be supported, contradicted, or refined.",
    defaultData: { confidence: "medium" },
    schema: {
      fields: [
        {
          key: "confidence",
          label: "Confidence",
          type: "select",
          defaultValue: "medium",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" }
          ]
        },
        { key: "evidence_note", label: "Evidence note", type: "text" }
      ]
    },
    defaultSize: { width: 270, height: 180 },
    defaultVisualStyle: { accentColor: "#7F56D9", fillColor: "#F9F5FF", borderColor: "#D6BBFB", iconKey: "claim" },
    ports: KNOWLEDGE_PORTS
  },
  {
    key: "knowledge_question_v1",
    name: "Question",
    description: "An explicit uncertainty that keeps the model honest.",
    defaultData: { priority: "medium", status: "open" },
    schema: {
      fields: [
        {
          key: "priority",
          label: "Priority",
          type: "select",
          defaultValue: "medium",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" }
          ]
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          defaultValue: "open",
          options: [
            { value: "open", label: "Open" },
            { value: "investigating", label: "Investigating" },
            { value: "answered", label: "Answered" }
          ]
        }
      ]
    },
    defaultSize: { width: 270, height: 170 },
    defaultVisualStyle: { accentColor: "#F79009", fillColor: "#FFFAEB", borderColor: "#FEDF89", iconKey: "question" },
    ports: KNOWLEDGE_PORTS
  },
  {
    key: "knowledge_decision_v1",
    name: "Decision",
    description: "A chosen direction with ownership and rationale.",
    defaultData: { status: "proposed" },
    schema: {
      fields: [
        { key: "owner", label: "Owner", type: "text" },
        {
          key: "status",
          label: "Status",
          type: "select",
          defaultValue: "proposed",
          options: [
            { value: "proposed", label: "Proposed" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Rejected" }
          ]
        },
        { key: "decided_on", label: "Decided on", type: "date" },
        { key: "rationale", label: "Rationale", type: "text" }
      ]
    },
    defaultSize: { width: 270, height: 190 },
    defaultVisualStyle: { accentColor: "#039855", fillColor: "#ECFDF3", borderColor: "#ABEFC6", iconKey: "decision" },
    ports: KNOWLEDGE_PORTS
  }
];

const typedKnowledgeGraphBlueprint: V2BoardBlueprint = {
  key: "typed_knowledge_graph_v1",
  version: 1,
  viewport: { x: 180, y: 160, zoom: 0.76 },
  cardTypes: knowledgeCardTypes,
  connectionTypes: [
    {
      key: "knowledge_supports_v1",
      name: "Supports",
      description: "The source provides evidence for the target.",
      schema: {
        fields: [
          {
            key: "strength",
            label: "Strength",
            type: "select",
            defaultValue: "moderate",
            options: [
              { value: "weak", label: "Weak" },
              { value: "moderate", label: "Moderate" },
              { value: "strong", label: "Strong" }
            ]
          },
          { key: "note", label: "Note", type: "text" }
        ],
        semantics: { version: 1, kind: "related", sourceRole: "evidence", targetRole: "supported" }
      },
      defaultVisualStyle: { strokeColor: "#039855", markerEnd: "arrow", showLabel: true }
    },
    {
      key: "knowledge_contradicts_v1",
      name: "Contradicts",
      description: "The source challenges or conflicts with the target.",
      schema: {
        fields: [{ key: "reason", label: "Reason", type: "text" }],
        semantics: { version: 1, kind: "custom", sourceRole: "challenge", targetRole: "challenged" }
      },
      defaultVisualStyle: { strokeColor: "#D92D20", markerEnd: "arrow", showLabel: true }
    },
    {
      key: "knowledge_depends_on_v1",
      name: "Depends on",
      description: "The source needs the target to be resolved or accepted first.",
      schema: {
        fields: [
          {
            key: "dependency_type",
            label: "Dependency type",
            type: "select",
            options: [
              { value: "evidence", label: "Evidence" },
              { value: "answer", label: "Answer" },
              { value: "decision", label: "Decision" }
            ]
          }
        ],
        semantics: { version: 1, kind: "needs", sourceRole: "dependent", targetRole: "dependency" }
      },
      defaultVisualStyle: { strokeColor: "#F79009", markerEnd: "arrow", showLabel: true }
    },
    {
      key: "knowledge_follows_v1",
      name: "Follows",
      description: "The source is the next conclusion, question, or decision after the target.",
      schema: {
        fields: [{ key: "sequence_note", label: "Sequence note", type: "text" }],
        semantics: { version: 1, kind: "custom", sourceRole: "later", targetRole: "earlier" }
      },
      defaultVisualStyle: { strokeColor: "#1570EF", markerEnd: "arrow", showLabel: true }
    }
  ],
  cards: [
    {
      localKey: "interview_source",
      cardTypeKey: "knowledge_source_v1",
      title: "Customer interviews",
      description: "Three structured interviews with architects and consultants.",
      data: { author: "Research team", published_on: "2026-07-01", credibility: "high" },
      position: { x: 0, y: 40 },
      status: "active"
    },
    {
      localKey: "structured_claim",
      cardTypeKey: "knowledge_claim_v1",
      title: "Structured cards reduce rework",
      description: "Reusable fields make assumptions and ownership easier to review.",
      data: { confidence: "high", evidence_note: "Repeated across interviews" },
      position: { x: 360, y: 0 },
      status: "active"
    },
    {
      localKey: "freeform_claim",
      cardTypeKey: "knowledge_claim_v1",
      title: "Free-form canvases are sufficient",
      description: "A competing claim to test against metadata-heavy work.",
      data: { confidence: "low", evidence_note: "Breaks down during handoff" },
      position: { x: 360, y: 250 },
      status: "active"
    },
    {
      localKey: "mandatory_fields_question",
      cardTypeKey: "knowledge_question_v1",
      title: "Which fields are mandatory?",
      description: "Identify the smallest schema that still supports real review.",
      data: { priority: "high", status: "investigating" },
      position: { x: 720, y: 40 },
      status: "active"
    },
    {
      localKey: "pilot_decision",
      cardTypeKey: "knowledge_decision_v1",
      title: "Pilot the Process Map blueprint",
      description: "Validate the structured workflow with design partners before broadening scope.",
      data: {
        owner: "Product owner",
        status: "accepted",
        decided_on: "2026-07-01",
        rationale: "Highest repeated activation need"
      },
      position: { x: 1080, y: 40 },
      status: "active"
    }
  ],
  connections: [
    {
      connectionTypeKey: "knowledge_supports_v1",
      sourceCardKey: "interview_source",
      targetCardKey: "structured_claim",
      sourcePortKey: "supports",
      targetPortKey: "supported_by",
      type: "evidence",
      label: "Supports",
      title: "Interview evidence",
      description: "Interview observations support the structured-card claim.",
      data: { strength: "strong", note: "Repeated pain around handoff and consistency" },
      status: "active"
    },
    {
      connectionTypeKey: "knowledge_contradicts_v1",
      sourceCardKey: "interview_source",
      targetCardKey: "freeform_claim",
      sourcePortKey: "contradicts",
      targetPortKey: "contradicted_by",
      type: "evidence",
      label: "Contradicts",
      title: "Handoff evidence",
      description: "Metadata-heavy handoff conflicts with the free-form-only claim.",
      data: { reason: "Reviewers need consistent fields and relationship meaning" },
      status: "active"
    },
    {
      connectionTypeKey: "knowledge_depends_on_v1",
      sourceCardKey: "mandatory_fields_question",
      targetCardKey: "structured_claim",
      sourcePortKey: "depends_on",
      targetPortKey: "dependency",
      type: "dependency",
      label: "Depends on",
      title: "Question depends on claim",
      description: "The field question matters if structured cards create value.",
      data: { dependency_type: "evidence" },
      status: "active"
    },
    {
      connectionTypeKey: "knowledge_follows_v1",
      sourceCardKey: "pilot_decision",
      targetCardKey: "mandatory_fields_question",
      sourcePortKey: "follows",
      targetPortKey: "previous",
      type: "sequence",
      label: "Follows",
      title: "Decision follows question",
      description: "The pilot turns the open schema question into observable evidence.",
      data: { sequence_note: "Test the minimum useful schema" },
      status: "active"
    },
    {
      connectionTypeKey: "knowledge_supports_v1",
      sourceCardKey: "structured_claim",
      targetCardKey: "pilot_decision",
      sourcePortKey: "supports",
      targetPortKey: "supported_by",
      type: "rationale",
      label: "Supports",
      title: "Claim supports pilot",
      description: "The structured-card claim motivates the chosen pilot.",
      data: { strength: "moderate", note: "Needs design-partner validation" },
      status: "active"
    }
  ]
};

const V2_BOARD_BLUEPRINTS: Record<V2BoardBlueprintKey, V2BoardBlueprint> = {
  process_map_v1: processMapBlueprint,
  typed_knowledge_graph_v1: typedKnowledgeGraphBlueprint
};

export function getV2BoardBlueprint(key: V2BoardBlueprintKey): V2BoardBlueprint {
  return V2_BOARD_BLUEPRINTS[key];
}
