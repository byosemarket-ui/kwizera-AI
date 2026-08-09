import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore } from "../ai/index.js";

async function main(): Promise<void> {
  const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-reason-progress-"));
  console.log("temp", storageRoot);
  const t0 = Date.now();
  console.log("creating core...");
  const core = createAiCore({ storageRootOverride: storageRoot });
  console.log("starting core...");
  await core.start("reason-progress");
  console.log("start_ms", Date.now() - t0);

  const engine = core.getManager().knowledgeFoundation!.getKnowledgeReasoningEngine();
  console.log("reasoning...");
  const t1 = Date.now();
  const result = await engine.reasonProfessional({
    request: "recommend camera lighting for product advertisement",
    requiredDomains: ["camera-knowledge", "lighting-knowledge"],
  });
  console.log("reason_ms", Date.now() - t1);
  console.log(
    JSON.stringify(
      {
        grounded: result.grounded,
        domains: result.domainsUsed,
        contributions: result.domainContributions.length,
        confidence: result.confidenceScore,
        selected: result.selected?.knowledgeId,
      },
      null,
      2
    )
  );
  await core.stop();
  fs.rmSync(storageRoot, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
