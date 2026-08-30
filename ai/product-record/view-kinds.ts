import type { ProductViewRole } from "../product-intelligence/types.js";
import { detectViewRoleDetailed } from "../product-intelligence/view-role.js";

/** Canonical product view kinds — stored in Product Intelligence and the Asset Map. */
export const CANONICAL_VIEWS = [
  "front",
  "back",
  "left",
  "right",
  "front_left",
  "front_right",
  "back_left",
  "back_right",
  "top",
  "bottom",
  "detail",
  "close-up",
  "material_detail",
  "packaging",
  "other",
  "unknown",
] as const;

export type CanonicalViewKind = (typeof CANONICAL_VIEWS)[number];

export const VIEW_LABELS: Record<CanonicalViewKind, string> = {
  front: "FRONT",
  back: "BACK",
  left: "LEFT SIDE",
  right: "RIGHT SIDE",
  front_left: "FRONT LEFT",
  front_right: "FRONT RIGHT",
  back_left: "BACK LEFT",
  back_right: "BACK RIGHT",
  top: "TOP",
  bottom: "BOTTOM",
  detail: "DETAIL",
  "close-up": "CLOSE-UP",
  material_detail: "MATERIAL DETAIL",
  packaging: "PACKAGING",
  other: "OTHER",
  unknown: "UNKNOWN",
};

const ALIASES: Record<string, CanonicalViewKind> = {
  front: "front",
  back: "back",
  left: "left",
  right: "right",
  left_side: "left",
  right_side: "right",
  "left side": "left",
  "right side": "right",
  front_left: "front_left",
  front_right: "front_right",
  back_left: "back_left",
  back_right: "back_right",
  "front left": "front_left",
  "front right": "front_right",
  "back left": "back_left",
  "back right": "back_right",
  top: "top",
  bottom: "bottom",
  detail: "detail",
  "close-up": "close-up",
  close_up: "close-up",
  closeup: "close-up",
  material_detail: "material_detail",
  "material detail": "material_detail",
  sole: "material_detail",
  packaging: "packaging",
  logo: "other",
  "angle-45": "front_left",
  side: "other",
  lifestyle: "other",
  other: "other",
  unknown: "unknown",
  FRONT: "front",
  BACK: "back",
  LEFT: "left",
  RIGHT: "right",
  LEFT_SIDE: "left",
  RIGHT_SIDE: "right",
  FRONT_LEFT: "front_left",
  FRONT_RIGHT: "front_right",
  BACK_LEFT: "back_left",
  BACK_RIGHT: "back_right",
  TOP: "top",
  BOTTOM: "bottom",
  DETAIL: "detail",
  CLOSE_UP: "close-up",
  "45_DEGREE": "front_left",
  MATERIAL_DETAIL: "material_detail",
  PACKAGING: "packaging",
  LOGO: "other",
  OTHER: "other",
  UNKNOWN: "unknown",
};

const LOW_CONFIDENCE = 0.55;

export function isCanonicalView(value: string): value is CanonicalViewKind {
  return (CANONICAL_VIEWS as readonly string[]).includes(value);
}

export function normalizeViewKind(value: string | null | undefined): CanonicalViewKind {
  if (!value) return "unknown";
  const trimmed = value.trim();
  const aliased = ALIASES[trimmed] ?? ALIASES[trimmed.toLowerCase().replace(/\s+/g, "_")];
  return aliased ?? "unknown";
}

export function toProductViewRole(view: CanonicalViewKind): ProductViewRole {
  if (view === "front_left" || view === "front_right") return "angle-45";
  if (view === "back_left" || view === "back_right") return view === "back_left" ? "left" : "right";
  if (view === "material_detail") return "detail";
  if (view === "other") return "side";
  return view as ProductViewRole;
}

export function fromProductViewRole(role: string): CanonicalViewKind {
  return normalizeViewKind(role);
}

export function detectCanonicalView(fileName: string): { view: CanonicalViewKind; confidence: number } {
  const lower = fileName.toLowerCase();
  const compound: Array<{ view: CanonicalViewKind; pattern: RegExp; confidence: number }> = [
    { view: "front_left", pattern: /front[-_ ]?left|left[-_ ]?front/, confidence: 0.94 },
    { view: "front_right", pattern: /front[-_ ]?right|right[-_ ]?front/, confidence: 0.94 },
    { view: "back_left", pattern: /back[-_ ]?left|left[-_ ]?back|rear[-_ ]?left/, confidence: 0.93 },
    { view: "back_right", pattern: /back[-_ ]?right|right[-_ ]?back|rear[-_ ]?right/, confidence: 0.93 },
    { view: "material_detail", pattern: /material[-_ ]?detail|texture[-_ ]?detail|sole[-_ ]?detail|stitch|grain/, confidence: 0.88 },
  ];
  for (const rule of compound) {
    if (rule.pattern.test(lower)) return { view: rule.view, confidence: rule.confidence };
  }
  const detected = detectViewRoleDetailed(fileName);
  const view = fromProductViewRole(detected.role);
  if (detected.confidence < LOW_CONFIDENCE) {
    return { view: "unknown", confidence: detected.confidence };
  }
  return { view, confidence: detected.confidence };
}

export function emptyAssetMap(): Record<CanonicalViewKind, string[]> {
  return Object.fromEntries(CANONICAL_VIEWS.map((view) => [view, [] as string[]])) as Record<CanonicalViewKind, string[]>;
}
