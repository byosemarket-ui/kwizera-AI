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
  CAMERA_PLATFORM_TARGETS,
  DirectorCameraAngle,
  DirectorShotType,
  type CameraDirectorEngineStatusReport,
  type CameraDirectorRecord,
} from "../ai/index.js";
import type { ProductAnalysisEngineInput } from "../ai/product-analysis-engine/types.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-camera-dir-"));
}

function ensureProjectStateDir(): string {
  const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SAMPLE_TECH: ProductAnalysisEngineInput = {
  productId: "step8d-kwizera-pro",
  productName: "KWIZERA Pro Studio",
  category: ProductAnalysisCategory.Software,
  subcategory: "creative-workstation",
  brand: "KWIZERA",
  description: "Professional AI-powered creative workstation for marketing teams",
  features: ["AI video generation", "brand consistency"],
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
  productId: "step8d-kwizera-jacket",
  productName: "KWIZERA Urban Jacket",
  category: ProductAnalysisCategory.Fashion,
  subcategory: "outerwear",
  brand: "KWIZERA",
  description: "Premium urban jacket for creators",
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
  productId: "step8d-glow-serum",
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

  return story.record.storyboardId;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const projectStateDir = ensureProjectStateDir();

  console.log("KWIZERA AI STUDIO — Step 8D Camera Director Engine Validation");
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
    await core.start("step-8d-validation");
    const initMs = Date.now() - initStart;

    const genFoundation = core.getManager().videoGenerationFoundation!;
    const cameraEngine = genFoundation.getCameraDirectorEngine();
    const piFoundation = core.getManager().productIntelligenceFoundation!;

    results.initialization = {
      passed: cameraEngine.isInitialized() && cameraEngine.isStartupComplete(),
      detail: cameraEngine.isStartupComplete()
        ? `Camera Director Engine ready in ${initMs}ms`
        : "Not initialized",
    };

    const registered = genFoundation.getRegistry().getModule("camera-planning-generation-engine");
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

    results.sceneUpstream = {
      passed: Boolean(techStoryboardId && fashionStoryboardId && beautyStoryboardId),
      detail: "Generated scenes prepared for camera direction",
    };

    const techPlans = await cameraEngine.planCamera({ storyboardId: techStoryboardId! });
    const fashionPlans = await cameraEngine.planCamera({ storyboardId: fashionStoryboardId! });
    const beautyPlans = await cameraEngine.planCamera({ storyboardId: beautyStoryboardId! });

    results.cameraPlanning = {
      passed: techPlans.success && fashionPlans.success && beautyPlans.success,
      detail: `Tech ${techPlans.plans?.length ?? 0}, Fashion ${fashionPlans.plans?.length ?? 0}, Beauty ${beautyPlans.plans?.length ?? 0} plans`,
    };

    const firstPlan = techPlans.plans?.[0];

    results.shotPlanning = {
      passed: (firstPlan?.shotPlans.length ?? 0) >= 1 &&
        firstPlan?.shotPlans.some((s) => s.shotType === DirectorShotType.Establishing || s.shotType === DirectorShotType.Medium),
      detail: `${firstPlan?.shotPlans.length} directed shots with type and framing`,
    };

    results.cameraAngles = {
      passed: firstPlan?.shotPlans.every((s) => s.cameraAngle) ?? false,
      detail: `Angles: ${[...new Set(firstPlan?.shotPlans.map((s) => s.cameraAngle))].join(", ")}`,
    };

    results.cameraMovements = {
      passed: firstPlan?.shotPlans.every((s) => s.cameraMovement) ?? false,
      detail: `Movements: ${[...new Set(firstPlan?.shotPlans.map((s) => s.cameraMovement))].join(", ")}`,
    };

    results.focusPlanning = {
      passed: Boolean(
        firstPlan?.focusPlanning.focusSubject &&
          firstPlan?.focusPlanning.depthOfField &&
          firstPlan?.focusPlanning.subjectPriority
      ),
      detail: "Focus subject, DOF, and subject priority defined",
    };

    results.compositionPlanning = {
      passed: Boolean(
        firstPlan?.compositionPlanning.primaryStrategy &&
          firstPlan?.compositionPlanning.ruleOfThirds &&
          firstPlan?.compositionPlanning.productHighlight &&
          firstPlan?.compositionPlanning.brandVisibility
      ),
      detail: `Strategy: ${firstPlan?.compositionPlanning.primaryStrategy}`,
    };

    results.continuity = {
      passed: firstPlan?.continuity.cameraConsistency === true &&
        firstPlan?.continuity.storyContinuity === true &&
        (firstPlan?.continuity.issues.length ?? 0) === 0,
      detail: `Continuity verified, ${firstPlan?.continuity.notes.length} notes`,
    };

    results.platformOptimization = {
      passed: (firstPlan?.platformOptimizations.length ?? 0) === CAMERA_PLATFORM_TARGETS.length,
      detail: `${firstPlan?.platformOptimizations.length}/${CAMERA_PLATFORM_TARGETS.length} platform optimizations`,
    };

    results.cameraScores = {
      passed:
        (firstPlan?.scores.cameraDirectionScore ?? 0) >= 55 &&
        (firstPlan?.scores.cinematicScore ?? 0) >= 50 &&
        (firstPlan?.scores.compositionScore ?? 0) >= 50 &&
        (firstPlan?.scores.storytellingScore ?? 0) >= 50 &&
        (firstPlan?.scores.productionReadinessScore ?? 0) >= 55 &&
        (firstPlan?.scores.aiConfidenceScore ?? 0) >= 55,
      detail: `Direction ${firstPlan?.scores.cameraDirectionScore}, cinematic ${firstPlan?.scores.cinematicScore}, confidence ${firstPlan?.scores.aiConfidenceScore}`,
    };

    results.relationships = {
      passed:
        (firstPlan?.relationships.scenes.length ?? 0) >= 1 &&
        (firstPlan?.relationships.storyboards.length ?? 0) >= 1 &&
        (firstPlan?.relationships.motionPlans.length ?? 0) >= 1,
      detail: `Scenes ${firstPlan?.relationships.scenes.length}, storyboards ${firstPlan?.relationships.storyboards.length}`,
    };

    results.productionReadiness = {
      passed: techPlans.plans?.every((p) => p.productionReady && p.validated) ?? false,
      detail: "All camera plans production-ready and validated",
    };

    results.brandConsistency = {
      passed: techPlans.plans?.every((p) => p.brandConsistent) ?? false,
      detail: "Brand consistency verified across camera plans",
    };

    results.cinematicConsistency = {
      passed: techPlans.plans?.every((p) => p.cinematicallyConsistent) ?? false,
      detail: "Cinematic continuity maintained",
    };

    const noScenes = await cameraEngine.planCamera({ storyboardId: "step8d-nonexistent" });
    results.incompleteRejection = {
      passed: !noScenes.success,
      detail: noScenes.message ?? "Rejected without generated scenes",
    };

    const repaired = await cameraEngine.repairCameraPlan(techStoryboardId!);
    results.automaticRepair = {
      passed: Boolean(repaired?.success),
      detail: repaired?.success ? "Camera plan repair verified" : "Repair failed",
    };

    const angleSearch = cameraEngine.searchCameraPlans({ cameraAngle: DirectorCameraAngle.EyeLevel });
    results.searchByAngle = {
      passed: angleSearch.length >= 1,
      detail: `${angleSearch.length} result(s) by camera angle`,
    };

    const shotSearch = cameraEngine.searchCameraPlans({ shotType: DirectorShotType.Medium });
    results.searchByShotType = {
      passed: shotSearch.length >= 1,
      detail: `${shotSearch.length} result(s) by shot type`,
    };

    const storyboardSearch = cameraEngine.searchCameraPlans({ storyboardId: techStoryboardId! });
    results.searchByStoryboard = {
      passed: storyboardSearch.length >= (techPlans.plans?.length ?? 1),
      detail: `${storyboardSearch.length} result(s) by storyboard`,
    };

    const keywordSearch = cameraEngine.searchCameraPlans({ keywords: "product" });
    results.searchByKeywords = {
      passed: keywordSearch.length >= 1,
      detail: `${keywordSearch.length} result(s) by keywords`,
    };

    const assetRegistered = genFoundation.getAssetRegistry().getAsset(firstPlan!.cameraPlanId);
    results.generationAssetRegistration = {
      passed: assetRegistered?.assetType === "camera-plan",
      detail: assetRegistered ? `Asset ${assetRegistered.assetId} registered` : "Not found",
    };

    const status = cameraEngine.buildStatusReport();
    results.performance = {
      passed: status.performance.averagePlanningMs < 120000,
      detail: `avg planning ${status.performance.averagePlanningMs}ms, search ${status.performance.averageSearchMs}ms`,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `camera-director-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    results.readiness = {
      passed: status.readinessScore >= 85,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    results.multiIndustry = {
      passed: fashionPlans.success && beautyPlans.success,
      detail: `Fashion ${fashionPlans.plans?.length} plans, Beauty ${beautyPlans.plans?.length} plans`,
    };

    await core.stop("step-8d-validation");

    const allPassed = Object.values(results).every((r) => r.passed);

    fs.writeFileSync(
      path.join(projectStateDir, "AI-Camera-Director-Report.md"),
      buildMainReport(status, results, storageRoot, allPassed, techPlans.plans, fashionPlans.plans, beautyPlans.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Planning-Report.md"),
      buildPlanningReport(techPlans.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Composition-Planning-Report.md"),
      buildCompositionReport(techPlans.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Continuity-Report.md"),
      buildContinuityReport(techPlans.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(projectStateDir, "Camera-Readiness-Report.md"),
      buildReadinessReport(status, techPlans.plans, fashionPlans.plans, beautyPlans.plans),
      "utf8"
    );
    fs.writeFileSync(
      path.join(process.cwd(), "STEP-8D-VALIDATION-REPORT.md"),
      buildMainReport(status, results, storageRoot, allPassed, techPlans.plans, fashionPlans.plans, beautyPlans.plans),
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
    console.log(`  ${path.join(projectStateDir, "AI-Camera-Director-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Camera-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Composition-Planning-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Camera-Continuity-Report.md")}`);
    console.log(`  ${path.join(projectStateDir, "Camera-Readiness-Report.md")}`);

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
  status: CameraDirectorEngineStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  tech?: CameraDirectorRecord[],
  fashion?: CameraDirectorRecord[],
  beauty?: CameraDirectorRecord[]
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 8 Step 8D Camera Director Report",
    "",
    `**Phase:** 8 — Video Generation Engine`,
    `**Step:** 8D — AI Camera Director Engine`,
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
    `| **Camera Plans Generated** | ${status.cameraPlansGenerated} |`,
    "",
    "## Validation Results",
    "",
    ...Object.entries(results).map(([k, r]) => `- **${k}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`),
    "",
    "## Camera Plans",
    "",
    `- Technology: ${tech?.length ?? 0} camera plans`,
    `- Fashion: ${fashion?.length ?? 0} camera plans`,
    `- Beauty: ${beauty?.length ?? 0} camera plans`,
    "",
  ].join("\n");
}

function buildPlanningReport(plans?: CameraDirectorRecord[]): string {
  const lines = ["# Camera Planning Report — Step 8D", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const plan of plans?.slice(0, 6) ?? []) {
    lines.push(`## ${plan.profile.sceneId}`, "");
    lines.push("| Shot | Type | Angle | Movement | Duration | Purpose |", "|------|------|-------|----------|----------|---------|");
    for (const shot of plan.shotPlans) {
      lines.push(`| ${shot.shotOrder} | ${shot.shotType} | ${shot.cameraAngle} | ${shot.cameraMovement} | ${shot.duration} | ${shot.marketingPurpose.slice(0, 30)}... |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildCompositionReport(plans?: CameraDirectorRecord[]): string {
  const lines = [
    "# Composition Planning Report — Step 8D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    "",
    "| Scene | Strategy | Rule of Thirds | Product Highlight | Brand Visibility |",
    "|-------|----------|----------------|-------------------|------------------|",
  ];
  for (const plan of plans?.slice(0, 8) ?? []) {
    const c = plan.compositionPlanning;
    lines.push(`| ${plan.profile.sceneId.slice(-20)} | ${c.primaryStrategy} | ✓ | ${c.productHighlight.slice(0, 25)}... | ${c.brandVisibility.slice(0, 25)}... |`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildContinuityReport(plans?: CameraDirectorRecord[]): string {
  const lines = ["# Camera Continuity Report — Step 8D", "", `**Date:** ${new Date().toISOString()}`, ""];
  for (const plan of plans?.slice(0, 6) ?? []) {
    const c = plan.continuity;
    lines.push(
      `## ${plan.profile.sceneId}`,
      "",
      `- Camera consistency: ${c.cameraConsistency ? "✅" : "❌"}`,
      `- Motion continuity: ${c.motionContinuity ? "✅" : "❌"}`,
      `- Lighting continuity: ${c.lightingContinuity ? "✅" : "❌"}`,
      `- Story continuity: ${c.storyContinuity ? "✅" : "❌"}`,
      `- Notes: ${c.notes.join("; ")}`,
      ""
    );
  }
  return lines.join("\n");
}

function buildReadinessReport(
  status: CameraDirectorEngineStatusReport,
  tech?: CameraDirectorRecord[],
  fashion?: CameraDirectorRecord[],
  beauty?: CameraDirectorRecord[]
): string {
  const all = [...(tech ?? []), ...(fashion ?? []), ...(beauty ?? [])];
  return [
    "# Camera Readiness Report — Step 8D",
    "",
    `**Date:** ${new Date().toISOString()}`,
    `**Engine Readiness:** ${status.readinessScore}/100`,
    `**Avg Direction Score:** ${status.averageCameraDirectionScore}/100`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Camera plans generated | ${status.cameraPlansGenerated} |`,
    `| Production-ready | ${all.filter((p) => p.productionReady).length}/${all.length} |`,
    `| Cinematically consistent | ${all.filter((p) => p.cinematicallyConsistent).length}/${all.length} |`,
    `| Brand consistent | ${all.filter((p) => p.brandConsistent).length}/${all.length} |`,
    "",
    "## Performance",
    "",
    `- Average planning: ${status.performance.averagePlanningMs}ms`,
    `- Average search: ${status.performance.averageSearchMs}ms`,
    "",
  ].join("\n");
}

void main();
