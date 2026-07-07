import type { V2CardType } from "@yadraw/shared";

export type YadrawTheme = {
  key: string;
  name: string;
  mode: "light" | "dark";
  surface: {
    app: string;
    board: string;
    card: string;
    cardHeader: string;
    panel: string;
    input: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    selected: string;
  };
  accent: Record<
    string,
    {
      soft: string;
      surface: string;
      solid: string;
      text: string;
      border: string;
    }
  >;
  graph: {
    connector: string;
    connectorSelected: string;
    portInput: string;
    portOutput: string;
    portReceiver: string;
    slotLabel: string;
  };
  card: {
    radius: string;
    shadow: string;
    selectedOutline: string;
  };
  panel: {
    shadow: string;
    backdrop: string;
  };
  form: {
    inputBackground: string;
    inputBorder: string;
    focusRing: string;
  };
};

const lightAccent = {
  blue: {
    soft: "#eef6ff",
    surface: "#dcecff",
    solid: "#2f80ed",
    text: "#1553a8",
    border: "#a9cdf8",
  },
  green: {
    soft: "#edf9f1",
    surface: "#dff3e7",
    solid: "#2ead63",
    text: "#17663a",
    border: "#a6ddb9",
  },
  orange: {
    soft: "#fff7ed",
    surface: "#ffedd5",
    solid: "#f2a128",
    text: "#9a5b00",
    border: "#fed7aa",
  },
  red: {
    soft: "#fef2f2",
    surface: "#fee2e2",
    solid: "#ef4444",
    text: "#991b1b",
    border: "#fecaca",
  },
  purple: {
    soft: "#f3efff",
    surface: "#e9ddff",
    solid: "#7147e8",
    text: "#4c2bb4",
    border: "#c5b4fb",
  },
  gray: {
    soft: "#f8fafc",
    surface: "#f1f5f9",
    solid: "#64748b",
    text: "#334155",
    border: "#cbd5e1",
  },
} satisfies YadrawTheme["accent"];

export const lightYadrawTheme: YadrawTheme = {
  key: "light",
  name: "Light",
  mode: "light",
  surface: {
    app: "#f7f8fb",
    board: "#f7f8fb",
    card: "#ffffff",
    cardHeader: "#f8fbff",
    panel: "#ffffff",
    input: "#ffffff",
  },
  text: {
    primary: "#101828",
    secondary: "#475467",
    muted: "#667085",
    inverse: "#ffffff",
  },
  border: {
    subtle: "#e8edf5",
    default: "#dde3ee",
    strong: "#c9d2e3",
    selected: "#0f172a",
  },
  accent: lightAccent,
  graph: {
    connector: "#c9d2e3",
    connectorSelected: "#2f80ed",
    portInput: "#98a2b3",
    portOutput: "#2f80ed",
    portReceiver: "#7147e8",
    slotLabel: "#667085",
  },
  card: {
    radius: "9px",
    shadow: "0 12px 28px rgba(23, 100, 220, 0.16)",
    selectedOutline: "0 0 0 3px rgba(15, 23, 42, 0.2)",
  },
  panel: {
    shadow: "0 16px 50px rgba(28, 39, 63, 0.12)",
    backdrop: "rgba(15, 23, 42, 0.34)",
  },
  form: {
    inputBackground: "#ffffff",
    inputBorder: "#d9e0ec",
    focusRing: "rgba(47, 128, 237, 0.18)",
  },
};

export const draftYadrawThemes: YadrawTheme[] = [
  {
    ...lightYadrawTheme,
    key: "darkDraft",
    name: "Dark draft",
    mode: "dark",
    surface: {
      app: "#0f172a",
      board: "#111827",
      card: "#182230",
      cardHeader: "#1f2937",
      panel: "#182230",
      input: "#111827",
    },
    text: {
      primary: "#f8fafc",
      secondary: "#cbd5e1",
      muted: "#94a3b8",
      inverse: "#0f172a",
    },
    border: {
      subtle: "#263244",
      default: "#334155",
      strong: "#475569",
      selected: "#e2e8f0",
    },
  },
  {
    ...lightYadrawTheme,
    key: "pastelDraft",
    name: "Pastel draft",
    mode: "light",
    surface: {
      ...lightYadrawTheme.surface,
      board: "#fbf7ff",
      cardHeader: "#f7f0ff",
    },
  },
  {
    ...lightYadrawTheme,
    key: "acidDraft",
    name: "Acid draft",
    mode: "light",
    surface: {
      ...lightYadrawTheme.surface,
      board: "#fbfff0",
      cardHeader: "#f1ffe1",
    },
  },
];

export function createYadrawThemeVariables(theme: YadrawTheme): Record<string, string> {
  const variables: Record<string, string> = {
    "--yd-surface-app": theme.surface.app,
    "--yd-surface-board": theme.surface.board,
    "--yd-surface-card": theme.surface.card,
    "--yd-surface-card-header": theme.surface.cardHeader,
    "--yd-surface-panel": theme.surface.panel,
    "--yd-surface-input": theme.surface.input,
    "--yd-text-primary": theme.text.primary,
    "--yd-text-secondary": theme.text.secondary,
    "--yd-text-muted": theme.text.muted,
    "--yd-text-inverse": theme.text.inverse,
    "--yd-border-subtle": theme.border.subtle,
    "--yd-border-default": theme.border.default,
    "--yd-border-strong": theme.border.strong,
    "--yd-border-selected": theme.border.selected,
    "--yd-card-radius": theme.card.radius,
    "--yd-card-shadow": theme.card.shadow,
    "--yd-card-selected-outline": theme.card.selectedOutline,
    "--yd-panel-shadow": theme.panel.shadow,
    "--yd-panel-backdrop": theme.panel.backdrop,
    "--yd-form-input-background": theme.form.inputBackground,
    "--yd-form-input-border": theme.form.inputBorder,
    "--yd-form-focus-ring": theme.form.focusRing,
    "--yd-form-bg": theme.form.inputBackground,
    "--yd-form-border": theme.form.inputBorder,
    "--yd-form-focus": theme.graph.connectorSelected,
    "--yd-form-text": theme.text.primary,
    "--yd-form-placeholder": theme.text.muted,
    "--yd-graph-connector": theme.graph.connector,
    "--yd-graph-connector-selected": theme.graph.connectorSelected,
    "--yd-graph-port-input": theme.graph.portInput,
    "--yd-graph-port-output": theme.graph.portOutput,
    "--yd-graph-port-receiver": theme.graph.portReceiver,
    "--yd-graph-slot-label": theme.graph.slotLabel,
  };

  for (const [key, accent] of Object.entries(theme.accent)) {
    variables[`--yd-accent-${key}-soft`] = accent.soft;
    variables[`--yd-accent-${key}-surface`] = accent.surface;
    variables[`--yd-accent-${key}-solid`] = accent.solid;
    variables[`--yd-accent-${key}-text`] = accent.text;
    variables[`--yd-accent-${key}-border`] = accent.border;
  }

  return variables;
}

export const YADRAW_REQUIRED_ACCENTS = ["blue", "green", "orange", "red", "purple", "gray"] as const;

const builtInTypeAccentKey: Record<string, string> = {
  source: "green",
  task: "blue",
  trigger: "green",
  ai_action: "blue",
  database: "purple",
  vector_store: "green",
  storage: "purple",
  note: "blue",
};

const colorToAccentKey: Record<string, string> = {
  "#2383ff": "blue",
  "#2f80ed": "blue",
  "#2ead63": "green",
  "#f2a128": "orange",
  "#ef4444": "red",
  "#7147e8": "purple",
  "#64748b": "gray",
};

function normalizeColor(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.startsWith("#") ? normalized : null;
}

export function resolveCardTypeAccentKey(cardType: V2CardType | null | undefined): string {
  const style = cardType?.defaultVisualStyle;
  if (style?.accentKey) return style.accentKey;

  const compatibleColor = normalizeColor(style?.accentColor) ?? normalizeColor(style?.fillColor);
  const compatibleAccentKey = compatibleColor ? colorToAccentKey[compatibleColor] : undefined;
  if (compatibleAccentKey) {
    return compatibleAccentKey;
  }

  const builtInAccentKey = cardType?.key ? builtInTypeAccentKey[cardType.key] : undefined;
  if (builtInAccentKey) {
    return builtInAccentKey;
  }

  return "blue";
}
