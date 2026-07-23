import type { CreativeDirectionRecord } from "../creative-direction-engine/types.js";
import type { MarketingStrategyRecord } from "../marketing-strategy-intelligence-engine/types.js";
import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import {
  BackgroundPlanning,
  BrandConsistencyCheck,
  CameraPlanning,
  SceneVisualPlan,
  VisualPlanningScores,
} from "./types.js";

export class VisualPlanningScorer {
  computeScores(
    scenePlans: SceneVisualPlan[],
    background: BackgroundPlanning,
    camera: CameraPlanning,
    brandConsistency: BrandConsistencyCheck,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    creative: CreativeDirectionRecord,
    strategy: MarketingStrategyRecord
  ): VisualPlanningScores {
    const visualPlanningScore = this.computePlanningScore(scenePlans, storyboard, scriptPlan);
    const compositionScore = this.computeCompositionScore(scenePlans);
    const brandConsistencyScore = this.computeBrandScore(brandConsistency, creative);
    const creativeScore = Math.min(100, creative.scores.creativeQualityScore);
    const marketingScore = Math.min(100, strategy.scores.marketingReadinessScore);
    const aiConfidenceScore = Math.round(
      (visualPlanningScore + compositionScore + brandConsistencyScore + creativeScore + marketingScore) / 5
    );

    return {
      visualPlanningScore,
      compositionScore,
      brandConsistencyScore,
      creativeScore,
      marketingScore,
      aiConfidenceScore,
    };
  }

  isVisualPlanValid(
    scores: VisualPlanningScores,
    scenePlans: SceneVisualPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    brandConsistency: BrandConsistencyCheck,
    alignmentIssues: string[]
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (alignmentIssues.length > 0) diagnostics.push(...alignmentIssues);
    if (scenePlans.length !== storyboard.scenes.length) {
      diagnostics.push("Scene visual plans must match every storyboard scene");
    }
    if (scenePlans.length !== scriptPlan.scenePlans.length) {
      diagnostics.push("Scene visual plans must match every script plan scene");
    }
    if (!scenePlans.some((s) => s.logoPlacement !== "none")) {
      diagnostics.push("Logo placement plan required in at least one scene");
    }
    if (!brandConsistency.brandColors) {
      diagnostics.push("Brand color consistency check failed");
    }
    if (scores.visualPlanningScore < 55) {
      diagnostics.push(`Visual planning score ${scores.visualPlanningScore} below threshold (55)`);
    }
    if (scores.compositionScore < 50) {
      diagnostics.push(`Composition score ${scores.compositionScore} below threshold (50)`);
    }
    if (scores.brandConsistencyScore < 50) {
      diagnostics.push(`Brand consistency score ${scores.brandConsistencyScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(
    scenePlans: SceneVisualPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    scores: VisualPlanningScores
  ): boolean {
    return (
      storyboard.productionReady &&
      scriptPlan.productionReady &&
      scenePlans.length === storyboard.scenes.length &&
      scenePlans.every((s) => s.visualGoal.length >= 10 && s.composition.startsWith("Plan composition")) &&
      scores.visualPlanningScore >= 55
    );
  }

  private computePlanningScore(
    scenePlans: SceneVisualPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord
  ): number {
    let score = 50;
    if (scenePlans.length === storyboard.scenes.length) score += 15;
    if (scenePlans.length === scriptPlan.scenePlans.length) score += 15;
    if (scenePlans.every((s) => s.productPlacement.startsWith("Plan"))) score += 10;
    if (scenePlans.every((s) => s.lightingDirection.startsWith("Plan lighting"))) score += 5;
    if (scenePlans.every((s) => s.cameraAngle.startsWith("Plan camera"))) score += 5;
    return Math.min(100, score);
  }

  private computeCompositionScore(scenePlans: SceneVisualPlan[]): number {
    let score = 45;
    if (scenePlans.every((s) => s.composition.length >= 15)) score += 20;
    if (scenePlans.every((s) => s.depth.length >= 10)) score += 15;
    if (scenePlans.every((s) => s.transitionDirection.startsWith("Plan transition"))) score += 10;
    if (scenePlans.some((s) => s.cameraDistance.includes("hero") || s.cameraDistance.includes("close-up"))) score += 10;
    return Math.min(100, score);
  }

  private computeBrandScore(brand: BrandConsistencyCheck, creative: CreativeDirectionRecord): number {
    let score = 40;
    if (brand.logoPlacement) score += 15;
    if (brand.brandColors) score += 15;
    if (brand.typography) score += 10;
    if (brand.brandIdentity) score += 10;
    if (brand.visualConsistency) score += 10;
    if (brand.issues.length === 0) score += 10;
    return Math.min(100, score);
  }
}
