import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  computeReadinessScores,
  deriveReadiness,
  runAllValidations,
  validateAssets,
  validateCta,
  validateConsistency,
  validateImageSet,
  validateLanguage,
  validatePricing,
  validateProductInfo,
} from "../../../desktop/product-validation/validation-runner.ts";
import { ProductValidationEngine } from "../../../desktop/product-validation/validation-engine.ts";
import { MARKETING_HANDOFF_KEY, PRODUCTION_PACKAGE_KEY, VALIDATION_STORE_KEY } from "./pv-keys.ts";
import type { Step5HandoffPayload } from "../../../desktop/marketing-input/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import type { MarketingProductionBrief } from "../../../desktop/marketing-input/types.ts";

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

function sampleProfile(overrides: Partial<ProductProfile["fields"]> = {}): ProductProfile {
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
      originalPrice: 50000,
      discount: 10,
      colors: ["Black"],
      description: "Runner",
      features: ["Cushion"],
      ...overrides,
    },
    variants: [],
    aiDerived: [
      { field: "colors", value: ["Blue"], confidence: 0.8, status: "pending", source: "product-intelligence" },
    ],
    history: [],
    productImageSet: {
      version: 1,
      projectId: "proj-1",
      projectName: "Demo Shoes",
      categoryEstimate: "Shoes",
      groups: [],
      images: [{
        assetId: "img-1", projectId: "proj-1", fileName: "front.jpg", mimeType: "image/jpeg",
        width: 800, height: 800, fileSize: 10, url: "/x.jpg", viewType: "FRONT", confidence: 0.95,
        roleInGroup: "primary", groupId: "view-FRONT", backgroundType: "studio", visibilityStatus: "clear",
        needsReview: false, analysisFailed: false, userCorrected: false, qualityScore: 90, warnings: [],
        analyzedAt: new Date().toISOString(),
      }],
      missingViews: ["BOTTOM"],
      recommendedViews: ["FRONT", "BOTTOM"],
      coverageScore: 92,
      warnings: [],
      consistencyOk: true,
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    completeness: { information: 96, images: 92, specifications: 80, overall: 96, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sampleBrief(overrides: Partial<ReturnType<typeof emptyMarketingFields>> = {}): MarketingProductionBrief {
  const fields = {
    ...emptyMarketingFields(),
    objective: "Direct Sales",
    audienceType: "Shoppers",
    platforms: ["TikTok"],
    contentFormat: "Short Product Video",
    duration: "short" as const,
    language: "Kinyarwanda",
    voiceLanguage: "Kinyarwanda",
    cta: "Order Now",
    tone: "Energetic",
    promotionType: "Discount",
    promotionDetails: "10% off",
    brandName: "Nike",
    ...overrides,
  };
  return {
    version: 1,
    marketingBriefId: "m1",
    projectId: "proj-1",
    productId: "proj-1",
    projectName: "Demo Shoes",
    productProfile: sampleProfile(),
    fields,
    recommendations: [{ field: "cta", value: "Buy Now", reason: "Stronger", confidence: 0.7, status: "pending" }],
    conflicts: [],
    history: [],
    completeness: { objective: 100, audience: 80, platform: 100, language: 100, cta: 100, promotion: 100, overall: 100, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    continueAnyway: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function seedHandoff(store: Record<string, string>) {
  const handoff: Step5HandoffPayload = {
    version: 1,
    step: "step-5-live-product-validation",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    productProfile: sampleProfile(),
    marketingBrief: sampleBrief(),
    preparedAt: new Date().toISOString(),
  };
  store[MARKETING_HANDOFF_KEY] = JSON.stringify(handoff);
}

describe("Validation runners", () => {
  it("validates assets and image set including recommended missing views", () => {
    const profile = sampleProfile();
    expect(validateAssets(profile).some((i) => i.severity === "critical")).toBe(false);
    const imageIssues = validateImageSet(profile);
    expect(imageIssues.some((i) => i.code === "MISSING_RECOMMENDED_VIEW")).toBe(true);
    expect(imageIssues.find((i) => i.code === "MISSING_RECOMMENDED_VIEW")?.severity).toBe("warning");
  });

  it("validates product info critically when name missing", () => {
    const profile = sampleProfile({ name: "" });
    expect(validateProductInfo(profile).some((i) => i.severity === "critical")).toBe(true);
  });

  it("detects color conflict without overwriting user value", () => {
    const issues = validateConsistency(sampleProfile(), sampleBrief());
    const color = issues.find((i) => i.code === "COLOR_CONFLICT");
    expect(color).toBeTruthy();
    expect(color?.userValue).toBe("Black");
    expect(color?.aiValue).toMatch(/blue/i);
  });

  it("validates price/promotion math and CTA soft mismatch", () => {
    const profile = sampleProfile({ originalPrice: 50000, price: 45000, discount: 10 });
    const brief = sampleBrief({ promotionDetails: "20% off", cta: "Learn More", objective: "Direct Sales" });
    const pricing = validatePricing(profile, brief);
    expect(pricing.some((i) => i.code === "PROMO_DISCOUNT_MISMATCH" || i.code === "PROMO_MATH")).toBe(true);
    expect(validateCta(brief).some((i) => i.code === "CTA_REVIEW")).toBe(true);
  });

  it("validates language mismatch", () => {
    const brief = sampleBrief({ language: "Kinyarwanda", voiceLanguage: "English", narrationEnabled: true });
    expect(validateLanguage(brief).some((i) => i.code === "LANGUAGE_MISMATCH")).toBe(true);
  });

  it("computes readiness READY_WITH_WARNINGS for optional missing views", () => {
    const profile = sampleProfile();
    const brief = sampleBrief();
    const issues = runAllValidations(profile, brief);
    const scores = computeReadinessScores(profile, brief, issues);
    const { readiness } = deriveReadiness(issues, scores);
    expect(scores.overall).toBeGreaterThan(50);
    expect(["READY", "READY_WITH_WARNINGS", "MANUAL_REVIEW_REQUIRED"]).toContain(readiness);
    expect(readiness).not.toBe("NOT_READY");
  });

  it("marks NOT_READY when no images", () => {
    const profile = sampleProfile();
    profile.productImageSet = {
      ...profile.productImageSet!,
      images: [],
      coverageScore: 0,
      missingViews: ["FRONT"],
    };
    const issues = runAllValidations(profile, sampleBrief());
    const scores = computeReadinessScores(profile, sampleBrief(), issues);
    expect(deriveReadiness(issues, scores).readiness).toBe("NOT_READY");
  });
});

describe("ProductValidationEngine", () => {
  beforeEach(() => {
    const store = mockStorage();
    seedHandoff(store);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/workspace/projects/proj-1")) {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "proj-1",
              name: "Demo Shoes",
              createdAt: "",
              modifiedAt: "",
              productImages: [{ id: "img-1", fileName: "f.jpg", mimeType: "image/jpeg", sizeBytes: 1, uploadedAt: "", url: "/x" }],
              productInformation: { name: "Nike Air Max", category: "Shoes", description: "x", brand: "Nike", price: 45000, currency: "RWF" },
              brandInformation: { name: "Nike" },
              campaignInformation: { name: "Direct Sales", objective: "Direct Sales", contentFormat: "Short Product Video" },
              targetAudience: "Shoppers",
              language: "rw",
              platform: "TikTok",
              workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/api/pipeline/jobs") && init?.method === "POST") {
        return { ok: true, json: async () => ({ job: { id: "job-1" } }) };
      }
      if (u.includes("/api/autonomous-executions") && init?.method === "POST") {
        return { ok: true, json: async () => ({ job: { id: "job-1" } }) };
      }
      return { ok: false, json: async () => ({ error: "missing" }) };
    }));
  });

  it("hydrates, runs validation, confirms package, and hands off to pipeline", async () => {
    const engine = new ProductValidationEngine();
    expect(await engine.hydrateFromHandoff()).toBe(true);
    await engine.runValidation();
    const snap = engine.snapshot();
    expect(snap.scores).toBeTruthy();
    expect(snap.issues.length).toBeGreaterThan(0);
    expect(snap.package?.status).toBe("draft");
    expect(localStorage.getItem(VALIDATION_STORE_KEY)).toBeTruthy();

    // Acknowledge soft conflicts so confirm can proceed if MANUAL_REVIEW
    for (const iss of snap.issues.filter((i) => i.severity === "warning")) {
      engine.acknowledgeIssue(iss.id);
    }
    const after = engine.snapshot();
    expect(after.readiness === "READY" || after.readiness === "READY_WITH_WARNINGS" || after.readiness === "MANUAL_REVIEW_REQUIRED").toBe(true);

    if (after.readiness === "NOT_READY") {
      throw new Error("unexpected NOT_READY after ack");
    }

    engine.openConfirm();
    expect(engine.snapshot().confirmPending).toBe(true);
    const pkg = await engine.confirmAndStartProduction();
    expect(pkg.status).toBe("handed-off");
    expect(pkg.pipelineJobId).toBe("job-1");
    expect(pkg.userConfirmations.confirmedAt).toBeTruthy();
    expect(localStorage.getItem(PRODUCTION_PACKAGE_KEY)).toBeTruthy();
    expect(engine.snapshot().productInputCenterComplete).toBe(true);
  });

  it("preserves package on handoff failure and allows retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/workspace/projects/proj-1")) {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "proj-1", name: "Demo", createdAt: "", modifiedAt: "",
              productImages: [{ id: "i", fileName: "f.jpg", mimeType: "image/jpeg", sizeBytes: 1, uploadedAt: "", url: "/x" }],
              productInformation: { name: "Nike Air Max", category: "Shoes", description: "x", price: 1, currency: "RWF" },
              brandInformation: { name: "Nike" },
              campaignInformation: { name: "x", objective: "Direct Sales", contentFormat: "Short Product Video" },
              targetAudience: "a", language: "rw", platform: "TikTok", workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/api/pipeline/jobs")) {
        return { ok: false, json: async () => ({ error: "pipeline down" }) };
      }
      return { ok: false, json: async () => ({ error: "x" }) };
    }));

    const engine = new ProductValidationEngine();
    await engine.hydrateFromHandoff();
    await engine.runValidation();
    for (const iss of engine.snapshot().issues.filter((i) => i.severity !== "info")) {
      engine.acknowledgeIssue(iss.id);
    }
    // Force readiness by clearing criticals via ack - critical can't ack in UI but engine allows
    engine.snapshot().issues.filter((i) => i.severity === "critical").forEach((i) => engine.acknowledgeIssue(i.id));

    await expect(engine.confirmAndStartProduction()).rejects.toThrow(/pipeline/i);
    expect(engine.snapshot().package?.status).toBe("handoff-failed");
    expect(localStorage.getItem(PRODUCTION_PACKAGE_KEY)).toBeTruthy();
  });

  it("exposes AI Me context from computed results only", async () => {
    const engine = new ProductValidationEngine();
    await engine.hydrateFromHandoff();
    await engine.runValidation();
    const ctx = engine.buildAiMeContext();
    expect(ctx.explanation).toMatch(/readiness|Validation/i);
    expect(ctx.explanation).toMatch(/invent/i);
  });

  it("recovers stored package after clearing handoff", async () => {
    const engine = new ProductValidationEngine();
    await engine.hydrateFromHandoff();
    await engine.runValidation();
    localStorage.removeItem(MARKETING_HANDOFF_KEY);
    const engine2 = new ProductValidationEngine();
    expect(await engine2.hydrateFromHandoff()).toBe(true);
    expect(engine2.snapshot().package?.projectId).toBe("proj-1");
  });
});
