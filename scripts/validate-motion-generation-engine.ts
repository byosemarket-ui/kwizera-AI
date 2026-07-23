import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  CreativePlatform,
  MarketingObjective,
  MotionType,
  MOTION_PLATFORM_TARGETS,
  ProductAnalysisCategory,
  ProductAvailabilityStatus,
  ProductBusinessType,
  ProductUnderstandingMarketingGoal,
  StoryboardGenerationPlatform,
  type MotionGenerationEngineStatusReport,
  type MotionGenerationRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-motion-gen-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step8e-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation",
  features: ["AI video generation"],
  specifications: { license: "pro" },
  materials: ["digital-license"],
  price: 299.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "technology" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.B2B,
  tags: ["software"],
  keywords: ["kwizera"],
};

const SAMPLE_FASHION: ProductAnalysisEngineInput = {
  productId: "step8e-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium urban jacket",
  features: ["water-resistant"],
  specifications: { fabric: "cotton-blend" },
  materials: ["cotton"],
  price: 129.99,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "fashion" as ProductAnalysisEngineInput["industry"],
  businessType: ProductBusinessType.D2C,
  tags: ["fashion"],
  keywords: ["jacket"],
};

const SAMPLE_BEAUTY: ProductAnalysisEngineInput = {
  productId: "step8e-glow-serum",
  productName: "Radiance Vitamin C Serum",
  category: ProductAnalysisCategory.Beauty,
  subcategory: "skincare",
  brand: "GlowLab",
  description: "Clinical-grade vitamin C serum",
  features: ["vitamin-c"],
  specifications: { volume: "30ml" },
  materials: ["glass-bottle"],
  price: 45.0,
  currency: "USD",
  availability: ProductAvailabilityStatus.InStock,
  industry: "beauty" as ProductAnalysisEngineInput["industry"],
  tags: ["beauty"],
  keywords: ["serum"],
};

async function prepareFullPipeline(
  piFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["productIntelligenceFoundation"]>,
  genFoundation: NonNullable<ReturnType<ReturnType<typeof createAiCore>["getManager"]>["videoGenerationFoundation"]>,
  sample: ProductAnalysisEngineInput,
  objective: MarketingObjective,
  platform: CreativePlatform,
  genPlatform: StoryboardGenerationPlatform
): Promise<string | undefined> {
  await piFoundation.getProductAnalysisEngine().analyzeProduct(sample);
  await piFoundation.getProductUnderstandingEngine().understandProduct({
    productId: sample.productId!,
    marketingGoal: ProductUnderstandingMarketingGoal.Conversion,
  });
  await piFoundation.getTargetAudienceIntelligenceEngine().analyzeAudience({ productId: sample.productId! });
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

  const story = await genFoundation.getStoryGenerationEngine().generateStoryboard({
    productId: sample.productId!,
    platform: genPlatform,
  });
  if (!story.record) return undefined;

  const scenes = await genFoundation.getSceneGenerationEngine().generateScenes({
    storyboardId: story.record.storyboardId,
  });
  if (!scenes.success) return undefined;

  const camera = await genFoundation.getCameraDirectorEngine().planCamera({
    storyboardId: story.record.storyboardId,
  });
  if (!camera.success) return undefined;

  return story.record.storyboardId;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 8E Motion Generation Engine Validation");
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
    await core.start("step-8e-validation");
    const initMs = Date.now() - initStart;

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const motionEngine = genFoundation.getMotionGenerationEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: motionEngine.isInitialized() && motionEngine.isStartupComplete(),
      detail: motionEngine.isStartupComplete()
        ? `Motion Generation Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = genFoundation.getRegistry().getModule("motion-planning-generation-engine");
    results.moduleRegistration = {
      passed: registered?.implemented === true && registered.status === "active",
      detail: `Module ${registered?.status}, v${registered?.version}, quality ${registered?.qualityScore}`,
    };

    const techStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_TECH, MarketingObjective.ProductLaunch,
      CreativePlatform.YouTube, StoryboardGenerationPlatform.YouTubeLongForm
    );
    const fashionStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_FASHION, MarketingObjective.ProductPromotion,
      CreativePlatform.InstagramReels, StoryboardGenerationPlatform.InstagramReels
    );
    const beautyStoryboardId = await prepareFullPipeline(
      piFoundation, genFoundation, SAMPLE_BEAUTY, MarketingObjective.BrandAwareness,
      CreativePlatform.TikTok, StoryboardGenerationPlatform.TikTok
    );

    results.cameraUpstream = {
      passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
      detail: "Camera plans prepared for motion generation",
    };

    const techMotion = await motionEngine.generateMotionPlans({ storyboardId: techStoryboardId! });
    const fashionMotion = await motionEngine.generateMotionPlans({ storyboardId: fashionStoryboardId! });
    const beautyMotion = await motionEngine.generateMotionPlans({ storyboardId: beautyStoryboardId! });

    results.motionPlanning = {
      passed: techMotion.success && fashionMotion.success && beautyMotion.success,
      detail: `Tech ${techMotion.plans?.length ?? 0}, Fashion ${fashionMotion.plans?.length ?? 0}, Beauty ${beautyMotion.plans?.length ?? 0} plans`,
    };

    const firstPlan = techMotion.plans?.[0];

    results.characterMotion = {
      passed: Boolean(
        firstPlan?.characterMotion.gestures &&
          firstPlan?.characterMotion.facialExpressions &&
          firstPlan?.characterMotion.bodyLanguage
      ),
      detail: `Primary: ${firstPlan?.characterMotion.primaryAction}`,
    };

    results.productMotion = {
      passed: Boolean(
        firstPlan?.productMotion.rotation &&
          firstPlan?.productMotion.reveal &&
          firstPlan?.productMotion.placement
      ),
      detail: `Primary: ${firstPlan?.productMotion.primaryAction}`,
    };

    results.objectMotion = {
      passed: Boolean(
        firstPlan?.objectMotion.entry &&
          firstPlan?.objectMotion.physicsBasedMotion &&
          firstPlan?.objectMotion.collisionPlanning
      ),
      detail: `Primary: ${firstPlan?.objectMotion.primaryAction}`,
    };

    results.cameraSynchronization = {
      passed: (firstPlan?.cameraSynchronization.syncPoints.length ?? 0) >= 1 &&
        Boolean(firstPlan?.cameraSynchronization.cameraMovement && firstPlan?.cameraSynchronization.sceneTiming),
      detail: `${firstPlan?.cameraSynchronization.syncPoints.length} sync points`,
    };

    results.motionTiming = {
      passed: Boolean(
        firstPlan?.motionTiming.motionStart &&
          firstPlan?.motionTiming.motionEnd &&
          firstPlan?.motionTiming.motionSpeed
      ),
      detail: `Duration ${firstPlan?.motionTiming.motionDuration}, speed ${firstPlan?.motionTiming.motionSpeed}`,
    };

    results.motionContinuity = {
      passed: firstPlan?.continuity.sceneContinuity === true &&
        firstPlan?.continuity.storyContinuity === true &&
        (firstPlan?.continuity.issues.length ?? 0) === 0,
      detail: "Scene, camera, and story continuity verified",
    };

    results.environmentMotion = {
      passed: (firstPlan?.environmentMotion.activeEffects.length ?? 0) >= 1,
      detail: `Effects: ${firstPlan?.environmentMotion.activeEffects.join(", ")}`,
    };

    results.platformOptimization = {
      passed: (firstPlan?.platformOptimizations.length ?? 0) === MOTION_PLATFORM_TARGETS.length,
      detail: `${firstPlan?.platformOptimizations.length}/${MOTION_PLATFORM_TARGETS.length} platform optimizations`,
    };

    results.motionScores = {
      passed:
        (firstPlan?.scores.motionQualityScore ?? 0) >= 55 &&
        (firstPlan?.scores.smoothnessScore ?? 0) >= 50 &&
        (firstPlan?.scores.cinematicScore ?? 0) >= 50 &&
        (firstPlan?.scores.physicsConsistencyScore ?? 0) >= 50 &&
        (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
        (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Quality ${firstPlan?.scores.motionQualityScore}, smoothness ${firstPlan?.scores.smoothnessScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (firstPlan?.relationships.scenes.length ?? 0) >= 1 &&
        (firstPlan?.relationships.cameraPlans.length ?? 0) >= 1 &&
        (firstPlan?.relationships.storyboards.length ?? 0) >= 1,
      detail: `Scenes ${firstPlan?.relationships.scenes.length}, camera ${firstPlan?.relationships.cameraPlans.length}`,
    };

    results.productionReadiness = {
      passed: techMotion.plans?.every((p) => p.productionReady && p.validated) ?? false,
      detail: "All motion plans production-ready and validated",
    };

    results.physicsConsistency = {
      passed: techMotion.plans?.every((p) => p.physicallyConsistent) ?? false,
      detail: "Physically consistent motion verified",
    };

    results.cinematicConsistency = {
      passed: techMotion.plans?.every((p) => p.cinematicallyConsistent) ?? false,
      detail: "Cinematic continuity maintained",
    };

    const noUpstream = await motionEngine.generateMotionPlans({ storyboardId: "step8e-nonexistent" });
    results.incompleteRejection = {
      passed: !noUpstream.success,
      detail: noUpstream.message ?? "Rejected without camera plans and scenes",
    };

    const repaired = await motionEngine.repairMotionPlans(techStoryboardId!);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Motion plan repair verified" : "Repair failed",
    };

    const typeSearch = motionEngine.searchMotionPlans({ motionType: MotionType.Combined });
    results.searchByMotionType = {
      passed: typeSearch.length >= 1,
      detail: `${typeSearch.length} result(s) by motion type`,
    };

    const storyboardSearch = motionEngine.searchMotionPlans({ storyboardId: techStoryboardId! });
    results.searchByStoryboard = {
      passed: storyboardSearch.length >= (techMotion.plans?.length ?? 1),
      detail: `${storyboardSearch.length} result(s) by storyboard`,
    };

    const keywordSearch = motionEngine.searchMotionPlans({ keywords: "product" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan!.motionPlanId);
    results.generationAssetRegistration = {
      passed: assetRegistered?.assetType === "motion-plan",
      detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
    };

    const status = motionEngine.buildStatusReport();
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg planning ${status.performance.averagePlanningMs}ms, sync ${status.performance.averageSyncMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `motion-generation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashionMotion.success && beautyMotion.success,
      detail: `Fashion ${fashionMotion.plans?.length} plans, Beauty ${beautyMotion.plans?.length} plans`,
    };

    await core.stop("step-8e-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Motion-Generation-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, techMotion.plans, fashionMotion.plans, beautyMotion.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Character-Motion-Report.md"),
      buildCharacterReport(techMotion.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Product-Motion-Report.md"),
      buildProductReport(techMotion.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Synchronization-Report.md"),
      buildSyncReport(techMotion.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Motion-Readiness-Report.md"),
      buildReadinessReport(status, techMotion.plans, fashionMotion.plans, beautyMotion.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-8E-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, techMotion.plans, fashionMotion.plans, beautyMotion.plans),
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
    console.log(`  ${path.join(projectStateDir, "AI-Motion-Generation-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Character-Motion-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Product-Motion-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Motion-Synchronization-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Motion-Readiness-Report.md")}`);

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
  status: MotionGenerationEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: MotionGenerationRecord[],
  fashion?: MotionGenerationRecord[],
  beauty?: MotionGenerationRecord[]
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 8 Step 8E Motion Generation Report",
    "",
    `**Phase:** 8 — Video Generation Engine`,
    `**Step:** 8E — AI Motion Generation Engine`,
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
    `| **Motion Plans Generated** | ${status.motionPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Motion Plans",
    "",
    `- Technology: ${tech?.length ?? 0} motion plans`,
    `- Fashion: ${fashion?.length ?? 0} motion plans`,
    `- Beauty: ${beauty?.length ?? 0} motion plans`,
    "",
  ].join("\n");
}

function buildCharacterReport(plans?: MotionGenerationRecord[]): string {
  const lines = ["# Character Motion Report — Step 8E", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const plan of plans?.slice(0, 6) ?? []) {
    const c = plan.characterMotion;
    lines.push(`## ${plan.profile.sceneId}`, "", `- Gestures: ${c.gestures.slice(0, 60)}...`, `- Expression: ${c.facialExpressions}`, `- Body language: ${c.bodyLanguage}`, `- Interaction: ${c.interaction.slice(0, 60)}...`, "");
  }
  return lines.join("\n");
}

function buildProductReport(plans?: MotionGenerationRecord[]): string {
  const lines = [
    "# Product Motion Report — Step 8E",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Scene | Primary | Rotation | Reveal | Showcase |",
    "|-------|---------|----------|--------|----------|",
  ];
  for (const plan of plans?.slice(0, 8) ?? []) {
    const p = plan.productMotion;
    lines.push(`| ${plan.profile.sceneId.slice(-24)} | ${p.primaryAction} | ${p.rotation.slice(0, 20)}... | ${p.reveal.slice(0, 20)}... | ${p.showcaseMotion.slice(0, 20)}... |`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildSyncReport(plans?: MotionGenerationRecord[]): string {
  const lines = ["# Motion Synchronization Report — Step 8E", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const plan of plans?.slice(0, 6) ?? []) {
    const s = plan.cameraSynchronization;
    lines.push(
      `## ${plan.profile.sceneId}`,
      "",
      `- Camera: ${s.cameraMovement}`,
      `- Character: ${s.characterMovement}`,
      `- Product: ${s.productMovement}`,
      `- Timing: ${s.sceneTiming}`,
      `- Sync points: ${s.syncPoints.join("; ")}`,
      ""
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: MotionGenerationEngineStatusReport,
  tech?: MotionGenerationRecord[],
  fashion?: MotionGenerationRecord[],
  beauty?: MotionGenerationRecord[]
): string {
  const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
  return [
    "# Motion Readiness Report — Step 8E",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    `**Avg Motion Quality:** ${status.averageMotionQualityScore}/100`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Motion plans | ${status.motionPlansGenerated} |`,
    `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
    `| Physically consistent | ${all.filter((p) => p.physicallyConsistent).length}/${all.length} |`,
    `| Cinematically consistent | ${all.filter((p) => p.cinematicallyConsistent).length}/${all.length} |`,
    "",
    "## Performance",
    "",
    `- Average planning: ${status.performance.averagePlanningMs}ms`,
    `- Average sync: ${status.performance.averageSyncMs}ms`,
    "",
  ].join("\n");
}

void main();
