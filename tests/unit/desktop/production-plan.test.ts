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
import { PLANNER_HANDOFF_KEY } from "../../../desktop/creative-planner/types.ts";
import type { Step3PreProductionHandoffPayload } from "../../../desktop/creative-planner/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import {
  assembleProductionPlan,
  auditTimeline,
  buildAiMePlanExplanation,
  buildAssetRequirements,
  bumpPlanVersion,
  detectMarketingConflicts,
  recalcAssets,
} from "../../../desktop/production-plan/assemble.ts";
import {
  ProductionPlanEngine,
  loadPhase5ProductionHandoff,
} from "../../../desktop/production-plan/plan-engine.ts";
import { PLAN_HANDOFF_KEY, PLAN_MEMORY_KEY, PLAN_SNAPSHOT_KEY, PLAN_STORE_KEY } from "../../../desktop/production-plan/types.ts";

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

function seedStep3(store: Record<string, string>) {
  const blueprint = makeBlueprint();
  const strategy = makeStrategy();
  const master = makeMaster();
  const handoff: Step3PreProductionHandoffPayload = {
    version: 1,
    step: "step-3-final-production-plan",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    blueprint,
    strategy,
    master,
    marketingBrief: makeBrief(),
    claimSafety: master.claimSafety,
    productionRestrictions: master.restrictions,
    preparedAt: new Date().toISOString(),
  };
  store[PLANNER_HANDOFF_KEY] = JSON.stringify(handoff);
  return { blueprint, strategy, master };
}

describe("production plan assemble", () => {
  it("1–6. project, product, marketing, creative, story, script integration", () => {
    const blueprint = makeBlueprint();
    const strategy = makeStrategy();
    const master = makeMaster();
    const plan = assembleProductionPlan({
      blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
    });
    expect(plan.projectId).toBe("proj-1");
    expect(plan.product.identity).toMatch(/Nike/i);
    expect(plan.project.campaignObjective).toMatch(/Direct Sales/i);
    expect(plan.project.cta).toBe("Shop Now");
    expect(plan.story.fullStory).toBeTruthy();
    expect(plan.script.length).toBe(plan.scenes.length);
    expect(plan.script.length).toBeGreaterThan(0);
  });

  it("7–10. scene timeline, duration, assets, mapping, missing", () => {
    const blueprint = makeBlueprint();
    const timeline = auditTimeline(blueprint.scenes, blueprint.targetDurationSec);
    expect(timeline.valid).toBe(true);
    expect(timeline.gaps).toHaveLength(0);
    expect(timeline.overlaps).toHaveLength(0);
    expect(timeline.totalDurationSec).toBeGreaterThan(0);
    const assets = buildAssetRequirements(blueprint);
    expect(assets.some((a) => a.assetType === "Product Images" && a.status === "AVAILABLE")).toBe(true);
    expect(assets.every((a) => a.status === "AVAILABLE" || a.status === "MISSING")).toBe(true);
    expect(assets.some((a) => a.fileName === "front.jpg" || a.status === "AVAILABLE")).toBe(true);
  });

  it("11–16. audio, visual, output, dependencies, claims, restrictions", () => {
    const blueprint = makeBlueprint();
    const strategy = makeStrategy();
    const master = makeMaster();
    const plan = assembleProductionPlan({
      blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
    });
    expect(plan.audio.note).toMatch(/not generate audio/i);
    expect(plan.audio.language).toBe("English");
    expect(plan.visual.cameraStyle).toBeTruthy();
    expect(plan.output.resolution).toBe("NOT CONFIGURED");
    expect(plan.dependencies.some((d) => d.name === "VOICE GENERATION")).toBe(true);
    expect(plan.dependencies.some((d) => d.name === "FINAL RENDER")).toBe(true);
    expect(Array.isArray(plan.claimAudit)).toBe(true);
    expect(Array.isArray(plan.restrictions)).toBe(true);
  });

  it("17–19. creative consistency, readiness score, readiness status", () => {
    const blueprint = makeBlueprint();
    const strategy = makeStrategy();
    const master = makeMaster();
    const plan = assembleProductionPlan({
      blueprint, strategy, master, brief: makeBrief(), claimSafety: master.claimSafety,
    });
    expect(plan.scores.overall).toBeGreaterThan(50);
    expect(plan.scores.explanation).toMatch(/Product|Marketing|Creative/i);
    expect(["READY", "READY WITH WARNINGS", "BLOCKED"]).toContain(plan.readiness);
    expect(plan.readiness).not.toBe("BLOCKED");
  });

  it("detects marketing configuration conflicts without silently changing settings", () => {
    const strategy = makeStrategy();
    strategy.objective.activeObjective = "Brand Awareness";
    strategy.cta.activeCta = "Buy Now";
    const conflicts = detectMarketingConflicts(strategy);
    expect(conflicts.some((c) => c.title === "MARKETING CONFIGURATION CONFLICT")).toBe(true);
  });
});

describe("production plan engine", () => {
  beforeEach(() => { mockStorage(); });

  it("20–31. review, confirm, versioning, snapshot, events, autosave, AI Me, recovery, incremental, handoff", async () => {
    const store = mockStorage();
    seedStep3(store);
    const events: Array<{ action?: string }> = [];
    const engine = new ProductionPlanEngine();
    engine.setEventEmitter((_t, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const draft = await engine.run();
    expect(draft.status).toBe("review");
    expect(draft.userConfirmed).toBe(false);
    expect(draft.phase4Complete).toBe(false);
    expect(JSON.parse(store[PLAN_STORE_KEY]!)["proj-1"].current.planId).toBe(draft.planId);
    expect(store[PLAN_MEMORY_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "MasterProductionPlanStarted")).toBe(true);
    expect(events.some((e) => e.action === "AssetRequirementCalculated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionReadinessCalculated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionPlanReviewOpened")).toBe(true);

    const ai = engine.buildAiMeContext();
    expect(ai.explanation).toMatch(/production-ready|READY|BLOCKED/i);
    expect(ai.explanation).toMatch(/not render|not generated|Phase 5 is not started/i);

    expect(draft.readiness).not.toBe("BLOCKED");
    const confirmed = engine.confirm();
    expect(confirmed.userConfirmed).toBe(true);
    expect(confirmed.phase4Complete).toBe(true);
    expect(confirmed.readyForPhase5).toBe(true);
    const handoff = loadPhase5ProductionHandoff();
    expect(handoff?.step).toBe("phase-5-ai-production");
    expect(handoff?.phase4Complete).toBe(true);
    expect(handoff?.snapshot.plan.planId).toBe(confirmed.planId);
    expect(store[PLAN_SNAPSHOT_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "ProductionPlanConfirmed")).toBe(true);
    expect(events.some((e) => e.action === "ProductionSnapshotCreated")).toBe(true);
    expect(events.some((e) => e.action === "ProductionPlanCompleted")).toBe(true);

    const v2 = await engine.run({ force: true });
    expect(v2.versionLabel).toBe("v1.1");
    expect(v2.userConfirmed).toBe(false);
    expect(bumpPlanVersion(confirmed).versionLabel).toBe("v1.1");

    const engine2 = new ProductionPlanEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(loadPhase5ProductionHandoff()?.phase4Complete).toBe(true);

    const incremental = recalcAssets(confirmed, makeBlueprint());
    expect(incremental.assets.length).toBeGreaterThan(0);
    expect(buildAiMePlanExplanation(confirmed)).toMatch(/Phase 5 is not started/i);
  });

  it("blocks confirm when readiness is BLOCKED", async () => {
    const store = mockStorage();
    const { blueprint } = seedStep3(store);
    blueprint.scenes = blueprint.scenes.map((s) => ({
      ...s,
      sourceAsset: { ...s.sourceAsset, status: "MISSING ASSET" as const, fileName: null, assetId: null },
      beat: s.beat === "PRODUCT_INTRO" || s.beat === "CTA" ? s.beat : s.beat,
    }));
    store[PLANNER_HANDOFF_KEY] = JSON.stringify({
      ...JSON.parse(store[PLANNER_HANDOFF_KEY]!),
      blueprint: {
        ...blueprint,
        scenes: blueprint.scenes.map((s) =>
          s.beat === "PRODUCT_INTRO" || s.beat === "CTA"
            ? { ...s, sourceAsset: { status: "MISSING ASSET", fileName: null, assetId: null, viewType: null, recommendation: "request-new", note: "MISSING" } }
            : s),
      },
    });
    const engine = new ProductionPlanEngine();
    engine.hydrate();
    const draft = await engine.run();
    expect(draft.readiness).toBe("BLOCKED");
    expect(() => engine.confirm()).toThrow(/BLOCKED/);
    expect(loadPhase5ProductionHandoff()).toBeNull();
  });

  it("refuses without confirmed creative blueprint", () => {
    mockStorage();
    const engine = new ProductionPlanEngine();
    expect(engine.hydrate()).toBe(false);
  });
});
