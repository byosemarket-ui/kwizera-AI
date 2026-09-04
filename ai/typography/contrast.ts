/**
 * STEP 4 — text color + contrast strategy against the REAL placement region.
 * Replaces blind "always white" selection; keeps ContrastStrategy for drawtext.
 */
import type { ContrastStrategy, HierarchyLevel, TextRole } from "./types.js";
import {
  contrastRatio,
  regionFromHints,
  textColorLuminance,
  type RegionAnalysis,
} from "./region-analysis.js";

export interface TextAppearanceDecision {
  color: string;
  contrastStrategy: ContrastStrategy;
  /** Panel fill when strategy is panel. */
  panelColor: "black" | "white";
  contrastRatio: number;
  readabilityPassed: boolean;
  attempts: string[];
  reason: string;
}

const MIN_RATIO_NORMAL = 3.2;
const MIN_RATIO_IMPORTANT = 4.0;

function minRatioFor(role: TextRole, hierarchyLevel: HierarchyLevel): number {
  if (role === "cta" || role === "price" || role === "discount" || hierarchyLevel === "PRIMARY" || hierarchyLevel === "CRITICAL_ACTION") {
    return MIN_RATIO_IMPORTANT;
  }
  return MIN_RATIO_NORMAL;
}

function effectiveBgLuminance(region: RegionAnalysis, strategy: ContrastStrategy, panelColor: "black" | "white"): number {
  if (strategy === "panel") return panelColor === "black" ? 0.05 : 0.95;
  // Outline/shadow improve effective contrast modestly against busy backgrounds.
  if (strategy === "outline" || strategy === "shadow") {
    return region.meanLuminance01 > 0.5
      ? Math.min(0.92, region.meanLuminance01 + 0.08)
      : Math.max(0.08, region.meanLuminance01 - 0.08);
  }
  return region.meanLuminance01;
}

function scoreCandidate(
  color: string,
  strategy: ContrastStrategy,
  panelColor: "black" | "white",
  region: RegionAnalysis,
  minRatio: number,
): { ratio: number; ok: boolean } {
  const bg = effectiveBgLuminance(region, strategy, panelColor);
  const fg = textColorLuminance(color);
  const ratio = contrastRatio(fg, bg);
  return { ratio, ok: ratio >= minRatio };
}

function accentForRole(input: {
  role: TextRole;
  brandColors?: string[];
  category?: string;
  tone?: string;
}): string | undefined {
  const brand = (input.brandColors ?? []).find((c) => /^#?[0-9a-f]{6}$/i.test(c.trim()));
  if (input.role === "discount" || input.role === "price") {
    if (brand) {
      const normalized = brand.startsWith("#") ? brand : `#${brand}`;
      return normalized;
    }
    return "#FFD966";
  }
  if (input.role === "cta" && brand) {
    return brand.startsWith("#") ? brand : `#${brand}`;
  }
  if (/luxury|premium|fashion/i.test(`${input.category ?? ""} ${input.tone ?? ""}`) && brand) {
    return brand.startsWith("#") ? brand : `#${brand}`;
  }
  return undefined;
}

function baseCandidates(region: RegionAnalysis, accent?: string): string[] {
  const darkBg = region.meanLuminance01 < 0.45;
  const lightBg = region.meanLuminance01 > 0.62;
  const list: string[] = [];
  if (darkBg) {
    list.push("white", "near-white", "#F5F5F5");
    if (accent) list.push(accent);
    list.push("black");
  } else if (lightBg) {
    list.push("black", "near-black", "#141414");
    if (accent) list.push(accent);
    list.push("white");
  } else {
    list.push("white", "black", "near-white", "near-black");
    if (accent) list.push(accent);
  }
  return [...new Set(list)];
}

/**
 * Select readable text color + least-intrusive treatment for the placement region.
 */
export function resolveTextAppearance(input: {
  region: RegionAnalysis;
  role: TextRole;
  hierarchyLevel: HierarchyLevel;
  brandColors?: string[];
  category?: string;
  tone?: string;
}): TextAppearanceDecision {
  const minRatio = minRatioFor(input.role, input.hierarchyLevel);
  const accent = accentForRole(input);
  const colors = baseCandidates(input.region, accent);
  const strategies: ContrastStrategy[] = input.region.complexity === "high"
    ? ["outline", "shadow", "panel", "none"]
    : ["none", "outline", "shadow", "panel"];
  const attempts: string[] = [];

  let best: TextAppearanceDecision | null = null;

  for (const strategy of strategies) {
    for (const color of colors) {
      const panelColor: "black" | "white" = textColorLuminance(color) > 0.5 ? "black" : "white";
      const scored = scoreCandidate(color, strategy, panelColor, input.region, minRatio);
      attempts.push(`${color}/${strategy}=${scored.ratio.toFixed(2)}`);
      const candidate: TextAppearanceDecision = {
        color,
        contrastStrategy: strategy,
        panelColor,
        contrastRatio: Number(scored.ratio.toFixed(2)),
        readabilityPassed: scored.ok,
        attempts,
        reason: scored.ok
          ? `Accepted ${color} with ${strategy} (ratio ${scored.ratio.toFixed(2)})`
          : `Rejected ${color}/${strategy}`,
      };
      if (scored.ok) {
        // Prefer no panel when possible; first ok in strategy order wins.
        return candidate;
      }
      if (!best || candidate.contrastRatio > best.contrastRatio) best = candidate;
    }
  }

  // Approved fallback: force panel + opposite luminance text.
  const fallbackColor = input.region.meanLuminance01 > 0.5 ? "black" : "white";
  const panelColor: "black" | "white" = fallbackColor === "white" ? "black" : "white";
  const scored = scoreCandidate(fallbackColor, "panel", panelColor, input.region, minRatio);
  return {
    color: fallbackColor,
    contrastStrategy: "panel",
    panelColor,
    contrastRatio: Number(scored.ratio.toFixed(2)),
    readabilityPassed: scored.ok || scored.ratio >= 2.5,
    attempts,
    reason: "Fallback panel treatment for guaranteed readability",
  };
}

/** Backward-compatible wrapper used by older call sites / tests. */
export function contrastForBackground(input: {
  meanLuminance?: number;
  backgroundType?: string;
  complexity?: string;
  role?: TextRole;
  hierarchyLevel?: HierarchyLevel;
  brandColors?: string[];
  category?: string;
  tone?: string;
  region?: RegionAnalysis;
}): { color: string; contrastStrategy: ContrastStrategy; panelColor?: "black" | "white"; contrastRatio?: number; readabilityPassed?: boolean } {
  const region = input.region ?? regionFromHints(input);
  const decision = resolveTextAppearance({
    region,
    role: input.role ?? "supporting",
    hierarchyLevel: input.hierarchyLevel ?? "SUPPORTING",
    brandColors: input.brandColors,
    category: input.category,
    tone: input.tone,
  });
  return {
    color: decision.color,
    contrastStrategy: decision.contrastStrategy,
    panelColor: decision.panelColor,
    contrastRatio: decision.contrastRatio,
    readabilityPassed: decision.readabilityPassed,
  };
}
