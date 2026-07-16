"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Settings2, Waypoints } from "lucide-react";
import type { V2ConnectionType } from "@yadraw/shared";
import { V2ConnectorStylePreview } from "./v2-connector-style-preview";

type Props = {
  connectionTypes: V2ConnectionType[];
  activeConnectionType: V2ConnectionType | null;
  onSelect: (connectionTypeId: string) => void;
  onManage: () => void;
};

export function V2ConnectionTypeToolbar({
  connectionTypes,
  activeConnectionType,
  onSelect,
  onManage,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="v2ConnectionTypeToolbar nodrag nopan">
      <button
        type="button"
        className="v2CreateToolbarButton v2ConnectionTypeTrigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Connector type: ${activeConnectionType?.name ?? "Connector"}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Waypoints size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>Connector</span>
        <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="v2ConnectionTypePopover" role="menu">
          <div className="v2ConnectionTypeList">
            {connectionTypes.map((connectionType) => {
              const isActive = connectionType.id === activeConnectionType?.id;
              return (
                <button
                  key={connectionType.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={isActive ? "v2ConnectionTypeOption v2ConnectionTypeOptionActive" : "v2ConnectionTypeOption"}
                  onClick={() => {
                    onSelect(connectionType.id);
                    setIsOpen(false);
                  }}
                >
                  <V2ConnectorStylePreview style={connectionType.defaultVisualStyle} label={connectionType.name} />
                  <span>{connectionType.name}</span>
                  {isActive ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="v2ConnectionTypeManage"
            onClick={() => {
              setIsOpen(false);
              onManage();
            }}
          >
            <Settings2 size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Manage connector types</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
