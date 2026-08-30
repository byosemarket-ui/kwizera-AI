import type { CreativePlan, PlanScene } from "./creative-planning-manager.js";
import type { ConfirmedCommercial } from "./commercial.js";
import type { ProductionScript } from "./script-builder.js";

export type ProductionManifestStatus = "DRAFT" | "PARTIALLY_READY" | "READY_FOR_VIDEO_PRODUCTION";

export interface ProductionManifest {
  version: 1;
  manifestId: string;
  projectId: string;
  productId: string;
  marketingBriefId: string;
  briefVersion: number;
  planId: string;
  planVersion: number;
  createdAt: string;
  updatedAt: string;
  platform: string;
  format: {
    aspectRatio: "9:16" | "1:1" | "16:9";
    width: number;
    height: number;
  };
  story: {
    purpose: string;
    beats: string[];
  };
  script: ProductionScript;
  commercial: ConfirmedCommercial;
  timeline: {
    durationMs: number;
    scenes: PlanScene[];
  };
  missing: string[];
  status: ProductionManifestStatus;
}

const SIZE: Record<"9:16" | "1:1" | "16:9", { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

export function aspectFromPlan(value?: string, platforms: string[] = []): "9:16" | "1:1" | "16:9" {
  if (value === "9:16" || value === "1:1" || value === "16:9") return value;
  const joined = platforms.join(" ").toLowerCase();
  if (/tiktok|instagram|reel/.test(joined)) return "9:16";
  if (/youtube/.test(joined) && !/short/.test(joined)) return "16:9";
  if (/facebook/.test(joined)) return "1:1";
  return "9:16";
}

export function buildProductionManifest(input: {
  plan: CreativePlan;
  commercial: ConfirmedCommercial;
  script: ProductionScript;
  missing: string[];
  platforms: string[];
  aspectRatio?: string;
  marketingBriefId?: string;
  briefVersion?: number;
  previous?: ProductionManifest | null;
}): ProductionManifest {
  const aspect = aspectFromPlan(input.aspectRatio, input.platforms);
  const scenes = [...input.plan.scenes].sort((a, b) => a.order - b.order);
  const durationMs = scenes.reduce((sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)), 0);
  const unresolved = scenes.filter((scene) => !scene.assetId);
  const missing = [
    ...input.missing,
    ...unresolved.map((scene) => `Scene ${scene.order} has no source asset`),
    ...input.commercial.missing,
    ...input.commercial.issues,
  ].filter((item, index, list) => list.indexOf(item) === index);

  const assetsOk = scenes.length > 0 && unresolved.length === 0;
  const status: ProductionManifestStatus = !assetsOk
    ? "DRAFT"
    : missing.some((item) => item.includes("no source asset"))
      ? "DRAFT"
      : missing.length
        ? "PARTIALLY_READY"
        : "READY_FOR_VIDEO_PRODUCTION";

  const now = new Date().toISOString();
  return {
    version: 1,
    manifestId: input.previous?.manifestId ?? `manifest_${input.plan.id}`,
    projectId: input.plan.projectId,
    productId: input.plan.productId || input.plan.projectId,
    marketingBriefId: input.marketingBriefId || input.previous?.marketingBriefId || "",
    briefVersion: input.briefVersion ?? input.previous?.briefVersion ?? 0,
    planId: input.plan.id,
    planVersion: input.plan.version,
    createdAt: input.previous?.createdAt ?? now,
    updatedAt: now,
    platform: (input.platforms[0] || "INSTAGRAM").toUpperCase(),
    format: { aspectRatio: aspect, ...SIZE[aspect] },
    story: {
      purpose: input.plan.objective || input.script.mainMessage,
      beats: scenes.map((scene) => scene.purpose),
    },
    script: input.script,
    commercial: input.commercial,
    timeline: { durationMs, scenes },
    missing,
    status,
  };
}
