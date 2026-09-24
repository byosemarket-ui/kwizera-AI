import { describe, expect, it, vi } from "vitest";
import {
  buildVisionIdentityQaPrompt,
  probeVisionQaAvailable,
  runVisionIdentityCheck,
} from "../../../../ai/pmv-qa/vision-identity-check.js";
import type { ProductIdentityLock } from "../../../../desktop/product-identity-lock/types.js";
import {
  ALLOWED_CREATIVE_CHANGES,
  PRODUCT_IDENTITY_LOCK_VERSION,
  PROTECTED_PRODUCT_ATTRIBUTES,
} from "../../../../desktop/product-identity-lock/types.js";

function attr(value: string) {
  return { value, confidence: 0.9, evidenceAssetId: "hero-1", source: "observed-from-image" as const };
}

function sampleLock(): ProductIdentityLock {
  return {
    version: PRODUCT_IDENTITY_LOCK_VERSION,
    identityVersion: "id-v1",
    projectId: "proj-1",
    profileId: "profile-1",
    analysisVersion: "step7-v1",
    analysisCapability: "VISION_ANALYSIS",
    status: "LOCKED",
    heroAssetId: "hero-1",
    productAssetIds: ["hero-1", "side-1"],
    assetFingerprint: "fp",
    productType: "footwear",
    shape: attr("boot"),
    silhouette: attr("ankle boot"),
    colors: [attr("oak brown")],
    logo: attr("KWIZERA"),
    branding: attr("KWIZERA Boots"),
    material: attr("leather"),
    texture: attr("smooth"),
    pattern: attr("unknown"),
    sole: attr("Goodyear welt"),
    laces: attr("unknown"),
    structure: attr("boot"),
    design: attr("classic"),
    proportions: attr("standard"),
    distinctiveDetails: [attr("Goodyear welt")],
    protectedAttributes: [...PROTECTED_PRODUCT_ATTRIBUTES],
    allowedCreativeChanges: [...ALLOWED_CREATIVE_CHANGES],
    sourceEvidence: [],
    confidence: 0.85,
    warnings: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lockedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("Phase 6 — vision identity QA", () => {
  it("builds a prompt that distinguishes protected vs allowed creative changes", () => {
    const prompt = buildVisionIdentityQaPrompt(sampleLock());
    expect(prompt).toMatch(/oak brown/);
    expect(prompt).toMatch(/Allowed creative changes/i);
    expect(prompt).toMatch(/background/i);
    expect(prompt).not.toMatch(/sk-|api[_-]?key/i);
  });

  it("reports UNAVAILABLE when VISION_ANALYSIS is not online", async () => {
    const runtime = {
      describe: () => ({ status: "UNAVAILABLE", source: "LOCAL", reason: "not mapped" }),
      execute: vi.fn(),
    };
    const available = await probeVisionQaAvailable(runtime as never);
    expect(available).toBe(false);
    const result = await runVisionIdentityCheck({
      runtime: runtime as never,
      lock: sampleLock(),
      projectId: "proj-1",
      imageBase64: Buffer.alloc(32, 1).toString("base64"),
    });
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.onlineExecuted).toBe(false);
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it("routes through CapabilityRuntime and never invents PASS on bad JSON", async () => {
    const runtime = {
      describe: () => ({
        status: "READY",
        source: "ONLINE",
        providerId: "provider-openai",
        modelId: "gpt-4o-mini",
        timeoutMs: 30_000,
      }),
      execute: vi.fn(async () => ({
        ok: true,
        outputText: "not-json-at-all",
        providerId: "provider-openai",
        modelId: "gpt-4o-mini",
        providerType: "openai",
      })),
    };
    const result = await runVisionIdentityCheck({
      runtime: runtime as never,
      lock: sampleLock(),
      projectId: "proj-1",
      imageBase64: Buffer.alloc(64, 2).toString("base64"),
      mimeType: "image/jpeg",
    });
    expect(runtime.execute).toHaveBeenCalledWith(
      "VISION_ANALYSIS",
      expect.objectContaining({ mode: "vision", projectId: "proj-1" }),
    );
    expect(result.onlineExecuted).toBe(true);
    expect(result.status).toBe("UNCERTAIN");
    expect(JSON.stringify(result)).not.toMatch(/sk-|api[_-]?key/i);
  });

  it("returns FAIL when vision reports critical identity mismatch", async () => {
    const runtime = {
      describe: () => ({ status: "READY", source: "ONLINE", timeoutMs: 30_000 }),
      execute: vi.fn(async () => ({
        ok: true,
        outputText: JSON.stringify({
          identityMatch: false,
          criticalFailures: ["logo changed"],
          allowedCreativeOk: true,
          confidence: 0.8,
          notes: ["background change is allowed"],
        }),
        providerId: "provider-openai",
        modelId: "gpt-4o-mini",
      })),
    };
    const result = await runVisionIdentityCheck({
      runtime: runtime as never,
      lock: sampleLock(),
      projectId: "proj-1",
      imageBase64: "abc",
    });
    expect(result.status).toBe("FAIL");
    expect(result.failures).toContain("logo changed");
    expect(result.onlineExecuted).toBe(true);
  });
});
