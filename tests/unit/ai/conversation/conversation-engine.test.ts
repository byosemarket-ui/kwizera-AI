import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AiConversationEngine } from "../../../../ai/conversation/conversation-engine.js";
import { FoundationKnowledgeSearchProvider, FoundationMemorySearchProvider } from "../../../../ai/decision/providers/foundation-search-providers.js";

const roots: string[] = [];

function coreStub(decisionEngine?: { isInitialized: () => boolean; decide: () => Promise<unknown> }) {
  return {
    coordinator: { beginSession: () => "core-session" },
    memoryFoundation: undefined,
    knowledgeFoundation: undefined,
    decisionEngine,
  };
}

async function createEngine(decisionEngine?: { isInitialized: () => boolean; decide: () => Promise<unknown> }): Promise<AiConversationEngine> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-conversation-"));
  roots.push(root);
  const engine = new AiConversationEngine();
  await engine.initialize(coreStub(decisionEngine) as never, root);
  return engine;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("AiConversationEngine", () => {
  it("classifies a mixed-language image request and persists its history", async () => {
    const engine = await createEngine();
    const first = await engine.respond({ message: "Muraho, please create an image of coffee for marketing" });
    const second = await engine.respond({ conversationId: first.conversation.id, message: "Use a clean studio background please" });

    expect(first.language).toBe("mixed");
    expect(first.plan.intent).toBe("image-generation");
    expect(first.plan.readyForWorkflow).toBe(true);
    expect(second.conversation.messages).toHaveLength(4);
    expect(engine.list()).toHaveLength(1);
  });

  it("asks for missing detail before preparing a workflow", async () => {
    const engine = await createEngine();
    const result = await engine.respond({ message: "Create image" });

    expect(result.plan.readyForWorkflow).toBe(false);
    expect(result.plan.missingInformation).toContain("Describe the product, goal, or desired outcome.");
    expect(result.response).toContain("Before I prepare the workflow");
  });

  it("records a non-executing decision and planning preview for a ready request", async () => {
    const engine = await createEngine({
      isInitialized: () => true,
      decide: async () => ({
        decisionId: "decision-preview",
        status: "approved",
        approved: true,
        canExecute: true,
        missingInformation: [],
        rationale: { rejectedAlternatives: [{ id: "alternate" }] },
        planningResult: { executionPlan: { taskList: [{ id: "task-1" }, { id: "task-2" }], estimatedTime: { totalMs: 1200 } }, riskAnalysis: { possibleRisks: ["provider availability"] } },
      }),
    });

    const result = await engine.respond({ message: "Create an image campaign for a coffee launch" });

    expect(result.plan.decision).toMatchObject({ decisionId: "decision-preview", approved: true, taskCount: 2, estimatedProcessingMs: 1200 });
    expect(result.plan.readyForWorkflow).toBe(true);
  });

  it("dispatches a confirmed, project-scoped pending workflow through its configured executor", async () => {
    const engine = await createEngine();
    const dispatched: string[] = [];
    engine.setExecutionDispatcher({
      dispatch: async (projectId) => {
        dispatched.push(projectId);
        return { jobId: "pipeline-job" };
      },
    });

    const prepared = await engine.respond({ projectId: "project-1", message: "Create an image campaign for a coffee launch" });
    const confirmed = await engine.respond({ conversationId: prepared.conversation.id, projectId: "project-1", message: "Confirm" });

    expect(dispatched).toEqual(["project-1"]);
    expect(confirmed.execution).toEqual({ dispatched: true, jobId: "pipeline-job" });
    expect(confirmed.response).toContain("started the image-generation workflow");
  });

  it("does not invent memory or knowledge results while foundations are unavailable", async () => {
    const core = coreStub() as never;
    await expect(new FoundationMemorySearchProvider(core).search("coffee", {})).resolves.toMatchObject({ found: false, items: [] });
    await expect(new FoundationKnowledgeSearchProvider(core).search("coffee", {})).resolves.toMatchObject({ found: false, items: [] });
  });
});