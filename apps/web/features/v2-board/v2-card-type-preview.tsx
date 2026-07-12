import { MoreHorizontal, Plus } from "lucide-react";
import { getV2CardTypeIconByKey } from "./v2-card-type-icons";
import type { V2CardTypeSchemaFieldDraft } from "./v2-card-type-schema-editor";

type V2CardTypePreviewProps = {
  name: string;
  accentKey: string;
  iconKey: string;
  fields: V2CardTypeSchemaFieldDraft[];
  hasInputPort: boolean;
  hasOutputPort: boolean;
  onToggleInputPort: () => void;
  onToggleOutputPort: () => void;
  disabled?: boolean;
};

function getPreviewRows(fields: V2CardTypeSchemaFieldDraft[]) {
  return fields.slice(0, 2).map((field) => ({
    key: field.id,
    label: field.label.trim() || "Field",
    value: field.type,
  }));
}

export function V2CardTypePreview({
  name,
  accentKey,
  iconKey,
  fields,
  hasInputPort,
  hasOutputPort,
  onToggleInputPort,
  onToggleOutputPort,
  disabled = false,
}: V2CardTypePreviewProps) {
  const Icon = getV2CardTypeIconByKey(iconKey);
  const rows = getPreviewRows(fields);
  const typeLabel = name.trim() || "New type";

  return (
    <section className="v2CardTypePreviewPanel" aria-label="Card preview">
      <article
        className="v2CardNode v2CardTypePreviewCard"
        style={{
          ["--v2-card-accent" as string]: `var(--yd-accent-${accentKey}-solid)`,
          ["--v2-card-accent-soft" as string]: `var(--yd-accent-${accentKey}-soft)`,
          ["--v2-card-accent-surface" as string]: `var(--yd-accent-${accentKey}-surface)`,
          ["--v2-card-accent-text" as string]: `var(--yd-accent-${accentKey}-text)`,
          ["--v2-card-accent-border" as string]: `var(--yd-accent-${accentKey}-border)`,
        }}
      >
        <PreviewPort
          direction="input"
          active={hasInputPort}
          disabled={disabled}
          onToggle={onToggleInputPort}
        />
        <PreviewPort
          direction="output"
          active={hasOutputPort}
          disabled={disabled}
          onToggle={onToggleOutputPort}
        />
        <div className="v2CardHeader">
          <span className="v2CardTypeIcon" aria-hidden="true">
            <Icon size={17} strokeWidth={2.1} />
          </span>
          <span className="v2CardTypeLabel">{typeLabel}</span>
          <span className="v2CardMenuButton" aria-hidden="true">
            <MoreHorizontal size={18} strokeWidth={2.2} />
          </span>
        </div>
        <div className="v2CardBody">
          <span className="v2CardTitle">Card title</span>
          <span className="v2CardSubtitle">Description</span>
          {rows.length > 0 ? (
            <dl className="v2CardDataPreview">
              {rows.map((row) => (
                <div key={row.key} className="v2CardDataPreviewRow">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function PreviewPort({
  direction,
  active,
  disabled,
  onToggle,
}: {
  direction: "input" | "output";
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const label = `${active ? "Remove" : "Add"} ${direction} port`;
  return (
    <button
      type="button"
      className={`v2CardTypePreviewPort v2CardTypePreviewPort-${direction}${
        active ? " v2CardTypePreviewPort-active" : ""
      }`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
    >
      {!active ? <Plus size={10} strokeWidth={2.6} aria-hidden="true" /> : null}
    </button>
  );
}
