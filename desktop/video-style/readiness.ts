import type { ProductionModeId } from "../../ai/video-production/production-capabilities.js";
import type { CreativePlanDto, ProductionManifestDto } from "../deep-intelligence/live-api.js";
import type { ProductionModeOption, PlanPreview, ReadinessResult, ScenePreview, VideoStyleSnapshot } from "./types.js";

export function resolveHandoffProductionMode(
  plan: CreativePlanDto | null,
  selectedMode: ProductionModeId | null,
): ProductionModeId | null {
  if (plan?.productionMode) return plan.productionMode as ProductionModeId;
  return selectedMode;
}

export function productionModesMatch(
  plan: CreativePlanDto | null,
  selectedMode: ProductionModeId | null,
): boolean {
  if (!selectedMode) return false;
  if (!plan?.productionMode) return true;
  return plan.productionMode === selectedMode;
}

export function sceneTextPreview(scene: { text?: string; copy?: Record<string, string | undefined> }): string {
  if (scene.text?.trim()) return scene.text.trim();
  const parts = [
    scene.copy?.headline,
    scene.copy?.featureText,
    scene.copy?.benefitText,
    scene.copy?.priceOffer,
    scene.copy?.callToAction,
    scene.copy?.supportingText,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

export function buildPlanPreview(
  plan: CreativePlanDto | null,
  manifest: ProductionManifestDto | null,
  durationSeconds: number,
  platformLabel: string,
): PlanPreview | null {
  if (!plan?.scenes?.length) return null;
  const uniqueViews = new Set(plan.scenes.map((s) => s.view).filter(Boolean));
  const uniqueAssets = new Set(plan.scenes.map((s) => s.assetId).filter(Boolean));
  const commercial = plan.commercial ?? manifest?.commercial;
  const hasPrice = commercial?.pricing.currentPrice != null;
  const hasDiscount = (commercial?.pricing.discountPercentage ?? 0) > 0;
  const hasWebsite = Boolean(commercial?.destination.website?.trim());
  const hasCta = Boolean(plan.callToAction?.trim() || plan.productionScript?.cta?.trim());

  return {
    ready: plan.scenes.every((s) => s.assetId),
    headline: `${durationSeconds}-second ${platformLabel} video`,
    sceneCount: plan.scenes.length,
    uniqueViewCount: Math.max(uniqueViews.size, uniqueAssets.size),
    formatLabel: `${manifest?.format.width ?? "—"} × ${manifest?.format.height ?? "—"}`,
    includesPrice: hasPrice,
    includesDiscount: hasDiscount,
    includesWebsite: hasWebsite,
    includesCta: hasCta,
    statusLabel: plan.planStatus === "READY_FOR_REVIEW" || plan.productionStatus === "READY_FOR_VIDEO_PRODUCTION"
      ? "VIDEO PLAN READY"
      : plan.scenes.every((s) => s.assetId) ? "VIDEO PLAN READY" : "PLAN INCOMPLETE",
  };
}

export function buildScenePreviews(projectId: string, plan: CreativePlanDto | null): ScenePreview[] {
  if (!plan?.scenes?.length) return [];
  return plan.scenes.map((scene) => ({
    id: scene.id,
    order: scene.order,
    purpose: scene.purpose || scene.beat || `Scene ${scene.order}`,
    beat: scene.beat ?? scene.purpose,
    view: scene.view ?? scene.imageRole ?? "unknown",
    durationSeconds: scene.durationSeconds ?? (scene.durationMs ? scene.durationMs / 1000 : 0),
    motion: scene.motion ?? scene.animation ?? "HOLD",
    transition: scene.transition ?? "cut",
    textPreview: sceneTextPreview(scene),
    assetId: scene.assetId ?? "",
    thumbnailUrl: scene.assetId ? `/api/workspace/projects/${projectId}/images/${scene.assetId}` : "",
    selectionReason: scene.selectionReason ?? "",
    userEdited: Boolean(scene.userEdited),
  }));
}

export function computeReadiness(
  snap: Pick<
    VideoStyleSnapshot,
    "projectId" | "handoff" | "selectedMode" | "modes" | "plan" | "planPreview" | "generating" | "saveState"
  >,
): ReadinessResult {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!snap.projectId) blocking.push("Open or create a project first.");
  if (!snap.handoff?.briefId) blocking.push("Complete Video Settings (Step 2) first.");
  if (!snap.selectedMode) blocking.push("Select a production mode.");
  const mode = snap.modes.find((m) => m.mode === snap.selectedMode);
  if (mode && !mode.available) blocking.push(`${mode.label} is unavailable on this production engine.`);
  if (snap.generating) blocking.push("Production plan is still generating.");
  if (!snap.plan?.scenes?.length) blocking.push("Generate a production plan before continuing.");
  if (snap.plan?.scenes.some((s) => !s.assetId)) blocking.push("Every scene must reference a valid original product image.");
  if (snap.plan && snap.selectedMode && !productionModesMatch(snap.plan, snap.selectedMode)) {
    blocking.push("Selected production mode has not been saved to the plan yet. Wait for save or regenerate.");
  }
  if (snap.saveState === "saving" || snap.saveState === "error") {
    blocking.push(snap.saveState === "error" ? "Fix save errors before continuing." : "Wait for the plan to finish saving.");
  }
  if (snap.planPreview && !snap.planPreview.ready) warnings.push("Some plan details may still be incomplete.");

  const ready = blocking.length === 0;
  return {
    ready,
    blockingIssues: blocking,
    warnings,
    statusLabel: ready ? (warnings.length ? "READY WITH NOTES" : "READY TO CONTINUE") : "NOT READY",
  };
}

export function formatPriceLabel(
  current: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (current == null || !Number.isFinite(current)) return null;
  const cur = currency?.trim() || "RWF";
  return `${current.toLocaleString()} ${cur}`;
}

export function mapCapabilities(raw: Awaited<ReturnType<typeof import("./api.js").fetchProductionCapabilities>>["capabilities"]): ProductionModeOption[] {
  return raw.map((c) => ({
    mode: c.mode,
    label: c.label,
    description: c.description,
    available: c.available,
    provider: c.provider,
    reason: c.reason,
    limitations: c.limitations,
    recommended: Boolean(c.recommended),
  }));
}

export function recommendedModeReason(modes: ProductionModeOption[], viewCount: number): string | null {
  const rec = modes.find((m) => m.recommended);
  if (!rec) return null;
  if (viewCount >= 2) {
    return "Your project contains multiple product views and the current production engine can create controlled motion from your original photographs.";
  }
  return "The current production engine can create a professional video from your original product photographs.";
}

export function isModeAvailable(modes: ProductionModeOption[], mode: ProductionModeId | null): boolean {
  if (!mode) return false;
  return modes.find((m) => m.mode === mode)?.available ?? false;
}
