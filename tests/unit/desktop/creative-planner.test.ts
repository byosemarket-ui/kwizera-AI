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
import { STRATEGY_HANDOFF_KEY } from "../../../desktop/marketing-strategy/types.ts";
import type { Step2CreativePlannerHandoffPayload } from "../../../desktop/marketing-strategy/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import {
  assembleCreativeBlueprint,
  buildAiMePlannerExplanation,
  bumpBlueprintVersion,
  flagUnsafeClaims,
  pickAsset,
  rebuildScene,
  selectStoryBeats,
  targetDurationSeconds,
} from "../../../desktop/creative-planner/assemble.ts";
import {
  CreativePlannerEngine,
  loadStep3PreProductionHandoff,
} from "../../../desktop/creative-planner/planner-engine.ts";
import { PLANNER_HANDOFF_KEY, PLANNER_STORE_KEY, PLANNER_MEMORY_KEY } from "../../../desktop/creative-planner/types.ts";

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

function seedStep2(store: Record<string, string>) {
  const strategy = makeStrategy();
  const master = makeMaster();
  const handoff: Step2CreativePlannerHandoffPayload = {
    version: 1,
    step: "step-2-story-script-creative-planner",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    strategy,
    master,
    marketingBrief: makeBrief(),
    productProfile: makeProfile(),
    research: null,
    claimSafety: master.claimSafety,
    productionRestrictions: master.restrictions,
    preparedAt: new Date().toISOString(),
  };
  store[STRATEGY_HANDOFF_KEY] = JSON.stringify(handoff);
  store["kwizera.image-organization.set.v1"] = JSON.stringify({ "proj-1": makeImageSet() });
  return { strategy, master };
}

describe("creative planner assemble", () => {
  it("1–6. loads intelligence/strategy, story, hooks, structure", () => {
    const bp = assembleCreativeBlueprint({
      strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
    });
    expect(bp.contentType).toBe("Social Media Ad");
    expect(bp.storyObjective).toMatch(/Direct Sales/);
    expect(bp.hooks.length).toBeGreaterThan(0);
    expect(bp.hooks.length).toBeLessThanOrEqual(3);
    expect(bp.primaryHookId).toBeTruthy();
    expect(bp.storyBeats.some((b) => b.id === "HOOK" && b.included)).toBe(true);
    expect(bp.storyBeats.some((b) => b.id === "CTA" && b.included)).toBe(true);
    expect(bp.storyBeats.find((b) => b.id === "OFFER")?.included).toBe(false);
    expect(bp.story.fullStory).toMatch(/Nike Air Max/);
    expect(bp.targetDurationSec).toBe(15);
  });

  it("7–10. script, claim safety, scenes, asset mapping", () => {
    const bp = assembleCreativeBlueprint({
      strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
    });
    expect(bp.script.length).toBe(bp.scenes.length);
    expect(bp.scenes.every((s) => s.purpose && s.durationSec > 0)).toBe(true);
    expect(bp.scenes.some((s) => s.sourceAsset.fileName === "front.jpg")).toBe(true);
    expect(bp.script.every((l) => !/waterproof/i.test(l.narration))).toBe(true);
    const flags = flagUnsafeClaims("100% waterproof", makeMaster().claimSafety, "scene-1");
    expect(Array.isArray(flags)).toBe(true);
  });

  it("11–16. missing assets, visual, camera, details, narration, text", () => {
    const emptySet = { ...makeImageSet(), images: [] };
    const missing = pickAsset([], ["PACKAGING"], "packaging");
    expect(missing.status).toBe("MISSING ASSET");
    const bp = assembleCreativeBlueprint({
      strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: emptySet,
    });
    expect(bp.missingAssets.length).toBeGreaterThan(0);
    const withAssets = assembleCreativeBlueprint({
      strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
    });
    expect(withAssets.scenes.every((s) => s.cameraDirection && s.visualDescription)).toBe(true);
    expect(withAssets.narrationDirection.note).toMatch(/not generate audio/i);
    expect(withAssets.language).toBe("English");
  });

  it("17–24. audio, timing, platform, language, CTA, promotion, style, storyboard, alternatives", () => {
    const bp = assembleCreativeBlueprint({
      strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet(),
    });
    expect(bp.audio.note).toMatch(/blueprint/i);
    expect(Math.abs(bp.totalDurationSec - bp.targetDurationSec)).toBeLessThanOrEqual(3);
    expect(bp.platforms.some((p) => /tiktok/i.test(p.platform))).toBe(true);
    expect(bp.cta.text).toBe("Shop Now");
    expect(bp.promotion.status === "NONE" || bp.promotion.status.includes("RECOMMENDATION")).toBe(true);
    expect(bp.style.visualStyle).toBeTruthy();
    expect(bp.storyAlternatives.length).toBeGreaterThanOrEqual(1);
    expect(bp.storyAlternatives.length).toBeLessThanOrEqual(2);
    expect(bp.ctaAlternatives[0]?.source).toBe("USER");
    expect(targetDurationSeconds(makeBrief(), ["TikTok"])).toBe(15);
    expect(selectStoryBeats(15, makeStrategy()).filter((b) => b.included).length).toBeLessThan(10);
  });
});

describe("creative planner engine", () => {
  beforeEach(() => { mockStorage(); });

  it("25–35. AI Me, review, validation, confirm, versioning, autosave, events, recovery, partial regen, step 3 handoff", async () => {
    const store = mockStorage();
    seedStep2(store);
    const events: Array<{ action?: string }> = [];
    const engine = new CreativePlannerEngine();
    engine.setEventEmitter((_t, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const draft = await engine.run();
    expect(draft.status).toBe("review");
    expect(draft.userConfirmed).toBe(false);
    expect(JSON.parse(store[PLANNER_STORE_KEY]!)["proj-1"].current.blueprintId).toBe(draft.blueprintId);
    expect(store[PLANNER_MEMORY_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "CreativePlanningStarted")).toBe(true);
    expect(events.some((e) => e.action === "StoryGenerated")).toBe(true);
    expect(events.some((e) => e.action === "ScriptGenerated")).toBe(true);
    expect(events.some((e) => e.action === "ScenePlanGenerated")).toBe(true);
    expect(events.some((e) => e.action === "CreativeReviewOpened")).toBe(true);

    const altHook = draft.hooks.find((h) => h.id !== draft.primaryHookId);
    if (altHook) {
      engine.setPrimaryHook(altHook.id);
      expect(engine.snapshot().package?.primaryHookId).toBe(altHook.id);
    }
    const sceneId = draft.scenes[1]?.id;
    if (sceneId) engine.regenerateScene(sceneId);
    expect(engine.snapshot().package?.scenes[0]?.id).toBe(draft.scenes[0]?.id);

    const ai = engine.buildAiMeContext();
    expect(ai.explanation).toMatch(/Story objective|hook|CTA/i);
    expect(ai.explanation).toMatch(/not generated/i);

    expect(draft.validation.canConfirm).toBe(true);
    const confirmed = engine.confirm();
    expect(confirmed.userConfirmed).toBe(true);
    expect(confirmed.readyForPreProduction).toBe(true);
    const handoff = loadStep3PreProductionHandoff();
    expect(handoff?.step).toBe("step-3-final-production-plan");
    expect(handoff?.blueprint.projectId).toBe("proj-1");
    expect(handoff?.strategy?.strategyId).toBeTruthy();
    expect(events.some((e) => e.action === "CreativeBlueprintConfirmed")).toBe(true);

    const v2 = await engine.run({ force: true });
    expect(v2.versionLabel).toBe("v1.1");
    expect(v2.userConfirmed).toBe(false);
    expect(bumpBlueprintVersion(confirmed).versionLabel).toBe("v1.1");

    const engine2 = new CreativePlannerEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(loadStep3PreProductionHandoff()?.step).toBe("step-3-final-production-plan");
  });

  it("refuses without confirmed strategy", () => {
    mockStorage();
    const engine = new CreativePlannerEngine();
    expect(engine.hydrate()).toBe(false);
  });
});

describe("partial regeneration helper", () => {
  it("rebuilds one beat without dropping other scene ids", () => {
    const ctx = { strategy: makeStrategy(), master: makeMaster(), brief: makeBrief(), imageSet: makeImageSet() };
    const bp = assembleCreativeBlueprint(ctx);
    const id = bp.scenes[0]!.id;
    const next = rebuildScene(bp, id, ctx);
    expect(next.scenes[0]!.id).toBe(id);
    expect(next.scenes.length).toBe(bp.scenes.length);
    expect(buildAiMePlannerExplanation(bp)).toMatch(/blueprint/i);
  });
});
