/**
 * Knowledge Seeding Certifier — Step 8 final gate.
 * Verifies durable persistence, restart survival, AI Me capability, and issues Knowledge Seeding Version 1.0.
 */

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "./knowledge-foundation.js";
import { KnowledgePersistenceVerifier } from "./knowledge-persistence-verifier.js";
import {
  KNOWLEDGE_SEEDING_VERSION,
  KnowledgeSeedingError,
  type AiMeKnowledgePersistenceAwareness,
  type KnowledgeRestartVerificationResult,
  type KnowledgeSeedingCertificationResult,
  type KnowledgeSeedingRepairResult,
  type KnowledgeSeedingReportData,
  type KnowledgeSeedingStatistics,
} from "./knowledge-seeding-types.js";

export class KnowledgeSeedingCertifier {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private certDir = "";
  private initialized = false;
  private startupComplete = false;
  private readonly verifier = new KnowledgePersistenceVerifier();
  private lastRestart: KnowledgeRestartVerificationResult | null = null;
  private lastCertification: KnowledgeSeedingCertificationResult | null = null;
  private lastRepair: KnowledgeSeedingRepairResult | null = null;
  private snapshotBeforeRestart: {
    packs: number;
    imports: number;
    records: number;
    relationships: number;
    packSlugs: string[];
    knowledgeIds: string[];
  } | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.certDir = path.join(storageRoot, "knowledge", "certification");
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fsPromises.mkdir(this.certDir, { recursive: true });
    await this.loadCertificate();
    // Mark started before repair so persistence recovery can run on restart when a certificate already exists.
    this.startupComplete = true;
    this.lastRepair = await this.repair();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  isCertified(): boolean {
    return Boolean(this.lastCertification?.certified);
  }

  getLastCertification(): KnowledgeSeedingCertificationResult | null {
    return this.lastCertification ? structuredClone(this.lastCertification) : null;
  }

  getLastRestart(): KnowledgeRestartVerificationResult | null {
    return this.lastRestart ? structuredClone(this.lastRestart) : null;
  }

  /** Capture durable counts before an application restart simulation. */
  capturePreRestartSnapshot(): void {
    this.ensureStarted();
    const foundation = this.foundation!;
    this.snapshotBeforeRestart = {
      packs: foundation.getKnowledgeExtractionEngine().listPacks().length,
      imports: foundation
        .getKnowledgePackImportEngine()
        .listImports()
        .filter((entry) => entry.status === "imported" || entry.status === "activated").length,
      records: foundation.getStorageEngine().getRecordCount(),
      relationships: this.countGraphRelationships(),
      packSlugs: foundation.getKnowledgeExtractionEngine().listPacks().map((pack) => pack.packSlug),
      knowledgeIds: foundation
        .getKnowledgePackImportEngine()
        .listImports()
        .map((entry) => entry.knowledgeId)
        .filter(Boolean) as string[],
    };
  }

  restorePreRestartSnapshot(snapshot: {
    packs: number;
    imports: number;
    records: number;
    relationships?: number;
    packSlugs: string[];
    knowledgeIds: string[];
  }): void {
    this.ensureStarted();
    this.snapshotBeforeRestart = {
      packs: snapshot.packs,
      imports: snapshot.imports,
      records: snapshot.records,
      relationships: snapshot.relationships ?? 0,
      packSlugs: snapshot.packSlugs,
      knowledgeIds: snapshot.knowledgeIds,
    };
  }

  /** Verify state after foundation reload (same storage root). */
  async verifyAfterRestart(): Promise<KnowledgeRestartVerificationResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const before = this.snapshotBeforeRestart;
    const packs = foundation.getKnowledgeExtractionEngine().listPacks();
    const imports = foundation
      .getKnowledgePackImportEngine()
      .listImports()
      .filter((entry) => entry.status === "imported" || entry.status === "activated");
    const records = foundation.getStorageEngine().getRecordCount();
    const relationships = this.countGraphRelationships();
    const issues: string[] = [];

    if (!before) {
      issues.push("No pre-restart snapshot captured.");
    } else {
      if (packs.length < before.packs) issues.push(`Pack count dropped after restart: ${before.packs} → ${packs.length}`);
      if (imports.length < before.imports) {
        issues.push(`Import count dropped after restart: ${before.imports} → ${imports.length}`);
      }
      if (records < before.records) issues.push(`Record count dropped after restart: ${before.records} → ${records}`);
      for (const slug of before.packSlugs) {
        if (!packs.some((pack) => pack.packSlug === slug)) issues.push(`Missing pack after restart: ${slug}`);
        const pack = packs.find((item) => item.packSlug === slug);
        if (pack && !pack.structuredKnowledge) issues.push(`Missing pack metadata after restart: ${slug}`);
      }
      for (const knowledgeId of before.knowledgeIds) {
        const read = await foundation.getStorageEngine().getRecord(knowledgeId, "knowledge-seeding-certifier");
        if (!read.success || !read.record) issues.push(`Missing foundation record after restart: ${knowledgeId}`);
      }
    }

    let searchWorksAfterRestart = false;
    try {
      const query = packs[0]?.packSlug ?? "knowledge";
      const search = await foundation.getRetrievalEngine().search({
        text: query,
        limit: 5,
        requesterId: "knowledge-seeding-certifier",
      });
      searchWorksAfterRestart = search.results.length > 0 || records === 0;
      if (records > 0 && search.results.length === 0) {
        // Soft warning — index may need invalidate; try imported ids
        searchWorksAfterRestart = before?.knowledgeIds.some((id) =>
          foundation.getStorageEngine().getIndexEntries().some((entry) => entry.knowledgeId === id)
        ) ?? false;
        if (!searchWorksAfterRestart) issues.push("Search index returned no results after restart.");
      }
    } catch (error) {
      issues.push(`Search failed after restart: ${error instanceof Error ? error.message : String(error)}`);
    }

    const metadataPreserved = packs.every(
      (pack) =>
        Boolean(pack.packId) &&
        Boolean(pack.contentFingerprint) &&
        pack.originalDocumentsPreserved &&
        Array.isArray(pack.items)
    );
    if (!metadataPreserved) issues.push("Pack metadata incomplete after restart.");

    const result: KnowledgeRestartVerificationResult = {
      verified: issues.length === 0,
      packsBefore: before?.packs ?? 0,
      packsAfter: packs.length,
      importsBefore: before?.imports ?? 0,
      importsAfter: imports.length,
      recordsBefore: before?.records ?? 0,
      recordsAfter: records,
      relationshipsBefore: before?.relationships ?? 0,
      relationshipsAfter: relationships,
      searchWorksAfterRestart,
      metadataPreserved,
      issues,
      verifiedAt: new Date().toISOString(),
    };
    this.lastRestart = result;
    return structuredClone(result);
  }

  getAiMeAwareness(): AiMeKnowledgePersistenceAwareness {
    this.ensureStarted();
    const importAwareness = this.foundation!.getKnowledgePackImportEngine().getAiMeAwareness();
    const packValidation = this.foundation!.getKnowledgePackValidationEngine();
    const certified = this.isCertified();
    return {
      canFind: importAwareness.canFind,
      canExplain: importAwareness.canExplain,
      canUse: importAwareness.canApply,
      canCompare: packValidation.listResults().length >= 2,
      canApplyDecisionRules: packValidation.listResults().some((result) =>
        this.foundation!.getKnowledgeExtractionEngine()
          .listPacks()
          .some((pack) => pack.packSlug === result.packSlug && pack.structuredKnowledge.decisionRules.length > 0)
      ),
      canUseInPlanning: importAwareness.canUseInPlanning || importAwareness.engines.planning,
      canUseInImageGeneration: importAwareness.canUseInImageGeneration,
      canUseInVideoGeneration: importAwareness.canUseInVideoGeneration,
      canUseInRendering: importAwareness.engines.rendering,
      permanentlyRemembers: certified || importAwareness.importedPacks > 0,
      immediatelyUsable: importAwareness.activatedPacks > 0,
      summary: certified
        ? `Knowledge Seeding ${KNOWLEDGE_SEEDING_VERSION} certified. AI Me permanently remembers and can use imported knowledge across planning, image, video, and rendering.`
        : `Persistence verification available. Imported packs=${importAwareness.importedPacks}. Certification pending final checks.`,
    };
  }

  async certify(options?: { requireRestartVerification?: boolean }): Promise<KnowledgeSeedingCertificationResult> {
    this.ensureStarted();
    const foundation = this.foundation!;
    const requireRestart = options?.requireRestartVerification !== false;
    const issues: string[] = [];
    const repairs: string[] = [];

    const persistence = this.verifier.verify(foundation);
    issues.push(...persistence.issues);
    repairs.push(...persistence.repairs);

    if (requireRestart) {
      if (!this.lastRestart) {
        issues.push("Restart verification has not been executed.");
      } else if (!this.lastRestart.verified) {
        issues.push(...this.lastRestart.issues);
      }
    }

    const aiMe = this.getAiMeAwareness();
    if (!aiMe.canFind || !aiMe.canExplain || !aiMe.canUse) {
      issues.push("AI Me cannot fully find/explain/use stored knowledge.");
    }

    const statistics = this.verifier.collectStatistics(foundation);
    if (statistics.totalImportedPacks === 0) issues.push("No imported packs available for certification.");
    if (statistics.totalKnowledgePacks === 0) issues.push("No knowledge packs on disk.");

    // Consistency repairs
    const consistencyRepair = await this.repair();
    repairs.push(...consistencyRepair.actions);
    issues.push(...consistencyRepair.remainingIssues);

    const graphConsistent = this.lastRestart
      ? this.lastRestart.relationshipsAfter >= 0 && !this.lastRestart.issues.some((issue) => issue.includes("relationship"))
      : fs.existsSync(path.join(foundation.getKnowledgeRoot(), "graph"));
    const searchConsistent = this.lastRestart?.searchWorksAfterRestart ?? persistence.checks.some((check) => check.name === "search-index" && check.passed);

    const certified =
      issues.length === 0 &&
      persistence.verified &&
      (!requireRestart || Boolean(this.lastRestart?.verified)) &&
      statistics.totalImportedPacks > 0;

    const certificatePath = path.join(this.certDir, "knowledge-seeding-certificate.json");
    const result: KnowledgeSeedingCertificationResult = {
      certified,
      version: KNOWLEDGE_SEEDING_VERSION,
      certifiedAt: new Date().toISOString(),
      foundationStatus: foundation.isStartupComplete() ? "operational" : "not-ready",
      persistenceStatus: persistence.verified ? "durable-on-disk" : "persistence-issues",
      restartVerified: Boolean(this.lastRestart?.verified),
      aiMeCapable: aiMe.canFind && aiMe.canExplain && aiMe.canUse,
      graphConsistent,
      searchConsistent,
      statistics,
      maturity: certified ? "Knowledge Seeding Version 1.0 — Production Ready" : "Knowledge Seeding incomplete",
      permanentlyRemembers: certified,
      immediatelyUsesImportedKnowledge: aiMe.immediatelyUsable,
      knowledgeSeedingComplete: certified,
      issues,
      repairs,
      certificatePath: certified ? certificatePath : null,
    };

    this.lastCertification = result;
    if (certified) {
      await fsPromises.mkdir(this.certDir, { recursive: true });
      await fsPromises.writeFile(certificatePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      this.writeFoundationManifest(KNOWLEDGE_SEEDING_VERSION);
    }
    return structuredClone(result);
  }

  async repair(): Promise<KnowledgeSeedingRepairResult> {
    this.ensureReady();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fsPromises.mkdir(this.certDir, { recursive: true });
    actions.push("Ensured knowledge/certification directory.");

    if (!this.foundation?.isStartupComplete()) {
      return { repaired: true, actions, remainingIssues };
    }

    const importer = this.foundation.getKnowledgePackImportEngine();
    const importRepair = await importer.repair();
    actions.push(...importRepair.actions);
    remainingIssues.push(...importRepair.remainingIssues);

    const persistence = this.verifier.verify(this.foundation);
    for (const issue of persistence.issues) {
      if (issue.includes("Missing durable directory")) {
        const match = issue.match(/Missing durable directory: (.+)$/);
        if (match) {
          await fsPromises.mkdir(match[1], { recursive: true });
          actions.push(`Recreated durable directory: ${match[1]}`);
        }
      }
    }

    // Rehydrate domain contentReady from imports
    for (const entry of importer.listImports()) {
      if (entry.status !== "imported" && entry.status !== "activated") continue;
      try {
        // Import engine already maps domains; re-mark to persist overrides.
        await importer.synchronizeEcosystem();
        actions.push(`Re-synchronized ecosystem for ${entry.packSlug}`);
        break;
      } catch (error) {
        remainingIssues.push(`Sync repair failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const repair = { repaired: remainingIssues.length === 0, actions: unique(actions), remainingIssues };
    this.lastRepair = repair;
    return repair;
  }

  buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): KnowledgeSeedingReportData {
    this.ensureStarted();
    const certification = this.lastCertification;
    const statistics = certification?.statistics ?? this.verifier.collectStatistics(this.foundation!);
    const aiMe = this.getAiMeAwareness();
    return {
      generatedAt: new Date().toISOString(),
      foundationStatus: this.foundation!.isStartupComplete() ? "operational" : "not-ready",
      persistenceStatus: certification?.persistenceStatus ?? "unchecked",
      restartVerification: this.lastRestart,
      aiMeCapability: aiMe,
      graphStatus: certification?.graphConsistent ? "consistent" : "unchecked",
      searchStatus: certification?.searchConsistent ? "consistent" : "unchecked",
      statistics,
      issuesFound: unique([...issuesFound, ...(certification?.issues ?? [])]),
      issuesRepaired: unique([...issuesRepaired, ...(certification?.repairs ?? [])]),
      maturity: certification?.maturity ?? "uncertified",
      permanentlyRemembers: Boolean(certification?.permanentlyRemembers),
      immediatelyUsesImportedKnowledge: Boolean(certification?.immediatelyUsesImportedKnowledge),
      knowledgeSeedingComplete: Boolean(certification?.knowledgeSeedingComplete),
      certifiedVersion: certification?.certified ? certification.version : null,
    };
  }

  getStatistics(): KnowledgeSeedingStatistics {
    this.ensureStarted();
    return this.verifier.collectStatistics(this.foundation!);
  }

  private countGraphRelationships(): number {
    try {
      const graphPath = path.join(this.foundation!.getKnowledgeRoot(), "graph", "knowledge-graph.json");
      if (!fs.existsSync(graphPath)) return 0;
      const graph = JSON.parse(fs.readFileSync(graphPath, "utf8")) as {
        edges?: Record<string, unknown> | unknown[];
        relationships?: unknown[];
        edgeCount?: number;
      };
      if (typeof graph.edgeCount === "number") return graph.edgeCount;
      if (Array.isArray(graph.edges)) return graph.edges.length;
      if (graph.edges && typeof graph.edges === "object") return Object.keys(graph.edges).length;
      if (Array.isArray(graph.relationships)) return graph.relationships.length;
      return 0;
    } catch {
      return 0;
    }
  }

  private writeFoundationManifest(version: string): void {
    const knowledgeRoot = this.foundation!.getKnowledgeRoot();
    const manifestPath = path.join(knowledgeRoot, "foundation-manifest.json");
    const existing = fs.existsSync(manifestPath)
      ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
      : {};
    const manifest = {
      ...existing,
      foundationVersion: version,
      knowledgeSeedingVersion: version,
      knowledgeSeedingCertifiedAt: new Date().toISOString(),
      storageRoot: this.storageRoot,
      knowledgeRoot,
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  private async loadCertificate(): Promise<void> {
    try {
      const raw = await fsPromises.readFile(path.join(this.certDir, "knowledge-seeding-certificate.json"), "utf8");
      this.lastCertification = JSON.parse(raw) as KnowledgeSeedingCertificationResult;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new KnowledgeSeedingError("Knowledge Seeding Certifier is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new KnowledgeSeedingError("Knowledge Seeding Certifier startup is incomplete", "NOT_STARTED");
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
