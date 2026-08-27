import { describe, expect, it } from "vitest";
import {
  emptyProductionState,
  mapPipelineToProductionStages,
  parsePipelineError,
  PRODUCTION_STAGE_MAP,
} from "../../../desktop/product-creation/production-orchestrator.ts";
import { buildStructuredMarketingPlan, buildVideoConcept, applyMarketingDefaults } from "../../../desktop/marketing-input/marketing-plan.ts";
import { emptyMarketingFields } from "../../../desktop/marketing-input/types.ts";
import type { ProductProfile } from "../../../desktop/product-profile/types.ts";

function sampleProduct(): ProductProfile {
  return {
    version: 1,
    productId: "p1",
    projectId: "p1",
    projectName: "Bottle",
    fields: {
      name: "Cert Bottle",
      brand: "",
      model: "",
      sku: "",
      barcode: "",
      category: "Drinkware",
      subcategory: "",
      price: 12000,
      originalPrice: null,
      discount: null,
      currency: "RWF",
      costPrice: null,
      promotionPrice: null,
      priceNotes: "",
      shortDescription: "Reusable bottle",
      description: "",
      highlights: [],
      features: ["Leak-proof"],
      benefits: ["Keeps water cold"],
      materials: [],
      colors: [],
      sizes: [],
      dimensions: "",
      weight: "",
      warranty: "",
      stock: "",
      countryOfOrigin: "",
      additionalNotes: "",
      specifications: {},
    },
    variants: [],
    aiDerived: [],
    history: [],
    productImageSet: {
      version: 1,
      projectId: "p1",
      projectName: "Bottle",
      categoryEstimate: "Drinkware",
      groups: [],
      images: [{
        assetId: "i1",
        projectId: "p1",
        fileName: "front.png",
        mimeType: "image/png",
        width: 100,
        height: 100,
        fileSize: 10,
        url: "/x",
        viewType: "FRONT",
        confidence: 0.9,
        roleInGroup: "primary",
        groupId: "g1",
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
      coverageScore: 60,
      warnings: [],
      consistencyOk: true,
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    completeness: { information: 70, images: 80, specifications: 40, overall: 65, missingRecommended: [] },
    validations: [],
    validationStatus: "valid",
    readiness: {
      state: "READY",
      canGenerateVideo: true,
      requiredMissing: [],
      optionalMissing: ["brand"],
      blockedReason: null,
      summary: "Ready",
    },
    structuredProfile: null,
    production: emptyProductionState(),
    canContinue: true,
    continueBlockedReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("Step 5 production orchestrator", () => {
  it("maps real pipeline stages without inventing progress", () => {
    const stages = mapPipelineToProductionStages(["validation", "analysis"], "planning", false);
    expect(stages.find((s) => s.id === "analysis")?.status).toBe("completed");
    expect(stages.find((s) => s.id === "marketing")?.status).toBe("active");
    expect(stages.find((s) => s.id === "video")?.status).toBe("pending");
    expect(PRODUCTION_STAGE_MAP.length).toBeGreaterThanOrEqual(7);
  });

  it("parses RESOURCE_UNAVAILABLE and QUALITY_CONTROL_FAILED", () => {
    expect(parsePipelineError("VIDEO_GENERATION: RESOURCE_UNAVAILABLE — low RAM").code).toBe("RESOURCE_UNAVAILABLE");
    expect(parsePipelineError("QUALITY_CONTROL_FAILED: final output file missing").code).toBe("QUALITY_CONTROL_FAILED");
  });

  it("starts at idle with 0 progress", () => {
    const empty = emptyProductionState();
    expect(empty.progress).toBe(0);
    expect(empty.status).toBe("idle");
    expect(empty.outputValidated).toBe(false);
  });
});

describe("Step 5 marketing plan from product data", () => {
  it("builds plan from real product fields without inventing price/specs", () => {
    const fields = applyMarketingDefaults({
      ...emptyMarketingFields(),
      objective: "Product Awareness",
      audienceType: "Locals",
      platforms: ["TikTok"],
    });
    const plan = buildStructuredMarketingPlan(fields, sampleProduct(), null);
    expect(plan.mainSellingPoint).toMatch(/Keeps water cold|Leak-proof|Cert Bottle|Reusable/);
    expect(plan.message).toContain("Cert Bottle");
    expect(plan.videoObjective).toBe("Product Awareness");
    const concept = buildVideoConcept(fields, sampleProduct(), plan);
    expect(concept.approximateDurationSec).toBeGreaterThan(0);
    expect(concept.ctaPlacement).toMatch(/Final/i);
  });
});
