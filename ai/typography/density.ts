/**
 * STEP 3 — text density control. Prefer dropping lowest-importance items
 * over shrinking everything unreadably.
 */
import type { TypographyItem } from "./types.js";

export function controlSceneDensity(items: TypographyItem[], maxItems = 3): {
  items: TypographyItem[];
  trimmed: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const sorted = [...items].sort((a, b) => {
    if (b.importanceScore !== a.importanceScore) return b.importanceScore - a.importanceScore;
    return a.hierarchy - b.hierarchy;
  });
  const totalWords = sorted.reduce((sum, item) => sum + item.text.trim().split(/\s+/).filter(Boolean).length, 0);
  let kept = sorted;
  let trimmed = false;

  if (sorted.length > maxItems) {
    kept = sorted.slice(0, maxItems);
    trimmed = true;
    warnings.push(`Reduced scene text density from ${sorted.length} to ${maxItems} items.`);
  }

  // If still word-heavy, drop MINOR/SUPPORTING first.
  if (totalWords > 28 && kept.length > 2) {
    const critical = kept.filter((item) => item.hierarchyLevel === "PRIMARY" || item.hierarchyLevel === "CRITICAL_ACTION" || item.role === "price");
    const rest = kept.filter((item) => !critical.includes(item));
    kept = [...critical, ...rest].slice(0, Math.max(2, critical.length));
    if (kept.length < sorted.length) {
      trimmed = true;
      warnings.push("Trimmed supporting copy to preserve readable sizes.");
    }
  }

  // Restore stable visual order: primary/action first by hierarchy rank then original importance.
  kept = [...kept].sort((a, b) => a.hierarchy - b.hierarchy || b.importanceScore - a.importanceScore);
  return { items: kept, trimmed, warnings };
}
