import type { ProductViewRole } from "./types.js";

export type DetectedViewRole = ProductViewRole;

export interface ViewRoleDetection {
  role: ProductViewRole;
  confidence: number;
  matchedPattern?: string;
}

/**
 * Infer a product view role from an uploaded image file name.
 * Analysis only — never reads or modifies image bytes.
 */
export function detectViewRole(fileName: string): ProductViewRole {
  return detectViewRoleDetailed(fileName).role;
}

/** Same heuristic with an explicit confidence score for Step 2 organization UI. */
export function detectViewRoleDetailed(fileName: string): ViewRoleDetection {
  const lower = fileName.toLowerCase();
  const rules: Array<{ role: ProductViewRole; pattern: RegExp; confidence: number }> = [
    { role: "front", pattern: /(^|[^a-z])front([^a-z]|$)|frontal|face[-_ ]?on|_f\.|view[-_]?front/, confidence: 0.96 },
    { role: "back", pattern: /(^|[^a-z])back([^a-z]|$)|rear|reverse|_b\.|view[-_]?back/, confidence: 0.95 },
    { role: "left", pattern: /(^|[^a-z])left([^a-z]|$)|_l\.|view[-_]?left/, confidence: 0.94 },
    { role: "right", pattern: /(^|[^a-z])right([^a-z]|$)|_r\.|view[-_]?right/, confidence: 0.94 },
    { role: "top", pattern: /(^|[^a-z])top([^a-z]|$)|overhead|bird.?eye|above/, confidence: 0.93 },
    { role: "bottom", pattern: /(^|[^a-z])bottom([^a-z]|$)|underside|sole|base.?view/, confidence: 0.93 },
    { role: "angle-45", pattern: /45|three[-_ ]?quarter|3[-_ ]?4|oblique|diagonal/, confidence: 0.9 },
    { role: "packaging", pattern: /\bpack(aging)?\b|box|carton|retail[-_ ]?pack/, confidence: 0.9 },
    { role: "lifestyle", pattern: /lifestyle|in[-_ ]?use|on[-_ ]?model|editorial|context/, confidence: 0.86 },
    { role: "logo", pattern: /\blogo\b|wordmark|brand[-_ ]?mark/, confidence: 0.92 },
    { role: "close-up", pattern: /close[-_ ]?up|macro/, confidence: 0.9 },
    { role: "detail", pattern: /(^|[^a-z])detail([^a-z]|$)|texture|stitch|zipper|hardware|port|screen/, confidence: 0.88 },
    { role: "side", pattern: /(^|[^a-z])side([^a-z]|$)|profile/, confidence: 0.82 },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(lower)) {
      return { role: rule.role, confidence: rule.confidence, matchedPattern: rule.pattern.source };
    }
  }
  return { role: "unknown", confidence: 0.35 };
}

/** Category-aware recommended views — does not hard-require every angle. */
export function recommendedViewsForCategory(category: string): ProductViewRole[] {
  const c = category.toLowerCase();
  if (/shoe|sneaker|boot|footwear/.test(c)) {
    return ["side", "front", "back", "bottom", "top", "detail"];
  }
  if (/bag|handbag|backpack|tote/.test(c)) {
    return ["front", "back", "side", "detail", "bottom"];
  }
  if (/phone|laptop|tablet|electronic|camera|headphone/.test(c)) {
    return ["front", "back", "side", "detail"];
  }
  if (/apparel|shirt|dress|jacket|clothing/.test(c)) {
    return ["front", "back", "detail"];
  }
  if (/beauty|serum|cream|cosmetic/.test(c)) {
    return ["front", "packaging", "detail"];
  }
  return ["front", "back", "left", "right", "top", "detail"];
}
