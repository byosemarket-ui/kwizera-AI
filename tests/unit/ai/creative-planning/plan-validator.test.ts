import { describe, expect, it } from "vitest";
import {
  durationMatchesTarget,
  sceneTotalDurationMs,
  validateAiPlannerOutput,
  validateCreativePlan,
} from "../../../../ai/creative-planning/plan-validator.js";
import type { PlanScene } from "../../../../ai/creative-planning/creative-planning-manager.js";

function scene(partial: Partial<PlanScene> & { id: string; assetId: string }): PlanScene {
  return {
    order: 1,
    durationSeconds: 2,
    durationMs: 2000,
    purpose: "HOOK",
    visual: "",
    narration: "",
    camera: "medium-product",
    lighting: "",
    composition: "",
    animation: "",
    ...partial,
  };
}

describe("creative plan validator", () => {
  it("accepts plans that match target duration within tolerance", () => {
    const scenes = [
      scene({ id: "s1", assetId: "a1", durationMs: 7000 }),
      scene({ id: "s2", assetId: "a2", durationMs: 8000 }),
      scene({ id: "s3", assetId: "a3", durationMs: 7500 }),
      scene({ id: "s4", assetId: "a4", durationMs: 7500 }),
    ];
    expect(sceneTotalDurationMs(scenes)).toBe(30_000);
    expect(durationMatchesTarget(30_000, 30)).toBe(true);
    const result = validateCreativePlan({
      projectId: "p1",
      productionMode: "AI_PRODUCT_MOTION",
      planProductionMode: "AI_PRODUCT_MOTION",
      platformId: "tiktok",
      durationSeconds: 30,
      language: "Kinyarwanda",
      scenes,
      assetIds: ["a1", "a2", "a3", "a4"],
      productName: "Oxford",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects stale asset references and mode mismatches", () => {
    const result = validateCreativePlan({
      projectId: "p1",
      productionMode: "CLASSIC_SHOWCASE",
      planProductionMode: "AI_PRODUCT_MOTION",
      platformId: "instagram_reels",
      durationSeconds: 15,
      language: "English",
      scenes: [scene({ id: "s1", assetId: "stale", durationMs: 1500 })],
      assetIds: ["a1"],
      productName: "Bag",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.includes("stale"))).toBe(true);
    expect(result.errors.some((item) => item.includes("production mode"))).toBe(true);
  });

  it("validates AI planner output structure", () => {
    expect(validateAiPlannerOutput(null).valid).toBe(false);
    expect(validateAiPlannerOutput({ scenes: [{ id: "1", purpose: "HOOK", assetId: "a1", duration: 2 }] }).valid).toBe(true);
    expect(validateAiPlannerOutput({ scenes: [{ purpose: "HOOK" }] }).valid).toBe(false);
  });
});
