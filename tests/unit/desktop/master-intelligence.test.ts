import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  assembleMasterPackage,
  buildAiMeMasterExplanation,
  buildClaimSafety,
  buildVerifiedFacts,
  classificationRank,
  mapLayerKind,
  nextVersionLabel,
  preferHigherPriority,
} from "../../../desktop/master-intelligence/assemble.ts";
import {
  MasterIntelligenceEngine,
  loadContentProductionHandoff,
} from "../../../desktop/master-intelligence/master-engine.ts";
import {
  MASTER_HANDOFF_KEY,
  MASTER_STORE_KEY,
  MASTER_MEMORY_KEY,
} from "../../../desktop/master-intelligence/types.ts";
import { RESEARCH_HANDOFF_KEY } from "../../../desktop/market-research/types.ts";
import type { Step4CreativeBriefHandoffPayload, ResearchPackage } from "../../../desktop/market-research/types.ts";
import type { ProductIntelligencePackage } from "../../../desktop/deep-intelligence/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import { emptyFields } from "../../../desktop/product-profile/types.ts";
import type { MasterProductIntelligence, ClassifiedItem } from "../../../desktop/master-intelligence/types.ts";

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
      subcategory: "Running Shoes",
      model: "Air Max",
      price: 120,
      currency: "USD",
      description: "Cushioned running shoe",
      materials: ["Leather"],
      colors: ["Black"],
      sizes: ["42"],
      features: ["Visible air unit"],
      benefits: ["Cushioned ride"],
      highlights: ["Iconic silhouette"],
      warranty: "1 year",
      sku: "NK-AM-01",
      specifications: { Sole: "Rubber" },
    },
    variants: [{ id: "v1", kind: "color", label: "Color", values: ["Black"] }],
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
    productId: "proj-1",
    projectName: "Demo Shoes",
    productName: "Nike Air Max",
    visualAnalysisId: "vana-1",
    productionPackageRef: "pkg-1",
    identity: [],
    verifiedFacts: [
      { id: "1", field: "Category", value: "Shoes", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
      { id: "2", field: "Brand", value: "Nike", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
      { id: "3", field: "Colors", value: "Black", kind: "verified", confidence: 1, band: "high", reason: "", evidence: [], reviewStatus: "pending" },
    ],
    visualObservations: [
      { id: "o1", field: "Sole appearance", value: "Rubber-like sole visible", kind: "ai-observation", confidence: 0.91, band: "high", reason: "visual", evidence: [], reviewStatus: "pending" },
    ],
    inferences: [
      { id: "i1", field: "Material guess", value: "May be synthetic leather", kind: "ai-inference", confidence: 0.4, band: "low", reason: "inference", evidence: [], reviewStatus: "pending" },
    ],
    features: [
      { id: "f1", field: "Sole", value: "Visible rubber sole", kind: "ai-observation", confidence: 0.91, band: "high", reason: "visual", evidence: [], reviewStatus: "pending" },
    ],
    characteristics: [],
    differentiators: [
      { id: "d1", field: "Look", value: "Distinct sole unit", kind: "ai-observation", confidence: 0.7, band: "medium", reason: "visual", evidence: [], reviewStatus: "pending" },
    ],
    benefits: [
      { id: "b1", field: "Verified benefit", value: "Cushioned ride", kind: "verified", confidence: 1, band: "high", reason: "profile", evidence: [], reviewStatus: "pending" },
      { id: "b2", field: "AI-inferred benefit", value: "May provide additional grip", kind: "ai-inference", confidence: 0.55, band: "low", reason: "inference", evidence: [], reviewStatus: "pending" },
    ],
    unknown: [
      { id: "u1", field: "Waterproof", value: "Unknown", kind: "ai-inference", confidence: 0.2, band: "low", reason: "no evidence", evidence: [], reviewStatus: "pending" },
    ],
    variants: [],
    specificationChecks: [],
    logoTextChecks: [],
    crossValidation: [
      {
        id: "cx1",
        field: "Material",
        userValue: "Leather",
        visualValue: "May be synthetic leather",
        mark: "conflict",
        confidence: 0.4,
        detail: "AI inference conflicts with user material",
        reviewStatus: "pending",
      },
    ],
    consistency: { product: "consistent", images: "consistent", specifications: "consistent", variants: "consistent", note: "ok", confidence: 0.8 },
    coverage: [
      { view: "FRONT", need: "required", status: "available" },
      { view: "PACKAGING", need: "recommended", status: "missing" },
      { view: "BOTTOM", need: "optional", status: "missing" },
    ],
    coveragePercent: 80,
    scores: { identity: 98, visualUnderstanding: 95, specificationSupport: 90, imageCoverage: 80, consistency: 90, overall: 93, explanation: "test" },
    warnings: [],
    history: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeResearch(): ResearchPackage {
  return {
    version: 1,
    researchId: "res-1",
    versionLabel: "1.0",
    versionNumber: 1,
    engineId: "test",
    projectId: "proj-1",
    productId: "proj-1",
    projectName: "Demo Shoes",
    productName: "Nike Air Max",
    internetAvailable: false,
    researchMode: "offline",
    workingLanguage: "en",
    queries: [{ id: "q1", text: "running shoe comfort", objective: "customer" }],
    sources: [{
      id: "s1",
      url: "local://knowledge/mbp",
      title: "Local customer psychology",
      sourceType: "local-knowledge",
      domain: "local",
      publishedAt: null,
      retrievedAt: new Date().toISOString(),
      quality: "HIGH",
      query: "comfort",
      extracted: "Comfort and durability are common purchase considerations",
      relevance: 0.8,
      confidence: 0.8,
      action: "keep",
    }],
    knowledge: [],
    productKnowledge: [{
      id: "k1",
      topic: "Comfort",
      claim: "Comfort is a common purchase consideration in this category",
      kind: "market-insight",
      sourceId: "s1",
      sourceQuality: "HIGH",
      confidence: 0.8,
      createdAt: new Date().toISOString(),
      lastVerified: null,
      freshness: "RECENT",
      objective: "customer",
      productRelevance: true,
      marketRelevance: true,
      customerRelevance: true,
      tags: ["comfort"],
    }],
    customerInsights: [{
      id: "c1", label: "Target Audience", detail: "Runners seeking cushioning", kind: "market-insight",
      confidence: 0.75, evidenceLevel: "medium", sourceOrReason: "local knowledge", reviewed: false,
    }],
    marketInsights: [],
    competitiveInsights: [{
      id: "comp1", label: "Common positioning", detail: "Competitors emphasize comfort and style", kind: "market-insight",
      confidence: 0.6, evidenceLevel: "low", sourceOrReason: "category pack", reviewed: false,
    }],
    painPoints: [{
      id: "p1", label: "Pain Point", detail: "Hard landings on pavement", kind: "market-insight",
      confidence: 0.7, evidenceLevel: "medium", sourceOrReason: "local knowledge", reviewed: false,
    }],
    desires: [],
    motivations: [],
    objections: [],
    audienceRefinement: "",
    marketingAngles: [{
      id: "a1",
      name: "Cushioned daily run",
      customerProblem: "Hard landings",
      productBenefit: "Cushioned ride",
      supportingEvidence: "User benefit + category insight",
      audience: "Runners",
      suggestedMessage: "Cushion for daily miles — only if claim-safe",
      confidence: 0.7,
      sourceIds: ["s1"],
      verificationFlag: null,
    }],
    platformNotes: [],
    localKnowledgeAge: "MBP catalog",
    insufficientMarketData: true,
    noLocalKnowledge: false,
    history: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function seedHandoff(store: Record<string, string>) {
  const profile = makeProfile();
  const intel = makeIntel();
  const research = makeResearch();
  const handoff: Step4CreativeBriefHandoffPayload = {
    version: 1,
    step: "step-4-master-intelligence-report",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    research,
    masterIntelligence: intel,
    productionPackage: null,
    productProfile: profile,
    marketingBrief: null,
    preparedAt: new Date().toISOString(),
  };
  store[RESEARCH_HANDOFF_KEY] = JSON.stringify(handoff);
  return { profile, intel, research };
}

describe("master intelligence assemble", () => {
  it("1. consolidates product identity without inventing missing values", () => {
    const profile = makeProfile();
    profile.fields.subcategory = "";
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile,
      brief: null,
      production: null,
    });
    expect(pkg.identity.name).toBe("Nike Air Max");
    expect(pkg.identity.brand).toBe("Nike");
    expect(pkg.identity.category).toBe("Shoes");
    expect(pkg.identity.subcategory).toBe("");
  });

  it("2. preserves verified facts from Product Profile", () => {
    const facts = buildVerifiedFacts(makeProfile(), makeIntel());
    expect(facts.materials).toEqual(["Leather"]);
    expect(facts.price).toBe(120);
    expect(facts.description).toBe("Cushioned running shoe");
  });

  it("3–6. consolidates visual features, differentiators, benefits with classification", () => {
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
    });
    expect(pkg.features.some((f) => f.value === "Visible air unit" && f.classification === "USER PROVIDED")).toBe(true);
    expect(pkg.features.some((f) => f.value === "Visible rubber sole" && f.classification === "VISUAL OBSERVATION")).toBe(true);
    expect(pkg.differentiators.some((d) => d.classification === "VERIFIED DIFFERENTIATOR")).toBe(true);
    expect(pkg.differentiators.some((d) => d.classification === "MARKETING RECOMMENDATION")).toBe(true);
    expect(pkg.benefits.some((b) => b.benefit === "Cushioned ride" && b.classification === "VERIFIED FACT")).toBe(true);
    expect(pkg.benefits.some((b) => b.classification === "AI INFERENCE")).toBe(true);
  });

  it("7–10. consolidates customer, market, competitive, marketing insights", () => {
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
    });
    expect(pkg.customerIntelligence.length).toBeGreaterThan(0);
    expect(pkg.marketIntelligence.some((m) => m.label === "MARKET DATA INSUFFICIENT")).toBe(true);
    expect(pkg.competitiveIntelligence.length).toBeGreaterThan(0);
    expect(pkg.marketingInsights.some((m) => m.classification === "AI RECOMMENDATION")).toBe(true);
    expect(pkg.productKnowledge.some((k) => k.freshness === "RECENT")).toBe(true);
  });

  it("11–12. generates creative direction and content opportunities without storyboard", () => {
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
    });
    expect(pkg.creativeDirection.note).toMatch(/CREATIVE BRIEF/i);
    expect(pkg.creativeDirection.storyDirection).not.toMatch(/scene 1/i);
    expect(pkg.contentOpportunities.length).toBeGreaterThanOrEqual(5);
  });

  it("13–15. claim safety, restrictions, missing information", () => {
    const profile = makeProfile();
    const intel = makeIntel();
    const facts = buildVerifiedFacts(profile, intel);
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel,
      visual: null,
      profile,
      brief: null,
      production: null,
    });
    const claims = buildClaimSafety({
      facts,
      benefits: pkg.benefits,
      features: pkg.features,
      differentiators: pkg.differentiators,
      intel,
    });
    expect(claims.some((c) => c.claim.includes("Leather") && c.status === "SAFE / VERIFIED")).toBe(true);
    expect(claims.some((c) => c.claim === "Waterproof" && c.status === "UNVERIFIED")).toBe(true);
    expect(claims.some((c) => c.status === "DO NOT USE")).toBe(true);
    expect(pkg.restrictions.length).toBeGreaterThan(0);
    expect(pkg.missingInformation.some((m) => m.severity === "RECOMMENDED" && /packag/i.test(m.detail))).toBe(true);
    expect(pkg.missingInformation.some((m) => m.severity === "OPTIONAL" && /bottom/i.test(m.detail))).toBe(true);
  });

  it("16–19. source registry, freshness, confidence, master score", () => {
    const pkg = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
    });
    expect(pkg.sources[0]?.title).toMatch(/customer/i);
    expect(pkg.sectionConfidence.overall).toBeGreaterThan(0);
    expect(pkg.scores.overall).toBeGreaterThan(0);
    expect(pkg.scores.explanation).toMatch(/diagnostic/i);
  });

  it("source priority never lets AI overwrite user material", () => {
    const user: ClassifiedItem = {
      id: "1", label: "Material", value: "Leather", classification: "USER PROVIDED",
      source: "Profile", evidence: "user", confidence: 1,
    };
    const ai: ClassifiedItem = {
      id: "2", label: "Material", value: "Synthetic leather", classification: "AI INFERENCE",
      source: "AI", evidence: "guess", confidence: 0.9,
    };
    expect(preferHigherPriority(user, ai).value).toBe("Leather");
    expect(classificationRank("USER PROVIDED")).toBeLessThan(classificationRank("AI INFERENCE"));
    expect(mapLayerKind("ai-observation")).toBe("VISUAL OBSERVATION");
  });
});

describe("master intelligence engine", () => {
  beforeEach(() => {
    mockStorage();
  });

  it("20–27. AI Me, review, confirm, versioning, autosave, events, recovery, package", async () => {
    const store = mockStorage();
    seedHandoff(store);
    const events: Array<{ type: string; action?: string }> = [];
    const engine = new MasterIntelligenceEngine();
    engine.setEventEmitter((type, payload) => {
      events.push({ type, action: typeof payload.action === "string" ? payload.action : undefined });
    });

    expect(engine.hydrate()).toBe(true);
    const draft = await engine.run();
    expect(draft.status).toBe("review");
    expect(draft.userConfirmed).toBe(false);
    expect(draft.phase3Complete).toBe(false);
    expect(JSON.parse(store[MASTER_STORE_KEY]!)["proj-1"].current.masterId).toBe(draft.masterId);
    expect(store[MASTER_MEMORY_KEY]).toBeTruthy();
    expect(events.some((e) => e.action === "MasterIntelligenceCompilationStarted")).toBe(true);
    expect(events.some((e) => e.action === "ClaimSafetyGenerated")).toBe(true);
    expect(events.some((e) => e.action === "CreativeBriefGenerated")).toBe(true);
    expect(events.some((e) => e.action === "MasterIntelligenceReviewOpened")).toBe(true);

    const ai = engine.buildAiMeContext();
    expect(ai.explanation).toMatch(/leather/i);
    expect(ai.explanation).toMatch(/Safe claims|Avoid|Missing/i);

    const confirmed = engine.confirm();
    expect(confirmed.userConfirmed).toBe(true);
    expect(confirmed.phase3Complete).toBe(true);
    expect(confirmed.readyForContentProduction).toBe(true);
    expect(loadContentProductionHandoff()?.step).toBe("ready-for-content-production");
    expect(events.some((e) => e.action === "MasterIntelligenceConfirmed")).toBe(true);
    expect(events.some((e) => e.action === "MasterIntelligenceCompleted")).toBe(true);

    const v2 = await engine.run({ force: true });
    expect(v2.versionNumber).toBeGreaterThan(confirmed.versionNumber);
    expect(v2.userConfirmed).toBe(false);
    expect(nextVersionLabel(confirmed).versionLabel).toBe(`v${confirmed.versionNumber + 1}.0`);

    // recovery after interruption: hydrate restores stored package
    const engine2 = new MasterIntelligenceEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(engine2.snapshot().package?.masterId).toBeTruthy();
  });

  it("28–30. next-phase handoff, large package integrity, project/product IDs", async () => {
    const store = mockStorage();
    seedHandoff(store);
    const engine = new MasterIntelligenceEngine();
    await engine.run();
    const confirmed = engine.confirm();
    const handoff = loadContentProductionHandoff();
    expect(handoff?.phase3Complete).toBe(true);
    expect(handoff?.master.projectId).toBe("proj-1");
    expect(handoff?.master.productId).toBe("prod-1");
    expect(handoff?.research?.researchId).toBe("res-1");
    expect(handoff?.deepIntelligence?.intelligenceId).toBe("pint-1");
    expect(confirmed.refs.researchId).toBe("res-1");
    expect(confirmed.refs.deepIntelligenceId).toBe("pint-1");
    expect(buildAiMeMasterExplanation(confirmed)).toMatch(/not yet confirmed|User confirmed/i);
  });
});

describe("master package versioning helper", () => {
  it("does not silently reuse confirmed package version numbers", () => {
    const base = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
    });
    const confirmed: MasterProductIntelligence = {
      ...base,
      userConfirmed: true,
      status: "confirmed",
      versionLabel: "v1.0",
      versionNumber: 1,
    };
    const next = assembleMasterPackage({
      research: makeResearch(),
      intel: makeIntel(),
      visual: null,
      profile: makeProfile(),
      brief: null,
      production: null,
      previous: confirmed,
    });
    expect(next.versionNumber).toBe(2);
    expect(next.versionLabel).toBe("v2.0");
    expect(next.userConfirmed).toBe(false);
  });
});
