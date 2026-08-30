/**
 * Product-specific scene planning for Creative Planning.
 * References original asset IDs only. Does not generate video.
 */
import { randomUUID } from "node:crypto";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { CanonicalProduct } from "../product-record/types.js";
import type { CanonicalViewKind } from "../product-record/view-kinds.js";
import type { AuthoritativeMarketingBrief } from "../marketing-brief/types.js";
import type { PlanScene } from "./creative-planning-manager.js";
import { priceSceneCopy, type ConfirmedCommercial } from "./commercial.js";
import {
  allocateDurations,
  beatPurpose,
  parseDurationMs,
  planStoryBeats,
  type StoryBeatId,
} from "./story-structure.js";
import { buildProductionScript } from "./script-builder.js";

export type CameraDirection =
  | "close-up"
  | "medium-product"
  | "wide-hero"
  | "slow-push-in"
  | "orbit"
  | "side-reveal"
  | "top-down"
  | "detail-macro";

export interface SceneCopy {
  headline?: string;
  featureText?: string;
  benefitText?: string;
  supportingText?: string;
  priceOffer?: string;
  callToAction?: string;
}

export interface ScenePlannerContext {
  project: CreativeProject;
  product?: ProductIntelligenceProfile | null;
  images?: ImageIntelligenceProfile[];
  existing?: PlanScene[];
  canonical?: CanonicalProduct | null;
  brief?: AuthoritativeMarketingBrief | null;
  commercial?: ConfirmedCommercial | null;
}

const VIEW_FOR_BEAT: Record<StoryBeatId, CanonicalViewKind[]> = {
  HOOK: ["front", "front_left", "front_right"],
  PRODUCT_REVEAL: ["front", "front_left", "front_right"],
  FEATURE: ["left", "right", "front_left", "front_right"],
  DETAIL: ["detail", "close-up", "material_detail"],
  EXPLORATION: ["back", "left", "right", "top", "back_left", "back_right", "bottom", "material_detail"],
  MESSAGE: ["front", "left", "right"],
  PRICE: ["front", "front_left"],
  CTA: ["front", "front_left", "front_right"],
};

function cameraFor(view: string, beat: StoryBeatId): { camera: CameraDirection; motion: string } {
  if (beat === "CTA") return { camera: "medium-product", motion: "HOLD" };
  if (beat === "HOOK") return { camera: "medium-product", motion: "SLOW_PUSH_IN" };
  if (/detail|close-up|material/.test(view) || beat === "DETAIL") return { camera: "detail-macro", motion: "CLOSE_UP_ZOOM" };
  if (/left|right|side/.test(view) || beat === "FEATURE") return { camera: "side-reveal", motion: "GENTLE_PAN" };
  if (/back/.test(view)) return { camera: "orbit", motion: "SLOW_REVEAL" };
  if (/top|bottom/.test(view)) return { camera: "top-down", motion: "SLOW_REVEAL" };
  if (beat === "PRODUCT_REVEAL") return { camera: "wide-hero", motion: "SLOW_PUSH_IN" };
  return { camera: "medium-product", motion: "SLOW_PUSH_IN" };
}

function originalsFrom(project: CreativeProject, canonical?: CanonicalProduct | null) {
  if (canonical?.originalAssets.length) {
    return canonical.originalAssets
      .filter((asset) => asset.fileAccessible)
      .map((asset) => ({
        id: asset.assetId,
        fileName: asset.originalFilename,
        view: canonical.productViews.find((entry) => entry.assetId === asset.assetId)?.view ?? "unknown",
        userView: canonical.productViews.find((entry) => entry.assetId === asset.assetId)?.source === "user",
      }));
  }
  return project.productImages.filter(isOriginalProductImage).map((image) => ({
    id: image.id,
    fileName: image.fileName,
    view: "unknown" as CanonicalViewKind | "unknown",
    userView: false,
  }));
}

function pickAsset(
  originals: Array<{ id: string; fileName: string; view: string; userView: boolean }>,
  preferred: CanonicalViewKind[],
  used: Set<string>,
  beat: StoryBeatId,
): { assetId: string; view: string; reason: string; priority: number } {
  const unused = originals.filter((item) => !used.has(item.id));
  const pool = unused.length ? unused : originals;
  for (const view of preferred) {
    const match = pool.find((item) => item.view === view);
    if (match) {
      return {
        assetId: match.id,
        view: match.view,
        reason: match.userView
          ? `User-corrected ${view} view`
          : `Highest-confidence ${view.replace(/_/g, " ")} product view for ${beat}`,
        priority: 1,
      };
    }
  }
  const byName = pool.find((item) => preferred.some((view) => item.fileName.toLowerCase().includes(view.replace(/_/g, "-"))));
  if (byName) {
    return {
      assetId: byName.id,
      view: byName.view,
      reason: `Filename indicates ${byName.fileName} for ${beat}`,
      priority: 2,
    };
  }
  const fallback = pool[0] ?? originals[0]!;
  return {
    assetId: fallback.id,
    view: fallback.view,
    reason: unused.length
      ? `Next unused original asset for ${beat}`
      : `Only available original asset for ${beat}`,
    priority: 3,
  };
}

function applyModeAndTone(
  motion: string,
  transition: string,
  beat: StoryBeatId,
  mode: string,
  tone?: string,
): { motion: string; transition: string } {
  let nextMotion = motion;
  let nextTransition = transition;
  if (mode === "CLASSIC_SHOWCASE") {
    if (beat !== "HOOK") nextMotion = beat === "CTA" || beat === "PRICE" ? "HOLD" : "SLOW_PUSH_IN";
    nextTransition = beat === "CTA" ? "fade" : "cut";
  }
  if (tone === "Minimal" || tone === "Luxury" || tone === "Premium") {
    if (beat === "CTA" || beat === "PRICE") nextMotion = "HOLD";
    if (beat === "DETAIL") nextMotion = "CLOSE_UP_ZOOM";
  }
  if (tone === "Energetic" && beat !== "CTA" && beat !== "PRICE") {
    nextMotion = "SLOW_PUSH_IN";
    nextTransition = "cut";
  }
  return { motion: nextMotion, transition: nextTransition };
}

export function planProductScenes(
  project: CreativeProject,
  product?: ProductIntelligenceProfile | null,
  imageProfiles: ImageIntelligenceProfile[] = [],
  existing: PlanScene[] = [],
  extras?: {
    canonical?: CanonicalProduct | null;
    brief?: AuthoritativeMarketingBrief | null;
    commercial?: ConfirmedCommercial | null;
    productionMode?: import("../video-production/production-mode-types.js").ProductionModeId;
    creativeTone?: import("../video-production/production-mode-types.js").CreativeToneId;
  },
): PlanScene[] {
  const originals = originalsFrom(project, extras?.canonical);
  if (!originals.length) return [];

  const brief = extras?.brief;
  const commercial = extras?.commercial;
  const platform = brief?.campaign.platforms[0] || project.platform || "instagram";
  const durationMs = parseDurationMs(brief?.output.duration, /tiktok|instagram/i.test(platform) ? 15_000 : 30_000);
  const uniqueViews = new Set(originals.map((item) => item.view).filter((view) => view && view !== "unknown"));
  const beats = planStoryBeats({
    durationMs,
    platform,
    uniqueViewCount: Math.max(uniqueViews.size, originals.length),
    hasPrice: Boolean(commercial?.pricing.currentPrice),
    hasPromotion: Boolean(commercial?.promotion.enabled),
  });
  const durations = allocateDurations(durationMs, beats, platform);
  const script = buildProductionScript(project, beats, {
    product: extras?.canonical,
    brief,
    commercial: commercial ?? {
      productName: project.productInformation.name,
      pricing: { currentPrice: null, originalPrice: null, currency: "", discountPercentage: null, discountAmount: null },
      promotion: { enabled: false, message: "" },
      destination: { website: "", phone: "", email: "", socialHandle: "" },
      issues: [],
      missing: [],
    },
  });
  const prices = commercial ? priceSceneCopy(commercial) : {};
  const used = new Set<string>();
  let cursor = 0;
  const generated: PlanScene[] = [];

  beats.forEach((beat, index) => {
    const pick = pickAsset(originals, VIEW_FOR_BEAT[beat], used, beat);
    used.add(pick.assetId);
    const camera = cameraFor(pick.view, beat);
    const modeAdjusted = applyModeAndTone(
      camera.motion,
      beat === "CTA" ? "fade" : beat === "HOOK" ? "cut" : "cut",
      beat,
      extras?.productionMode ?? "AI_PRODUCT_MOTION",
      extras?.creativeTone,
    );
    const sceneDuration = durations[index] ?? 2000;
    const existingKeep = existing.find((item) => item.userEdited && generated.every((scene) => scene.id !== item.id) && (
      item.beat === beat || item.purpose === beatPurpose(beat)
    ));
    if (existingKeep?.userEdited) {
      const durationMsKept = existingKeep.durationMs ?? Math.round((existingKeep.durationSeconds || 2) * 1000);
      generated.push({
        ...existingKeep,
        order: index + 1,
        startMs: cursor,
        durationMs: durationMsKept,
        durationSeconds: durationMsKept / 1000,
        assetId: originals.some((item) => item.id === existingKeep.assetId) ? existingKeep.assetId : pick.assetId,
      });
      cursor += durationMsKept;
      return;
    }

    const copy: SceneCopy = {};
    let text = "";
    let narration = script.narration[index] || "";
    if (beat === "HOOK") {
      copy.headline = script.hook;
      text = script.hook;
    } else if (beat === "PRODUCT_REVEAL") {
      copy.headline = script.productName;
      text = script.productName;
    } else if (beat === "FEATURE") {
      copy.featureText = script.featureText || script.mainMessage;
      text = copy.featureText || "";
    } else if (beat === "DETAIL" || beat === "EXPLORATION") {
      copy.supportingText = script.supportingPoints[beat === "DETAIL" ? 0 : 1] || script.mainMessage;
      text = copy.supportingText || "";
    } else if (beat === "MESSAGE") {
      copy.benefitText = script.mainMessage;
      text = script.mainMessage;
    } else if (beat === "PRICE") {
      copy.priceOffer = prices.newPrice;
      copy.supportingText = prices.oldPrice;
      copy.headline = prices.saveLabel;
      text = [prices.saveLabel, prices.newPrice].filter(Boolean).join(" · ");
      narration = script.priceLine || narration;
    } else {
      copy.callToAction = script.cta;
      copy.supportingText = beat === "CTA" ? script.website : undefined;
      if (prices.newPrice && !beats.includes("PRICE")) {
        copy.priceOffer = [prices.saveLabel, prices.newPrice].filter(Boolean).join(" · ");
      }
      text = script.website ? `${script.cta}` : script.cta;
    }

    const profile = imageProfiles.find((item) => item.imageId === pick.assetId);
    generated.push({
      id: randomUUID(),
      order: index + 1,
      durationSeconds: sceneDuration / 1000,
      durationMs: sceneDuration,
      startMs: cursor,
      beat,
      purpose: beatPurpose(beat),
      visual: `Show the product using asset ${pick.assetId} (${pick.view}).`,
      narration,
      camera: camera.camera,
      lighting: profile?.visualMetrics?.lightingObserved || profile?.lighting || "Keep lighting consistent with the source product photograph.",
      composition: beat === "CTA" ? "Stable closing frame for CTA text" : "Product remains the visual priority",
      animation: modeAdjusted.motion.replace(/_/g, " ").toLowerCase(),
      assetId: pick.assetId,
      imageRole: pick.view,
      visualPurpose: beatPurpose(beat),
      cameraDirection: camera.camera,
      motion: modeAdjusted.motion,
      view: pick.view,
      transition: modeAdjusted.transition,
      text,
      copy,
      selectedFor: beatPurpose(beat),
      selectionReason: pick.reason,
      priority: pick.priority,
      assetRole: "PRIMARY_PRODUCT_IMAGE",
      fieldSources: {
        camera: "AI_RECOMMENDED",
        motion: "AI_RECOMMENDED",
        text: "AI_RECOMMENDED",
        assetId: "AI_RECOMMENDED",
        durationMs: "AI_RECOMMENDED",
      },
      userEdited: false,
    });
    cursor += sceneDuration;
  });

  void product;
  return generated;
}
