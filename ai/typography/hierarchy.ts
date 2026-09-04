/**
 * STEP 3 — scene-aware text hierarchy / importance classification.
 * Builds on roleHierarchy without replacing font/placement intelligence.
 */
import type { HierarchyLevel, TextRole } from "./types.js";
import { roleHierarchy } from "./font-selection.js";

export interface ImportanceDecision {
  hierarchyLevel: HierarchyLevel;
  /** 1 = strongest (compatible with existing hierarchy rank). */
  hierarchy: number;
  importanceScore: number;
  reason: string;
}

function purposeBlob(purpose?: string): string {
  return (purpose ?? "").toUpperCase();
}

/**
 * Classify a text element's visual/marketing importance for the scene.
 * Scene purpose can demote product name when the scene is about price/CTA.
 */
export function classifyTextImportance(input: {
  role: TextRole;
  text: string;
  purpose?: string;
  productName?: string;
}): ImportanceDecision {
  const purpose = purposeBlob(input.purpose);
  const isPriceScene = /PRICE|PROMO|OFFER|DISCOUNT/.test(purpose);
  const isCtaScene = /CTA|CALL|ORDER|SHOP|BUY|CLOSING|END|FINAL/.test(purpose);
  const isHeroScene = /HOOK|HERO|INTRO|REVEAL|OPEN/.test(purpose);
  const isFeatureScene = /FEATURE|DETAIL|BENEFIT/.test(purpose);

  if (input.role === "cta") {
    return {
      hierarchyLevel: "CRITICAL_ACTION",
      hierarchy: 1,
      importanceScore: isCtaScene ? 0.98 : 0.9,
      reason: "Call to action",
    };
  }
  if (input.role === "price" || input.role === "discount") {
    return {
      hierarchyLevel: "PRIMARY",
      hierarchy: 1,
      importanceScore: isPriceScene ? 0.96 : 0.88,
      reason: input.role === "discount" ? "Discount emphasis" : "Current price",
    };
  }
  if (input.role === "previousPrice") {
    return {
      hierarchyLevel: "SUPPORTING",
      hierarchy: 3,
      importanceScore: 0.45,
      reason: "Previous price is subordinate",
    };
  }
  if (input.role === "hook" || input.role === "title" || input.role === "headline") {
    if (isPriceScene) {
      return { hierarchyLevel: "SECONDARY", hierarchy: 2, importanceScore: 0.7, reason: "Headline supports price scene" };
    }
    return {
      hierarchyLevel: "PRIMARY",
      hierarchy: 1,
      importanceScore: isHeroScene ? 0.95 : 0.9,
      reason: "Primary marketing message",
    };
  }
  if (input.role === "productName") {
    if (isPriceScene || isCtaScene) {
      return { hierarchyLevel: "SECONDARY", hierarchy: 2, importanceScore: 0.72, reason: "Product name secondary in this scene" };
    }
    return {
      hierarchyLevel: "PRIMARY",
      hierarchy: 1,
      importanceScore: 0.92,
      reason: "Product name primary",
    };
  }
  if (input.role === "benefit") {
    return {
      hierarchyLevel: isFeatureScene || isHeroScene ? "PRIMARY" : "SECONDARY",
      hierarchy: isFeatureScene || isHeroScene ? 1 : 2,
      importanceScore: isFeatureScene ? 0.9 : 0.75,
      reason: "Benefit messaging",
    };
  }
  if (input.role === "productFeature" || input.role === "promotion") {
    return { hierarchyLevel: "SECONDARY", hierarchy: 2, importanceScore: 0.7, reason: "Secondary feature/promotion" };
  }
  if (input.role === "brand" || input.role === "closingMessage") {
    return {
      hierarchyLevel: isCtaScene ? "SECONDARY" : "PRIMARY",
      hierarchy: isCtaScene ? 2 : 1,
      importanceScore: isCtaScene ? 0.7 : 0.85,
      reason: "Brand/closing identity",
    };
  }
  if (input.role === "website" || input.role === "phone") {
    return { hierarchyLevel: "MINOR", hierarchy: 4, importanceScore: 0.4, reason: "Contact information" };
  }
  if (input.role === "subtitle" || input.role === "sceneCaption" || input.role === "supporting") {
    return { hierarchyLevel: "SUPPORTING", hierarchy: 3, importanceScore: 0.5, reason: "Supporting copy" };
  }

  const fallback = roleHierarchy(input.role);
  return {
    hierarchyLevel: fallback <= 1 ? "PRIMARY" : fallback === 2 ? "SECONDARY" : fallback === 3 ? "SUPPORTING" : "MINOR",
    hierarchy: fallback,
    importanceScore: Math.max(0.3, 1 - (fallback - 1) * 0.15),
    reason: "Role default hierarchy",
  };
}

export function hierarchyLevelToRank(level: HierarchyLevel): number {
  switch (level) {
    case "PRIMARY":
    case "CRITICAL_ACTION":
      return 1;
    case "SECONDARY":
      return 2;
    case "SUPPORTING":
      return 3;
    case "MINOR":
    default:
      return 4;
  }
}
