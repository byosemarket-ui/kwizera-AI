/**
 * Deterministic typography engine. Optional Ollama hints are validated before use.
 */
import { randomUUID } from "node:crypto";
import { contrastForBackground } from "./contrast.js";
import { personalityForContext, roleHierarchy, selectFontForRole } from "./font-selection.js";
import { getVerifiedFonts, pickFallbackFont } from "./font-registry.js";
import { fitText } from "./fitting.js";
import { choosePlacement, clampToSafeZone, platformSafeZone, regionOverlapsProduct } from "./placement.js";
import { suggestTypographyHints } from "./ollama-typography.js";
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
  aiHint?: { personality?: TypographyItem["font"]["personality"]; region?: PlacementRegion };
}): Promise<TypographyItem> {
  const hierarchy = roleHierarchy(input.roleText.role);
  const personality = input.aiHint?.personality && isFontPersonality(input.aiHint.personality)
    ? input.aiHint.personality
    : personalityForContext({
      category: input.project.productCategory,
      goal: input.project.marketingGoal,
      tone: input.project.creativeTone,
      role: input.roleText.role,
    });
  const font = selectFontForRole(input.fonts, input.roleText.role, input.roleText.text, personality);
  const productCentered = productLikelyCentered(input.scene.image);
  let region = input.aiHint?.region && !regionOverlapsProduct(input.aiHint.region, productCentered)
    ? input.aiHint.region
    : choosePlacement({
      role: input.roleText.role,
      productCentered,
      backgroundComplexity: input.scene.image?.backgroundComplexity,
      occupiedRegions: input.occupied,
      hierarchy,
    });
  if (regionOverlapsProduct(region, productCentered)) {
    region = choosePlacement({
      role: input.roleText.role,
      productCentered: true,
      occupiedRegions: input.occupied,
      hierarchy,
    });
  }
  const zone = platformSafeZone(input.project.platform, input.project.aspectRatio);
  const layout = clampToSafeZone(region, zone);
  const fitted = fitText({
    text: input.roleText.text,
    width: input.project.width,
    height: input.project.height,
    hierarchy,
    roleMaxLines: input.roleText.role === "cta" || input.roleText.role === "price" ? 2 : undefined,
  });
  const visual = contrastForBackground({
    meanLuminance: input.scene.image?.meanLuminance,
    backgroundType: input.scene.image?.backgroundType,
    complexity: input.scene.image?.backgroundComplexity,
  });
  return {
    id: randomUUID(),
    role: input.roleText.role,
    text: input.roleText.text,
    lines: fitted.lines,
    font: {
      id: font.id,
      family: font.family,
      filePath: font.filePath,
      style: font.style,
      weight: font.weight,
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
    },
    visual,
    hierarchy,
    confidence: input.aiHint ? 0.72 : 0.9,
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
    const items: TypographyItem[] = [];
    for (const roleText of scene.texts) {
      if (!roleText.text.trim()) continue;
      const item = await buildItem({
        fonts: verified,
        project: input,
        scene,
        roleText,
        occupied,
        aiHint: sharedHint,
      });
      occupied.push(item.layout.region);
      items.push(item);
    }
    scenes.push({ sceneId: scene.sceneId, assetId: scene.assetId, items });
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
