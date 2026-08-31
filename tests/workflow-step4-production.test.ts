/**
 * Step 4 production engine — stage mapping and handoff context tests.
 */
import { describe, expect, it } from "vitest";
import { MODE_COPY } from "../ai/video-production/production-mode-types.js";
import { PRODUCTION_STAGES, isProductionOutputReady, stageCompletion } from "../desktop/final-review/final-review-engine.js";
import type { Step4HandoffPayload } from "../desktop/video-style/types.js";

describe("Step 4 production workflow", () => {
  it("maps production stages in ascending progress order", () => {
    expect(PRODUCTION_STAGES[0]?.minProgress).toBe(0);
    expect(PRODUCTION_STAGES.at(-1)?.minProgress).toBe(100);
    for (let i = 1; i < PRODUCTION_STAGES.length; i += 1) {
      expect(PRODUCTION_STAGES[i]!.minProgress).toBeGreaterThanOrEqual(PRODUCTION_STAGES[i - 1]!.minProgress);
    }
  });

  it("derives stage completion from real job progress", () => {
    expect(stageCompletion(100, 0)).toBe("done");
    expect(stageCompletion(30, 25)).toBe("active");
    expect(stageCompletion(10, 45)).toBe("pending");
  });

  it("preserves video style label in Step 4 handoff contract", () => {
    const handoff: Step4HandoffPayload = {
      version: 1,
      step: "step-4-final-review",
      projectId: "proj-1",
      projectName: "Chestnut Oxford",
      briefId: "brief-1",
      productId: "prod-1",
      planId: "plan-1",
      manifestId: null,
      assetIds: ["img-1", "img-2"],
      heroAssetId: "img-1",
      productionMode: "AI_PRODUCT_MOTION",
      styleLabel: MODE_COPY.AI_PRODUCT_MOTION.label,
      creativeTone: "Premium",
      platformId: "tiktok",
      platformLabel: "TikTok",
      formatLabel: "1080 × 1920",
      durationSeconds: 30,
      language: "Kinyarwanda",
      priceLabel: "20,000 RWF",
      discountLabel: "Save 56%",
      objective: "Product Showcase",
      sceneCount: 5,
      preparedAt: new Date().toISOString(),
    };
    expect(handoff.styleLabel).toBe("AI Product Motion");
    expect(handoff.productionMode).toBe("AI_PRODUCT_MOTION");
    expect(handoff.assetIds).toHaveLength(2);
    expect(handoff.priceLabel).toContain("RWF");
    expect(handoff.language).toBe("Kinyarwanda");
  });

  it("requires verified output URL and CURRENT status before ready", () => {
    expect(isProductionOutputReady(null)).toBe(false);
    expect(isProductionOutputReady({
      output: { url: "/api/workspace/projects/p/videos/out.mp4" },
      renderState: "completed",
      outputStatus: "CURRENT",
    } as never)).toBe(true);
    expect(isProductionOutputReady({
      output: { url: "/api/workspace/projects/p/videos/out.mp4" },
      renderState: "completed",
      outputStatus: "OUTDATED",
    } as never)).toBe(false);
  });
});
