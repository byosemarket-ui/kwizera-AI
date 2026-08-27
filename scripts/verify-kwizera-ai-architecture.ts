/**
 * Step 1 — Verify KWIZERA AI Core foundations are connected without requiring Ollama.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/core/index.js";

async function main(): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kwizera-arch-"));
  const core = createAiCore({ storageRootOverride: root });
  const manager = core.getManager();

  await core.start("architecture-verify");

  const checks = {
    ready: manager.isReady(),
    memory: Boolean(manager.memoryFoundation),
    knowledge: Boolean(manager.knowledgeFoundation),
    product: Boolean(manager.productIntelligenceFoundation),
    image: Boolean(manager.imageIntelligenceFoundation),
    video: Boolean(manager.videoIntelligenceFoundation),
    workflow: Boolean(manager.workflowEngine),
    decision: Boolean(manager.decisionEngine),
    models: Boolean(manager.modelManager),
    bus: Boolean(manager.communicationBus),
    modules: Boolean(manager.moduleManager),
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ foundation: "kwizera-ai-core", checks, root }, null, 2));

  await core.stop("architecture-verify");
  await fs.rm(root, { recursive: true, force: true });

  if (failed.length) {
    console.error("FAIL: disconnected modules:", failed.join(", "));
    process.exit(1);
  }
  console.log("PASS: KWIZERA AI Core foundations connected (Ollama not required)");
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
