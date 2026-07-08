import { MoreHorizontal } from "lucide-react";
import { getV2CardTypeIconByKey } from "./v2-card-type-icons";
import type { V2CardTypeSchemaFieldDraft } from "./v2-card-type-schema-editor";

type V2CardTypePreviewProps = {
  typeKey: string;
  name: string;
  description: string;
  accentKey: string;
  iconKey: string;
  fields: V2CardTypeSchemaFieldDraft[];
  hasInputPort: boolean;
  hasOutputPort: boolean;
};

function getPreviewRows(fields: V2CardTypeSchemaFieldDraft[]): Array<{ key: string; label: string; value: string }> {
  return fields.slice(0, 2).map((field) => ({
    key: field.id,
    label: field.label.trim() || field.key.trim() || "Field",
    value: field.type,
  }));
}

export function V2CardTypePreview({
  typeKey,
  name,
  description,
  accentKey,
  iconKey,
  fields,
  hasInputPort,
  hasOutputPort,
}: V2CardTypePreviewProps) {
  const Icon = getV2CardTypeIconByKey(iconKey);
  const typeLabel = name.trim() || typeKey.trim() || "New type";
  const title = name.trim() || "Example card";
  const summary = description.trim() || "Card preview for this type.";
  const rows = getPreviewRows(fields);

  return (
    <section
      className="v2CardTypePreviewPanel"
      style={{ ["--v2-preview-accent" as string]: `var(--yd-accent-${accentKey}-solid)` }}
    >
      <div className="v2CardTypePreviewCard">
        {hasInputPort ? <span className="v2CardTypePreviewPort v2CardTypePreviewPortInput" /> : null}
        {hasOutputPort ? <span className="v2CardTypePreviewPort v2CardTypePreviewPortOutput" /> : null}
        <div className="v2CardTypePreviewCardHeader">
          <span className="v2CardTypePreviewIcon" aria-hidden="true">
            <Icon size={16} strokeWidth={2.1} />
          </span>
          <span className="v2CardTypePreviewTypeLabel">{typeLabel}</span>
          <MoreHorizontal size={17} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="v2CardTypePreviewCardBody">
          <strong>{title}</strong>
          <span>{summary}</span>
          {rows.length > 0 ? (
            <dl className="v2CardTypePreviewDataRows">
              {rows.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
