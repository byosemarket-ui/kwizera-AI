import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  computeMarketingCompleteness,
  detectConflicts,
  validateMarketingFields,
} from "../../../desktop/marketing-input/validation.ts";
import {
  emptyMarketingFields,
  MARKETING_HANDOFF_KEY,
  MARKETING_STORE_KEY,
} from "../../../desktop/marketing-input/types.ts";
import { MarketingInputEngine } from "../../../desktop/marketing-input/marketing-engine.ts";
import { PROFILE_HANDOFF_KEY } from "../../../desktop/product-profile/types.ts";
import type { Step4HandoffPayload, ProductProfile } from "../../../desktop/product-profile/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function sampleProductProfile(): ProductProfile {
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
      colors: ["Black", "White"],
      sizes: ["39", "40", "41", "42", "43", "44"],
      description: "Classic runner",
      features: ["Cushion"],
    },
    variants: [{ id: "v1", kind: "color", label: "Color", values: ["Black", "White"] }],
    aiDerived: [],
    history: [],
    productImageSet: {
      version: 1,
      projectId: "proj-1",
      projectName: "Demo Shoes",
      categoryEstimate: "Shoes",
      groups: [],
      images: [{
        assetId: "img-1",
        projectId: "proj-1",
        fileName: "front.jpg",
        mimeType: "image/jpeg",
        width: 800,
        height: 800,
        fileSize: 10,
        url: "/x.jpg",
        viewType: "FRONT",
        confidence: 0.9,
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
      }],
      missingViews: [],
      recommendedViews: ["FRONT"],
      coverageScore: 100,
      warnings: [],
      consistencyOk: true,
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    completeness: { information: 90, images: 100, specifications: 80, overall: 90, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    canContinue: true,
    continueBlockedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

function seedStep4(store: Record<string, string>) {
  const handoff: Step4HandoffPayload = {
    version: 1,
    step: "step-4-marketing-input",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    productProfile: sampleProductProfile(),
    preparedAt: new Date().toISOString(),
  };
  store[PROFILE_HANDOFF_KEY] = JSON.stringify(handoff);
}

describe("Marketing validation & completeness", () => {
  it("requires objective, audience, platform; defaults format and language", () => {
    const fields = emptyMarketingFields();
    const rows = validateMarketingFields(fields);
    expect(rows.some((r) => r.field === "objective" && r.status === "error")).toBe(true);
    expect(rows.some((r) => r.field === "platforms" && r.status === "error")).toBe(true);
    expect(rows.some((r) => r.field === "contentFormat" && r.status === "warning")).toBe(true);
    const clearedLang = { ...emptyMarketingFields(), language: "", languageOther: "" };
    expect(validateMarketingFields(clearedLang).some((r) => r.field === "language" && r.status === "warning")).toBe(true);
    fields.objective = "Direct Sales";
    fields.audienceType = "Shoppers";
    fields.platforms = ["TikTok"];
    const ok = validateMarketingFields(fields);
    expect(ok.filter((r) => r.status === "error")).toHaveLength(0);
    expect(ok.some((r) => r.field === "cta" && r.status === "warning")).toBe(true);
  });

  it("detects platform vs duration conflict", () => {
    const fields = emptyMarketingFields();
    fields.platforms = ["TikTok"];
    fields.duration = "long";
    const conflicts = detectConflicts(fields);
    expect(conflicts.some((c) => c.code === "platform-duration")).toBe(true);
  });

  it("computes completeness scores", () => {
    const fields = emptyMarketingFields();
    fields.objective = "Product Launch";
    fields.audienceType = "Youth";
    fields.platforms = ["Instagram", "Facebook"];
    fields.language = "English";
    fields.cta = "Shop Now";
    fields.promotionType = "None";
    const score = computeMarketingCompleteness(fields);
    expect(score.objective).toBe(100);
    expect(score.platform).toBe(100);
    expect(score.cta).toBe(100);
    expect(score.overall).toBeGreaterThan(70);
  });
});

describe("MarketingInputEngine", () => {
  beforeEach(() => {
    const store = mockStorage();
    seedStep4(store);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/workspace/projects/proj-1") && init?.method === "POST" && String(init.body ?? "").includes("open")) {
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
              campaignInformation: { name: "", objective: "" },
              targetAudience: "",
              language: "rw",
              platform: "",
              workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/api/workspace/projects/proj-1") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "proj-1",
              name: "Demo Shoes",
              createdAt: "",
              modifiedAt: "",
              productImages: [],
              productInformation: { name: "Nike Air Max", category: "Shoes", description: "x" },
              brandInformation: { name: "Nike" },
              campaignInformation: { name: "Direct Sales", objective: "Direct Sales" },
              targetAudience: "Shoppers",
              language: "rw",
              platform: "TikTok",
              workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/api/workspace/projects/proj-1")) {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "proj-1",
              name: "Demo Shoes",
              createdAt: "",
              modifiedAt: "",
              productImages: [],
              productInformation: { name: "Nike Air Max", category: "Shoes", description: "x", brand: "Nike", price: 45000, currency: "RWF" },
              brandInformation: { name: "Nike" },
              campaignInformation: { name: "", objective: "" },
              targetAudience: "",
              language: "rw",
              platform: "",
              workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/marketing-intelligence/")) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              ctas: ["Buy Now"],
              platform: { name: "TikTok", format: "Short Product Video", recommendations: ["Keep under 30s"] },
              strategy: "Benefit-led short video",
            },
          }),
        };
      }
      if (u.includes("/api/production/projects/")) {
        return { ok: true, json: async () => ({ job: null }) };
      }
      return { ok: false, json: async () => ({ error: "missing" }) };
    }));
  });

  it("hydrates from Step 3 handoff with product profile (no re-entry)", async () => {
    const engine = new MarketingInputEngine();
    const ok = await engine.hydrateFromHandoff();
    expect(ok).toBe(true);
    const brief = engine.snapshot().brief!;
    expect(brief.productProfile.fields.name).toBe("Nike Air Max");
    expect(brief.productProfile.fields.price).toBe(45000);
    expect(brief.fields.brandName).toBe("Nike");
    expect(brief.recommendations.length).toBeGreaterThan(0);
  });

  it("configures objective, audience, platforms, format, duration, language, voice, cta, promotion, tone, creative", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("objective", "Direct Sales");
    engine.updateField("audienceType", "Urban shoppers");
    engine.updateField("ageRange", "18-35");
    engine.togglePlatform("TikTok");
    engine.togglePlatform("Instagram");
    engine.updateField("contentFormat", "Short Product Video");
    engine.updateField("duration", "short");
    engine.updateField("language", "Kinyarwanda");
    engine.updateField("voiceLanguage", "Kinyarwanda");
    engine.updateField("voiceGender", "Neutral");
    engine.updateField("tone", "Energetic");
    engine.updateField("cta", "Buy Now");
    engine.updateField("promotionType", "Discount");
    engine.updateField("promotionDetails", "20% off this week");
    engine.updateField("style", "Clean modern");
    engine.updateField("mood", "Confident");
    engine.updateField("energy", "High");
    const f = engine.snapshot().brief!.fields;
    expect(f.objective).toBe("Direct Sales");
    expect(f.platforms).toEqual(expect.arrayContaining(["TikTok", "Instagram"]));
    expect(f.cta).toBe("Buy Now");
    expect(f.promotionDetails).toBe("20% off this week");
    expect(engine.snapshot().brief!.history.length).toBeGreaterThan(10);
  });

  it("keeps user settings over silent AI overwrite", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("cta", "WhatsApp Us");
    engine.updateField("cta", "Buy Now", "ai-recommendation");
    expect(engine.snapshot().brief!.fields.cta).toBe("WhatsApp Us");
  });

  it("accepts and rejects AI recommendations", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    const pending = engine.snapshot().brief!.recommendations.find((r) => r.status === "pending");
    expect(pending).toBeTruthy();
    engine.acceptRecommendation(pending!.field);
    expect(engine.snapshot().brief!.recommendations.find((r) => r.field === pending!.field)?.status).toBe("accepted");
    const other = engine.snapshot().brief!.recommendations.find((r) => r.status === "pending");
    if (other) {
      engine.rejectRecommendation(other.field);
      expect(engine.snapshot().brief!.recommendations.find((r) => r.field === other.field)?.status).toBe("rejected");
    }
  });

  it("acknowledges conflicts and gates Step 5 handoff", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("objective", "Direct Sales");
    engine.updateField("audienceType", "Buyers");
    engine.togglePlatform("TikTok");
    engine.updateField("contentFormat", "Short Product Video");
    engine.updateField("language", "Kinyarwanda");
    engine.updateField("duration", "long");
    engine.updateField("cta", "Order Now");
    const conflicts = engine.snapshot().brief!.conflicts.filter((c) => !c.acknowledged);
    expect(conflicts.some((c) => c.code === "platform-duration")).toBe(true);
    engine.acknowledgeConflict("platform-duration");
    expect(engine.snapshot().brief!.canContinue || engine.snapshot().brief!.continueAnyway).toBe(true);
    expect(engine.snapshot().brief!.completeness.overall).toBeGreaterThan(50);
    const handoff = await engine.continueToStep5();
    expect(handoff.step).toBe("step-5-live-product-validation");
    expect(handoff.productProfile.fields.name).toBe("Nike Air Max");
    expect(handoff.marketingBrief.fields.objective).toBe("Direct Sales");
    expect(localStorage.getItem(MARKETING_HANDOFF_KEY)).toBeTruthy();
    expect(localStorage.getItem(MARKETING_STORE_KEY)).toBeTruthy();
  });

  it("recovers after clearing Step 3 handoff from local store", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("objective", "Brand Awareness");
    localStorage.removeItem(PROFILE_HANDOFF_KEY);
    const engine2 = new MarketingInputEngine();
    const ok = await engine2.hydrateFromHandoff();
    expect(ok).toBe(true);
    expect(engine2.snapshot().brief!.fields.objective).toBe("Brand Awareness");
  });

  it("exposes AI Me context without inventing facts", async () => {
    const engine = new MarketingInputEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("objective", "Direct Sales");
    engine.updateField("audienceType", "Locals");
    engine.togglePlatform("TikTok");
    engine.updateField("contentFormat", "Short Product Video");
    engine.updateField("language", "Kinyarwanda");
    const ctx = engine.buildAiMeContext();
    expect(ctx.explanation).toMatch(/Direct Sales/);
    expect(ctx.explanation).toMatch(/TikTok/);
    expect(ctx.explanation).toMatch(/Kinyarwanda/);
    expect(ctx.explanation).toMatch(/CTA has not yet been specified|CTA:/i);
    expect(ctx.explanation).toMatch(/invent/i);
  });
});
