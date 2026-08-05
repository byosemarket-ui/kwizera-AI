import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiCore, createAiCore, KNOWLEDGE_SEEDING_VERSION } from "@ai";

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
}

async function seedFoundation(storageRoot: string): Promise<void> {
  writeDocs(storageRoot);
  const core = createAiCore({ storageRootOverride: storageRoot });
  await core.start("knowledge-seeding-persist");
  const foundation = core.getManager().knowledgeFoundation!;
  const understanding = foundation.getDocumentUnderstandingEngine();
  const extraction = foundation.getKnowledgeExtractionEngine();
  const packValidation = foundation.getKnowledgePackValidationEngine();
  const importer = foundation.getKnowledgePackImportEngine();

  for (const [file, domain, id] of [
    ["lighting.md", "lighting-knowledge", "doc-light"],
    ["camera.md", "camera-knowledge", "doc-camera"],
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
  await importer.importAllCertified();
  await importer.synchronizeEcosystem();

  const certifier = foundation.getKnowledgeSeedingCertifier();
  certifier.capturePreRestartSnapshot();
  fs.mkdirSync(path.join(storageRoot, "knowledge", "certification"), { recursive: true });
  fs.writeFileSync(
    path.join(storageRoot, "knowledge", "certification", "pre-restart-snapshot.json"),
    `${JSON.stringify({
      packs: extraction.listPacks().length,
      imports: importer.listImports().filter((entry) => entry.status === "imported" || entry.status === "activated")
        .length,
      records: foundation.getStorageEngine().getRecordCount(),
      packSlugs: extraction.listPacks().map((pack) => pack.packSlug),
      knowledgeIds: importer.listImports().map((entry) => entry.knowledgeId).filter(Boolean),
    })}\n`,
    "utf8"
  );
  await core.stop();
  AiCore.resetInstance();
}

describe("Knowledge Seeding Persistence & Certification (Step 8)", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-knowledge-seeding-cert-"));
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  it("persists imported knowledge across application restart and certifies seeding 1.0", async () => {
    await seedFoundation(storageRoot);

    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("knowledge-seeding-reload");
    const foundation = core.getManager().knowledgeFoundation!;
    const certifier = foundation.getKnowledgeSeedingCertifier();

    const snapshot = JSON.parse(
      fs.readFileSync(path.join(storageRoot, "knowledge", "certification", "pre-restart-snapshot.json"), "utf8")
    ) as {
      packs: number;
      imports: number;
      records: number;
      packSlugs: string[];
      knowledgeIds: string[];
    };
    const packs = foundation.getKnowledgeExtractionEngine().listPacks();
    const imports = foundation
      .getKnowledgePackImportEngine()
      .listImports()
      .filter((entry) => entry.status === "imported" || entry.status === "activated");
    expect(packs.length).toBeGreaterThanOrEqual(snapshot.packs);
    expect(imports.length).toBeGreaterThanOrEqual(snapshot.imports);
    expect(foundation.getStorageEngine().getRecordCount()).toBeGreaterThanOrEqual(snapshot.records);
    for (const slug of snapshot.packSlugs) {
      expect(packs.some((pack) => pack.packSlug === slug)).toBe(true);
      expect(fs.existsSync(path.join(storageRoot, "knowledge", "packs", slug, "pack.json"))).toBe(true);
    }
    for (const knowledgeId of snapshot.knowledgeIds) {
      const read = await foundation.getStorageEngine().getRecord(String(knowledgeId), "test");
      expect(read.success).toBe(true);
    }

    certifier.restorePreRestartSnapshot(snapshot);
    const restart = await certifier.verifyAfterRestart();
    expect(restart.verified).toBe(true);
    expect(restart.metadataPreserved).toBe(true);

    const certification = await certifier.certify({ requireRestartVerification: true });
    expect(certification.certified).toBe(true);
    expect(certification.version).toBe(KNOWLEDGE_SEEDING_VERSION);
    expect(certification.knowledgeSeedingComplete).toBe(true);
    expect(certification.permanentlyRemembers).toBe(true);
    expect(certification.immediatelyUsesImportedKnowledge).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "knowledge", "certification", "knowledge-seeding-certificate.json"))).toBe(
      true
    );

    const awareness = certifier.getAiMeAwareness();
    expect(awareness.canFind).toBe(true);
    expect(awareness.canExplain).toBe(true);
    expect(awareness.permanentlyRemembers).toBe(true);

    const stats = certifier.getStatistics();
    expect(stats.totalKnowledgePacks).toBeGreaterThan(0);
    expect(stats.totalImportedPacks).toBeGreaterThan(0);
    expect(stats.totalDecisionRules).toBeGreaterThan(0);
    expect(stats.totalWorkflows).toBeGreaterThan(0);

    await core.stop();
  }, 300_000);
});
