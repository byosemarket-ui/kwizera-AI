import type { OrganizationViewType } from "./types";

/** Browser-side mirror of ai/product-intelligence/view-role heuristics (no Node deps). */

export interface LocalViewDetection {
  viewType: OrganizationViewType;
  confidence: number;
  serverRole: string;
}

const RULES: Array<{ viewType: OrganizationViewType; serverRole: string; pattern: RegExp; confidence: number }> = [
  { viewType: "FRONT", serverRole: "front", pattern: /(^|[^a-z])front([^a-z]|$)|frontal|face[-_ ]?on|_f\.|view[-_]?front/, confidence: 0.96 },
  { viewType: "BACK", serverRole: "back", pattern: /(^|[^a-z])back([^a-z]|$)|rear|reverse|_b\.|view[-_]?back/, confidence: 0.95 },
  { viewType: "LEFT", serverRole: "left", pattern: /(^|[^a-z])left([^a-z]|$)|_l\.|view[-_]?left/, confidence: 0.94 },
  { viewType: "RIGHT", serverRole: "right", pattern: /(^|[^a-z])right([^a-z]|$)|_r\.|view[-_]?right/, confidence: 0.94 },
  { viewType: "TOP", serverRole: "top", pattern: /(^|[^a-z])top([^a-z]|$)|overhead|bird.?eye|above/, confidence: 0.93 },
  { viewType: "BOTTOM", serverRole: "bottom", pattern: /(^|[^a-z])bottom([^a-z]|$)|underside|sole|base.?view/, confidence: 0.93 },
  { viewType: "45_DEGREE", serverRole: "angle-45", pattern: /45|three[-_ ]?quarter|3[-_ ]?4|oblique|diagonal/, confidence: 0.9 },
    { viewType: "PACKAGING", serverRole: "packaging", pattern: /\bpack(aging)?\b|box|carton|retail[-_ ]?pack/, confidence: 0.9 },
    { viewType: "OTHER", serverRole: "lifestyle", pattern: /lifestyle|in[-_ ]?use|on[-_ ]?model|editorial|context/, confidence: 0.86 },
  { viewType: "LOGO", serverRole: "logo", pattern: /\blogo\b|wordmark|brand[-_ ]?mark/, confidence: 0.92 },
  { viewType: "DETAIL", serverRole: "detail", pattern: /close[-_ ]?up|macro|(^|[^a-z])detail([^a-z]|$)|texture|stitch|zipper|hardware|port|screen/, confidence: 0.88 },
  { viewType: "OTHER", serverRole: "side", pattern: /(^|[^a-z])side([^a-z]|$)|profile/, confidence: 0.82 },
];

export function classifyFileName(fileName: string): LocalViewDetection {
  const lower = fileName.toLowerCase();
  for (const rule of RULES) {
    if (rule.pattern.test(lower)) {
      return { viewType: rule.viewType, confidence: rule.confidence, serverRole: rule.serverRole };
    }
  }
  return { viewType: "UNKNOWN", confidence: 0.35, serverRole: "unknown" };
}

export function mapServerRoleToView(role: string): OrganizationViewType {
  const map: Record<string, OrganizationViewType> = {
    front: "FRONT",
    back: "BACK",
    left: "LEFT",
    right: "RIGHT",
    top: "TOP",
    bottom: "BOTTOM",
    "angle-45": "45_DEGREE",
    packaging: "PACKAGING",
    lifestyle: "OTHER",
    logo: "LOGO",
    detail: "DETAIL",
    "close-up": "DETAIL",
    side: "OTHER",
    unknown: "UNKNOWN",
  };
  return map[role] ?? "UNKNOWN";
}

export function mapViewToServerRole(view: OrganizationViewType): string {
  const map: Record<OrganizationViewType, string> = {
    FRONT: "front",
    BACK: "back",
    LEFT: "left",
    RIGHT: "right",
    TOP: "top",
    BOTTOM: "bottom",
    "45_DEGREE": "angle-45",
    PACKAGING: "packaging",
    LOGO: "logo",
    DETAIL: "detail",
    OTHER: "side",
    UNKNOWN: "unknown",
  };
  return map[view];
}

export function recommendedViewsForCategory(category: string): OrganizationViewType[] {
  const c = category.toLowerCase();
  if (/shoe|sneaker|boot|footwear/.test(c)) {
    return ["OTHER", "FRONT", "BACK", "BOTTOM", "TOP", "DETAIL"];
  }
  if (/bag|handbag|backpack|tote/.test(c)) {
    return ["FRONT", "BACK", "OTHER", "DETAIL", "BOTTOM"];
  }
  if (/phone|laptop|tablet|electronic|camera|headphone/.test(c)) {
    return ["FRONT", "BACK", "OTHER", "DETAIL"];
  }
  if (/apparel|shirt|dress|jacket|clothing/.test(c)) {
    return ["FRONT", "BACK", "DETAIL"];
  }
  if (/beauty|serum|cream|cosmetic/.test(c)) {
    return ["FRONT", "PACKAGING", "DETAIL"];
  }
  return ["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "DETAIL"];
}

export function classifyBackground(type: string): string {
  const t = type.toLowerCase();
  if (/white|studio.?white|pure.?white/.test(t)) return "White";
  if (/black|dark/.test(t)) return "Black";
  if (/neutral|gray|grey/.test(t)) return "Neutral";
  if (/indoor|interior|room/.test(t)) return "Indoor";
  if (/outdoor|exterior|nature/.test(t)) return "Outdoor";
  if (/complex|busy|clutter/.test(t)) return "Complex";
  if (/transparent|alpha|cutout/.test(t)) return "Transparent";
  return "Unknown";
}
