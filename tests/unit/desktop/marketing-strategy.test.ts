import { describe, expect, it, beforeEach, vi } from "vitest";
import { assembleMasterPackage } from "../../../desktop/master-intelligence/assemble.ts";
import type { MasterProductIntelligence } from "../../../desktop/master-intelligence/types.ts";
import { MASTER_HANDOFF_KEY } from "../../../desktop/master-intelligence/types.ts";
import type { ContentProductionHandoffPayload } from "../../../desktop/master-intelligence/types.ts";
import type { ProductIntelligencePackage } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import { emptyFields } from "../../../desktop/product-profile/types.ts";
import type { MarketingProductionBrief } from "../../../desktop/marketing-input/types.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import {
  assembleMarketingStrategy,
  buildAiMeStrategyExplanation,
  bumpStrategyVersion,
  evaluateCta,
  recommendObjective,
} from "../../../desktop/marketing-strategy/assemble.ts";
import {
  MarketingStrategyEngine,
  loadStep2CreativePlannerHandoff,
} from "../../../desktop/marketing-strategy/strategy-engine.ts";
import { STRATEGY_HANDOFF_KEY, STRATEGY_STORE_KEY, STRATEGY_MEMORY_KEY } from "../../../desktop/marketing-strategy/types.ts";

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
      colors: ["Black"],
      features: ["Visible air unit"],
      benefits: ["Cushioned ride"],
      highlights: ["Iconic silhouette"],
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
    version: 1,
    intelligenceId: "pint-1",
    versionLabel: "1.0",
    versionNumber: 1,
    engineId: "test",
    projectId: "proj-1",
    productId: "prod-1",
    projectName: "Demo Shoes",
    productName: "Nike Air Max",
    visualAnalysisId: "vana-1",
    productionPackageRef: "pkg-1",
    identity: [],
    verifiedFacts: [],
    visualObservations: [],
    inferences: [],
    features: [
      { id: "f1", field: "Sole", value: "Visible rubber sole", kind: "ai-observation", confidence: 0.91, band: "high", reason: "visual", evidence: [], reviewStatus: "pending" },
    ],
    characteristics: [],
    differentiators: [
      { id: "d1", field: "Look", value: "Distinct sole unit", kind: "ai-observation", confidence: 0.7, band: "medium", reason: "visual", evidence: [], reviewStatus: "pending" },
    ],
    benefits: [
      { id: "b1", field: "Verified benefit", value: "Cushioned ride", kind: "verified", confidence: 1, band: "high", reason: "profile", evidence: [], reviewStatus: "pending" },
      { id: "b2", field: "AI-inferred", value: "May provide grip", kind: "ai-inference", confidence: 0.4, band: "low", reason: "inference", evidence: [], reviewStatus: "pending" },
    ],
    unknown: [],
    variants: [],
    specificationChecks: [],
    logoTextChecks: [],
    crossValidation: [],
    consistency: { product: "consistent", images: "consistent", specifications: "consistent", variants: "consistent", note: "ok", confidence: 0.8 },
    coverage: [],
    coveragePercent: 80,
    scores: { identity: 98, visualUnderstanding: 90, specificationSupport: 80, imageCoverage: 80, consistency: 90, overall: 90, explanation: "t" },
    warnings: [],
    history: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeBrief(overrides?: Partial<ReturnType<typeof emptyMarketingFields>>): MarketingProductionBrief {
  return {
    version: 1,
    marketingBriefId: "mb-1",
    projectId: "proj-1",
    productId: "prod-1",
    projectName: "Demo Shoes",
    productProfile: makeProfile(),
    fields: {
      ...emptyMarketingFields(),
      objective: "Direct Sales",
      audienceType: "Young professionals",
      ageRange: "25-34",
      location: "Kigali",
      interests: ["running"],
      customerNeeds: "Comfortable everyday footwear",
      buyingIntent: "Quality",
      platforms: ["Instagram", "TikTok"],
      language: "English",
      tone: "Professional",
      cta: "Shop Now",
      promotionType: "None",
      mood: "Modern",
      energy: "Measured",
      ...overrides,
    },
    recommendations: [],
    conflicts: [],
    history: [],
    completeness: { objective: 1, audience: 1, platform: 1, language: 1, cta: 1, promotion: 1, overall: 1, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    continueAnyway: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeMaster(): MasterProductIntelligence {
  const pkg = assembleMasterPackage({
    research: null,
    intel: makeIntel(),
    visual: null,
    profile: makeProfile(),
    brief: makeBrief(),
    production: null,
  });
  return { ...pkg, userConfirmed: true, status: "confirmed", phase3Complete: true, readyForContentProduction: true };
}

function seedPhase3(store: Record<string, string>, brief = makeBrief()) {
  const master = makeMaster();
  const handoff: ContentProductionHandoffPayload = {
    version: 1,
    step: "ready-for-content-production",
    phase3Complete: true,
    projectId: "proj-1",
    projectName: "Demo Shoes",
    master,
    research: null,
    deepIntelligence: makeIntel(),
    visualAnalysis: null,
    productionPackage: null,
    productProfile: makeProfile(),
    marketingBrief: brief,
    preparedAt: new Date().toISOString(),
  };
  store[MASTER_HANDOFF_KEY] = JSON.stringify(handoff);
  return { master, brief };
}

describe("marketing strategy assemble", () => {
  it("1–5. objective, audience, problem, desire, motivation", () => {
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
    expect(pkg.objective.userObjective).toBe("Direct Sales");
    expect(pkg.objective.activeObjective).toBe("Direct Sales");
    expect(pkg.audience.primaryAudience).toMatch(/Young professionals/);
    expect(pkg.audience.ageRange).toBe("25-34");
    expect(pkg.audience.location).toBe("Kigali");
    expect(pkg.customerProblem.detail).toBe("Comfortable everyday footwear");
    expect(pkg.customerProblem.classification).toBe("USER PROVIDED");
    expect(pkg.customerDesire.length).toBeGreaterThan(0);
    expect(pkg.buyingMotivations[0]?.motivation).toBe("Quality");
    expect(pkg.buyingMotivations[0]?.classification).toBe("USER PROVIDED");
  });

  it("does not invent missing demographics", () => {
    const brief = makeBrief({ ageRange: "", location: "", gender: "" });
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief });
    expect(pkg.audience.ageRange).toBe("UNKNOWN / NOT PROVIDED");
    expect(pkg.audience.location).toBe("UNKNOWN / NOT PROVIDED");
  });

  it("6–12. positioning, value, USP, angles, primary, message", () => {
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
    expect(pkg.positioning.thisProduct).toBe("Nike Air Max");
    expect(pkg.positioning.whoNeed).toMatch(/Comfortable/);
    expect(pkg.valueProposition.statement).toMatch(/Nike Air Max/);
    expect(pkg.uspCandidates.length).toBeGreaterThan(0);
    expect(pkg.uspCandidates.every((u) => !u.superiorityClaim || /do not use/i.test(u.statement))).toBe(true);
    expect(pkg.angles.length).toBeGreaterThanOrEqual(5);
    expect(pkg.primaryAngleId).toBeTruthy();
    expect(pkg.message.note).toMatch(/not a final script/i);
    expect(pkg.message.ctaMessage).toBe("Shop Now");
  });

  it("13–20. benefits, platform, language, voice, CTA, promotion, competitive, content, creative", () => {
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
    expect(pkg.benefits.some((b) => b.role === "PRIMARY" && b.classification === "VERIFIED")).toBe(true);
    expect(pkg.benefits.some((b) => b.classification === "AI RECOMMENDATION")).toBe(true);
    expect(pkg.platforms.map((p) => p.platform)).toEqual(["Instagram", "TikTok"]);
    expect(pkg.languageVoice.language).toBe("English");
    expect(pkg.languageVoice.communicationStyle).toMatch(/Professional/);
    expect(pkg.languageVoice.note).toMatch(/script/i);
    expect(pkg.cta.userCta).toBe("Shop Now");
    expect(pkg.promotion.status).toBe("NO PROMOTION CONFIGURED");
    expect(pkg.competitive.note).toMatch(/not copy/i);
    expect(pkg.contentDirection.primary).toBeTruthy();
    expect(pkg.creative.note).toMatch(/not a storyboard/i);
  });

  it("21–23. claim safety, risks, confidence", () => {
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
    expect(pkg.claims.approved.some((c) => /Leather|Nike Air Max|Cushioned/i.test(c.claim))).toBe(true);
    expect(pkg.risks.some((r) => r.title === "Promotion inconsistency")).toBe(false);
    const promoObj = assembleMarketingStrategy({
      master: makeMaster(),
      brief: makeBrief({ objective: "Promotion", promotionType: "None" }),
    });
    expect(promoObj.risks.some((r) => /Promotion inconsistency/i.test(r.title))).toBe(true);
    expect(pkg.confidence.overall).toBeGreaterThan(0);
    expect(pkg.confidence.explanation).toMatch(/diagnostic/i);
  });

  it("CTA and objective recommendations never overwrite the user", () => {
    expect(recommendObjective("Direct Sales", "None").recommendation).toBeNull();
    const cta = evaluateCta(makeBrief({ objective: "Brand Awareness", cta: "Buy Now" }), "Brand Awareness", true);
    expect(cta.userCta).toBe("Buy Now");
    expect(cta.activeCta).toBe("Buy Now");
    expect(cta.aiRecommendation).toBe("Learn More");
    expect(cta.recDecision).toBe("kept-user");
  });
});

describe("marketing strategy engine", () => {
  beforeEach(() => {
    mockStorage();
  });

  it("24–33. AI Me, review, confirm, versioning, autosave, events, package, step 2 handoff, IDs, recovery", async () => {
    const store = mockStorage();
    seedPhase3(store);
    const events: Array<{ action?: string }> = [];
    const engine = new MarketingStrategyEngine();
    engine.setEventEmitter((_type, payload) => {
      events.push({ action: typeof payload.action === "string" ? payload.action : undefined });
    });

    expect(engine.hydrate()).toBe(true);
    const draft = await engine.run();
    expect(draft.status).toBe("review");
    expect(draft.userConfirmed).toBe(false);
    expect(JSON.parse(store[STRATEGY_STORE_KEY]!)["proj-1"].current.strategyId).toBe(draft.strategyId);
    expect(store[STRATEGY_MEMORY_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "MarketingStrategyStarted")).toBe(true);
    expect(events.some((e) => e.action === "AudienceStrategyGenerated")).toBe(true);
    expect(events.some((e) => e.action === "PrimaryAngleSelected")).toBe(true);
    expect(events.some((e) => e.action === "MarketingStrategyReviewed")).toBe(true);

    const alt = draft.angles.find((a) => a.id !== draft.primaryAngleId)!;
    engine.setPrimaryAngle(alt.id);
    expect(engine.snapshot().package?.primaryAngleId).toBe(alt.id);

    engine.keepMySettings();
    expect(engine.snapshot().package?.objective.activeObjective).toBe("Direct Sales");

    const ai = engine.buildAiMeContext();
    expect(ai.explanation).toMatch(/Direct Sales/);
    expect(ai.explanation).toMatch(/Young professionals/);
    expect(ai.explanation).toMatch(/not a script/i);

    const confirmed = engine.confirm();
    expect(confirmed.userConfirmed).toBe(true);
    expect(confirmed.readyForCreativePlanning).toBe(true);
    const handoff = loadStep2CreativePlannerHandoff();
    expect(handoff?.step).toBe("step-2-story-script-creative-planner");
    expect(handoff?.strategy.projectId).toBe("proj-1");
    expect(handoff?.strategy.productId).toBe("prod-1");
    expect(handoff?.master?.masterId).toBeTruthy();
    expect(handoff?.marketingBrief?.marketingBriefId).toBe("mb-1");
    expect(handoff?.claimSafety).toBeDefined();
    expect(events.some((e) => e.action === "MarketingStrategyConfirmed")).toBe(true);
    expect(events.some((e) => e.action === "MarketingStrategyCompleted")).toBe(true);

    const v2 = await engine.run({ force: true });
    expect(v2.versionLabel).toBe("v1.1");
    expect(v2.userConfirmed).toBe(false);
    expect(bumpStrategyVersion(confirmed).versionLabel).toBe("v1.1");

    const engine2 = new MarketingStrategyEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(engine2.snapshot().package?.strategyId).toBeTruthy();
    expect(loadStep2CreativePlannerHandoff()?.step).toBe("step-2-story-script-creative-planner");
  });

  it("refuses to start without confirmed Phase 3 master", () => {
    mockStorage();
    const engine = new MarketingStrategyEngine();
    expect(engine.hydrate()).toBe(false);
  });
});

describe("AI Me explanation", () => {
  it("distinguishes facts from recommendations", () => {
    const pkg = assembleMarketingStrategy({ master: makeMaster(), brief: makeBrief() });
    const text = buildAiMeStrategyExplanation(pkg);
    expect(text).toMatch(/Direct Sales/);
    expect(text).toMatch(/Value proposition/);
    expect(text).toMatch(/Recommendations do not overwrite/);
  });
});
