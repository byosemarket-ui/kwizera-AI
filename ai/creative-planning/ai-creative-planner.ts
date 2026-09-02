/**
 * AI creative planning integration point.
 * Uses deterministic scene planning when no reasoning provider is configured.
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
}

export interface CreativeReasoningProvider {
  readonly id: string;
  isAvailable(): Promise<boolean>;
  planCreativeScenes(input: AiCreativePlannerInput): Promise<unknown>;
}

class UnconfiguredCreativeReasoningProvider implements CreativeReasoningProvider {
  readonly id = "unconfigured";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async planCreativeScenes(): Promise<unknown> {
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

export async function generateCreativeScenes(input: AiCreativePlannerInput): Promise<AiCreativePlannerResult> {
  const warnings: string[] = [];
  try {
    if (await reasoningProvider.isAvailable()) {
      const raw = await reasoningProvider.planCreativeScenes(input);
      const parsed = validateAiPlannerOutput(raw);
      if (parsed.valid) {
        const deterministic = buildDeterministicPlan(input);
        const merged = deterministic.map((scene, index) => {
          const aiScene = parsed.scenes[index];
          if (!aiScene) return scene;
          return {
            ...scene,
            purpose: aiScene.purpose || scene.purpose,
            assetId: aiScene.assetId && input.project.productImages.some((img) => img.id === aiScene.assetId)
              ? aiScene.assetId
              : scene.assetId,
            durationSeconds: aiScene.duration && aiScene.duration >= 0.8 ? aiScene.duration : scene.durationSeconds,
            durationMs: aiScene.duration && aiScene.duration >= 0.8
              ? Math.round(aiScene.duration * 1000)
              : scene.durationMs,
          };
        });
        return { scenes: merged, source: "ai", warnings };
      }
      warnings.push("AI planner returned invalid output; using deterministic planning.");
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `AI planner unavailable: ${error.message}`
        : "AI planner unavailable; using deterministic planning.",
    );
  }

  return {
    scenes: buildDeterministicPlan(input),
    source: "deterministic",
    warnings,
  };
}
