import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  assembleIntelligence,
  buildBenefits,
  buildCrossValidation,
  buildDifferentiators,
  buildIdentity,
  buildInferences,
  buildLogoTextChecks,
  buildObservations,
  buildSpecChecks,
  buildUnknown,
  buildVariantChecks,
  buildVerifiedFacts,
  computeScores,
  valuesAgree,
} from "../../../desktop/deep-intelligence/assemble.ts";
import { DeepIntelligenceEngine, loadStep3MarketIntelHandoff } from "../../../desktop/deep-intelligence/deep-intelligence-engine.ts";
import { INTEL_HANDOFF_KEY, INTEL_STORE_KEY } from "../../../desktop/deep-intelligence/types.ts";
import { VISUAL_HANDOFF_KEY, VISUAL_STORE_KEY } from "../../../desktop/visual-analysis/types.ts";
import type { VisualProductAnalysisPackage, ImageVisualResult } from "../../../desktop/visual-analysis/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import type { ProductionInputPackage } from "../../../desktop/product-validation/types.ts";
import type { Step2DeepIntelHandoffPayload } from "../../../desktop/visual-analysis/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function emptyProductFields() {
  return {
    name: "", brand: "", model: "", sku: "", barcode: "", category: "", subcategory: "",
    price: null as number | null, originalPrice: null as number | null, discount: null as number | null,
    currency: "RWF", costPrice: null as number | null, promotionPrice: null as number | null, priceNotes: "",
    shortDescription: "", description: "", highlights: [] as string[], features: [] as string[], benefits: [] as string[],
    materials: [] as string[], colors: [] as string[], sizes: [] as string[], dimensions: "", weight: "",
    warranty: "", stock: "", countryOfOrigin: "", additionalNotes: "", specifications: {} as Record<string, string>,
  };
}

function makeImage(overrides: Partial<OrganizedImage> = {}): OrganizedImage {
  return {
    assetId: "img-1", projectId: "proj-1", fileName: "front-black.jpg", mimeType: "image/jpeg",
    width: 1920, height: 2400, fileSize: 120_000, url: "/x.jpg", viewType: "FRONT", confidence: 0.95,
    roleInGroup: "primary", groupId: "view-FRONT", backgroundType: "studio", visibilityStatus: "clear",
    needsReview: false, analysisFailed: false, userCorrected: false, qualityScore: 90, warnings: [],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImageSet(images: OrganizedImage[]): ProductImageSet {
  return {
    version: 1, projectId: "proj-1", projectName: "Demo Shoes", categoryEstimate: "Shoes",
    groups: [], images, missingViews: ["BOTTOM"], recommendedViews: ["FRONT", "BACK", "BOTTOM"],
    coverageScore: 80, warnings: [], consistencyOk: true,
    analyzedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeProfile(overrides: Partial<ProductProfile["fields"]> = {}): ProductProfile {
  const imageSet = makeImageSet([makeImage()]);
  return {
    version: 1, productId: "proj-1", projectId: "proj-1", projectName: "Demo Shoes",
    fields: {
      ...emptyProductFields(),
      name: "Nike Air Max", brand: "Nike", category: "Shoes", model: "Air Max",
      price: 45000, currency: "RWF", colors: ["Black", "White", "Brown"], materials: ["Leather"],
      sizes: ["42"], benefits: ["Cushioned ride"], features: ["Air unit"], dimensions: "30cm",
      specifications: { closure: "Laces" },
      ...overrides,
    },
    variants: [{ id: "c1", kind: "color", label: "Colors", values: ["Black", "White", "Brown"] }],
    aiDerived: [], history: [], productImageSet: imageSet,
    completeness: { information: 90, images: 80, specifications: 70, overall: 85, missingRecommended: [] },
    validations: [], validationStatus: "valid", canContinue: true, continueBlockedReason: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

function makeVisualResult(overrides: Partial<ImageVisualResult> = {}): ImageVisualResult {
  return {
    assetId: "img-1", fileName: "front-black.jpg", url: "/x.jpg", width: 1920, height: 2400,
    viewType: "FRONT", viewConfidence: 0.95,
    productDetection: { detected: true, confidence: 0.97, visibilityPercent: 94, mainProduct: "Nike Air Max", obstruction: "None", needsReview: false },
    background: { type: "White Studio", complexity: "low", separation: "Excellent", removalSuitability: "high", confidence: 0.9 },
    colors: [{ name: "Black", role: "primary", confidence: 0.96 }, { name: "White", role: "secondary", confidence: 0.91 }],
    logo: { present: true, possibleBrand: "Nike", location: "Side", confidence: 0.9 },
    detectedText: [{ text: "Nike", kind: "brand", confidence: 0.85 }],
    quality: { classification: "GOOD", score: 90, sharpness: "Good", lighting: "Good", blur: "Low", resolutionNote: "1920 × 2400", confidence: 0.88 },
    lighting: { exposure: "Good", shadows: "Moderate", highlights: "Controlled", productVisibility: "Excellent" },
    visibility: { percent: 94, framing: "Good", cutoff: false, obstruction: "Low", status: "good", confidence: 0.88 },
    composition: "Centered", visualFeatures: ["Footwear silhouette", "Laces", "Sole"],
    failed: false, reviewStatus: "pending", analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeVisual(profile: ProductProfile): VisualProductAnalysisPackage {
  const images = [makeVisualResult(), makeVisualResult({ assetId: "img-2", fileName: "detail-sole.jpg", viewType: "DETAIL", visualFeatures: ["Sole", "Stitching / texture"] })];
  return {
    version: 1, analysisId: "vana-1", projectId: "proj-1", productId: "proj-1", projectName: "Demo Shoes",
    productName: "Nike Air Max", engineId: "local-image-evidence-analyzer",
    productionPackageRef: "pkg-1", productImageSet: profile.productImageSet, productProfile: profile,
    images,
    categoryCheck: { profileCategory: "Shoes", visualEstimate: "Shoes", confidence: 0.9, conflict: false },
    consistency: { consistent: true, confidence: 0.88, note: "ok" },
    coverage: [
      { view: "FRONT", need: "required", status: "available" },
      { view: "BACK", need: "recommended", status: "available" },
      { view: "BOTTOM", need: "recommended", status: "missing" },
      { view: "DETAIL", need: "recommended", status: "available" },
    ],
    coveragePercent: 75,
    aggregate: {
      productDetectionAvg: 0.97, primaryColor: "Black", secondaryColor: "White",
      logoDetected: true, textDetected: true, qualityGoodCount: 2, needsReviewCount: 0,
      warningCount: 0, imagesAnalyzed: 2, imagesTotal: 2,
    },
    warnings: [],
    verifiedFacts: [{ field: "Category", value: "Shoes" }],
    aiObservations: [{ field: "Primary Color", value: "Black", confidence: 0.96 }],
    aiInferences: [],
    status: "complete",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("deep intelligence — assemble", () => {
  it("1. product identity analysis marks consistent vs conflict", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const identity = buildIdentity(profile, visual, { category: "Shoes", productType: "Footwear" });
    expect(identity.find((i) => i.field === "Category")!.mark).toBe("consistent");
    visual.categoryCheck.conflict = true;
    visual.categoryCheck.visualEstimate = "Handbags";
    const conflicted = buildIdentity(profile, visual, { category: "Handbags" });
    expect(conflicted.find((i) => i.field === "Category")!.mark).toBe("conflict");
  });

  it("2–4. verified / observation / inference layers stay separated", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const verified = buildVerifiedFacts(profile);
    const observations = buildObservations(visual);
    const inferences = buildInferences(profile, visual, { materials: ["May be leather"] });
    expect(verified.every((v) => v.kind === "verified")).toBe(true);
    expect(observations.every((v) => v.kind === "ai-observation")).toBe(true);
    expect(inferences.every((v) => v.kind === "ai-inference")).toBe(true);
    expect(verified.some((v) => v.field === "Price")).toBe(true);
    expect(inferences[0]!.confidence).toBeLessThan(0.7);
  });

  it("5–8. cross-validation for category, brand, color", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const xv = buildCrossValidation(profile, visual, { brand: "Nike" });
    expect(xv.find((c) => c.field === "Colors")!.mark).toBe("consistent");
    expect(xv.find((c) => c.field === "Brand")!.mark).toBe("consistent");
    visual.aggregate.primaryColor = "Blue";
    visual.images[0]!.colors = [{ name: "Blue", role: "primary", confidence: 0.91 }];
    const colorConflict = buildCrossValidation(profile, visual, null);
    expect(colorConflict.find((c) => c.field === "Colors")!.mark).toBe("conflict");
    expect(colorConflict.find((c) => c.field === "Colors")!.detail).toMatch(/COLOR CONFLICT/);
  });

  it("9–11. features, differentiators, benefit signals", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const pkg = assembleIntelligence({
      intelligenceId: "x", versionNumber: 1, versionLabel: "1.0", history: [],
      profile, visual, intel: null, productionPackageRef: null,
    });
    expect(pkg.features.length).toBeGreaterThan(0);
    expect(pkg.differentiators.length).toBeGreaterThan(0);
    expect(pkg.benefits.some((b) => b.kind === "verified")).toBe(true);
    expect(pkg.benefits.some((b) => b.kind === "ai-inference")).toBe(true);
  });

  it("12–14. variants, specs, logo/text cross-check", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const variants = buildVariantChecks(profile, visual);
    expect(variants.find((v) => v.declared === "Black")!.status).toBe("visually-supported");
    expect(variants.find((v) => v.declared === "Brown")!.status).toBe("user-provided-not-visually-verified");
    const specs = buildSpecChecks(profile, visual, { materials: ["leather"] });
    expect(specs.find((s) => s.field === "Material")!.detail).toMatch(/VERIFIED USER DATA|supporting/i);
    const texts = buildLogoTextChecks(profile, visual);
    expect(texts.some((t) => t.visualValue === "Nike")).toBe(true);
    const brandB = makeVisual(makeProfile({ brand: "Acme" }));
    brandB.images[0]!.detectedText = [{ text: "OtherBrand", kind: "brand", confidence: 0.9 }];
    const critical = buildLogoTextChecks(makeProfile({ brand: "Acme" }), brandB);
    expect(critical.some((c) => c.detail.includes("CRITICAL"))).toBe(true);
  });

  it("15–16. consistency and missing information", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    visual.consistency.consistent = false;
    const pkg = assembleIntelligence({
      intelligenceId: "x", versionNumber: 1, versionLabel: "1.0", history: [],
      profile, visual, intel: null, productionPackageRef: null,
    });
    expect(pkg.consistency.images).toBe("conflict");
    expect(pkg.warnings.some((w) => w.code === "POSSIBLE_MISMATCH")).toBe(true);
    const unknown = buildUnknown(profile, visual);
    expect(unknown.some((u) => /Material|dimensions|Internal/i.test(u.field))).toBe(true);
  });

  it("17–18. confidence scoring and evidence traceability", () => {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const identity = buildIdentity(profile, visual, null);
    const scores = computeScores(identity, visual, buildSpecChecks(profile, visual, null), buildCrossValidation(profile, visual, null));
    expect(scores.overall).toBeGreaterThan(50);
    expect(scores.explanation).toMatch(/weighted average/i);
    const obs = buildObservations(visual);
    expect(obs[0]!.evidence[0]!.assetId).toBeTruthy();
    expect(obs[0]!.evidence[0]!.engineId).toBeTruthy();
  });

  it("valuesAgree helper", () => {
    expect(valuesAgree("Black", "black")).toBe(true);
    expect(valuesAgree("Shoes", "Handbags")).toBe(false);
  });
});

describe("deep intelligence — engine", () => {
  beforeEach(() => {
    mockStorage();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  });

  function seedHandoff() {
    const profile = makeProfile();
    const visual = makeVisual(profile);
    const production: ProductionInputPackage = {
      version: "1", packageId: "pkg-1", status: "confirmed",
      projectId: "proj-1", productId: "proj-1", projectName: "Demo Shoes",
      productImageSet: profile.productImageSet, productProfile: profile,
      marketingBrief: {
        version: 1, marketingBriefId: "mb-1", projectId: "proj-1", productId: "proj-1",
        projectName: "Demo Shoes", productProfile: profile, fields: emptyMarketingFields(),
        recommendations: [], conflicts: [], history: [],
        completeness: { objective: 80, audience: 80, platform: 80, language: 80, cta: 80, promotion: 80, overall: 80, missingRecommended: [] },
        validations: [], validationStatus: "valid", canContinue: true, continueBlockedReason: null, continueAnyway: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      issues: [],
      scores: { productAssets: 90, imageSet: 85, productInformation: 90, marketing: 80, validation: 88, overall: 88, blockersTo100: [] },
      readiness: "READY", readinessReason: "ok",
      productionRequirements: {
        productImages: true, productInformation: true, marketingInformation: true,
        storyRequirements: [], creativeRequirements: [], audioRequirements: [], videoRequirements: [],
        platformRequirements: [], exportRequirements: [],
      },
      userConfirmations: { confirmedAt: new Date().toISOString(), confirmedBy: "user", acknowledgedIssueIds: [] },
      aiRecommendations: [], pipelineJobId: null, handoffError: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), confirmedAt: new Date().toISOString(),
    };
    const handoff: Step2DeepIntelHandoffPayload = {
      version: 1, step: "step-2-deep-product-intelligence",
      projectId: "proj-1", projectName: "Demo Shoes",
      visualAnalysis: visual, productionPackage: production,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(VISUAL_HANDOFF_KEY, JSON.stringify(handoff));
    localStorage.setItem(VISUAL_STORE_KEY, JSON.stringify({ "proj-1": visual }));
    return { profile, visual, production };
  }

  it("19–25. user review, priority, versioning, autosave, resume, AI Me, events", async () => {
    seedHandoff();
    const events: Array<{ action?: string; type: string }> = [];
    const engine = new DeepIntelligenceEngine();
    engine.setEventEmitter((type, payload) => {
      events.push({ type, action: typeof payload.action === "string" ? payload.action : undefined });
    });
    expect(engine.hydrate()).toBe(true);
    const pkg = await engine.run();
    expect(pkg.verifiedFacts.every((f) => f.kind === "verified")).toBe(true);
    expect(pkg.scores.overall).toBeGreaterThan(0);

    const conflictId = pkg.crossValidation[0]!.id;
    engine.setCrossReview(conflictId, "keep-user");
    expect(engine.snapshot().package!.crossValidation.find((c) => c.id === conflictId)!.reviewStatus).toBe("keep-user");
    expect(engine.snapshot().package!.verifiedFacts.find((f) => f.field === "Category")!.value).toBe("Shoes");

    const stored = JSON.parse(localStorage.getItem(INTEL_STORE_KEY) ?? "{}") as Record<string, { current: { versionLabel: string } }>;
    expect(stored["proj-1"]?.current.versionLabel).toBe("1.0");

    const v2 = await engine.retry();
    expect(v2.versionLabel).toBe("2.0");
    expect(v2.history.some((h) => h.versionLabel === "1.0")).toBe(true);

    const engine2 = new DeepIntelligenceEngine();
    expect(engine2.hydrate()).toBe(true);
    expect(engine2.snapshot().package?.versionLabel).toBe("2.0");

    const aiMe = engine2.buildAiMeContext();
    expect(aiMe.explanation).toMatch(/for certain|observed|inference/i);
    expect(aiMe.running).toBe(false);

    expect(events.some((e) => e.action === "ProductIntelligenceStarted")).toBe(true);
    expect(events.some((e) => e.action === "ProductCrossValidationCompleted")).toBe(true);
    expect(events.some((e) => e.action === "ProductIntelligenceCompleted")).toBe(true);
  });

  it("26–27. final package + Step 3 handoff without starting Step 3", async () => {
    seedHandoff();
    const engine = new DeepIntelligenceEngine();
    engine.hydrate();
    await engine.run();
    const handoff = engine.continueToStep3();
    expect(handoff.step).toBe("step-3-market-customer-intelligence");
    expect(handoff.masterIntelligence.productName).toBe("Nike Air Max");
    expect(handoff.masterIntelligence.verifiedFacts.length).toBeGreaterThan(0);
    expect(loadStep3MarketIntelHandoff()?.projectId).toBe("proj-1");
    expect(localStorage.getItem(INTEL_HANDOFF_KEY)).toBeTruthy();
    expect(handoff.productProfile!.fields.materials).toEqual(["Leather"]);
  });

  it("28. large batch (8 images) completes", async () => {
    const profile = makeProfile();
    const images = Array.from({ length: 8 }, (_, i) =>
      makeVisualResult({
        assetId: `img-${i}`,
        fileName: `view-${i}-black.jpg`,
        viewType: (["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "DETAIL", "PACKAGING", "OTHER"] as const)[i]!,
      }),
    );
    const visual = makeVisual(profile);
    visual.images = images;
    visual.aggregate.imagesTotal = 8;
    visual.aggregate.imagesAnalyzed = 8;
    visual.productProfile = profile;
    const handoff: Step2DeepIntelHandoffPayload = {
      version: 1, step: "step-2-deep-product-intelligence",
      projectId: "proj-1", projectName: "Demo Shoes",
      visualAnalysis: visual, productionPackage: null,
      preparedAt: new Date().toISOString(),
    };
    localStorage.setItem(VISUAL_HANDOFF_KEY, JSON.stringify(handoff));
    localStorage.setItem(VISUAL_STORE_KEY, JSON.stringify({ "proj-1": visual }));
    const engine = new DeepIntelligenceEngine();
    engine.hydrate();
    const pkg = await engine.run();
    expect(pkg.visualObservations.length).toBeGreaterThan(0);
    expect(pkg.status).toBe("complete");
  });
});
