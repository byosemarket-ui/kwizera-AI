import type { OrganizationViewType } from "../image-organization/types";
import { LOW_CONFIDENCE } from "../image-organization/types";

/** User-facing view labels for classification UI. */
export const VIEW_PICKER_OPTIONS: Array<{ value: OrganizationViewType; label: string }> = [
  { value: "FRONT", label: "Front" },
  { value: "BACK", label: "Back" },
  { value: "LEFT", label: "Left" },
  { value: "RIGHT", label: "Right" },
  { value: "OTHER", label: "Side" },
  { value: "TOP", label: "Top" },
  { value: "BOTTOM", label: "Bottom / Sole" },
  { value: "DETAIL", label: "Detail" },
  { value: "CLOSE_UP", label: "Close-up" },
  { value: "PACKAGING", label: "Packaging" },
  { value: "UNKNOWN", label: "Unknown" },
];

export function viewDisplayLabel(view: OrganizationViewType): string {
  const map: Partial<Record<OrganizationViewType, string>> = {
    FRONT: "Front",
    BACK: "Back",
    LEFT: "Left",
    RIGHT: "Right",
    FRONT_LEFT: "Front Left",
    FRONT_RIGHT: "Front Right",
    BACK_LEFT: "Back Left",
    BACK_RIGHT: "Back Right",
    TOP: "Top",
    BOTTOM: "Sole",
    DETAIL: "Detail",
    CLOSE_UP: "Detail",
    MATERIAL_DETAIL: "Detail",
    PACKAGING: "Packaging",
    LOGO: "Logo",
    OTHER: "Side",
    UNKNOWN: "Unknown",
  };
  return map[view] ?? view.replace(/_/g, " ");
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= LOW_CONFIDENCE) return "High confidence";
  if (confidence >= 0.5) return "Medium confidence";
  return "Needs review";
}

export function parseUserViewPick(value: string): OrganizationViewType {
  const upper = value.toUpperCase().replace(/\s+/g, "_") as OrganizationViewType;
  const allowed: OrganizationViewType[] = [
    "FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM", "DETAIL", "CLOSE_UP",
    "PACKAGING", "OTHER", "UNKNOWN", "FRONT_LEFT", "FRONT_RIGHT", "BACK_LEFT", "BACK_RIGHT",
  ];
  if (allowed.includes(upper)) return upper;
  if (value === "SIDE") return "OTHER";
  if (value === "SOLE") return "BOTTOM";
  return "UNKNOWN";
}
