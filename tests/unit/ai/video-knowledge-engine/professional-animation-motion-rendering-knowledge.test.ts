import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  ANIMATION_DOMAIN_ID,
  createAiCore,
  MOTION_GRAPHICS_DOMAIN_ID,
  PROFESSIONAL_ANIMATION_TOPICS,
  PROFESSIONAL_MOTION_GRAPHICS_TOPICS,
  PROFESSIONAL_RENDERING_TOPICS,
  PROFESSIONAL_TRANSITION_TOPICS,
  RENDERING_DOMAIN_ID,
  REQUIRED_ANIMATION_TOPIC_IDS,
  REQUIRED_MOTION_GRAPHICS_TOPIC_IDS,
  REQUIRED_RENDERING_TOPIC_IDS,
  REQUIRED_TRANSITION_TOPIC_IDS,
} from "@ai";

describe("Professional Animation, Motion Graphics & Rendering Knowledge (Expansion Step 5)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-amr-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("installs animation, motion, transition, and rendering topics with AI Me capabilities", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("amr-expansion");
    const foundation = core.getManager().knowledgeFoundation!;
    const amr = foundation.getProfessionalAnimationMotionRenderingKnowledge();

    expect(REQUIRED_ANIMATION_TOPIC_IDS.length).toBe(12);
    expect(REQUIRED_MOTION_GRAPHICS_TOPIC_IDS.length).toBe(10);
    expect(REQUIRED_TRANSITION_TOPIC_IDS.length).toBe(10);
    expect(REQUIRED_RENDERING_TOPIC_IDS.length).toBe(12);
    expect(PROFESSIONAL_ANIMATION_TOPICS.length).toBe(12);
    expect(PROFESSIONAL_MOTION_GRAPHICS_TOPICS.length).toBe(10);
    expect(PROFESSIONAL_TRANSITION_TOPICS.length).toBe(10);
    expect(PROFESSIONAL_RENDERING_TOPICS.length).toBe(12);

    const install = amr.getLastInstall();
    expect(install?.installed).toBe(true);

    const health = await amr.runHealthCheck();
    expect(health.healthy).toBe(true);
    expect(health.brokenRelationships).toEqual([]);
    expect(health.duplicateKnowledge).toEqual([]);

    expect(amr.recommendAnimationStyle("playful product with anticipation").available).toBe(true);
    expect(amr.recommendMotionGraphics("logo sting for brand").available).toBe(true);
    expect(amr.recommendRenderingSettings("H.264 bitrate for youtube").available).toBe(true);
    expect(amr.recommendExportSettings("instagram reels export").available).toBe(true);
    expect(amr.explain("squash and stretch").available).toBe(true);
    expect(amr.answer("What export settings should I use for social?").available).toBe(true);

    const awareness = amr.getAiMeAwareness();
    expect(awareness.canRecommendAnimationStyles).toBe(true);
    expect(awareness.canRecommendExportSettings).toBe(true);
    expect(awareness.animationDomainReady).toBe(true);
    expect(awareness.motionGraphicsDomainReady).toBe(true);
    expect(awareness.renderingDomainReady).toBe(true);

    expect(foundation.getKnowledgeDomainPlanner().getDomain(ANIMATION_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain(MOTION_GRAPHICS_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain(RENDERING_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain("video-editing-knowledge")?.metadata.contentReady).not.toBe(
      true
    );

    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "animation", "pack.json"))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "motion", "pack.json"))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "rendering", "pack.json"))).toBe(true);

    await core.stop();
  }, 900_000);
});
