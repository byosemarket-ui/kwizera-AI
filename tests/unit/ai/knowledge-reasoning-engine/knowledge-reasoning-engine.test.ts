import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, KnowledgeStorageType, KnowledgeVerificationStatus } from "@ai";

describe("AiKnowledgeReasoningEngine", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-reasoning-test-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("selects validated professional guidance and explains alternatives and risks", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-reasoning-test");
    const foundation = core.getManager().knowledgeFoundation!;

    await foundation.getStorageEngine().storeRecord({
      knowledgeId: "camera-premium",
      knowledgeType: KnowledgeStorageType.Video,
      category: "acquired-knowledge",
      title: "Premium Camera Lighting",
      description: "Professional camera and lighting techniques.",
      source: "knowledge-acquisition-engine",
      qualityScore: 94,
      confidenceScore: 92,
      verificationStatus: KnowledgeVerificationStatus.Verified,
      payload: {
        professionalTechniques: ["Use a controlled hero shot with premium key lighting."],
        bestPractices: ["Keep the camera move motivated by the product reveal."],
        decisionRules: ["If the product is luxury, prefer premium lighting."],
        commonMistakes: ["Avoid uncontrolled handheld movement during the hero reveal."],
      },
    });
    await foundation.getStorageEngine().storeRecord({
      knowledgeId: "camera-alternative",
      knowledgeType: KnowledgeStorageType.Video,
      category: "acquired-knowledge",
      title: "Alternative Camera Composition",
      description: "Alternative product camera technique.",
      source: "knowledge-acquisition-engine",
      qualityScore: 82,
      confidenceScore: 80,
      verificationStatus: KnowledgeVerificationStatus.Verified,
      payload: {
        professionalTechniques: ["Use a side angle for product detail."],
        bestPractices: ["Preserve product separation from the background."],
        decisionRules: ["When detail is the priority, use a side angle."],
        commonMistakes: ["Do not hide the product silhouette."],
      },
    });

    const reasoning = await foundation.getKnowledgeReasoningEngine().reason("premium camera lighting");

    expect(reasoning.available).toBe(true);
    expect(reasoning.selected?.knowledgeId).toBe("camera-premium");
    expect(reasoning.alternatives).toHaveLength(1);
    expect(reasoning.risks).toContain("Avoid uncontrolled handheld movement during the hero reveal.");
    expect(reasoning.decisionRules).toContain("If the product is luxury, prefer premium lighting.");
    await core.stop();
  });

  it("records workflow and recommendation impact for a changed knowledge record", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-reasoning-test");
    const foundation = core.getManager().knowledgeFoundation!;
    const stored = await foundation.getStorageEngine().storeRecord({
      knowledgeId: "camera-video-impact",
      knowledgeType: KnowledgeStorageType.Video,
      category: "camera-video",
      title: "Camera Video Workflow",
      description: "Camera knowledge for video production.",
      source: "knowledge-acquisition-engine",
      qualityScore: 88,
      confidenceScore: 86,
      verificationStatus: KnowledgeVerificationStatus.Verified,
      payload: { professionalTechniques: ["Use a hero shot."], bestPractices: [], decisionRules: [], commonMistakes: [] },
    });

    const impact = await foundation.getKnowledgeReasoningEngine().analyzeImpact(stored.record!.knowledgeId, "create");

    expect(impact.affectedWorkflows).toEqual(expect.arrayContaining(["video-production", "camera-planning"]));
    expect(impact.affectedRecommendations).toEqual(expect.arrayContaining(["video", "camera"]));
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "impact", "camera-video-impact.json"))).toBe(true);
    await core.stop();
  });
});