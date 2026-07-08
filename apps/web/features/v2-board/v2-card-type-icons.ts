import {
  Box,
  Database,
  Factory,
  FileText,
  Package,
  Settings,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import type { V2CardType } from "@yadraw/shared";

export type V2CardTypeIconOption = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export const V2_CARD_TYPE_ICON_OPTIONS: V2CardTypeIconOption[] = [
  { key: "database", label: "Database", icon: Database },
  { key: "task", label: "Task", icon: Box },
  { key: "box", label: "Box", icon: Box },
  { key: "user", label: "User", icon: User },
  { key: "file", label: "File", icon: FileText },
  { key: "gear", label: "Gear", icon: Settings },
  { key: "truck", label: "Truck", icon: Truck },
  { key: "factory", label: "Factory", icon: Factory },
  { key: "material", label: "Material", icon: Package },
];

const iconByKey = new Map<string, LucideIcon>(
  V2_CARD_TYPE_ICON_OPTIONS.flatMap((option) => {
    const entries: Array<[string, LucideIcon]> = [[option.key, option.icon]];
    if (option.key === "database") entries.push(["source", option.icon]);
    if (option.key === "gear") entries.push(["settings", option.icon]);
    return entries;
  })
);

export function getV2CardTypeIconByKey(iconKey: string | null | undefined): LucideIcon {
  return iconByKey.get(iconKey ?? "") ?? Database;
}

export function getV2CardTypeIcon(cardType: V2CardType): LucideIcon {
  return getV2CardTypeIconByKey(cardType.defaultVisualStyle.iconKey ?? cardType.key);
}
