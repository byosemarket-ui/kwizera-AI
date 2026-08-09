import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

async function main(): Promise<void> {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-di-smoke-"));
  console.log("temp", storageRoot);
  const t0 = Date.now();
  console.log("starting core...");
  const core = createAiCore({ storageRootOverride: storageRoot });
  await core.start("decision-intelligence-smoke");
  console.log("start_ms", Date.now() - t0);

  const engine = core.getManager().decisionEngine!;
  const awareness = engine.getAiMeProfessionalDecisionAwareness();
  console.log("awareness", {
    available: awareness.available,
    enabled: awareness.enabled,
    planning: awareness.planningIntelligenceEnabled,
  });

  const t1 = Date.now();
  const first = await engine.decideProfessional({
    request: "decide camera lighting for a product advertisement on social media",
    objective: "Product ad lighting and platform decision",
    context: { product: "earbuds", audience: "young adults", platform: "instagram" },
    requiredDomains: ["camera-knowledge", "lighting-knowledge", "social-media-knowledge", "industry-standards-knowledge"],
    includeDomainModules: true,
  });
  console.log("first_decision_ms", Date.now() - t1);
  console.log(
    JSON.stringify(
      {
        grounded: first.grounded,
        unsupported: first.unsupported,
        confidence: first.confidenceScore,
        options: first.framework.availableOptions.length,
        packs: first.explanation.knowledgePacksUsed.length,
        memoryId: first.decisionId,
      },
      null,
      2
    )
  );

  const second = await engine.decideProfessional({
    request: "decide camera lighting for a product advertisement on social media",
    objective: "Product ad lighting and platform decision",
    context: { product: "earbuds", audience: "young adults", platform: "instagram" },
    requiredDomains: ["camera-knowledge", "lighting-knowledge", "social-media-knowledge", "industry-standards-knowledge"],
    includeDomainModules: true,
  });
  console.log(
    JSON.stringify(
      {
        learnedFromHistory: second.learnedFromHistory,
        priorCount: second.memoryRecord.priorDecisionIds.length,
        historyCount: engine.getProfessionalDecisionHistory().length,
        memoryFile: fs.existsSync(path.join(storageRoot, "decisions", "professional-decision-memory.jsonl")),
      },
      null,
      2
    )
  );

  let health = await engine.runProfessionalDecisionHealthCheck();
  if (!health.healthy) {
    const repair = await engine.repairProfessionalDecisionIntelligence();
    console.log("repair", repair);
    health = await engine.runProfessionalDecisionHealthCheck();
  }
  console.log("health", { healthy: health.healthy, canDecide: health.canDecide, memoryWritable: health.memoryWritable });

  const ok =
    first.grounded &&
    !first.unsupported &&
    first.confidenceScore > 50 &&
    second.learnedFromHistory &&
    health.healthy &&
    awareness.enabled &&
    !awareness.planningIntelligenceEnabled;

  await core.stop();
  fs.rmSync(storageRoot, { recursive: true, force: true });
  console.log(ok ? "SMOKE PASSED" : "SMOKE FAILED");
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
