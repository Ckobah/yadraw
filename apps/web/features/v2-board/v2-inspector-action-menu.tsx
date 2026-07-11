"use client";

import { Copy, MoreHorizontal, Settings2, Trash2 } from "lucide-react";

type Props = {
  disabled?: boolean;
  onManage?: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
};

export function V2InspectorActionMenu({ disabled, onManage, onDuplicate, onDelete }: Props) {
  return (
    <details className="v2InspectorActionMenu">
      <summary aria-label="More actions" title="More actions">
        <MoreHorizontal size={17} strokeWidth={2.1} />
      </summary>
      <div role="menu">
        {onManage ? <button type="button" role="menuitem" onClick={onManage}><Settings2 size={15} /> Type</button> : null}
        {onDuplicate ? <button type="button" role="menuitem" disabled={disabled} onClick={onDuplicate}><Copy size={15} /> Duplicate</button> : null}
        <button type="button" role="menuitem" className="danger" disabled={disabled} onClick={onDelete}><Trash2 size={15} /> Delete</button>
      </div>
    </details>
  );
}
