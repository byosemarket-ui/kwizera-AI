import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
  SCENE_PLATFORM_TARGETS,
  SceneType,
  type SceneGenerationEngineStatusReport,
  type SceneGenerationRecord,
  type StoryboardGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-scene-gen-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step8c-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description:
    "Professional AI-powered creative workstation empowering marketing teams to produce brand-consistent content at scale",
  features: ["AI video generation", "brand consistency", "multi-platform export"],
  specifications: { license: "pro", deployment: "cloud" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  useCase: "creative-production",
  targetCustomer: "creative professionals and marketing teams",
  businessType: ProductBusinessType.B2B,
  tags: ["software", "validation"],
  keywords: ["AI studio", "kwizera"],
};

const SAMPLE_FASHION: ProductAnalysisEngineInput = {
  productId: "step8c-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium urban jacket for creators who need weather-resistant style on the move",
  features: ["water-resistant", "breathable", "minimal branding"],
  specifications: { fabric: "cotton-blend" },
  materials: ["cotton", "polyester"],
  price: 129.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "fashion" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.D2C,
  tags: ["fashion", "validation"],
  keywords: ["jacket", "kwizera"],
};

const SAMPLE_BEAUTY: ProductAnalysisEngineInput = {
  productId: "step8c-glow-serum",
  productName: "Radiance Vitamin C Serum",
  category: ProductAnalysisCategory.Beauty,
  subcategory: "skincare",
  brand: "GlowLab",
  description: "Clinical-grade vitamin C serum delivering radiant skin and anti-aging benefits",
  features: ["vitamin-c", "anti-aging", "hydrating"],
  specifications: { volume: "30ml" },
  materials: ["glass-bottle"],
  price: 45.0,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "beauty" as ProductAnalysisEngineInput["industry"],
  tags: ["beauty", "validation"],
  keywords: ["serum", "glowlab"],
};

async function preparePipelineAndStoryboard(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform,
  genPlatform: StoryboardGenerationPlatform
): Promise<StoryboardGenerationRecord | undefined> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(sample);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({
    productId: sample.productId!,
  });
  await piFoundation.getMarketingStrategyIntelligenceEngine().prepareMarketingStrategy({
    productId: sample.productId!,
    marketingObjective: objective,
  });
  await piFoundation.getCreativeDirectionEngine().planCreativeDirection({
    productId: sample.productId!,
    platform,
  });
  await piFoundation.getStoryboardIntelligenceEngine().createStoryboard({
    productId: sample.productId!,
    includeSocialProof: true,
  });

  const storyResult = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: sample.productId!,
    platform: genPlatform,
    generatePlatformVariations: true,
  });

  return storyResult.record;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 8C Scene Generation Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("Project state:", projectStateDir);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({
      storageRootOverride: storageRoot,
      skipPlanningEngine: true,
      skipWorkflowEngine: true,
      skipTaskManager: true,
    });
    const initStart = Date.now();
    await core.start("step-8c-validation");
    const initMs = Date.now() - initStart;

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const sceneEngine = genFoundation.getSceneGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: sceneEngine.isInitialized() && sceneEngine.isStartupComplete(),
      detail: sceneEngine.isStartupComplete()
        ? `Scene Generation Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = genFoundation.getRegistry().getModule("scene-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    const techStoryboard = await preparePipelineAndStoryboard(
      piFoundation,
      genFoundation,
      SAMPLE_TECH,
      MarketingObjective.ProductLaunch,
      CreativePlatform.YouTube,
      StoryboardGenerationPlatform.YouTubeLongForm
    );
    const fashionStoryboard = await preparePipelineAndStoryboard(
      piFoundation,
      genFoundation,
      SAMPLE_FASHION,
      MarketingObjective.ProductPromotion,
      CreativePlatform.InstagramReels,
      StoryboardGenerationPlatform.InstagramReels
    );
    const beautyStoryboard = await preparePipelineAndStoryboard(
      piFoundation,
      genFoundation,
      SAMPLE_BEAUTY,
      MarketingObjective.BrandAwareness,
      CreativePlatform.TikTok,
      StoryboardGenerationPlatform.TikTok
    );

    results.storyboardUpstream = {
      passed: Boolean(techStoryboard?.validated && fashionStoryboard?.validated && beautyStoryboard?.validated),
      detail: "Approved storyboards prepared for scene generation",
    };

    const techScenes = await sceneEngine.generateScenes({ storyboardId: techStoryboard!.storyboardId });
    const fashionScenes = await sceneEngine.generateScenes({ storyboardId: fashionStoryboard!.storyboardId });
    const beautyScenes = await sceneEngine.generateScenes({ storyboardId: beautyStoryboard!.storyboardId });

    results.sceneGeneration = {
      passed: techScenes.success && fashionScenes.success && beautyScenes.success,
      detail: `Tech ${techScenes.scenes?.length ?? 0}, Fashion ${fashionScenes.scenes?.length ?? 0}, Beauty ${beautyScenes.scenes?.length ?? 0} scenes`,
    };

    const firstScene = techScenes.scenes?.[0];

    results.sceneStructure = {
      passed: Boolean(
        firstScene?.structure.sceneOrder &&
          firstScene?.structure.sceneDuration &&
          firstScene?.structure.scenePurpose &&
          firstScene?.structure.sceneType &&
          firstScene?.structure.sceneObjectives.length >= 1
      ),
      detail: "Scene order, duration, purpose, type, objectives verified",
    };

    results.shotPlanning = {
      passed: (firstScene?.shots.length ?? 0) >= 1 && firstScene?.shots.every((s) => s.focusPoint && s.framing),
      detail: `${firstScene?.shots.length} shots with focus point and framing`,
    };

    results.visualPlanning = {
      passed: Boolean(
        firstScene?.visualPlan.background &&
          firstScene?.visualPlan.lighting &&
          firstScene?.visualPlan.composition &&
          firstScene?.visualPlan.productPlacement
      ),
      detail: "Visual generation plan with background, lighting, composition, product placement",
    };

    results.characterPlanning = {
      passed: Boolean(
        firstScene?.characterPlanning.characterPosition &&
          firstScene?.characterPlanning.facialExpression &&
          firstScene?.characterPlanning.interactionPlanning
      ),
      detail: "Character planning with position, expression, interaction",
    };

    results.audioPlanning = {
      passed: Boolean(
        firstScene?.audioPlanning.voiceTiming &&
          firstScene?.audioPlanning.musicTiming &&
          firstScene?.audioPlanning.audioSynchronization
      ),
      detail: "Audio planning with voice, music, synchronization",
    };

    results.transitionPlanning = {
      passed: Boolean(
        firstScene?.transitionPlanning.sceneTransition &&
          firstScene?.transitionPlanning.shotTransition &&
          firstScene?.transitionPlanning.visualTransition
      ),
      detail: "Transition planning for scene, shot, and visual",
    };

    results.platformOptimization = {
      passed: (firstScene?.platformOptimizations.length ?? 0) === SCENE_PLATFORM_TARGETS.length,
      detail: `${firstScene?.platformOptimizations.length}/${SCENE_PLATFORM_TARGETS.length} platform optimizations`,
    };

    results.sceneScores = {
      passed:
        (firstScene?.scores.sceneQualityScore ?? 0) >= 55 &&
        (firstScene?.scores.compositionScore ?? 0) >= 50 &&
        (firstScene?.scores.cinematicScore ?? 0) >= 50 &&
        (firstScene?.scores.brandConsistencyScore ?? 0) >= 50 &&
        (firstScene?.scores.productionReadinessScore ?? 0) >= 55 &&
        (firstScene?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${firstScene?.scores.sceneQualityScore}, composition ${firstScene?.scores.compositionScore}, confidence ${firstScene?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (firstScene?.relationships.storyboards.length ?? 0) >= 1 &&
        (firstScene?.relationships.cameraPlans.length ?? 0) >= 1 &&
        (firstScene?.relationships.motionPlans.length ?? 0) >= 1,
      detail: `Storyboards ${firstScene?.relationships.storyboards.length}, camera ${firstScene?.relationships.cameraPlans.length}, motion ${firstScene?.relationships.motionPlans.length}`,
    };

    results.productionReadiness = {
      passed: techScenes.scenes?.every((s) => s.productionReady && s.validated) ?? false,
      detail: `All tech scenes production-ready: ${techScenes.scenes?.every((s) => s.productionReady)}`,
    };

    results.brandConsistency = {
      passed: techScenes.scenes?.every((s) => s.brandConsistent) ?? false,
      detail: "Brand consistency verified across generated scenes",
    };

    const noStoryboard = await sceneEngine.generateScenes({ storyboardId: "step8c-nonexistent" });
    results.incompleteRejection = {
      passed: !noStoryboard.success,
      detail: noStoryboard.message ?? "Rejected without approved storyboard",
    };

    const unvalidated = await sceneEngine.generateScenes({ storyboardId: "unvalidated-storyboard" });
    results.unvalidatedRejection = {
      passed: !unvalidated.success,
      detail: unvalidated.message ?? "Rejected without validated storyboard",
    };

    const repaired = await sceneEngine.repairScenes(techStoryboard!.storyboardId);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Scene repair pipeline verified" : "Repair failed",
    };

    const storyboardSearch = sceneEngine.searchScenes({ storyboardId: techStoryboard!.storyboardId });
    results.searchByStoryboard = {
      passed: storyboardSearch.length >= (techStoryboard?.scenes.length ?? 1),
      detail: `${storyboardSearch.length} scene(s) by storyboard`,
    };

    const productSearch = sceneEngine.searchScenes({ productId: "step8c-kwizera-pro" });
    results.searchByProduct = {
      passed: productSearch.length >= 1,
      detail: `${productSearch.length} result(s) by product`,
    };

    const typeSearch = sceneEngine.searchScenes({ sceneType: SceneType.ProductShowcase });
    results.searchBySceneType = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by scene type`,
    };

    const keywordSearch = sceneEngine.searchScenes({ keywords: "product" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstScene!.sceneId);
    results.generationAssetRegistration = {
      passed: assetRegistered?.assetType === "scene",
      detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Asset not found",
    };

    const status = sceneEngine.buildStatusReport();
    results.performance = {
      passed: status.performance.averageGenerationMs < 120000,
      detail: `avg generation ${status.performance.averageGenerationMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `scene-generation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashionScenes.success && beautyScenes.success,
      detail: `Fashion ${fashionScenes.scenes?.length} scenes, Beauty ${beautyScenes.scenes?.length} scenes`,
    };

    await core.stop("step-8c-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Scene-Generation-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, techScenes.scenes, fashionScenes.scenes, beautyScenes.scenes),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Structure-Report.md"),
      buildStructureReport(techScenes.scenes, fashionScenes.scenes, beautyScenes.scenes),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Shot-Generation-Report.md"),
      buildShotReport(techScenes.scenes),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Composition-Report.md"),
      buildCompositionReport(techScenes.scenes),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Scene-Readiness-Report.md"),
      buildReadinessReport(status, techScenes.scenes, fashionScenes.scenes, beautyScenes.scenes),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-8C-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, techScenes.scenes, fashionScenes.scenes, beautyScenes.scenes),
      "utf8"
    );

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);
    console.log("Reports written:");
    console.log(`  ${path.join(projectStateDir, "AI-Scene-Generation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Scene-Structure-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Shot-Generation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Scene-Composition-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Scene-Readiness-Report.md")}`);

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildMainReport(
  status: SceneGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: SceneGenerationRecord[],
  fashion?: SceneGenerationRecord[],
  beauty?: SceneGenerationRecord[]
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 8 Step 8C Scene Generation Report",
    "",
    `**Phase:** 8 — Video Generation Engine`,
    `**Step:** 8C — AI Scene Generation Engine`,
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    `**Permanent storage:** \`${DEFAULT_STORAGE_ROOT}\``,
    "",
    "## Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Scenes Generated** | ${status.scenesGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Generated Scenes",
    "",
    `- Technology: ${tech?.length ?? 0} scene blueprints`,
    `- Fashion: ${fashion?.length ?? 0} scene blueprints`,
    `- Beauty: ${beauty?.length ?? 0} scene blueprints`,
    "",
  ].join("\n");
}

function buildStructureReport(
  tech?: SceneGenerationRecord[],
  fashion?: SceneGenerationRecord[],
  beauty?: SceneGenerationRecord[]
): string {
  const lines = [
    "# Scene Structure Report — Step 8C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  for (const [label, scenes] of [
    ["Technology", tech],
    ["Fashion", fashion],
    ["Beauty", beauty],
  ] as const) {
    if (!scenes?.length) continue;
    lines.push(`## ${label} — ${scenes.length} scenes`, "");
    lines.push("| Order | Type | Purpose | Duration | Priority | Mood |", "|-------|------|---------|----------|----------|------|");
    for (const scene of scenes) {
      lines.push(
        `| ${scene.structure.sceneOrder} | ${scene.structure.sceneType} | ${scene.structure.scenePurpose} | ${scene.structure.sceneDuration} | ${scene.structure.scenePriority} | ${scene.structure.sceneMood} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildShotReport(scenes?: SceneGenerationRecord[]): string {
  const lines = [
    "# Shot Generation Report — Step 8C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
  ];

  if (!scenes?.length) return lines.join("\n");

  for (const scene of scenes.slice(0, 5)) {
    lines.push(`## Scene ${scene.structure.sceneOrder}: ${scene.structure.scenePurpose}`, "");
    lines.push("| Shot | Type | Angle | Movement | Focus | Duration |", "|------|------|-------|----------|-------|----------|");
    for (const shot of scene.shots) {
      lines.push(
        `| ${shot.shotOrder} | ${shot.shotType} | ${shot.cameraAngle} | ${shot.cameraMovement} | ${shot.focusPoint.slice(0, 25)}... | ${shot.shotDuration} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildCompositionReport(scenes?: SceneGenerationRecord[]): string {
  const lines = [
    "# Scene Composition Report — Step 8C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Scene | Composition | Lighting | Product | Logo | Typography |",
    "|-------|-------------|----------|---------|------|------------|",
  ];

  for (const scene of scenes?.slice(0, 8) ?? []) {
    const v = scene.visualPlan;
    lines.push(
      `| ${scene.structure.scenePurpose} | ${v.composition.slice(0, 20)}... | ${v.lighting.slice(0, 15)}... | ${v.productPlacement.slice(0, 20)}... | ${v.logoPlacement.slice(0, 15)}... | ${v.typographyPlacement.slice(0, 15)}... |`
    );
  }

  lines.push("");
  return lines.join("\n");
}

function buildReadinessReport(
  status: SceneGenerationEngineStatusReport,
  tech?: SceneGenerationRecord[],
  fashion?: SceneGenerationRecord[],
  beauty?: SceneGenerationRecord[]
): string {
  const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
  const avgQuality =
    all.length > 0 ? Math.round(all.reduce((s, r) => s + r.scores.sceneQualityScore, 0) / all.length) : 0;

  return [
    "# Scene Readiness Report — Step 8C",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    `**Average Scene Quality:** ${avgQuality}/100`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Scenes generated | ${status.scenesGenerated} |`,
    `| Avg production readiness | ${status.averageProductionReadinessScore}/100 |`,
    `| Production-ready scenes | ${all.filter((s) => s.productionReady).length}/${all.length} |`,
    `| Validated scenes | ${all.filter((s) => s.validated).length}/${all.length} |`,
    "",
    "## Performance",
    "",
    `- Average generation: ${status.performance.averageGenerationMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    `- Shot planning: ${status.shotPlanningStatus}`,
    "",
  ].join("\n");
}

void main();
