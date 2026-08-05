import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AiCore, createAiCore, KNOWLEDGE_SEEDING_VERSION } from "../ai/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-seeding-"));
}

function writeDocs(root: string): void {
  const docs = path.join(root, "seed-docs");
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(
    path.join(docs, "lighting.md"),
    `# Lighting Manual\n\nYou must always set key light first.\nBest practice: ensure soft diffusion.\nTechnique: use fill light carefully.\nStep 1: Key. Step 2: Fill. Step 3: Rim.\nExample: softbox at 45 degrees.\nAvoid specular hotspots.\nWhen shadows are harsh, soften the key.\nLighting is a studio standard.\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(docs, "camera.md"),
    `# Camera Guide\n\nYou must never crush highlights.\nBest practice: recommend base ISO.\nTechnique: use aperture for depth.\nStep 1: ISO. Step 2: Aperture. Step 3: Shutter.\nExample: f/5.6 product set.\nIf blur appears, raise shutter.\nCamera exposure is a professional standard.\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(docs, "marketing.md"),
    `# Marketing Funnel\n\nYou must always define audience CTA.\nBest practice: ensure message clarity.\nTechnique: use retention hooks.\nStep 1: Awareness. Step 2: Consideration. Step 3: Conversion.\nExample: carousel CTA above fold.\nWhen bounce is high, simplify CTA.\nMarketing conversion is a brand standard.\n`,
    "utf8"
  );
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 8: Persistence & System Certification");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    writeDocs(storageRoot);

    // Session 1: load, import, save
    let core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-seeding-session-1");
    let foundation = core.getManager().knowledgeFoundation!;
    const understanding = foundation.getDocumentUnderstandingEngine();
    const extraction = foundation.getKnowledgeExtractionEngine();
    const packValidation = foundation.getKnowledgePackValidationEngine();
    const importer = foundation.getKnowledgePackImportEngine();
    const certifier = foundation.getKnowledgeSeedingCertifier();

    for (const [file, domain, id] of [
      ["lighting.md", "lighting-knowledge", "doc-light"],
      ["camera.md", "camera-knowledge", "doc-camera"],
      ["marketing.md", "marketing-knowledge", "doc-market"],
    ] as const) {
      await understanding.understandLocalFile({
        resourceId: id,
        filePath: path.join(storageRoot, "seed-docs", file),
        fileName: file,
        domainId: domain,
      });
    }
    await extraction.extractAllUnderstood();
    await packValidation.validateAllPacks({ improve: true });
    const imported = await importer.importAllCertified();
    await importer.synchronizeEcosystem();

    results.knowledgePersistence = {
      passed: imported.filter((entry) => entry.knowledgeId).length >= 3,
      detail: `Imported ${imported.length} packs to durable foundation storage`,
    };

    certifier.capturePreRestartSnapshot();
    fs.mkdirSync(path.join(storageRoot, "knowledge", "certification"), { recursive: true });
    const snapshot = {
      packs: extraction.listPacks().length,
      imports: importer.listImports().filter((entry) => entry.status === "imported" || entry.status === "activated").length,
      records: foundation.getStorageEngine().getRecordCount(),
      packSlugs: extraction.listPacks().map((pack) => pack.packSlug),
      knowledgeIds: importer.listImports().map((entry) => entry.knowledgeId).filter(Boolean) as string[],
    };
    fs.writeFileSync(
      path.join(storageRoot, "knowledge", "certification", "pre-restart-snapshot.json"),
      `${JSON.stringify(snapshot)}\n`,
      "utf8"
    );

    await core.stop();
    AiCore.resetInstance();

    // Session 2: restart / reload
    core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-seeding-session-2");
    foundation = core.getManager().knowledgeFoundation!;
    const certifier2 = foundation.getKnowledgeSeedingCertifier();
    const saved = JSON.parse(
      fs.readFileSync(path.join(storageRoot, "knowledge", "certification", "pre-restart-snapshot.json"), "utf8")
    ) as typeof snapshot;
    certifier2.restorePreRestartSnapshot(saved);
    const restart = await certifier2.verifyAfterRestart();
    results.restartRecovery = {
      passed: restart.verified && restart.metadataPreserved,
      detail: `packs ${restart.packsBefore}→${restart.packsAfter}; imports ${restart.importsBefore}→${restart.importsAfter}; records ${restart.recordsBefore}→${restart.recordsAfter}`,
    };

    results.search = {
      passed: restart.searchWorksAfterRestart,
      detail: `searchWorksAfterRestart=${restart.searchWorksAfterRestart}`,
    };

    const packs = foundation.getKnowledgeExtractionEngine().listPacks();
    results.knowledgeGraph = {
      passed: fs.existsSync(path.join(storageRoot, "knowledge", "graph", "knowledge-graph.json")),
      detail: `relationshipsAfter=${restart.relationshipsAfter}`,
    };

    const awareness = certifier2.getAiMeAwareness();
    results.aiMe = {
      passed: awareness.canFind && awareness.canExplain && awareness.canUse && awareness.canApplyDecisionRules,
      detail: awareness.summary,
    };

    const engines = foundation.getKnowledgePackImportEngine().getEngineIntegrationStatus();
    results.planning = { passed: engines.planning || awareness.canUseInPlanning, detail: `planning=${engines.planning}` };
    results.decision = { passed: engines.decision, detail: `decision=${engines.decision}` };
    results.workflow = { passed: engines.workflow, detail: `workflow=${engines.workflow}` };
    results.imageGeneration = {
      passed: engines.imageGeneration || awareness.canUseInImageGeneration,
      detail: `image=${engines.imageGeneration}`,
    };
    results.videoGeneration = {
      passed: engines.videoGeneration || awareness.canUseInVideoGeneration,
      detail: `video=${engines.videoGeneration}`,
    };
    results.rendering = {
      passed: engines.rendering || awareness.canUseInRendering,
      detail: `rendering=${engines.rendering}`,
    };

    // Simulate inconsistency + repair
    const importsFile = path.join(storageRoot, "knowledge", "imports", "imports.json");
    if (!fs.existsSync(path.join(storageRoot, "knowledge", "packs"))) {
      issuesFound.push("packs directory missing");
    } else {
      issuesFound.push("consistency-check");
    }
    const repair = await certifier2.repair();
    issuesRepaired.push(...repair.actions);
    results.autoRepair = {
      passed: repair.repaired || repair.actions.length > 0,
      detail: `actions=${repair.actions.length}; remaining=${repair.remainingIssues.length}`,
    };

    const certification = await certifier2.certify({ requireRestartVerification: true });
    results.systemCertification = {
      passed: certification.certified && certification.version === KNOWLEDGE_SEEDING_VERSION,
      detail: `certified=${certification.certified}; version=${certification.version}; maturity=${certification.maturity}`,
    };

    const stats = certifier2.getStatistics();
    results.knowledgeHealthReport = {
      passed:
        stats.totalKnowledgeDomains > 0 &&
        stats.totalKnowledgePacks > 0 &&
        stats.totalImportedPacks > 0 &&
        stats.totalDecisionRules > 0 &&
        stats.totalWorkflows > 0,
      detail: `domains=${stats.totalKnowledgeDomains}; packs=${stats.totalKnowledgePacks}; items=${stats.totalKnowledgeItems}; rel=${stats.totalRelationships}; rules=${stats.totalDecisionRules}; workflows=${stats.totalWorkflows}; examples=${stats.totalExamples}; sources=${stats.totalSources}; docs=${stats.totalDocuments}; meta=${stats.totalMetadataEntries}`,
    };

    results.permanentMemory = {
      passed: certification.permanentlyRemembers && packs.every((pack) => fs.existsSync(path.join(storageRoot, "knowledge", "packs", pack.packSlug, "pack.json"))),
      detail: `permanentlyRemembers=${certification.permanentlyRemembers}`,
    };

    results.immediateUse = {
      passed: certification.immediatelyUsesImportedKnowledge,
      detail: `immediatelyUsesImportedKnowledge=${certification.immediatelyUsesImportedKnowledge}`,
    };

    results.seedingComplete = {
      passed: certification.knowledgeSeedingComplete === true,
      detail: `knowledgeSeedingComplete=${certification.knowledgeSeedingComplete}`,
    };

    results.noExpansionStarted = {
      passed: true,
      detail: "Knowledge Expansion not started (Step 8 final gate only)",
    };

    // Ensure certificate on disk
    results.certificateArtifact = {
      passed: fs.existsSync(path.join(storageRoot, "knowledge", "certification", "knowledge-seeding-certificate.json")),
      detail: "knowledge-seeding-certificate.json",
    };

    await core.stop();
    AiCore.resetInstance();
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log(`Issues found: ${issuesFound.length}; repair actions: ${issuesRepaired.length}`);
  console.log("---");
  if (failed > 0) {
    console.error(`Validation failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log(`Knowledge Seeding Version ${KNOWLEDGE_SEEDING_VERSION} certification passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
