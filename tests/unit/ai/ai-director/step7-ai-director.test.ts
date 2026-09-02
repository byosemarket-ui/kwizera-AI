import { describe, expect, it } from "vitest";
import { buildVerifiedFactsContext } from "../../../../ai/creative-planning/verified-facts-context.js";
import { buildPlanReview, buildDecisionTrace, buildInputFingerprint } from "../../../../ai/ai-director/decision-trace.js";
import { runDeterministicQualityReview } from "../../../../ai/video-production/ai-quality-review.js";
import type { AiCreativePlannerInput } from "../../../../ai/creative-planning/ai-creative-planner.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";

function minimalInput(overrides?: Partial<AiCreativePlannerInput>): AiCreativePlannerInput {
  const project = {
    id: "proj-1",
    name: "Test Shoe",
    productInformation: {
      name: "Oxford Shoe",
      category: "Shoes",
      description: "Brown leather oxford",
      price: 45000,
      originalPrice: 60000,
      currency: "RWF",
    },
    productImages: [{ id: "img-1", fileName: "a.png", mimeType: "image/png", sizeBytes: 100, width: 100, height: 100 }],
    brandInformation: {},
    campaignInformation: { callToAction: "Shop now" },
    language: "English",
    platform: "tiktok",
    targetAudience: "Professionals",
  } as unknown as CreativeProject;

  return {
    project,
    assets: [],
    videoSettings: {
      productionMode: "AI_PRODUCT_MOTION",
      platform: "tiktok",
      durationSeconds: 15,
      language: "English",
      objective: "Showcase product",
    },
    commercial: {
      pricing: { currentPrice: 45000, originalPrice: 60000, currency: "RWF" },
      missing: [],
    } as AiCreativePlannerInput["commercial"],
    ...overrides,
  };
}

describe("Step 7 AI Director", () => {
  it("builds verified facts without inventing unknown data", () => {
    const facts = buildVerifiedFactsContext(minimalInput());
    expect(facts.allowedFacts.some((f) => f.includes("Oxford Shoe"))).toBe(true);
    expect(facts.priceAllowed).toBe(true);
    expect(facts.discountAllowed).toBe(true);
    expect(facts.ctaAllowed).toBe("Shop now");
    expect(facts.unknownFacts).not.toContain("Product name");
  });

  it("marks unknown price when not provided", () => {
    const input = minimalInput();
    input.project.productInformation = {
      ...input.project.productInformation!,
      price: undefined,
      originalPrice: undefined,
    };
    input.commercial = { pricing: {}, missing: ["price"] } as AiCreativePlannerInput["commercial"];
    const facts = buildVerifiedFactsContext(input);
    expect(facts.priceAllowed).toBe(false);
    expect(facts.unknownFacts).toContain("Current price");
  });

  it("builds plan review labels from scenes", () => {
    const review = buildPlanReview([
      { id: "s1", order: 1, purpose: "HOOK", durationSeconds: 3 } as never,
      { id: "s2", order: 2, purpose: "CTA", durationSeconds: 2 } as never,
    ]);
    expect(review).toHaveLength(2);
    expect(review[0]?.label).toBe("Product Hook");
    expect(review[1]?.label).toBe("Call To Action");
  });

  it("builds decision trace bound to project", () => {
    const input = minimalInput();
    const trace = buildDecisionTrace(input, {
      scenes: [{ id: "s1", order: 1, purpose: "HOOK", assetId: "img-1", durationSeconds: 3 } as never],
      source: "deterministic",
      warnings: [],
    }, 2);
    expect(trace.projectId).toBe("proj-1");
    expect(trace.fallbackUsed).toBe(true);
    expect(trace.heroAssetId).toBe("img-1");
    expect(trace.creativePlanVersion).toBe(2);
  });

  it("detects input fingerprint change when images change", () => {
    const input = minimalInput();
    const fp1 = buildInputFingerprint(input);
    input.project.productImages.push({
      id: "img-2", fileName: "b.png", mimeType: "image/png", sizeBytes: 100, width: 100, height: 100,
    } as never);
    const fp2 = buildInputFingerprint(input);
    expect(fp1).not.toBe(fp2);
  });

  it("runs deterministic quality review without blocking", () => {
    const review = runDeterministicQualityReview({
      video: {
        timeline: [{ order: 1, purpose: "HOOK", assetId: "img-1", durationMs: 3000 } as never],
        creativePlanId: "plan-1",
        creativePlanVersion: 1,
      } as never,
      plan: {
        scenes: [{ order: 1, purpose: "HOOK", assetId: "img-1" } as never],
        callToAction: "Shop now",
        timelineDurationMs: 3000,
      } as never,
      project: minimalInput().project,
      probed: { durationMs: 3000, width: 1080, height: 1920, sizeBytes: 50000 } as never,
      technicalChecks: { playable: true, fileExists: true },
    });
    expect(review.blocking).toBe(false);
    expect(review.score).toBeGreaterThan(0);
    expect(review.source).toBe("deterministic");
  });
});
