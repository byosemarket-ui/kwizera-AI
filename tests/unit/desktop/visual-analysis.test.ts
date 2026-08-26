import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  analyzeOneImage,
  assembleVisualPackage,
  buildCoverage,
  categoryVisualCheck,
  detectColorsLocal,
  qualityClassFromScore,
  visualFeaturesForCategory,
} from "../../../desktop/visual-analysis/analyze.ts";
import { VisualAnalysisEngine, loadStep2DeepIntelHandoff } from "../../../desktop/visual-analysis/visual-analysis-engine.ts";
import { VISUAL_HANDOFF_KEY, VISUAL_STORE_KEY, LOW_CONFIDENCE } from "../../../desktop/visual-analysis/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import type { ProductImageSet, OrganizedImage } from "../../../desktop/image-organization/types.ts";
import type { ProductionInputPackage } from "../../../desktop/product-validation/types.ts";
import type { ServerImageProfile } from "../../../desktop/visual-analysis/analyze.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";

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
    assetId: "img-1",
    projectId: "proj-1",
    fileName: "front-black.jpg",
    mimeType: "image/jpeg",
    width: 1920,
    height: 2400,
    fileSize: 120_000,
    url: "/x.jpg",
    viewType: "FRONT",
    confidence: 0.95,
    roleInGroup: "primary",
    groupId: "view-FRONT",
    backgroundType: "studio",
    visibilityStatus: "clear",
    needsReview: false,
    analysisFailed: false,
    userCorrected: false,
    qualityScore: 90,
    warnings: [],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeImageSet(images: OrganizedImage[]): ProductImageSet {
  return {
    version: 1,
    projectId: "proj-1",
    projectName: "Demo Shoes",
    categoryEstimate: "Shoes",
    groups: [],
    images,
    missingViews: ["BOTTOM"],
    recommendedViews: ["FRONT", "BACK", "BOTTOM", "TOP", "DETAIL"],
    coverageScore: 80,
    warnings: [],
    consistencyOk: true,
    analyzedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeProfile(overrides: Partial<ProductProfile["fields"]> = {}): ProductProfile {
  const imageSet = makeImageSet([makeImage()]);
  return {
    version: 1,
    productId: "proj-1",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    fields: {
      ...emptyProductFields(),
      name: "Nike Air Max",
      brand: "Nike",
      category: "Shoes",
      price: 45000,
      currency: "RWF",
      colors: ["Black"],
      materials: ["Mesh"],
      description: "Runner",
      features: ["Cushion"],
      ...overrides,
    },
    variants: [],
    aiDerived: [],
    history: [],
    productImageSet: imageSet,
    completeness: { information: 90, images: 80, specifications: 70, overall: 85, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeProductionPackage(profile: ProductProfile): ProductionInputPackage {
  const now = new Date().toISOString();
  return {
    version: "1",
    packageId: "pkg-1",
    status: "confirmed",
    projectId: "proj-1",
    productId: "proj-1",
    projectName: "Demo Shoes",
    productImageSet: profile.productImageSet,
    productProfile: profile,
    marketingBrief: {
      version: 1,
      marketingBriefId: "mb-1",
      projectId: "proj-1",
      productId: "proj-1",
      projectName: "Demo Shoes",
      productProfile: profile,
      fields: emptyMarketingFields(),
      recommendations: [],
      conflicts: [],
      history: [],
      completeness: {
        objective: 80, audience: 80, platform: 80, language: 80, cta: 80, promotion: 80,
        overall: 80, missingRecommended: [],
      },
      validations: [],
      validationStatus: "valid",
      canContinue: true,
      continueBlockedReason: null,
      continueAnyway: false,
      createdAt: now,
      updatedAt: now,
    },
    issues: [],
    scores: {
      productAssets: 90,
      imageSet: 85,
      productInformation: 90,
      marketing: 80,
      validation: 88,
      overall: 88,
      blockersTo100: [],
    },
    readiness: "READY",
    readinessReason: "ok",
    productionRequirements: {
      productImages: true,
      productInformation: true,
      marketingInformation: true,
      storyRequirements: [],
      creativeRequirements: [],
      audioRequirements: [],
      videoRequirements: [],
      platformRequirements: [],
      exportRequirements: [],
    },
    userConfirmations: { confirmedAt: now, confirmedBy: "user", acknowledgedIssueIds: [] },
    aiRecommendations: [],
    pipelineJobId: null,
    handoffError: null,
    createdAt: now,
    updatedAt: now,
    confirmedAt: now,
  };
}

describe("visual analysis — pure analyze helpers", () => {
  it("1. product detection uses confidence and marks low confidence for review", () => {
    const img = analyzeOneImage(makeImage(), makeProfile(), undefined, null);
    expect(img.productDetection.detected).toBe(true);
    expect(img.productDetection.confidence).toBeGreaterThan(0.5);
    expect(img.productDetection.needsReview).toBe(img.productDetection.confidence < LOW_CONFIDENCE);
  });

  it("2. background detection returns type / complexity / separation", () => {
    const img = analyzeOneImage(makeImage({ fileName: "studio-white-front.jpg" }), makeProfile(), undefined, null);
    expect(img.background.type).toBe("White Studio");
    expect(img.background.complexity).toBe("low");
    expect(img.background.separation).toBe("Excellent");
    expect(img.background.confidence).toBeGreaterThan(0);
  });

  it("3. color detection finds primary colors from filename + profile", () => {
    const colors = detectColorsLocal("front-black-white.jpg", ["Black"]);
    expect(colors.some((c) => c.name === "Black")).toBe(true);
    const img = analyzeOneImage(makeImage({ fileName: "front-black.jpg" }), makeProfile(), undefined, null);
    expect(img.colors.length).toBeGreaterThan(0);
    expect(img.colors[0]!.confidence).toBeGreaterThan(0);
  });

  it("4. logo detection reports presence and confidence", () => {
    const img = analyzeOneImage(makeImage({ viewType: "LOGO", fileName: "logo.jpg" }), makeProfile(), undefined, null);
    expect(img.logo.present).toBe(true);
    expect(img.logo.possibleBrand).toBe("Nike");
    expect(img.logo.confidence).toBeGreaterThan(0.5);
  });

  it("5. text detection stores server cues separately (empty when none)", () => {
    const local = analyzeOneImage(makeImage(), makeProfile(), undefined, null);
    expect(local.detectedText).toEqual([]);
    const server: ServerImageProfile = {
      imageId: "img-1",
      fileName: "front.jpg",
      detectedText: [{ text: "AIR MAX", kind: "model", confidence: 0.83 }],
    };
    const withText = analyzeOneImage(makeImage(), makeProfile(), server, null);
    expect(withText.detectedText[0]!.text).toBe("AIR MAX");
    expect(withText.detectedText[0]!.confidence).toBeCloseTo(0.83);
  });

  it("6. product view analysis reuses Step 2 classification", () => {
    const img = analyzeOneImage(makeImage({ viewType: "BACK", confidence: 0.88 }), makeProfile(), undefined, null);
    expect(img.viewType).toBe("BACK");
    expect(img.viewConfidence).toBe(0.88);
  });

  it("7. product visibility reports percent and framing", () => {
    const img = analyzeOneImage(makeImage({ visibilityStatus: "clear" }), makeProfile(), undefined, null);
    expect(img.visibility.percent).toBeGreaterThanOrEqual(90);
    expect(img.visibility.cutoff).toBe(false);
    expect(img.visibility.status).toBe("good");
  });

  it("8. image quality classifies GOOD / ACCEPTABLE / NEEDS_REVIEW / POOR", () => {
    expect(qualityClassFromScore(90)).toBe("GOOD");
    expect(qualityClassFromScore(75)).toBe("ACCEPTABLE");
    expect(qualityClassFromScore(60)).toBe("NEEDS_REVIEW");
    expect(qualityClassFromScore(40)).toBe("POOR");
    const img = analyzeOneImage(makeImage({ qualityScore: 90 }), makeProfile(), undefined, null);
    expect(img.quality.classification).toBe("GOOD");
  });

  it("9. lighting analysis records exposure / shadows / highlights", () => {
    const img = analyzeOneImage(makeImage(), makeProfile(), { imageId: "img-1", fileName: "x.jpg", lighting: "studio", shadows: "soft", reflections: "low" }, null);
    expect(img.lighting.exposure).toBe("Good");
    expect(img.lighting.shadows).toBe("soft");
    expect(img.lighting.productVisibility).toBeTruthy();
  });

  it("10. composition analysis records a composition string", () => {
    const img = analyzeOneImage(makeImage(), makeProfile(), { imageId: "img-1", fileName: "x.jpg", composition: "Centered" }, null);
    expect(img.composition).toBe("Centered");
  });

  it("11. visual feature detection is category-aware and evidence-based", () => {
    const shoe = visualFeaturesForCategory("Shoes", "detail-sole.jpg", ["Mesh"]);
    expect(shoe).toContain("Sole");
    expect(shoe.some((f) => /Mesh/.test(f))).toBe(true);
    const bag = visualFeaturesForCategory("Bags", "strap-view.jpg", []);
    expect(bag.some((f) => /Strap|handle/i.test(f))).toBe(true);
  });

  it("12. product consistency flags mismatch from image set", () => {
    const profile = makeProfile();
    const set = makeImageSet([makeImage(), makeImage({ assetId: "img-2", fileName: "other.jpg", duplicateOfAssetId: "img-1" })]);
    set.consistencyOk = false;
    const pkg = assembleVisualPackage({
      analysisId: "a1",
      projectId: "proj-1",
      projectName: "Demo",
      productId: "proj-1",
      productionPackageRef: "pkg-1",
      profile,
      imageSet: set,
      serverProfiles: [],
      productIntel: null,
    });
    expect(pkg.consistency.consistent).toBe(false);
    expect(pkg.warnings.some((w) => w.code === "POSSIBLE_MISMATCH")).toBe(true);
  });

  it("13. missing photo detection builds coverage rows", () => {
    const set = makeImageSet([makeImage({ viewType: "FRONT" })]);
    const coverage = buildCoverage(set, "Shoes");
    expect(coverage.some((r) => r.view === "FRONT" && r.status === "available")).toBe(true);
    expect(coverage.some((r) => r.status === "missing")).toBe(true);
    expect(coverage.every((r) => ["required", "recommended", "optional"].includes(r.need))).toBe(true);
  });

  it("14. confidence scoring is present on key results", () => {
    const img = analyzeOneImage(makeImage(), makeProfile(), undefined, null);
    expect(img.productDetection.confidence).toBeGreaterThan(0);
    expect(img.background.confidence).toBeGreaterThan(0);
    expect(img.logo.confidence).toBeGreaterThan(0);
    expect(img.quality.confidence).toBeGreaterThan(0);
  });

  it("15. verified vs AI observation vs inference are separated", () => {
    const profile = makeProfile();
    const pkg = assembleVisualPackage({
      analysisId: "a1",
      projectId: "proj-1",
      projectName: "Demo",
      productId: "proj-1",
      productionPackageRef: null,
      profile,
      imageSet: profile.productImageSet!,
      serverProfiles: [],
      productIntel: { materials: ["May be leather"], category: "Shoes" },
    });
    expect(pkg.verifiedFacts.some((f) => f.field === "Category" && f.value === "Shoes")).toBe(true);
    expect(pkg.aiObservations.length).toBeGreaterThan(0);
    expect(pkg.aiInferences.some((i) => /Material/.test(i.field))).toBe(true);
    expect(pkg.productProfile!.fields.category).toBe("Shoes");
  });

  it("16. low-confidence and category conflict produce NEEDS_REVIEW / warnings", () => {
    const failed = analyzeOneImage(
      makeImage({ analysisFailed: true, confidence: 0.2 }),
      makeProfile(),
      { imageId: "img-1", fileName: "x.jpg", objects: [{ label: "object", confidence: 0.2 }] },
      null,
    );
    expect(failed.productDetection.needsReview).toBe(true);
    const conflict = categoryVisualCheck(makeProfile({ category: "Shoes" }), { category: "Handbags" });
    expect(conflict.conflict).toBe(true);
  });
});

describe("visual analysis — engine integration", () => {
  beforeEach(() => {
    mockStorage();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  });

  it("17–22. run analysis with service unavailable, progress, autosave, resume, events, AI Me", async () => {
    const events: Array<{ type: string; action?: string }> = [];
    const engine = new VisualAnalysisEngine();
    engine.setEventEmitter((type, payload) => {
      events.push({ type, action: typeof payload.action === "string" ? payload.action : undefined });
    });

    const production = makeProductionPackage(makeProfile());
    expect(engine.hydrateFromPackage(production)).toBe(true);

    const pkg = await engine.runAnalysis();
    expect(pkg.status === "complete" || pkg.status === "partial").toBe(true);
    expect(pkg.aggregate.imagesAnalyzed).toBeGreaterThan(0);
    expect(engine.snapshot().serviceAvailable).toBe(false);
    expect(engine.snapshot().progress.percent).toBe(100);
    expect(engine.snapshot().progress.running).toBe(false);

    const stored = JSON.parse(localStorage.getItem(VISUAL_STORE_KEY) ?? "{}") as Record<string, unknown>;
    expect(stored["proj-1"]).toBeTruthy();

    expect(events.some((e) => e.action === "ProductVisualAnalysisStarted")).toBe(true);
    expect(events.some((e) => e.action === "ProductDetectionCompleted")).toBe(true);
    expect(events.some((e) => e.action === "ProductVisualAnalysisCompleted")).toBe(true);
    expect(events.some((e) => e.type === "product-analysis.completed")).toBe(true);

    const aiMeDone = engine.buildAiMeContext();
    expect(aiMeDone.explanation).toMatch(/analyzed/i);
    expect(aiMeDone.explanation).toMatch(/observation/i);

    const engine2 = new VisualAnalysisEngine();
    expect(engine2.hydrateFromPackage(production)).toBe(true);
    expect(engine2.snapshot().package?.analysisId).toBe(pkg.analysisId);
  });

  it("18. retry re-runs analysis and preserves package", async () => {
    const engine = new VisualAnalysisEngine();
    const production = makeProductionPackage(makeProfile());
    engine.hydrateFromPackage(production);
    await engine.runAnalysis();
    const firstId = engine.snapshot().package!.analysisId;
    await engine.retryFailed();
    expect(engine.snapshot().package).toBeTruthy();
    expect(engine.snapshot().package!.analysisId).not.toBe(firstId);
  });

  it("23. AI Me context reflects completion state", async () => {
    const engine = new VisualAnalysisEngine();
    engine.hydrateFromPackage(makeProductionPackage(makeProfile()));
    await engine.runAnalysis();
    const ctx = engine.buildAiMeContext();
    expect(ctx.running).toBe(false);
    expect(ctx.canContinue).toBe(true);
  });

  it("24–25. final package + Step 2 handoff without starting Step 2", async () => {
    const engine = new VisualAnalysisEngine();
    engine.hydrateFromPackage(makeProductionPackage(makeProfile()));
    await engine.runAnalysis();
    engine.setImageReview("img-1", "accepted");
    const handoff = engine.continueToStep2();
    expect(handoff.step).toBe("step-2-deep-product-intelligence");
    expect(handoff.visualAnalysis.images[0]!.reviewStatus).toBe("accepted");
    expect(loadStep2DeepIntelHandoff()?.projectId).toBe("proj-1");
    expect(localStorage.getItem(VISUAL_HANDOFF_KEY)).toBeTruthy();
    expect(handoff.visualAnalysis.productProfile!.fields.category).toBe("Shoes");
  });

  it("26. large batch (8 images) completes without throwing", async () => {
    const images = Array.from({ length: 8 }, (_, i) =>
      makeImage({
        assetId: `img-${i}`,
        fileName: `view-${i}-black.jpg`,
        viewType: (["FRONT", "BACK", "LEFT", "RIGHT", "TOP", "DETAIL", "PACKAGING", "OTHER"] as const)[i]!,
      }),
    );
    const profile = makeProfile();
    profile.productImageSet = makeImageSet(images);
    const engine = new VisualAnalysisEngine();
    engine.hydrateFromPackage(makeProductionPackage(profile));
    const pkg = await engine.runAnalysis();
    expect(pkg.aggregate.imagesTotal).toBe(8);
    expect(pkg.images).toHaveLength(8);
  });

  it("error recovery: one failed image does not wipe successful results", () => {
    const profile = makeProfile();
    const set = makeImageSet([
      makeImage({ assetId: "ok", fileName: "front.jpg" }),
      makeImage({ assetId: "bad", fileName: "blur.jpg", analysisFailed: true, analysisError: "decode failed", qualityScore: 40 }),
    ]);
    const pkg = assembleVisualPackage({
      analysisId: "a1",
      projectId: "proj-1",
      projectName: "Demo",
      productId: "proj-1",
      productionPackageRef: null,
      profile,
      imageSet: set,
      serverProfiles: [],
      productIntel: null,
    });
    expect(pkg.status).toBe("partial");
    expect(pkg.images.find((i) => i.assetId === "ok")!.failed).toBe(false);
    expect(pkg.images.find((i) => i.assetId === "bad")!.failed).toBe(true);
    expect(pkg.warnings.some((w) => w.code === "ANALYSIS_FAILED")).toBe(true);
  });
});
