import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  CAMERA_DOMAIN_ID,
  CAMERA_MOVEMENT_DOMAIN_ID,
  createAiCore,
  PROFESSIONAL_CAMERA_MOVEMENT_TOPICS,
  PROFESSIONAL_CAMERA_SETTING_TOPICS,
  REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS,
  REQUIRED_CAMERA_SETTING_TOPIC_IDS,
} from "@ai";

describe("Professional Camera Knowledge (Expansion Step 2)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-camera-knowledge-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("installs camera settings and movements with AI Me capabilities", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("camera-knowledge-expansion");
    const foundation = core.getManager().knowledgeFoundation!;
    const camera = foundation.getProfessionalCameraKnowledge();

    expect(REQUIRED_CAMERA_SETTING_TOPIC_IDS.length).toBe(15);
    expect(REQUIRED_CAMERA_MOVEMENT_TOPIC_IDS.length).toBe(22);
    expect(PROFESSIONAL_CAMERA_SETTING_TOPICS.length).toBe(15);
    expect(PROFESSIONAL_CAMERA_MOVEMENT_TOPICS.length).toBe(22);

    const install = camera.getLastInstall();
    expect(install?.installed).toBe(true);
    expect((install?.settingsInstalled ?? 0) + (install?.settingsUpdated ?? 0)).toBeGreaterThanOrEqual(15);
    expect((install?.movementsInstalled ?? 0) + (install?.movementsUpdated ?? 0)).toBeGreaterThanOrEqual(22);

    for (const topic of PROFESSIONAL_CAMERA_SETTING_TOPICS) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "test");
      expect(read.success).toBe(true);
    }
    for (const topic of PROFESSIONAL_CAMERA_MOVEMENT_TOPICS) {
      const read = await foundation.getStorageEngine().getRecord(topic.knowledgeId, "test");
      expect(read.success).toBe(true);
      expect(topic.whenToUse.length).toBeGreaterThan(0);
      expect(topic.relatedCameraSettings.length).toBeGreaterThan(0);
    }

    const health = await camera.runHealthCheck();
    expect(health.healthy).toBe(true);
    expect(health.missingConcepts).toEqual([]);
    expect(health.duplicateKnowledge).toEqual([]);
    expect(health.brokenRelationships).toEqual([]);

    const movement = camera.recommendMovement("smooth product showcase circle");
    expect(movement.available).toBe(true);
    expect(movement.reason.length).toBeGreaterThan(0);

    const settings = camera.recommendSettings("depth of field for product text");
    expect(settings.available).toBe(true);

    const compared = camera.compareMovements("dolly", "zoom");
    expect(compared.confidenceScore).toBeGreaterThan(0);
    expect(compared.differences.length).toBeGreaterThan(0);

    const answered = camera.answer("When should I use a gimbal?");
    expect(answered.available).toBe(true);

    const awareness = camera.getAiMeAwareness();
    expect(awareness.canRecommendMovement).toBe(true);
    expect(awareness.canExplainMovementChoice).toBe(true);
    expect(awareness.canRecommendSettings).toBe(true);
    expect(awareness.canCompareMovements).toBe(true);
    expect(awareness.cameraDomainReady).toBe(true);
    expect(awareness.cameraMovementDomainReady).toBe(true);

    expect(foundation.getKnowledgeDomainPlanner().getDomain(CAMERA_DOMAIN_ID)?.metadata.contentReady).toBe(true);
    expect(foundation.getKnowledgeDomainPlanner().getDomain(CAMERA_MOVEMENT_DOMAIN_ID)?.metadata.contentReady).toBe(
      true
    );
    expect(foundation.getKnowledgeDomainPlanner().getDomain("lighting-knowledge")?.metadata.contentReady).not.toBe(
      true
    );

    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "camera", "pack.json"))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", "camera-movement", "pack.json"))).toBe(true);

    await core.stop();
  }, 300_000);
});
