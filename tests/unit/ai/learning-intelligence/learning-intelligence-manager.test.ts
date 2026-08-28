import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiCoreManager } from "../../../../ai/core/ai-core-manager.js";
import { CreativeWorkspaceManager } from "../../../../ai/creative-workspace/creative-workspace-manager.js";
import { DecisionIntelligenceManager } from "../../../../ai/decision-intelligence/decision-intelligence-manager.js";
import { ImageIntelligenceManager } from "../../../../ai/image-intelligence/image-intelligence-manager.js";
import { AiLearningManager } from "../../../../ai/learning-intelligence/learning-intelligence-manager.js";
import { MarketingIntelligenceManager } from "../../../../ai/marketing-intelligence/marketing-intelligence-manager.js";
import { AiModelManager } from "../../../../ai/model-management/ai-model-manager.js";
import { ProductIntelligenceManager } from "../../../../ai/product-intelligence/product-intelligence-manager.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function stubCore(): AiCoreManager {
  return {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  } as unknown as AiCoreManager;
}

async function createLearningDeps(core: AiCoreManager) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-learning-"));
  roots.push(root);
  const workspace = new CreativeWorkspaceManager();
  await workspace.initialize(root);
  const project = await workspace.createProject("Bottle Launch");
  await workspace.updateProject(project.id, {
    productInformation: { name: "KWIZERA Steel Bottle", category: "Beverage", description: "Black insulated stainless steel bottle" },
    brandInformation: { name: "KWIZERA", voice: "confident" },
    campaignInformation: { name: "Launch", objective: "Increase awareness", callToAction: "Shop now" },
    targetAudience: "Active urban professionals",
    platform: "instagram",
  });
  await workspace.uploadImage(project.id, { fileName: "bottle.png", mimeType: "image/png", dataBase64: "iVBORw0KGgo=" });
  const models = new AiModelManager();
  await models.initialize(root, core);
  await models.install("studio-language-base");
  const images = new ImageIntelligenceManager();
  await images.initialize(root, { core, workspace });
  const products = new ProductIntelligenceManager();
  await products.initialize(root, { core, workspace });
  products.attachImageIntelligence(images);
  const marketing = new MarketingIntelligenceManager();
  await marketing.initialize(root, { core, workspace, products, images });
  const decisions = new DecisionIntelligenceManager();
  await decisions.initialize(root, { core, workspace, models, products, images, marketing });
  return { root, workspace, project, products, images, marketing, decisions };
}

describe("AiLearningManager", { timeout: 60_000 }, () => {
  it("learns from a successful project and user feedback with persistent analytics", async () => {
    const core = stubCore();
    const { root, workspace, project, products, images, marketing, decisions } = await createLearningDeps(core);
    const manager = new AiLearningManager();
    await manager.initialize(root, { core, workspace, products, images, marketing, decisions });
    const profile = await manager.learnFromProject(project.id, "success");
    expect(profile.progress).toBeGreaterThan(70);
    expect(profile.knowledgeGrowth).toBe(12);
    expect(profile.improvements[0]).toContain("Retain");
    const feedback = await manager.recordFeedback(project.id, "Prefer concise benefit-led copy.");
    expect(feedback.userPreferences[0]).toContain("concise");
    expect((await manager.getDashboard(project.id)).analytics.experiences).toBe(2);
  });

  it("does not register unknown Memory or Knowledge catalog ids during initialize", async () => {
    const attempted: string[] = [];
    const core = {
      ...stubCore(),
      memoryFoundation: {
        isStartupComplete: () => true,
        registerMemoryModule: (registration: { memoryId: string }) => {
          attempted.push(registration.memoryId);
          if (registration.memoryId !== "learning-memory") {
            throw new Error(`Unknown memory category: ${registration.memoryId}`);
          }
        },
      },
      knowledgeFoundation: {
        isStartupComplete: () => true,
        registerKnowledgeModule: (registration: { knowledgeId: string }) => {
          attempted.push(registration.knowledgeId);
          if (registration.knowledgeId !== "workflow-knowledge") {
            throw new Error(`Unknown knowledge category: ${registration.knowledgeId}`);
          }
        },
      },
    } as unknown as AiCoreManager;

    const { root, workspace, products, images, marketing, decisions } = await createLearningDeps(core);
    const manager = new AiLearningManager();
    await expect(manager.initialize(root, { core, workspace, products, images, marketing, decisions })).resolves.toBeUndefined();
    expect(manager.isInitialized()).toBe(true);
    expect(attempted).not.toContain("learning-intelligence-runtime");
  });
});
