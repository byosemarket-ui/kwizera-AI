/**
 * Deterministic typography engine.
 * STEP 3: hierarchy, adaptive size, weight, emphasis.
 * STEP 4: region contrast, color, readability, collision.
 */
import { randomUUID } from "node:crypto";
import { adaptiveFitText, estimateBoundingArea } from "./adaptive-sizing.js";
import { resolveTextCollisions } from "./collision.js";
import { resolveTextAppearance } from "./contrast.js";
import { controlSceneDensity } from "./density.js";
import { findEmphasisSpans } from "./emphasis.js";
import { personalityForContext, selectFontForRole } from "./font-selection.js";
import { getVerifiedFonts, pickFallbackFont } from "./font-registry.js";
import { classifyTextImportance } from "./hierarchy.js";
import { choosePlacement, clampToSafeZone, platformSafeZone, regionOverlapsProduct } from "./placement.js";
import { keepCurrencyWithAmount } from "./price-typography.js";
import { analyzeRegionFromImagePath, regionFromHints } from "./region-analysis.js";
import { suggestTypographyHints } from "./ollama-typography.js";
import { mapWeightToInstalled, preferredWeightName } from "./weight-selection.js";
import type {
  FontPersonality,
  PlacementRegion,
  TypographyComposeInput,
  TypographyDecision,
  TypographyItem,
  TypographyScenePlan,
  VerifiedFont,
} from "./types.js";
import { isFontPersonality } from "./types.js";
import { validateTypographyDecision } from "./validator.js";

function productLikelyCentered(image?: TypographyComposeInput["scenes"][number]["image"]): boolean {
  if (image?.productLikelyCentered === false) return false;
  if (image?.productLikelyCentered === true) return true;
  const composition = `${image?.composition ?? ""} ${image?.backgroundType ?? ""}`.toLowerCase();
  if (/edge|left|right|top-heavy|bottom/.test(composition)) return false;
  return true;
}

async function buildItem(input: {
  fonts: VerifiedFont[];
  project: TypographyComposeInput;
  scene: TypographyComposeInput["scenes"][number];
  roleText: { role: TypographyItem["role"]; text: string };
  occupied: PlacementRegion[];
  itemCountInScene: number;
  aiHint?: { personality?: TypographyItem["font"]["personality"]; region?: PlacementRegion };
}): Promise<TypographyItem> {
  const text = keepCurrencyWithAmount(input.roleText.text);
  const importance = classifyTextImportance({
    role: input.roleText.role,
    text,
    purpose: input.scene.purpose,
    productName: input.project.productName,
  });
  const personality = input.aiHint?.personality && isFontPersonality(input.aiHint.personality)
    ? input.aiHint.personality
    : personalityForContext({
      category: input.project.productCategory,
      goal: input.project.marketingGoal,
      tone: input.project.creativeTone,
      role: input.roleText.role,
    });
  const baseFont = selectFontForRole(input.fonts, input.roleText.role, text, personality);
  const weightPref = preferredWeightName({
    hierarchyLevel: importance.hierarchyLevel,
    role: input.roleText.role,
  });
  const weighted = mapWeightToInstalled(weightPref, baseFont, input.fonts);
  const productCentered = productLikelyCentered(input.scene.image);
  let region = input.aiHint?.region && !regionOverlapsProduct(input.aiHint.region, productCentered)
    ? input.aiHint.region
    : choosePlacement({
      role: input.roleText.role,
      productCentered,
      backgroundComplexity: input.scene.image?.backgroundComplexity,
      occupiedRegions: input.occupied,
      hierarchy: importance.hierarchy,
    });
  if (regionOverlapsProduct(region, productCentered)) {
    region = choosePlacement({
      role: input.roleText.role,
      productCentered: true,
      occupiedRegions: input.occupied,
      hierarchy: importance.hierarchy,
    });
  }
  const zone = platformSafeZone(input.project.platform, input.project.aspectRatio);
  const layout = clampToSafeZone(region, zone);
  const fitted = adaptiveFitText({
    text,
    role: input.roleText.role,
    hierarchyLevel: importance.hierarchyLevel,
    width: input.project.width,
    height: input.project.height,
    aspectRatio: input.project.aspectRatio,
    region,
    alignment: layout.alignment,
    productCentered,
    itemCountInScene: input.itemCountInScene,
  });
  const boundingArea = estimateBoundingArea({
    lines: fitted.lines,
    fontSizePx: fitted.fontSizePx,
    maxWidthPx: fitted.maxWidthPx,
    normalizedX: layout.x,
    normalizedY: layout.y,
    alignment: layout.alignment,
    frameWidth: input.project.width,
    frameHeight: input.project.height,
  });

  let regionStats = regionFromHints({
    meanLuminance: input.scene.image?.meanLuminance,
    backgroundType: input.scene.image?.backgroundType,
    complexity: input.scene.image?.backgroundComplexity,
    dominantHex: input.scene.image?.dominantColors?.[0],
  });
  if (input.scene.image?.imagePath) {
    const sampled = await analyzeRegionFromImagePath(input.scene.image.imagePath, boundingArea);
    if (sampled) regionStats = sampled;
  }
  const appearance = resolveTextAppearance({
    region: regionStats,
    role: input.roleText.role,
    hierarchyLevel: importance.hierarchyLevel,
    brandColors: input.scene.image?.brandColors ?? input.project.brandColors,
    category: input.project.productCategory,
    tone: input.project.creativeTone,
  });

  return {
    id: randomUUID(),
    role: input.roleText.role,
    text,
    lines: fitted.lines,
    font: {
      id: weighted.font.id,
      family: weighted.font.family,
      filePath: weighted.font.filePath,
      style: weighted.font.style,
      weight: weighted.weight,
      weightName: weighted.weightName,
      personality,
    },
    layout: {
      region,
      normalizedX: layout.x,
      normalizedY: layout.y,
      alignment: layout.alignment,
    },
    size: {
      fontSizePx: fitted.fontSizePx,
      maxLines: fitted.maxLines,
      maxWidthPx: fitted.maxWidthPx,
    },
    visual: {
      color: appearance.color,
      contrastStrategy: appearance.contrastStrategy,
      panelColor: appearance.panelColor,
      contrastRatio: appearance.contrastRatio,
      readabilityPassed: appearance.readabilityPassed,
    },
    hierarchy: importance.hierarchy,
    hierarchyLevel: importance.hierarchyLevel,
    importanceScore: importance.importanceScore,
    emphasis: findEmphasisSpans({ text, role: input.roleText.role }),
    boundingArea,
    confidence: input.aiHint ? 0.72 : 0.92,
  };
}

export async function composeTypographyDecision(
  input: TypographyComposeInput,
  fonts?: VerifiedFont[],
): Promise<TypographyDecision> {
  const verified = fonts ?? await getVerifiedFonts();
  const fallback = pickFallbackFont(verified);
  const warnings: string[] = [];
  if (!fallback) {
    return {
      projectId: input.projectId,
      width: input.width,
      height: input.height,
      aspectRatio: input.aspectRatio,
      platform: input.platform,
      source: "deterministic",
      fallbackUsed: true,
      scenes: [],
      warnings: ["No verified fonts available"],
      createdAt: new Date().toISOString(),
    };
  }

  let usedAi = false;
  let sharedHint: { personality?: FontPersonality; region?: PlacementRegion } | undefined;
  if (input.useOllama) {
    try {
      const first = input.scenes.find((scene) => scene.texts.some((item) => item.text.trim()));
      const hint = await suggestTypographyHints({
        category: input.productCategory,
        role: first?.texts.find((item) => item.text.trim())?.role ?? "headline",
        purpose: first?.purpose,
      });
      if (hint) {
        usedAi = true;
        sharedHint = hint;
      }
    } catch {
      warnings.push("Ollama typography hint skipped — using deterministic selection.");
    }
  }

  const scenes: TypographyScenePlan[] = [];
  for (const scene of input.scenes) {
    const occupied: PlacementRegion[] = [];
    const draft: TypographyItem[] = [];
    const candidates = scene.texts.filter((item) => item.text.trim());
    for (const roleText of candidates) {
      const item = await buildItem({
        fonts: verified,
        project: input,
        scene,
        roleText,
        occupied,
        itemCountInScene: candidates.length,
        aiHint: sharedHint,
      });
      occupied.push(item.layout.region);
      draft.push(item);
    }
    const densified = controlSceneDensity(draft, /cta|call|closing|end|final|contact/i.test(scene.purpose ?? "") ? 4 : 3);
    warnings.push(...densified.warnings);
    const collided = resolveTextCollisions(densified.items);
    warnings.push(...collided.warnings);
    scenes.push({
      sceneId: scene.sceneId,
      assetId: scene.assetId,
      purpose: scene.purpose,
      items: collided.items,
      density: {
        itemCount: collided.items.length,
        totalWords: collided.items.reduce((sum, item) => sum + item.text.trim().split(/\s+/).filter(Boolean).length, 0),
        trimmed: densified.trimmed,
        warnings: densified.warnings,
      },
    });
  }

  const decision: TypographyDecision = {
    projectId: input.projectId,
    width: input.width,
    height: input.height,
    aspectRatio: input.aspectRatio,
    platform: input.platform,
    source: usedAi ? "ai-validated" : "deterministic",
    fallbackUsed: !usedAi,
    scenes,
    warnings,
    createdAt: new Date().toISOString(),
  };
  const validated = validateTypographyDecision(decision, verified);
  if (!validated.valid) {
    const { sanitizeAiTypographyDecision } = await import("./validator.js");
    const sanitized = sanitizeAiTypographyDecision(decision, verified);
    const again = validateTypographyDecision(sanitized, verified);
    return {
      ...sanitized,
      warnings: [
        ...warnings,
        ...validated.errors.map((error) => `validation:${error}`),
        ...again.warnings,
      ],
    };
  }
  return { ...decision, warnings: [...warnings, ...validated.warnings] };
}

export function applyInvalidAiSafely(
  decision: TypographyDecision,
  fonts: VerifiedFont[],
): TypographyDecision {
  const fallback = pickFallbackFont(fonts);
  if (!fallback) return { ...decision, warnings: [...decision.warnings, "No fallback font"] };
  const scenes = decision.scenes.map((scene) => ({
    ...scene,
    items: scene.items.map((item) => {
      const known = fonts.some((font) => font.id === item.font.id);
      if (known) return item;
      return {
        ...item,
        font: {
          id: fallback.id,
          family: fallback.family,
          filePath: fallback.filePath,
          style: fallback.style,
          weight: fallback.weight,
          weightName: "regular" as const,
          personality: "clean-sans" as const,
        },
        confidence: Math.min(item.confidence, 0.4),
      };
    }),
  }));
  return {
    ...decision,
    source: "deterministic",
    fallbackUsed: true,
    scenes,
    warnings: [...decision.warnings, "Unverified AI font names replaced with fallback."],
  };
}
