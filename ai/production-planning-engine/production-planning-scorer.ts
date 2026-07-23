import type { StoryboardIntelligenceRecord } from "../storyboard-intelligence-engine/types.js";
import type { ScriptPlanningRecord } from "../script-planning-engine/types.js";
import type { VisualPlanningRecord } from "../visual-planning-engine/types.js";
import type { AudioPlanningRecord } from "../audio-planning-engine/types.js";
import {
  AssetManagement,
  DependencyValidation,
  ProductionPlanningScores,
  ProductionWorkflow,
  SceneProductionPlan,
} from "./types.js";
import { ProductionPlanningAnalyzer } from "./production-planning-analyzer.js";

export class ProductionPlanningScorer {
  private readonly analyzer = new ProductionPlanningAnalyzer();

  computeScores(
    sceneProductionPlans: SceneProductionPlan[],
    workflow: ProductionWorkflow,
    assets: AssetManagement,
    dependencies: DependencyValidation,
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord
  ): ProductionPlanningScores {
    const dependencyScore = this.computeDependencyScore(dependencies);
    const assetReadinessScore = this.computeAssetScore(assets);
    const workflowReadinessScore = this.computeWorkflowScore(workflow, sceneProductionPlans);
    const productionReadinessScore = this.computeProductionScore(
      sceneProductionPlans,
      storyboard,
      scriptPlan,
      visualPlan,
      audioPlan,
      dependencies
    );
    const performanceScore = Math.min(
      100,
      Math.round((storyboard.scores.aiConfidenceScore + scriptPlan.scores.aiConfidenceScore) / 2)
    );
    const aiConfidenceScore = Math.round(
      (productionReadinessScore + assetReadinessScore + workflowReadinessScore + dependencyScore + performanceScore) / 5
    );

    return {
      productionReadinessScore,
      assetReadinessScore,
      workflowReadinessScore,
      dependencyScore,
      performanceScore,
      aiConfidenceScore,
    };
  }

  isProductionPlanValid(
    scores: ProductionPlanningScores,
    dependencies: DependencyValidation,
    assets: AssetManagement,
    sceneProductionPlans: SceneProductionPlan[],
    storyboard: StoryboardIntelligenceRecord,
    alignmentIssues: string[]
  ): { valid: boolean; diagnostics: string[] } {
    const diagnostics: string[] = [];

    if (alignmentIssues.length > 0) diagnostics.push(...alignmentIssues);
    if (dependencies.issues.length > 0) diagnostics.push(...dependencies.issues);

    const requiredAssets = this.analyzer.getAllRequiredAssets(assets);
    const missingAssets = requiredAssets.filter((a) => a.status === "missing");
    if (missingAssets.length > 0) {
      diagnostics.push(`${missingAssets.length} required assets missing`);
    }

    if (!dependencies.storyboard || !dependencies.scriptPlan || !dependencies.visualPlan || !dependencies.audioPlan) {
      diagnostics.push("All planning module dependencies must pass validation");
    }
    if (!dependencies.creativeDirection || !dependencies.marketingStrategy || !dependencies.productIntelligence) {
      diagnostics.push("Creative direction, marketing strategy and product intelligence required");
    }
    if (sceneProductionPlans.length !== storyboard.scenes.length) {
      diagnostics.push("Scene production plans must match storyboard scene count");
    }
    if (scores.productionReadinessScore < 55) {
      diagnostics.push(`Production readiness score ${scores.productionReadinessScore} below threshold (55)`);
    }
    if (scores.dependencyScore < 50) {
      diagnostics.push(`Dependency score ${scores.dependencyScore} below threshold (50)`);
    }
    if (scores.assetReadinessScore < 50) {
      diagnostics.push(`Asset readiness score ${scores.assetReadinessScore} below threshold (50)`);
    }
    if (scores.aiConfidenceScore < 55) {
      diagnostics.push(`AI confidence score ${scores.aiConfidenceScore} below threshold (55)`);
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  isProductionReady(
    sceneProductionPlans: SceneProductionPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    dependencies: DependencyValidation,
    scores: ProductionPlanningScores
  ): boolean {
    return (
      storyboard.productionReady &&
      scriptPlan.productionReady &&
      visualPlan.productionReady &&
      audioPlan.productionReady &&
      dependencies.issues.length === 0 &&
      sceneProductionPlans.length === storyboard.scenes.length &&
      scores.productionReadinessScore >= 55
    );
  }

  private computeDependencyScore(deps: DependencyValidation): number {
    const checks = [
      deps.storyboard,
      deps.scriptPlan,
      deps.visualPlan,
      deps.audioPlan,
      deps.creativeDirection,
      deps.marketingStrategy,
      deps.productIntelligence,
      deps.brandKnowledge,
      deps.languageKnowledge,
      deps.memory,
      deps.knowledge,
    ];
    const passed = checks.filter(Boolean).length;
    return Math.min(100, Math.round((passed / checks.length) * 100));
  }

  private computeAssetScore(assets: AssetManagement): number {
    const required = this.analyzer.getAllRequiredAssets(assets);
    if (required.length === 0) return 50;
    const planned = required.filter((a) => a.status === "planned" || a.status === "validated").length;
    return Math.min(100, Math.round((planned / required.length) * 100));
  }

  private computeWorkflowScore(workflow: ProductionWorkflow, scenes: SceneProductionPlan[]): number {
    let score = 45;
    if (workflow.preProduction.startsWith("Plan pre-production")) score += 10;
    if (workflow.renderingPreparation.startsWith("Plan rendering")) score += 10;
    if (workflow.exportPreparation.startsWith("Plan export")) score += 10;
    if (workflow.deliveryPreparation.startsWith("Plan delivery")) score += 10;
    if (scenes.every((s) => s.renderInstructions.startsWith("Plan render"))) score += 15;
    return Math.min(100, score);
  }

  private computeProductionScore(
    scenes: SceneProductionPlan[],
    storyboard: StoryboardIntelligenceRecord,
    scriptPlan: ScriptPlanningRecord,
    visualPlan: VisualPlanningRecord,
    audioPlan: AudioPlanningRecord,
    deps: DependencyValidation
  ): number {
    let score = 40;
    if (scenes.length === storyboard.scenes.length) score += 15;
    if (scriptPlan.scenePlans.length === storyboard.scenes.length) score += 10;
    if (visualPlan.scenePlans.length === storyboard.scenes.length) score += 10;
    if (audioPlan.sceneAudioPlans.length === storyboard.scenes.length) score += 10;
    if (deps.issues.length === 0) score += 15;
    return Math.min(100, score);
  }
}
