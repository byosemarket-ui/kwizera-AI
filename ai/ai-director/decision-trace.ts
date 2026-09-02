import { createHash } from "node:crypto";
import type { AiCreativePlannerInput, AiCreativePlannerResult } from "../creative-planning/ai-creative-planner.js";
import type { PlanScene } from "../creative-planning/creative-planning-manager.js";
import type { PlanReviewItem, ProductionDecisionTrace } from "./ai-director-types.js";

const PURPOSE_LABELS: Record<string, string> = {
  HOOK: "Product Hook",
  REVEAL: "Product Reveal",
  FEATURE: "Key Feature",
  DETAIL: "Product Detail",
  OFFER: "Price / Offer",
  PRICE: "Price",
  PROMO: "Promotion",
  CTA: "Call To Action",
};

export function purposeLabel(purpose: string): string {
  const key = purpose.toUpperCase().replace(/[\s-]+/g, "_");
  for (const [pattern, label] of Object.entries(PURPOSE_LABELS)) {
    if (key.includes(pattern)) return label;
  }
  return purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Scene";
}

export function buildPlanReview(scenes: PlanScene[]): PlanReviewItem[] {
  return scenes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((scene) => ({
      order: scene.order,
      label: purposeLabel(scene.purpose),
      purpose: scene.purpose,
      assetId: scene.assetId,
    }));
}

export function buildInputFingerprint(input: AiCreativePlannerInput): string {
  return createHash("sha256").update(JSON.stringify({
    projectId: input.project.id,
    images: input.project.productImages.map((img) => [img.id, img.checksumSha256 ?? img.sizeBytes]),
    product: input.project.productInformation,
    mode: input.videoSettings.productionMode,
    duration: input.videoSettings.durationSeconds,
    platform: input.videoSettings.platform,
  })).digest("hex").slice(0, 16);
}

export function buildDecisionTrace(
  input: AiCreativePlannerInput,
  result: AiCreativePlannerResult,
  planVersion: number,
): ProductionDecisionTrace {
  const scenes = result.scenes;
  const hero = scenes.find((s) => /hook|reveal|hero|intro/i.test(s.purpose)) ?? scenes[0];
  return {
    projectId: input.project.id,
    planSource: result.source,
    modelId: result.modelId ?? null,
    fallbackUsed: result.source === "deterministic",
    heroAssetId: hero?.assetId ?? null,
    sceneCount: scenes.length,
    platform: input.videoSettings.platform,
    productionMode: input.videoSettings.productionMode,
    durationSeconds: input.videoSettings.durationSeconds,
    creativePlanVersion: planVersion,
    assetIds: [...new Set(scenes.map((s) => s.assetId).filter(Boolean) as string[])],
    inputFingerprint: buildInputFingerprint(input),
    createdAt: new Date().toISOString(),
  };
}
