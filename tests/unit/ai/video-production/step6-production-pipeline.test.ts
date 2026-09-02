import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  applyProductionModeToClip,
  resolveProductionRenderProfile,
} from "../../../../ai/video-production/production-render-profile.js";
import { verifyOutputFileOnDisk } from "../../../../ai/video-production/output-verify.js";
import { rebindCreativePlanScenes } from "../../../../ai/video-production/plan-to-timeline.js";
import type { VideoTimelineClip } from "../../../../ai/video-production/types.js";
import type { CreativeProject } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import type { CreativePlan } from "../../../../ai/creative-planning/creative-planning-manager.js";

function clip(overrides: Partial<VideoTimelineClip> = {}): VideoTimelineClip {
  return {
    id: "c1",
    sceneId: "s1",
    order: 1,
    purpose: "HOOK",
    assetId: "a1",
    startMs: 0,
    durationMs: 2000,
    layer: "video",
    camera: "hero",
    motion: "hold",
    lighting: "",
    background: "",
    transitionIn: "cut",
    transitionOut: "cut",
    text: [],
    audioDirection: "",
    ...overrides,
  };
}

describe("Step 6 production render profile", () => {
  it("uses subtle motion for classic showcase", () => {
    const profile = resolveProductionRenderProfile("CLASSIC_SHOWCASE");
    expect(profile.motionStyle).toBe("subtle");
    const adjusted = applyProductionModeToClip(clip({ motion: "pan-left", order: 2 }), profile);
    expect(adjusted.motion).toBe("slow-zoom");
  });

  it("upgrades hold to dynamic motion for AI product motion", () => {
    const profile = resolveProductionRenderProfile("AI_PRODUCT_MOTION");
    const adjusted = applyProductionModeToClip(clip({ motion: "hold", purpose: "HOOK" }), profile);
    expect(adjusted.motion).toBe("image-reveal");
  });

  it("does not claim generative 3D when provider is unavailable", () => {
    const profile = resolveProductionRenderProfile("CINEMATIC_3D");
    expect(profile.usesGenerativeVideo).toBe(false);
    expect(profile.providerHonestLabel).toMatch(/unavailable|FFmpeg/i);
  });
});

describe("Step 6 stale asset rebinding", () => {
  it("rebinds plan scenes to current originals", () => {
    const now = new Date().toISOString();
    const project: CreativeProject = {
      id: "p1",
      name: "Shoe",
      createdAt: now,
      modifiedAt: now,
      productImages: [
        { id: "new-asset", fileName: "front.png", mimeType: "image/png", sizeBytes: 10, uploadedAt: now, url: "/front.png" },
      ],
      productInformation: { name: "Oxford", category: "Shoes", description: "" },
      brandInformation: { name: "KWIZERA" },
      campaignInformation: { name: "Launch", objective: "Showcase" },
      targetAudience: "All",
      language: "English",
      platform: "tiktok",
      workspaceSettings: {},
    };
    const plan = {
      id: "plan-1",
      projectId: "p1",
      version: 1,
      scenes: [{ id: "s1", order: 1, purpose: "HOOK", assetId: "stale-asset", durationSeconds: 2 }],
    } as CreativePlan;
    const repaired = rebindCreativePlanScenes(project, plan);
    expect(repaired.scenes[0]?.assetId).toBe("new-asset");
  });
});

describe("Step 6 output file verification", () => {
  it("rejects missing output files", async () => {
    const result = await verifyOutputFileOnDisk(path.join(os.tmpdir(), `missing-${Date.now()}.mp4`));
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("accepts a minimal valid mp4 header on disk", async () => {
    const file = path.join(os.tmpdir(), `kwizera-step6-${Date.now()}.mp4`);
    // Minimal ftyp box (not a playable video, but validates header path).
    const body = Buffer.alloc(2000, 0);
    body.writeUInt32BE(16, 0);
    body.write("ftyp", 4);
    body.write("isom", 8);
    await fs.writeFile(file, body);
    const result = await verifyOutputFileOnDisk(file);
    expect(result.valid).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(1000);
    await fs.rm(file, { force: true });
  });
});
