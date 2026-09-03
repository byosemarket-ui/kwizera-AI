/**
 * AI creative planning integration point.
 * Uses deterministic scene planning when no reasoning provider is configured / available.
 */
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import type { ImageIntelligenceProfile } from "../image-intelligence/types.js";
import type { ProductIntelligenceProfile } from "../product-intelligence/types.js";
import type { CanonicalProduct } from "../product-record/types.js";
import type { AuthoritativeMarketingBrief } from "../marketing-brief/types.js";
import type { CreativeToneId, ProductionModeId } from "../video-production/production-mode-types.js";
import type { ConfirmedCommercial } from "./commercial.js";
import type { PlanScene } from "./creative-planning-manager.js";
import { planProductScenes } from "./scene-planner.js";
import { validateAiPlannerOutput } from "./plan-validator.js";
import { buildVerifiedFactsContext } from "./verified-facts-context.js";
import { buildDecisionTrace, buildPlanReview } from "../ai-director/decision-trace.js";
import type { PlanReviewItem, ProductionDecisionTrace } from "../ai-director/ai-director-types.js";

export interface AiCreativePlannerInput {
  project: CreativeProject;
  productIntelligence?: ProductIntelligenceProfile | null;
  assets: ImageIntelligenceProfile[];
  marketingSettings?: AuthoritativeMarketingBrief | null;
  videoSettings: {
    productionMode: ProductionModeId;
    creativeTone?: CreativeToneId;
    platform: string;
    durationSeconds: number;
    language: string;
    objective: string;
  };
  canonical?: CanonicalProduct | null;
  commercial?: ConfirmedCommercial | null;
  existingScenes?: PlanScene[];
}

export interface AiCreativePlannerResult {
  scenes: PlanScene[];
  source: "ai" | "deterministic";
  warnings: string[];
  modelId?: string | null;
  creativeDirection?: string;
  primarySellingPoint?: string;
  textStrategy?: {
    headline?: string;
    price?: string;
    cta?: string;
  };
  planReview?: PlanReviewItem[];
  decisionTrace?: ProductionDecisionTrace;
}

export interface CreativeReasoningProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  planCreativeScenes(input: AiCreativePlannerInput): Promise<unknown>;
  getLastModel?(): string | null;
}

class UnconfiguredCreativeReasoningProvider implements CreativeReasoningProvider {
  readonly id = "unconfigured";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async planCreativeScenes(): Promise<unknown> {
    return null;
  }

  getLastModel(): string | null {
    return null;
  }
}

let reasoningProvider: CreativeReasoningProvider = new UnconfiguredCreativeReasoningProvider();

export function setCreativeReasoningProvider(provider: CreativeReasoningProvider | null): void {
  reasoningProvider = provider ?? new UnconfiguredCreativeReasoningProvider();
}

export function getCreativeReasoningProvider(): CreativeReasoningProvider {
  return reasoningProvider;
}

function buildDeterministicPlan(input: AiCreativePlannerInput): PlanScene[] {
  return planProductScenes(
    input.project,
    input.productIntelligence,
    input.assets,
    input.existingScenes ?? [],
    {
      canonical: input.canonical,
      brief: input.marketingSettings,
      commercial: input.commercial,
      productionMode: input.videoSettings.productionMode,
      creativeTone: input.videoSettings.creativeTone,
      targetDurationMs: Math.round(input.videoSettings.durationSeconds * 1000),
    },
  );
}

function allowedAssetIds(input: AiCreativePlannerInput): Set<string> {
  return new Set(input.project.productImages.map((img) => img.id));
}

function finalizePlannerResult(
  input: AiCreativePlannerInput,
  partial: Omit<AiCreativePlannerResult, "planReview" | "decisionTrace">,
  planVersion: number,
): AiCreativePlannerResult {
  return {
    ...partial,
    planReview: buildPlanReview(partial.scenes),
    decisionTrace: buildDecisionTrace(input, partial, planVersion),
  };
}

const MAX_AI_PLAN_ATTEMPTS = 2;
const NON_RETRYABLE_CODES = new Set([
  "MODEL_TIMEOUT",
  "OLLAMA_UNAVAILABLE",
  "OLLAMA_DISABLED",
  "PROJECT_CONTEXT_MISSING",
  "MODEL_NOT_FOUND",
]);

function plannerErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code);
  }
  return undefined;
}

function mergeValidatedScenes(
  input: AiCreativePlannerInput,
  parsed: ReturnType<typeof validateAiPlannerOutput>,
): AiCreativePlannerResult["scenes"] {
  const deterministic = buildDeterministicPlan(input);
  const allowed = allowedAssetIds(input);
  return deterministic.map((scene, index) => {
    const aiScene = parsed.scenes[index];
    if (!aiScene) return scene;
    const assetId = aiScene.assetId && allowed.has(aiScene.assetId) ? aiScene.assetId : scene.assetId;
    const durationSeconds = aiScene.duration && aiScene.duration >= 0.8
      ? aiScene.duration
      : scene.durationSeconds;
    return {
      ...scene,
      purpose: aiScene.purpose || scene.purpose,
      assetId,
      durationSeconds,
      durationMs: Math.round(durationSeconds * 1000),
      camera: aiScene.camera || scene.camera,
      cameraDirection: aiScene.camera || scene.cameraDirection,
      motion: aiScene.motion || scene.motion,
      animation: aiScene.motion || scene.animation,
      narration: aiScene.narration || scene.narration,
      visualPurpose: aiScene.purpose || scene.visualPurpose,
      selectionReason: aiScene.backgroundStrategy
        ? `AI background strategy: ${aiScene.backgroundStrategy}`
        : scene.selectionReason,
    };
  });
}

export async function generateCreativeScenes(
  input: AiCreativePlannerInput,
  planVersion = 1,
): Promise<AiCreativePlannerResult> {
  const warnings: string[] = [];
  if (!(await reasoningProvider.isAvailable())) {
    warnings.push("AI Creative Director unavailable — using deterministic planning.");
    return finalizePlannerResult(input, {
      scenes: buildDeterministicPlan(input),
      source: "deterministic",
      warnings,
      modelId: null,
    }, planVersion);
  }

  const verifiedFacts = buildVerifiedFactsContext(input);
  const validateOpts = {
    projectId: input.project.id,
    allowedAssetIds: [...allowedAssetIds(input)],
    targetDurationSeconds: input.videoSettings.durationSeconds,
    productionMode: input.videoSettings.productionMode,
    verifiedFacts,
  };

  for (let attempt = 1; attempt <= MAX_AI_PLAN_ATTEMPTS; attempt += 1) {
    try {
      const raw = await reasoningProvider.planCreativeScenes(input);
      const parsed = validateAiPlannerOutput(raw, validateOpts);
      if (parsed.valid) {
        if (attempt > 1) warnings.push("AI plan accepted after one controlled validation retry.");
        return finalizePlannerResult(input, {
          scenes: mergeValidatedScenes(input, parsed),
          source: "ai",
          warnings: [...warnings, ...parsed.warnings],
          modelId: reasoningProvider.getLastModel?.() ?? null,
          creativeDirection: parsed.creativeDirection,
          primarySellingPoint: parsed.primarySellingPoint,
          textStrategy: parsed.textStrategy,
        }, planVersion);
      }
      const reason = parsed.errors[0]
        ? `AI_PLAN_VALIDATION_FAILED: ${parsed.errors[0]}`
        : "AI planner returned invalid output.";
      console.warn(`[KWIZERA] Creative plan validation failed (attempt ${attempt}/${MAX_AI_PLAN_ATTEMPTS}): ${reason}`);
      warnings.push(reason);
      if (attempt >= MAX_AI_PLAN_ATTEMPTS) break;
      warnings.push("Retrying structured AI plan once.");
    } catch (error) {
      const code = plannerErrorCode(error);
      const message = error instanceof Error
        ? `${code ? `${code}: ` : "AI planner unavailable: "}${error.message}`
        : "AI planner unavailable; using deterministic planning.";
      console.warn(`[KWIZERA] Creative plan provider error (attempt ${attempt}/${MAX_AI_PLAN_ATTEMPTS}): ${message}`);
      warnings.push(message);
      if (!code || NON_RETRYABLE_CODES.has(code) || attempt >= MAX_AI_PLAN_ATTEMPTS) break;
      warnings.push("Retrying structured AI plan once after recoverable provider error.");
    }
  }

  warnings.push("Using deterministic planning after AI validation/fallback.");
  return finalizePlannerResult(input, {
    scenes: buildDeterministicPlan(input),
    source: "deterministic",
    warnings,
    modelId: null,
  }, planVersion);
}
