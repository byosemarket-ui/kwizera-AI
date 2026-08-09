import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiCore, createAiCore, KnowledgeStorageType, KnowledgeVerificationStatus } from "@ai";

const TEST_TIMEOUT_MS = 180_000;

describe("AiKnowledgeReasoningEngine", () => {
  let storageRoot: string;
  let core: ReturnType<typeof createAiCore>;

  beforeAll(async () => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-reasoning-test-"));
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-reasoning-test");
  }, 600_000);

  afterAll(async () => {
    await core.stop();
    AiCore.resetInstance();
    fs.rmSync(storageRoot, { recursive: true, force: true });
  }, 120_000);

  it(
    "selects validated professional guidance and explains alternatives and risks",
    async () => {
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
      expect(reasoning.selected).toBeTruthy();
      expect(reasoning.grounded).toBe(true);
      expect(reasoning.processSteps).toHaveLength(8);
      expect(reasoning.explanation.toLowerCase()).toContain("selected");
      expect(reasoning.confidenceScore).toBeGreaterThan(0);
      expect(reasoning.consideredOptions.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "records workflow and recommendation impact for a changed knowledge record",
    async () => {
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
    },
    TEST_TIMEOUT_MS
  );

  it(
    "performs multi-domain professional reasoning with explanation and confidence",
    async () => {
      const engine = core.getManager().knowledgeFoundation!.getKnowledgeReasoningEngine();

      const result = await engine.reasonProfessional({
        request: "recommend camera lighting composition and marketing approach for a product advertisement on social media",
        objective: "Build a professional product ad recommendation",
        includeDomainModules: true,
        context: { product: "wireless earbuds", audience: "young professionals", platform: "instagram" },
        requiredDomains: [
          "camera-knowledge",
          "lighting-knowledge",
          "composition-knowledge",
          "marketing-knowledge",
          "social-media-knowledge",
          "industry-standards-knowledge",
        ],
      });

      expect(result.available).toBe(true);
      expect(result.grounded).toBe(true);
      expect(result.selected).toBeTruthy();
      expect(result.domainsUsed.length).toBeGreaterThan(1);
      expect(result.multiDomain).toBe(true);
      expect(result.domainContributions.length).toBeGreaterThan(0);
      expect(result.consideredOptions.length).toBeGreaterThan(1);
      expect(result.rejectedOptions.length).toBeGreaterThan(0);
      expect(result.explanation.toLowerCase()).toMatch(/selected|rejected|confidence/);
      expect(result.confidenceScore).toBeGreaterThan(50);
      expect(result.confidenceExplanation).toContain("Confidence");
      expect(result.professionalStandards.length + result.improvements.length).toBeGreaterThan(0);
      expect(result.processSteps.map((step) => step.name)).toEqual([
        "Understand the request",
        "Search relevant Knowledge Packs",
        "Analyze available knowledge",
        "Compare professional options",
        "Select the best solution",
        "Explain why it was selected",
        "Recommend improvements",
        "Estimate confidence",
      ]);

      const awareness = engine.getAiMeAwareness();
      expect(awareness.available).toBe(true);
      expect(awareness.groundedInKnowledgeFoundation).toBe(true);
      expect(awareness.decisionIntelligenceEnabled).toBe(true);

      const health = await engine.runHealthCheck();
      if (!health.healthy) {
        const repair = await engine.repair();
        expect(repair.repaired || repair.remainingIssues.length === 0).toBe(true);
      }
      const recheck = await engine.runHealthCheck();
      expect(recheck.healthy).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "identifies missing editing knowledge without inventing unsupported editing guidance",
    async () => {
      const result = await core.getManager().knowledgeFoundation!.getKnowledgeReasoningEngine().reasonProfessional({
        request: "recommend a professional video editing timeline and cut strategy",
        objective: "Editing workflow recommendation",
        requiredDomains: ["video-editing-knowledge"],
      });

      expect(result.missingInformation.some((item) => item.field.includes("video-editing"))).toBe(true);
      expect(result.problemAnalysis.toLowerCase()).toContain("editing");
      expect(core.getManager().knowledgeFoundation!.getKnowledgeReasoningEngine().getAiMeAwareness().decisionIntelligenceEnabled).toBe(
        true
      );
    },
    TEST_TIMEOUT_MS
  );
});
