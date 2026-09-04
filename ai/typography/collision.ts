/**
 * STEP 4 — light collision / spacing checks between text bounding areas.
 */
import type { TextBoundingArea, TypographyItem } from "./types.js";

function overlapRatio(a: TextBoundingArea, b: TextBoundingArea): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter <= 0) return 0;
  const smaller = Math.min(a.width * a.height, b.width * b.height) || 1;
  return inter / smaller;
}

/**
 * Nudge lower-importance items downward when they heavily overlap stronger ones.
 * Does not invent new scenes — only adjusts Y within safe bounds.
 */
export function resolveTextCollisions(items: TypographyItem[]): {
  items: TypographyItem[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const sorted = [...items].sort((a, b) => a.hierarchy - b.hierarchy || b.importanceScore - a.importanceScore);
  const placed: TypographyItem[] = [];

  for (const item of sorted) {
    let next = item;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const hit = placed.find((other) => overlapRatio(next.boundingArea, other.boundingArea) > 0.35);
      if (!hit) break;
      const shift = 0.06 + attempt * 0.04;
      const ny = Math.min(0.9, next.layout.normalizedY + shift);
      const by = Math.min(0.88, next.boundingArea.y + shift);
      next = {
        ...next,
        layout: { ...next.layout, normalizedY: ny },
        boundingArea: { ...next.boundingArea, y: by },
      };
      warnings.push(`Collision nudge for ${item.role} away from ${hit.role}`);
    }
    placed.push(next);
  }

  // Restore original relative order by id sequence in input.
  const byId = new Map(placed.map((item) => [item.id, item]));
  return {
    items: items.map((item) => byId.get(item.id) ?? item),
    warnings,
  };
}

export function areasCollide(a: TextBoundingArea, b: TextBoundingArea, threshold = 0.35): boolean {
  return overlapRatio(a, b) > threshold;
}
