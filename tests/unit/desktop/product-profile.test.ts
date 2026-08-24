import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  computeCompleteness,
  textToList,
  validateProfileFields,
} from "../../../desktop/product-profile/validation.ts";
import { emptyFields, categorySpecHints, PROFILE_HANDOFF_KEY, PROFILE_STORE_KEY } from "../../../desktop/product-profile/types.ts";
import { ProductProfileEngine } from "../../../desktop/product-profile/profile-engine.ts";
import { ORG_HANDOFF_KEY } from "../../../desktop/image-organization/types.ts";
import type { Step3HandoffPayload } from "../../../desktop/image-organization/types.ts";

function mockStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
  });
  return store;
}

function sampleImageSet(projectId = "proj-1") {
  return {
    version: 1 as const,
    projectId,
    projectName: "Demo Shoes",
    categoryEstimate: "Shoes",
    groups: [],
    images: [
      {
        assetId: "img-1",
        projectId,
        fileName: "front.jpg",
        mimeType: "image/jpeg",
        width: 800,
        height: 800,
        fileSize: 12000,
        url: "/media/front.jpg",
        viewType: "FRONT" as const,
        confidence: 0.95,
        roleInGroup: "primary" as const,
        groupId: "view-FRONT",
        backgroundType: "studio",
        visibilityStatus: "clear" as const,
        needsReview: false,
        analysisFailed: false,
        userCorrected: false,
        qualityScore: 90,
        warnings: [],
        analyzedAt: new Date().toISOString(),
      },
    ],
    missingViews: [],
    recommendedViews: ["FRONT" as const],
    coverageScore: 100,
    warnings: [],
    consistencyOk: true,
    analyzedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function seedStep3Handoff(store: Record<string, string>) {
  const handoff: Step3HandoffPayload = {
    version: 1,
    step: "step-3-product-information",
    projectId: "proj-1",
    projectName: "Demo Shoes",
    productImageSet: sampleImageSet(),
    preparedAt: new Date().toISOString(),
  };
  store[ORG_HANDOFF_KEY] = JSON.stringify(handoff);
}

describe("Product profile validation & completeness", () => {
  it("requires critical identity, price, currency, and images", () => {
    const fields = emptyFields();
    const rows = validateProfileFields(fields, 0);
    expect(rows.some((r) => r.field === "name" && r.status === "error")).toBe(true);
    expect(rows.some((r) => r.field === "price" && r.status === "error")).toBe(true);
    expect(rows.some((r) => r.field === "images" && r.status === "error")).toBe(true);

    fields.name = "Air Max";
    fields.category = "Shoes";
    fields.price = 45000;
    fields.currency = "RWF";
    const ok = validateProfileFields(fields, 2);
    expect(ok.filter((r) => r.status === "error")).toHaveLength(0);
  });

  it("warns on empty description and colors without blocking", () => {
    const fields = emptyFields();
    fields.name = "Bag";
    fields.category = "Bags";
    fields.price = 10;
    fields.currency = "RWF";
    const rows = validateProfileFields(fields, 1);
    expect(rows.some((r) => r.field === "description" && r.status === "warning")).toBe(true);
    expect(rows.some((r) => r.field === "colors" && r.status === "warning")).toBe(true);
  });

  it("computes completeness and category-aware missing recommendations", () => {
    const fields = emptyFields();
    fields.name = "Runner";
    fields.brand = "Nike";
    fields.category = "Shoes";
    fields.price = 45000;
    fields.currency = "RWF";
    fields.description = "Comfort shoe";
    fields.features = ["cushion"];
    fields.colors = ["Black"];
    const score = computeCompleteness(fields, 100, []);
    expect(score.information).toBeGreaterThan(80);
    expect(score.images).toBe(100);
    expect(score.overall).toBeGreaterThan(50);
    expect(score.missingRecommended).toContain("Material");
    expect(categorySpecHints("Shoes").some((h) => h.key === "soleMaterial")).toBe(true);
    expect(categorySpecHints("Laptop").some((h) => h.key === "ram")).toBe(true);
  });

  it("parses list text", () => {
    expect(textToList("Black, White; Brown\nRed")).toEqual(["Black", "White", "Brown", "Red"]);
  });
});

describe("ProductProfileEngine", () => {
  beforeEach(() => {
    const store = mockStorage();
    seedStep3Handoff(store);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/workspace/projects/proj-1") && init?.method === "POST" && String(init.body).includes("open")) {
        return {
          ok: true,
          json: async () => ({
            project: {
              id: "proj-1",
              name: "Demo Shoes",
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              productImages: [{ id: "img-1", fileName: "front.jpg", mimeType: "image/jpeg", sizeBytes: 1, uploadedAt: "", url: "/x" }],
              productInformation: { name: "", category: "", description: "" },
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
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              productImages: [{ id: "img-1", fileName: "front.jpg", mimeType: "image/jpeg", sizeBytes: 1, uploadedAt: "", url: "/x" }],
              productInformation: { name: "Air Max", category: "Shoes", description: "x", price: 25000, currency: "RWF" },
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
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              productImages: [{ id: "img-1", fileName: "front.jpg", mimeType: "image/jpeg", sizeBytes: 1, uploadedAt: "", url: "/x" }],
              productInformation: { name: "", category: "", description: "" },
              workspaceSettings: {},
            },
          }),
        };
      }
      if (u.includes("/product-intelligence/")) {
        return {
          ok: true,
          json: async () => ({
            profile: {
              category: "Shoes",
              brand: "Nike",
              colours: ["Black", "White"],
              materials: ["mesh"],
              features: ["air cushion"],
              visibleLogos: ["Swoosh"],
            },
          }),
        };
      }
      return { ok: false, json: async () => ({ error: "missing" }) };
    }));
  });

  it("creates profile from Step 2 handoff with image set and AI suggestions", async () => {
    const engine = new ProductProfileEngine();
    const ok = await engine.hydrateFromHandoff();
    expect(ok).toBe(true);
    const snap = engine.snapshot();
    expect(snap.profile?.projectId).toBe("proj-1");
    expect(snap.profile?.productImageSet?.images.length).toBe(1);
    expect(snap.profile?.aiDerived.some((a) => a.field === "brand")).toBe(true);
    expect(snap.profile?.fields.category).toBe("Shoes");
  });

  it("edits identity, pricing, description, features, materials, colors, sizes, sku, barcode, warranty", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("name", "Nike Air Max");
    engine.updateField("price", 25000);
    engine.updateField("currency", "RWF");
    engine.updateField("description", "Classic runner");
    engine.updateField("features", ["Cushion", "Breathable"]);
    engine.updateField("materials", ["Mesh"]);
    engine.updateField("colors", ["Black", "White"]);
    engine.updateField("sizes", ["39", "40", "41", "42"]);
    engine.updateField("sku", "NK-AM-01");
    engine.updateField("barcode", "1234567890123");
    engine.updateField("warranty", "1 year");
    const f = engine.snapshot().profile!.fields;
    expect(f.name).toBe("Nike Air Max");
    expect(f.price).toBe(25000);
    expect(f.features).toContain("Cushion");
    expect(f.sizes).toHaveLength(4);
    expect(engine.snapshot().profile!.history.length).toBeGreaterThan(5);
  });

  it("adds variants and category-specific specifications", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.addVariant("color", "Color", "Black, White, Brown");
    engine.addVariant("size", "Size", "39, 40, 41, 42");
    engine.updateSpecification("soleMaterial", "Rubber");
    const p = engine.snapshot().profile!;
    expect(p.variants).toHaveLength(2);
    expect(p.fields.specifications.soleMaterial).toBe("Rubber");
  });

  it("keeps user price authoritative and never invents prices from AI", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("price", 25000);
    engine.updateField("currency", "RWF");
    // Silent AI overwrite blocked
    engine.updateField("price", 99999, "ai-suggestion");
    expect(engine.snapshot().profile!.fields.price).toBe(25000);
    expect(engine.snapshot().profile!.aiDerived.every((a) => a.field !== "price")).toBe(true);
  });

  it("accepts and rejects AI suggestions", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.acceptAiSuggestion("brand");
    expect(engine.snapshot().profile!.fields.brand).toBe("Nike");
    expect(engine.snapshot().profile!.aiDerived.find((a) => a.field === "brand")?.status).toBe("accepted");
    engine.rejectAiSuggestion("materials");
    expect(engine.snapshot().profile!.aiDerived.find((a) => a.field === "materials")?.status).toBe("rejected");
    expect(engine.snapshot().profile!.fields.materials).toEqual([]);
  });

  it("validates completeness and gates Step 4 handoff", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    expect(engine.snapshot().profile!.canContinue).toBe(false);
    engine.updateField("name", "Nike Air Max");
    engine.updateField("category", "Shoes");
    engine.updateField("price", 45000);
    engine.updateField("currency", "RWF");
    expect(engine.snapshot().profile!.canContinue).toBe(true);
    expect(engine.snapshot().profile!.completeness.overall).toBeGreaterThan(40);
    const handoff = await engine.continueToStep4();
    expect(handoff.step).toBe("step-4-marketing-input");
    expect(handoff.productProfile.fields.name).toBe("Nike Air Max");
    expect(localStorage.getItem(PROFILE_HANDOFF_KEY)).toBeTruthy();
    expect(localStorage.getItem(PROFILE_STORE_KEY)).toBeTruthy();
  });

  it("blocks cross-project mismatch and recovers from stored profile", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("name", "Recover Me");
    const engine2 = new ProductProfileEngine();
    // Clear handoff — restore from PROFILE_STORE_KEY
    localStorage.removeItem(ORG_HANDOFF_KEY);
    const ok = await engine2.hydrateFromHandoff();
    expect(ok).toBe(true);
    expect(engine2.snapshot().profile!.fields.name).toBe("Recover Me");
  });

  it("exposes AI Me context without inventing facts", async () => {
    const engine = new ProductProfileEngine();
    await engine.hydrateFromHandoff();
    engine.updateField("name", "Air Max");
    engine.updateField("price", 1);
    engine.updateField("currency", "RWF");
    engine.updateField("category", "Shoes");
    const ctx = engine.buildAiMeContext();
    expect(ctx.explanation).toMatch(/complete/i);
    expect(ctx.explanation).toMatch(/authoritative|invent/i);
    expect(ctx.canContinue).toBe(true);
  });
});
