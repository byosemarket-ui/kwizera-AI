import type { PlanScene } from "./creative-planning-manager.js";
import type { ProductionModeId } from "../video-production/production-mode-types.js";

export interface CreativePlanValidationInput {
  projectId: string | null;
  productionMode: ProductionModeId | null;
  planProductionMode?: ProductionModeId | null;
  platformId?: string | null;
  durationSeconds: number;
  language?: string | null;
  scenes: PlanScene[];
  assetIds: string[];
  productName?: string | null;
}

export interface CreativePlanValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalDurationMs: number;
}

const VALID_MODES: ProductionModeId[] = ["AI_PRODUCT_MOTION", "CINEMATIC_3D", "CLASSIC_SHOWCASE"];
const DURATION_TOLERANCE_MS = 2_500;

export function sceneTotalDurationMs(scenes: PlanScene[]): number {
  return scenes.reduce(
    (sum, scene) => sum + (scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000)),
    0,
  );
}

export function durationMatchesTarget(totalMs: number, targetSeconds: number, toleranceMs = DURATION_TOLERANCE_MS): boolean {
  const targetMs = Math.round(targetSeconds * 1000);
  return Math.abs(totalMs - targetMs) <= toleranceMs;
}

export function validateCreativePlan(input: CreativePlanValidationInput): CreativePlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.projectId) errors.push("Project ID is required.");
  if (!input.productName?.trim()) warnings.push("Product name is missing from the creative plan.");
  if (!input.productionMode || !VALID_MODES.includes(input.productionMode)) {
    errors.push("Select a valid production mode.");
  }
  if (
    input.planProductionMode
    && input.productionMode
    && input.planProductionMode !== input.productionMode
  ) {
    errors.push("Saved plan production mode does not match the selected mode. Regenerate or wait for save.");
  }
  if (!input.platformId?.trim()) warnings.push("Platform is not set on the creative plan.");
  if (!input.language?.trim()) warnings.push("Language is not set on the creative plan.");
  if (!input.scenes.length) errors.push("Creative plan must include at least one scene.");
  if (!input.assetIds.length) errors.push("No usable product assets are available.");

  const staleAssets = input.scenes
    .filter((scene) => scene.assetId && !input.assetIds.includes(scene.assetId))
    .map((scene) => scene.assetId as string);
  if (staleAssets.length) {
    errors.push(`Creative plan references stale assets: ${[...new Set(staleAssets)].join(", ")}`);
  }

  const missingAssets = input.scenes.filter((scene) => !scene.assetId);
  if (missingAssets.length) errors.push("Every scene must reference a valid original product image.");

  const invalidTiming = input.scenes.filter((scene) => {
    const ms = scene.durationMs ?? Math.round((scene.durationSeconds || 0) * 1000);
    return ms < 800;
  });
  if (invalidTiming.length) errors.push("Scene durations must be at least 0.8 seconds.");

  const totalDurationMs = sceneTotalDurationMs(input.scenes);
  if (input.durationSeconds > 0 && !durationMatchesTarget(totalDurationMs, input.durationSeconds)) {
    warnings.push(
      `Scene timing (${(totalDurationMs / 1000).toFixed(1)}s) differs from target duration (${input.durationSeconds}s).`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalDurationMs,
  };
}

export function validateAiPlannerOutput(
  output: unknown,
  opts?: {
    projectId?: string;
    allowedAssetIds?: string[];
    targetDurationSeconds?: number;
    productionMode?: ProductionModeId;
  },
): {
  valid: boolean;
  scenes: Array<{
    id: string;
    purpose: string;
    assetId?: string;
    duration?: number;
    camera?: string;
    motion?: string;
    backgroundStrategy?: string;
    narration?: string;
  }>;
  errors: string[];
  warnings: string[];
  creativeDirection?: string;
  primarySellingPoint?: string;
  textStrategy?: { headline?: string; price?: string; cta?: string };
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!output || typeof output !== "object") {
    return { valid: false, scenes: [], errors: ["INVALID_AI_OUTPUT"], warnings };
  }
  const record = output as Record<string, unknown>;
  if (opts?.projectId && typeof record.projectId === "string" && record.projectId && record.projectId !== opts.projectId) {
    errors.push("AI output projectId does not match the active project.");
  }
  if (opts?.productionMode && typeof record.productionMode === "string" && record.productionMode
    && record.productionMode !== opts.productionMode) {
    warnings.push("AI productionMode differed from user selection — user selection is authoritative.");
  }
  if (!Array.isArray(record.scenes) || !record.scenes.length) {
    return { valid: false, scenes: [], errors: ["AI output missing scenes"], warnings };
  }

  const allowed = new Set(opts?.allowedAssetIds ?? []);
  const scenes = record.scenes
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const assetId = typeof item.assetId === "string" ? item.assetId : undefined;
      if (assetId && allowed.size && !allowed.has(assetId)) {
        errors.push(`Hallucinated asset reference rejected: ${assetId}`);
      }
      return {
        id: String(item.id ?? `scene-${index + 1}`),
        purpose: String(item.purpose ?? ""),
        assetId: assetId && (!allowed.size || allowed.has(assetId)) ? assetId : undefined,
        duration: typeof item.duration === "number" ? item.duration : undefined,
        camera: typeof item.camera === "string" ? item.camera : undefined,
        motion: typeof item.motion === "string" ? item.motion : undefined,
        backgroundStrategy: typeof item.backgroundStrategy === "string" ? item.backgroundStrategy : undefined,
        narration: typeof item.narration === "string" ? item.narration : undefined,
      };
    })
    .filter((item) => item.purpose);

  if (!scenes.length) errors.push("AI output scenes lacked required purpose fields.");

  if (opts?.targetDurationSeconds && opts.targetDurationSeconds > 0) {
    const total = scenes.reduce((sum, scene) => sum + (scene.duration ?? 0), 0);
    if (total > 0 && Math.abs(total - opts.targetDurationSeconds) > 4) {
      warnings.push(
        `AI scene durations (${total.toFixed(1)}s) differ from target (${opts.targetDurationSeconds}s).`,
      );
    }
  }

  const textStrategyRaw = record.textStrategy && typeof record.textStrategy === "object"
    ? record.textStrategy as Record<string, unknown>
    : null;

  return {
    valid: errors.length === 0 && scenes.length > 0,
    scenes,
    errors,
    warnings,
    creativeDirection: typeof record.creativeDirection === "string" ? record.creativeDirection : undefined,
    primarySellingPoint: typeof record.primarySellingPoint === "string" ? record.primarySellingPoint : undefined,
    textStrategy: textStrategyRaw
      ? {
          headline: typeof textStrategyRaw.headline === "string" ? textStrategyRaw.headline : undefined,
          price: typeof textStrategyRaw.price === "string" ? textStrategyRaw.price : undefined,
          cta: typeof textStrategyRaw.cta === "string" ? textStrategyRaw.cta : undefined,
        }
      : undefined,
  };
}
