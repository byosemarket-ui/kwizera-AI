import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ensureIntelligenceLayer,
  resetIntelligenceLayerForTests,
} from "../../../../ai/intelligence-layer/index.js";
import { buildCompactIntelligenceContext } from "../../../../ai/intelligence-layer/context-builder.js";
import { mapTransitionSafe } from "../../../../ai/intelligence-layer/types.js";

describe("intelligence-layer", () => {
  let tmp: string;

  beforeEach(async () => {
    resetIntelligenceLayerForTests();
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-intel-"));
  });

  afterEach(async () => {
    resetIntelligenceLayerForTests();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("creates, retrieves, and isolates project learning events", async () => {
    const layer = await ensureIntelligenceLayer(tmp);
    const a = await layer.recordRenderLearning({
      projectId: "proj-a",
      qualityScore: 60,
      planSource: "deterministic",
      sceneDurationsMs: [2000],
      transitions: ["cut"],
      motions: ["HOLD"],
      scenePurposes: ["FEATURE"],
      renderSucceeded: true,
    });
    await layer.recordRenderLearning({
      projectId: "proj-b",
      qualityScore: 90,
      planSource: "ai",
      sceneDurationsMs: [2500],
      transitions: ["fade"],
      motions: ["PRODUCT_FOCUS"],
      scenePurposes: ["HOOK"],
      renderSucceeded: true,
    });

    expect(a.event.eventId).toBeTruthy();
    expect(layer.getProjectLearning("proj-a")).toHaveLength(1);
    expect(layer.getProjectLearning("proj-a")[0]!.projectId).toBe("proj-a");
    expect(layer.getProjectLearning("proj-b")).toHaveLength(1);
    expect(layer.getProjectLearning("proj-b")[0]!.projectId).toBe("proj-b");
  });

  it("refuses unsafe promotion for weak/failed learning", async () => {
    const layer = await ensureIntelligenceLayer(tmp);
    const failed = await layer.recordRenderLearning({
      projectId: "proj-fail",
      qualityScore: 40,
      planSource: "ai",
      sceneDurationsMs: [2000],
      transitions: ["cut"],
      motions: ["HOLD"],
      scenePurposes: ["HOOK"],
      renderSucceeded: false,
    });
    expect(failed.promoted).toHaveLength(0);
    expect(failed.refused.length).toBeGreaterThan(0);

    const weak = await layer.recordRenderLearning({
      projectId: "proj-weak",
      qualityScore: 72,
      planSource: "ai",
      sceneDurationsMs: [2000],
      transitions: ["cut"],
      motions: ["PRODUCT_FOCUS"],
      scenePurposes: ["HOOK"],
      renderSucceeded: true,
    });
    // Single weak observation (quality < 85, only 1 project) must not promote.
    expect(weak.promoted).toHaveLength(0);
    expect(weak.refused.some((r) => /Insufficient|too weak|Failed/i.test(r.reason))).toBe(true);
  });

  it("promotes abstract pattern on strong evidence and retrieves on second pass", async () => {
    const layer = await ensureIntelligenceLayer(tmp);
    const first = await layer.recordRenderLearning({
      projectId: "proj-strong",
      qualityScore: 88,
      planSource: "ai",
      aiModelId: "llama3.2:1b",
      sceneDurationsMs: [2800, 3000],
      transitions: ["cut", "fade"],
      motions: ["PRODUCT_FOCUS", "HOLD"],
      scenePurposes: ["HOOK", "CTA"],
      renderSucceeded: true,
    });
    expect(first.promoted.length).toBeGreaterThan(0);
    expect(first.promoted[0]!.scope).toBe("global-abstract");
    expect(first.promoted[0]!.statement).not.toMatch(/proj-strong|customer|John/i);

    const proof = await layer.secondPassProof({
      projectId: "proj-next",
      productName: "Luxury Perfume",
      category: "beauty",
      durationSeconds: 20,
      cta: "Shop",
      platform: "social",
      assetRoles: [
        { assetId: "a1", viewRole: "HERO" },
        { assetId: "a2", viewRole: "DETAIL" },
      ],
      useOllama: false,
    });
    expect(proof.patternsRetrieved.length).toBeGreaterThan(0);
    expect(proof.learningInfluenced).toBe(true);
    expect(proof.decision.knowledgePatternIds.length).toBeGreaterThan(0);
    expect(proof.decision.transition === "cut" || proof.decision.transition === "fade").toBe(true);
  });

  it("builds compact deterministic context under budget", () => {
    const a = buildCompactIntelligenceContext({
      projectId: "p1",
      productName: "Perfume",
      category: "beauty",
      platform: "tiktok",
      durationSeconds: 20,
      cta: "Shop now",
      assetRoles: [
        { assetId: "1", viewRole: "HERO" },
        { assetId: "2", viewRole: "DETAIL" },
      ],
      charBudget: 1200,
    });
    const b = buildCompactIntelligenceContext({
      projectId: "p1",
      productName: "Perfume",
      category: "beauty",
      platform: "tiktok",
      durationSeconds: 20,
      cta: "Shop now",
      assetRoles: [
        { assetId: "1", viewRole: "HERO" },
        { assetId: "2", viewRole: "DETAIL" },
      ],
      charBudget: 1200,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a).length).toBeLessThanOrEqual(1200);
    expect(a.topSkills.length).toBeGreaterThan(0);
  });

  it("clamps unsupported transitions", () => {
    expect(mapTransitionSafe("morph-wipe")).toBe("cut");
    expect(mapTransitionSafe("soft fade dissolve")).toBe("fade");
  });

  it("clamps unsupported motion language on decide", async () => {
    const layer = await ensureIntelligenceLayer(tmp);
    const decision = await layer.decide({
      projectId: "proj-clamp",
      productName: "Product",
      category: "beauty",
      durationSeconds: 15,
      cta: "Buy",
      platform: "social",
      assetRoles: [{ assetId: "a1", viewRole: "HERO" }],
      useOllama: false,
    });
    expect(["PRODUCT_FOCUS", "DETAIL_PUSH", "SUBTLE_PUSH", "HOLD", null]).toContain(decision.motion);
    expect(decision.transition === "cut" || decision.transition === "fade").toBe(true);
  });
});
