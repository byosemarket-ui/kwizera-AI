import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  KnowledgeDownloadEngine,
  KnowledgeCollectionWorkspace,
  PREPARED_WORKSPACE_DOMAIN_SLUGS,
  domainIdToWorkspaceSlug,
} from "../ai/knowledge-research-engine/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-collection-"));
}

async function main(): Promise<void> {
  const root = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, "knowledge", "workspace")
    : path.join(createTempRoot(), "workspace");
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
  const parent = path.dirname(root);

  console.log("KWIZERA AI STUDIO — Knowledge Seeding Step 3: Knowledge Collection Validation");
  console.log("Workspace root:", root);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    fs.mkdirSync(root, { recursive: true });
    const workspace = new KnowledgeCollectionWorkspace();
    let repair = await workspace.initialize(root);
    issuesRepaired.push(...repair.actions);

    // Introduce a verified issue, then repair until healthy.
    const cameraPath = path.join(root, "camera");
    if (fs.existsSync(cameraPath)) {
      fs.rmSync(cameraPath, { recursive: true, force: true });
      issuesFound.push("Missing domain folder: camera");
    }

    let attempts = 0;
    let healthy = false;
    while (attempts < 3) {
      attempts += 1;
      repair = await workspace.ensureStructure();
      issuesRepaired.push(...repair.actions);
      const audit = await workspace.audit();
      if (audit.healthy) {
        healthy = true;
        break;
      }
      issuesFound.push(...audit.issues);
    }

    results.workspaceOrganization = {
      passed: healthy && PREPARED_WORKSPACE_DOMAIN_SLUGS.every((slug) => fs.existsSync(path.join(root, slug))),
      detail: `Prepared ${PREPARED_WORKSPACE_DOMAIN_SLUGS.length} domain folders; repair attempts=${attempts}`,
    };

    const fixtureDir = path.join(parent, "fixtures");
    fs.mkdirSync(fixtureDir, { recursive: true });
    const fixture = path.join(fixtureDir, "storytelling.md");
    fs.writeFileSync(fixture, "# Storytelling\nHook, conflict, resolve.\n", "utf8");

    const engine = new KnowledgeDownloadEngine(async () => {
      throw new Error("offline validation must use local collection");
    });
    await engine.initialize(root);

    const source = {
      id: "story-local-pack",
      name: "Storytelling Local Pack",
      description: "Offline storytelling learning resource.",
      type: "local-documentation" as const,
      location: { kind: "local-path" as const, value: fixture },
      tags: ["storytelling"],
      status: "approved" as const,
      verification: { verified: true, trustScore: 85, issues: [] as string[], verifiedAt: new Date().toISOString() },
      quality: {
        qualityScore: 88,
        trustScore: 85,
        reputationScore: 70,
        completenessScore: 90,
        freshnessScore: 80,
        confidenceScore: 90,
      },
      license: "Internal",
      version: "1.0.0",
      language: "en" as const,
      domainIds: ["storytelling-knowledge"],
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pending = await engine.requestDownload(
      {
        topic: "Storytelling",
        sourceId: source.id,
        resourceType: "markdown",
        url: `local://${fixture}`,
        fileName: "storytelling-basics.md",
        domainId: "storytelling-knowledge",
        title: "Storytelling Basics",
        language: "en",
        localSourcePath: fixture,
      },
      source,
      "allow"
    );
    results.knowledgeCollection = {
      passed: pending.status === "pending-approval",
      detail: `Request status=${pending.status}`,
    };

    const completed = await engine.approveDownload(pending.id, source.type);
    const expectedPath = path.join(root, domainIdToWorkspaceSlug("storytelling-knowledge"), "markdown", "storytelling-basics.md");
    results.localStorage = {
      passed: completed.status === "completed" && completed.filePath === expectedPath && fs.existsSync(expectedPath),
      detail: completed.filePath ?? "missing path",
    };

    results.resourceMetadata = {
      passed: Boolean(
        completed.title &&
          completed.domainId &&
          completed.sourceId &&
          completed.resourceType &&
          completed.language &&
          completed.license &&
          completed.version &&
          completed.collectionDate &&
          completed.trustScore &&
          completed.qualityScore &&
          completed.localStoragePath &&
          completed.metadataFingerprint
      ),
      detail: "Resource ID/title/domain/source/type/language/version/license/dates/scores/path present",
    };

    const duplicate = await engine.requestDownload(
      {
        topic: "Storytelling",
        sourceId: source.id,
        resourceType: "markdown",
        url: `local://${fixture}`,
        fileName: "storytelling-basics.md",
        domainId: "storytelling-knowledge",
        title: "Storytelling Basics",
        localSourcePath: fixture,
      },
      source,
      "allow"
    );
    results.duplicateProtection = {
      passed: duplicate.status === "duplicate",
      detail: duplicate.rejectionReason ?? duplicate.status,
    };

    const blocked = await engine.requestDownload(
      {
        topic: "Storytelling",
        sourceId: "untrusted",
        resourceType: "documentation",
        url: "https://evil.example.com/x",
        fileName: "x.pdf",
        domainId: "storytelling-knowledge",
      },
      null,
      "block"
    );
    results.untrustedBlocked = {
      passed: blocked.status === "rejected",
      detail: blocked.rejectionReason ?? blocked.status,
    };

    // Auto-repair loop for index integrity
    fs.rmSync(expectedPath, { force: true });
    issuesFound.push(`Missing collected file: ${expectedPath}`);
    const repairResult = await engine.repairWorkspace();
    issuesRepaired.push(...repairResult.actions);
    const repairedRecord = engine.getDownload(completed.id);
    results.autoRepair = {
      passed: repairedRecord?.status === "failed" || repairResult.actions.length > 0,
      detail: `Repair actions=${repairResult.actions.length}; record status=${repairedRecord?.status}`,
    };

    results.noExtraction = {
      passed: completed.processingStatus === "queued-for-acquisition",
      detail: "Collected resources remain unprocessed for Step 4 extraction",
    };
  } catch (error) {
    results.fatal = {
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (useTemp && fs.existsSync(parent)) {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  }

  console.log("");
  let failed = 0;
  for (const [name, result] of Object.entries(results)) {
    const mark = result.passed ? "PASS" : "FAIL";
    if (!result.passed) failed += 1;
    console.log(`[${mark}] ${name}: ${result.detail}`);
  }
  console.log(`Issues found: ${issuesFound.length}; repair actions recorded: ${issuesRepaired.length}`);
  console.log("---");
  if (failed > 0) {
    console.error(`Validation failed: ${failed} check(s)`);
    process.exit(1);
  }
  console.log("Knowledge Collection validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
