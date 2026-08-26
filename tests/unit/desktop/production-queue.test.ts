import { describe, expect, it, beforeEach, vi } from "vitest";
import { assembleMasterPackage } from "../../../desktop/master-intelligence/assemble.ts";
import type { MasterProductIntelligence } from "../../../desktop/master-intelligence/types.ts";
import type { ProductIntelligencePackage } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import { emptyFields } from "../../../desktop/product-profile/types.ts";
import type { MarketingProductionBrief } from "../../../desktop/marketing-input/types.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import { assembleMarketingStrategy } from "../../../desktop/marketing-strategy/assemble.ts";
import type { MasterMarketingStrategy } from "../../../desktop/marketing-strategy/types.ts";
import { assembleCreativeBlueprint } from "../../../desktop/creative-planner/assemble.ts";
import type { MasterCreativeBlueprint } from "../../../desktop/creative-planner/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import { assembleProductionPlan, buildProductionSnapshot } from "../../../desktop/production-plan/assemble.ts";
import type { Phase5ProductionHandoffPayload, ProductionSnapshot } from "../../../desktop/production-plan/types.ts";
import { PLAN_HANDOFF_KEY } from "../../../desktop/production-plan/types.ts";
import {
  applySmartQueue,
  assembleProductionJob,
  buildAiMeQueueExplanation,
  buildTaskGraph,
  checkAssetsFromPlan,
  classifyFailure,
  detectParallelGroups,
  discoverEngines,
  nextProductionId,
  validateSnapshot,
} from "../../../desktop/production-queue/assemble.ts";
import {
  ProductionQueueEngine,
  loadStep2PipelineHandoff,
} from "../../../desktop/production-queue/queue-engine.ts";
import { QUEUE_HANDOFF_KEY, QUEUE_MEMORY_KEY, QUEUE_STORE_KEY } from "../../../desktop/production-queue/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function makeProfile(): ProductProfile {
  return {
    version: 1,
    productId: "prod-1",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    fields: {
      ...emptyFields(),
      name: "Nike Air Max",
      brand: "Nike",
      category: "Shoes",
      materials: ["Leather"],
      features: ["Visible air unit"],
      benefits: ["Cushioned ride"],
      description: "Cushioned running shoe",
    },
    variants: [],
    aiDerived: [],
    history: [],
    productImageSet: null,
    completeness: { information: 90, images: 80, specifications: 80, overall: 85, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeIntel(): ProductIntelligencePackage {
  return {
    version: 1, intelligenceId: "pint-1", versionLabel: "1.0", versionNumber: 1, engineId: "test",
    projectId: "proj-1", productId: "prod-1", projectName: "Demo Shoes", productName: "Nike Air Max",
    visualAnalysisId: "vana-1", productionPackageRef: "pkg-1",
    identity: [], verifiedFacts: [], visualObservations: [], inferences: [],
    features: [{ id: "f1", field: "Sole", value: "Visible rubber sole", kind: "ai-observation", confidence: 0.91, band: "high", reason: "visual", evidence: [], reviewStatus: "pending" }],
    characteristics: [],
    differentiators: [{ id: "d1", field: "Look", value: "Distinct sole unit", kind: "ai-observation", confidence: 0.7, band: "medium", reason: "visual", evidence: [], reviewStatus: "pending" }],
    benefits: [
      { id: "b1", field: "Verified benefit", value: "Cushioned ride", kind: "verified", confidence: 1, band: "high", reason: "profile", evidence: [], reviewStatus: "pending" },
    ],
    unknown: [], variants: [], specificationChecks: [], logoTextChecks: [], crossValidation: [],
    consistency: { product: "consistent", images: "consistent", specifications: "consistent", variants: "consistent", note: "ok", confidence: 0.8 },
    coverage: [], coveragePercent: 80,
    scores: { identity: 98, visualUnderstanding: 90, specificationSupport: 80, imageCoverage: 80, consistency: 90, overall: 90, explanation: "t" },
    warnings: [], history: [], status: "complete", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeBrief(): MarketingProductionBrief {
  return {
    version: 1, marketingBriefId: "mb-1", projectId: "proj-1", productId: "prod-1", projectName: "Demo Shoes",
    productProfile: makeProfile(),
    fields: {
      ...emptyMarketingFields(),
      objective: "Direct Sales",
      audienceType: "Young professionals",
      customerNeeds: "Comfortable everyday footwear",
      buyingIntent: "Quality",
      platforms: ["TikTok", "Instagram"],
      contentFormat: "Social Media Ad",
      language: "English",
      tone: "Professional",
      cta: "Shop Now",
      promotionType: "None",
      duration: "short",
      voiceGender: "Female",
      voiceStyle: "Clear",
    },
    recommendations: [], conflicts: [], history: [],
    completeness: { objective: 1, audience: 1, platform: 1, language: 1, cta: 1, promotion: 1, overall: 1, missingRecommended: [] },
    validations: [], validationStatus: "valid", canContinue: true, continueBlockedReason: null, continueAnyway: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeImage(fileName: string, viewType: OrganizedImage["viewType"]): OrganizedImage {
  return {
    assetId: `a-${fileName}`, projectId: "proj-1", fileName, mimeType: "image/jpeg",
    width: 800, height: 800, fileSize: 1000, viewType, confidence: 0.9, roleInGroup: "primary",
    groupId: viewType, backgroundType: "White", visibilityStatus: "clear", needsReview: false,
    analysisFailed: false, userCorrected: false, qualityScore: 80, warnings: [], analyzedAt: new Date().toISOString(),
  };
}

function makeImageSet(): ProductImageSet {
  return {
    version: 1, projectId: "proj-1", projectName: "Demo Shoes", categoryEstimate: "Shoes",
    groups: [],
    images: [
      makeImage("front.jpg", "FRONT"),
      makeImage("detail-01.jpg", "DETAIL"),
      makeImage("back.jpg", "BACK"),
    ],
    missingViews: ["PACKAGING"], recommendedViews: ["PACKAGING"], coverageScore: 70, warnings: [],
    consistencyOk: true, analyzedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeMaster(): MasterProductIntelligence {
  const pkg = assembleMasterPackage({
    research: null, intel: makeIntel(), visual: null, profile: makeProfile(), brief: makeBrief(), production: null,
  });
  return { ...pkg, userConfirmed: true, status: "confirmed", phase3Complete: true, readyForContentProduction: true };
}

function makeStrategy(): MasterMarketingStrategy {
  const s = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
  return { ...s, userConfirmed: true, status: "confirmed", readyForCreativePlanning: true };
}

function makeBlueprint(): MasterCreativeBlueprint {
  const bp = assembleCreativeBlueprint({
    strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
  });
  return {
    ...bp,
    userConfirmed: true,
    status: "confirmed",
    readyForPreProduction: true,
    confirmedAt: new Date().toISOString(),
  };
}

function makeConfirmedSnapshot(): ProductionSnapshot {
  const blueprint = makeBlueprint();
  const strategy = makeStrategy();
  const master = makeMaster();
  const plan = assembleProductionPlan({
    blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
  });
  const confirmed = {
    ...plan,
    userConfirmed: true,
    status: "confirmed" as const,
    phase4Complete: true,
    readyForPhase5: true,
    confirmedAt: new Date().toISOString(),
  };
  return buildProductionSnapshot(confirmed, {
    blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
  });
}

function seedPhase5(store: Record<string, string>) {
  const snapshot = makeConfirmedSnapshot();
  const handoff: Phase5ProductionHandoffPayload = {
    version: 1,
    step: "phase-5-ai-production",
    phase4Complete: true,
    projectId: "proj-1",
    projectName: "Demo Shoes",
    snapshot,
    preparedAt: new Date().toISOString(),
  };
  store[PLAN_HANDOFF_KEY] = JSON.stringify(handoff);
  return snapshot;
}

describe("production queue assemble", () => {
  it("1–4. snapshot validation and job assembly", () => {
    const snapshot = makeConfirmedSnapshot();
    const validation = validateSnapshot(snapshot);
    expect(validation.valid).toBe(true);
    expect(validation.blocking).toHaveLength(0);
    const job = assembleProductionJob({
      snapshot,
      productionId: nextProductionId(1),
      aiCoreOnline: true,
      resourceHints: { cores: 8, deviceMemoryGb: 16, jsHeapMb: 120, diskUsedGb: 40, diskTotalGb: 200 },
    });
    expect(job.productionId).toMatch(/^PROD-\d{4}-0001$/);
    expect(job.snapshotId).toBe(snapshot.snapshotId);
    expect(job.status === "READY" || job.status === "BLOCKED").toBe(true);
    expect(job.totalTasks).toBeGreaterThan(5);
    expect(job.progress).toBe(0);
  });

  it("5–10. task graph, dependencies, parallel, assets, integrity, engines", () => {
    const snapshot = makeConfirmedSnapshot();
    const tasks = buildTaskGraph({ productionId: "PROD-2026-0001", snapshot, priority: "NORMAL" });
    expect(tasks.some((t) => t.taskType === "ASSET_IMPORT")).toBe(true);
    expect(tasks.some((t) => t.taskType === "EXPORT")).toBe(true);
    expect(tasks.every((t) => t.maxRetries === 3)).toBe(true);
    const assets = checkAssetsFromPlan(snapshot);
    expect(assets.some((a) => a.category === "Product Images")).toBe(true);
    const engines = discoverEngines(tasks, true);
    expect(engines.length).toBeGreaterThan(0);
    expect(engines.every((e) => e.modelVersion === "NOT CONFIGURED" || e.status === "AVAILABLE")).toBe(true);
    const queued = applySmartQueue(tasks, assets, engines);
    expect(queued.some((t) => t.status === "READY")).toBe(true);
    expect(queued.filter((t) => t.status === "READY" && t.dependencies.length === 0).length).toBeGreaterThan(0);
    const parallel = detectParallelGroups(queued);
    expect(Array.isArray(parallel)).toBe(true);
  });

  it("11–16. resources, storage, priority, order, smart queue, failures", () => {
    const snapshot = makeConfirmedSnapshot();
    const job = assembleProductionJob({
      snapshot,
      productionId: "PROD-2026-0002",
      priority: "HIGH",
      aiCoreOnline: true,
      resourceHints: { cores: 4, deviceMemoryGb: 8, jsHeapMb: 80, diskUsedGb: 10, diskTotalGb: 100 },
    });
    expect(job.priority).toBe("HIGH");
    expect(job.resources.some((r) => r.name === "CPU")).toBe(true);
    expect(job.resources.some((r) => r.name === "GPU" && r.status === "NOT DETECTED")).toBe(true);
    expect(job.storage.estimatedRequiredLabel).toBeTruthy();
    expect(job.executionOrder.length).toBe(job.totalTasks);
    expect(job.readyTasks).toBeGreaterThan(0);
    expect(classifyFailure("insufficient VRAM")).toBe("RESOURCE");
    expect(classifyFailure("engine not configured")).toBe("CONFIGURATION");
    expect(classifyFailure("dependency incomplete")).toBe("DEPENDENCY");
  });

  it("blocks when snapshot invalid", () => {
    const snapshot = makeConfirmedSnapshot();
    snapshot.plan.userConfirmed = false;
    const validation = validateSnapshot(snapshot);
    expect(validation.valid).toBe(false);
    const job = assembleProductionJob({ snapshot, productionId: "PROD-2026-0003", aiCoreOnline: true });
    expect(job.status).toBe("BLOCKED");
  });
});

describe("production queue engine", () => {
  beforeEach(() => { mockStorage(); });

  it("17–30. prepare, duplicate protection, readiness, events, autosave, AI Me, recovery, step 2 handoff", async () => {
    const store = mockStorage();
    seedPhase5(store);
    const events: Array<{ action?: string }> = [];
    const engine = new ProductionQueueEngine();
    engine.setAiCoreOnline(true);
    engine.setEventEmitter((_t, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const job = await engine.prepare();
    expect(job.status).toBe("READY");
    expect(job.readyForStep2).toBe(true);
    expect(JSON.parse(store[QUEUE_STORE_KEY]!)["proj-1"].current.productionId).toBe(job.productionId);
    expect(store[QUEUE_MEMORY_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "ProductionJobCreated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionSnapshotValidated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionQueueCreated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionJobReady")).toBe(true);

    const dup = await engine.prepare();
    expect(dup.productionId).toBe(job.productionId);

    const v2 = await engine.prepare({ forceNewVersion: true });
    expect(v2.productionId).not.toBe(job.productionId);
    expect(v2.versionLabel).toBe("v1.1");

    engine.setPriority("URGENT");
    expect(engine.snapshot().job?.priority).toBe("URGENT");

    engine.markReadyAcknowledged();
    const handoff = loadStep2PipelineHandoff();
    expect(handoff?.step).toBe("phase-5-step-2-pipeline-engine");
    expect(handoff?.productionId).toBe(engine.snapshot().job?.productionId);
    expect(store[QUEUE_HANDOFF_KEY]).toBeTruthy();
    expect(handoff?.note).toMatch(/Step 2/i);

    const ai = engine.buildAiMeContext();
    expect(ai.explanation).toMatch(/tasks|READY|Production job/i);
    expect(ai.explanation).toMatch(/not started/i);
    expect(buildAiMeQueueExplanation(engine.snapshot().job!)).toMatch(/Phase 5 Step 2/i);

    const engine2 = new ProductionQueueEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(engine2.snapshot().job?.productionId).toBeTruthy();
    expect(engine2.snapshot().job?.status).not.toBe("RUNNING");
  });

  it("refuses without Phase 4 handoff", () => {
    mockStorage();
    const engine = new ProductionQueueEngine();
    expect(engine.hydrate()).toBe(false);
  });
});
