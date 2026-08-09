import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProfessionalKnowledgeCertificationEngine } from "@ai";

const REQUIRED = [
  ["video-production-knowledge", "video-production"],
  ["camera-knowledge", "camera"],
  ["camera-movement-knowledge", "camera-movement"],
  ["lighting-knowledge", "lighting"],
  ["composition-knowledge", "composition"],
  ["storytelling-knowledge", "storytelling"],
  ["scene-knowledge", "scene"],
  ["animation-knowledge", "animation"],
  ["motion-graphics-knowledge", "motion"],
  ["rendering-knowledge", "rendering"],
  ["video-editing-knowledge", "editing"],
  ["marketing-knowledge", "marketing"],
  ["branding-knowledge", "branding"],
  ["customer-psychology", "customer-psychology"],
  ["sales-psychology", "sales-psychology"],
  ["social-media-knowledge", "social-media"],
  ["industry-standards-knowledge", "industry-standards"],
] as const;

describe("Professional Knowledge Certification Engine (Step 10)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-professional-cert-"));
  });

  afterEach(() => {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("blocks certification when Professional Video Editing Knowledge is absent", async () => {
    const packs = REQUIRED.filter(([, slug]) => slug !== "editing").map(([domain, slug]) =>
      makePack(slug, domain)
    );
    for (const [, slug] of REQUIRED.filter(([, slug]) => slug !== "editing")) {
      fs.mkdirSync(path.join(root, "knowledge", "packs", slug, "versions"), { recursive: true });
    }

    const domains = new Map(
      REQUIRED.map(([domainId]) => [
        domainId,
        { metadata: { contentReady: domainId !== "video-editing-knowledge" } },
      ])
    );
    const healthy = { getLastHealth: () => ({ healthy: true }), repair: async () => ({ repaired: true, actions: [], remainingIssues: [] }) };
    const foundation = {
      integration: {
        getStatus: () => ({
          planningEngine: true,
          decisionEngine: true,
          workflowEngine: true,
        }),
      },
      getKnowledgeRoot: () => path.join(root, "knowledge"),
      getKnowledgeExtractionEngine: () => ({
        listPacks: () => packs,
        reloadPacks: async () => undefined,
      }),
      getKnowledgeDomainPlanner: () => ({
        getDomain: (id: string) => domains.get(id),
        listDomains: () => [...domains.entries()].map(([domainId, value]) => ({ domainId, ...value })),
      }),
      getGraphEngine: () => ({
        validateIntegrity: () => ({ valid: true, issuesRepaired: 0, diagnostics: [] }),
        getGraph: () => ({ nodes: { one: {} }, edgeCount: 120 }),
      }),
      getStorageEngine: () => ({
        getIndexEntries: () => packs.map((pack) => ({ knowledgeId: pack.items[0].knowledgeId })),
        getRecordCount: () => packs.length,
      }),
      getRetrievalEngine: () => ({
        search: async () => ({ success: true, results: [{ knowledgeId: "vp-professional-production-workflow" }] }),
      }),
      getKnowledgePackImportEngine: () => ({ getLastHealth: () => null }),
      getKnowledgeReasoningEngine: () => ({
        reason: async () => ({
          available: true,
          selected: { knowledgeId: "vp-professional-production-workflow" },
          relatedKnowledgeIds: ["cam-camera-fundamentals"],
          explanation: "Validated professional knowledge selected.",
        }),
      }),
      getProfessionalVideoProductionKnowledge: () => ({
        ...healthy,
        explain: () => ({ available: true }),
        recommendWorkflow: () => ({ available: true, workflow: ["Brief", "Produce"], reason: "Workflow available." }),
        recommendBestPractices: () => ({ available: true, practices: ["Use a brief"], reason: "Practice available." }),
      }),
      getProfessionalCameraKnowledge: () => ({
        ...healthy,
        recommendSettings: () => ({ available: true, title: "Aperture", topicId: "cam-aperture" }),
        recommendMovement: () => ({ available: true, name: "Dolly", movementId: "cmov-dolly" }),
        compareMovements: () => ({ confidenceScore: 93, recommendation: "Use a dolly for controlled reveals." }),
      }),
      getProfessionalLightingCompositionKnowledge: () => ({
        ...healthy,
        recommendLighting: () => ({ available: true, name: "Three-point lighting", topicId: "light-three-point", reason: "Lighting available." }),
      }),
      getProfessionalStorytellingSceneKnowledge: () => ({
        ...healthy,
        recommendSceneSequence: () => ({
          available: true,
          reason: "Scene sequence available.",
          knowledgeIds: ["story-three-act-structure"],
        }),
      }),
      getProfessionalAnimationMotionRenderingKnowledge: () => ({
        ...healthy,
        recommendRenderingSettings: () => ({
          available: true,
          reason: "Rendering settings available.",
          topicId: "render-export-settings",
        }),
      }),
      getProfessionalMarketingBrandingPsychologyKnowledge: () => ({
        ...healthy,
        recommendMarketingStrategy: () => ({
          available: true,
          reason: "Marketing strategy available.",
          topicId: "mkt-marketing-fundamentals",
        }),
      }),
      getProfessionalSocialMediaKnowledge: () => ({
        ...healthy,
        recommendPlatform: () => ({
          available: true,
          reason: "Platform available.",
          topicId: "sm-platform-selection",
        }),
      }),
      getProfessionalIndustryStandardsQualityKnowledge: () => ({
        ...healthy,
        evaluateProfessionalQuality: () => ({
          available: true,
          evaluationCriteria: ["Use measurable criteria"],
          scope: "Rule-based quality guidance.",
          knowledgeId: "std-industry-standards",
        }),
      }),
    };

    const engine = new ProfessionalKnowledgeCertificationEngine();
    engine.initialize(foundation as never, root);
    await engine.runStartup();

    const result = engine.getLastResult();
    expect(result?.certified).toBe(false);
    expect(result?.professionalCoverage.find((domain) => domain.domainId === "video-editing-knowledge")?.status).toBe(
      "blocked"
    );
    expect(result?.remainingGaps.join(" ")).toContain("Video Editing");
    expect(result?.certificatePath).toBeNull();
    expect(fs.existsSync(path.join(root, "knowledge", "certification", "professional-knowledge-verification-latest.json"))).toBe(
      true
    );
  });
});

function makePack(slug: string, domain: string) {
  return {
    packId: `pack-${slug}`,
    packSlug: slug,
    domain,
    title: `${slug} knowledge`,
    version: 1,
    status: "generated",
    items: [
      {
        knowledgeId: `${slug}-knowledge`,
        title: `${slug} knowledge`,
        domain,
        category: "professional",
        description: "Professional knowledge.",
        coreConcepts: ["professional"],
        definitions: ["Professional knowledge definition."],
        rules: ["Use validated guidance."],
        bestPractices: ["Use a documented process."],
        professionalTechniques: ["Apply professional technique."],
        workflow: ["Plan", "Review"],
        decisionRules: ["Follow quality rules."],
        commonMistakes: ["Skipping review."],
        troubleshooting: ["Review the requirements."],
        recommendations: ["Use the professional workflow."],
        examples: ["Professional example."],
        professionalStandards: ["Document acceptance criteria."],
        relatedTopics: [],
        keywords: ["professional"],
        confidenceScore: 92,
        qualityScore: 92,
        sourceMetadata: [{ name: "test", type: "test", reliability: 100 }],
        issues: [],
        improved: false,
      },
    ],
    structuredKnowledge: {
      title: `${slug} knowledge`,
      category: "professional",
      domain,
      description: "Professional knowledge.",
      sections: [{ title: "Guidance", kind: "guidance", items: ["Professional guidance."] }],
      concepts: ["professional"],
      entities: [domain],
      terminology: ["professional"],
      rules: ["Use validated guidance."],
      bestPractices: ["Use a documented process."],
      professionalTechniques: ["Apply professional technique."],
      examples: ["Professional example."],
      commonMistakes: ["Skipping review."],
      qualityRules: ["Document acceptance criteria."],
      decisionRules: ["Follow quality rules."],
      workflowSteps: ["Plan", "Review"],
      prerequisites: ["Brief"],
      dependencies: [domain],
      relatedKnowledge: [],
      difficultyLevel: "advanced",
      confidenceScore: 92,
      sourceMetadata: [{ name: "test", type: "test", reliability: 100 }],
    },
    resourceIds: [],
    understandingIds: [],
    contentFingerprint: `fingerprint-${slug}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    originalDocumentsPreserved: true,
    issues: [],
  };
}
