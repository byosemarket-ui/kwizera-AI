/**
 * Knowledge Pack Validation Engine — Step 6.
 * Validates, improves, and certifies Knowledge Packs offline.
 * Does NOT import certified packs into the permanent Knowledge Foundation (Step 7).
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import type { KnowledgePack, KnowledgePackSlug } from "../knowledge-processing-engine/knowledge-extraction-types.js";
import { KnowledgePackStore } from "../knowledge-processing-engine/knowledge-pack-store.js";
import { KnowledgePackImprover } from "./knowledge-pack-improver.js";
import { KnowledgePackQualityAnalyzer } from "./knowledge-pack-quality-analyzer.js";
import {
  KnowledgePackValidationError,
  PACK_CERT_COMPLETENESS_MIN,
  PACK_CERT_CONFIDENCE_MIN,
  PACK_CERT_CONSISTENCY_MIN,
  PACK_CERT_QUALITY_MIN,
  PACK_CERT_READINESS_MIN,
  type AiMePackValidationAwareness,
  type KnowledgePackValidationRepairResult,
  type KnowledgePackValidationReportData,
  type KnowledgePackValidationResult,
} from "./knowledge-pack-validation-types.js";

export class KnowledgePackValidationEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private certRoot = "";
  private initialized = false;
  private startupComplete = false;
  private readonly analyzer = new KnowledgePackQualityAnalyzer();
  private readonly improver = new KnowledgePackImprover();
  private readonly packStore = new KnowledgePackStore();
  private readonly results = new Map<string, KnowledgePackValidationResult>();
  private lastRepair: KnowledgePackValidationRepairResult | null = null;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.certRoot = path.join(storageRoot, "knowledge", "validation", "packs");
    this.packStore.initialize(this.storageRoot);
    this.initialized = true;
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    await fs.mkdir(this.certRoot, { recursive: true });
    await this.loadState();
    this.lastRepair = await this.repair();
    this.startupComplete = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  getLastRepair(): KnowledgePackValidationRepairResult | null {
    return this.lastRepair;
  }

  listResults(): KnowledgePackValidationResult[] {
    this.ensureStarted();
    return [...this.results.values()].map((result) => structuredClone(result));
  }

  getResult(packSlug: KnowledgePackSlug): KnowledgePackValidationResult | null {
    this.ensureStarted();
    const found = [...this.results.values()].find((result) => result.packSlug === packSlug);
    return found ? structuredClone(found) : null;
  }

  async validatePack(packSlug: KnowledgePackSlug, options?: { improve?: boolean }): Promise<KnowledgePackValidationResult> {
    this.ensureStarted();
    const extraction = this.foundation?.getKnowledgeExtractionEngine();
    if (!extraction?.isStartupComplete()) {
      throw new KnowledgePackValidationError("Knowledge Extraction Engine is not ready", "EXTRACTION_NOT_READY");
    }

    let pack = await extraction.getPack(packSlug);
    if (!pack) {
      throw new KnowledgePackValidationError(`Knowledge pack not found: ${packSlug}`, "PACK_NOT_FOUND");
    }

    // Never destroy certified knowledge — skip destructive rewrites.
    if (pack.status === "certified" && this.results.get(pack.packId)?.certified) {
      const existing = this.results.get(pack.packId)!;
      return structuredClone(existing);
    }

    const improve = options?.improve !== false;
    let improvements: string[] = [];
    const firstPass = this.analyzer.analyze(pack);
    if (improve && (firstPass.issues.length > 0 || firstPass.warnings.length > 0 || !meetsCertification(firstPass.scores))) {
      const improved = this.improver.improve(pack, firstPass.findings);
      improvements = improved.improvements;
      if (improvements.length > 0) {
        // Versioned write — preserves history; does not destroy prior content.
        pack = await this.writeImprovedPack(improved.pack);
      }
    }

    const analysis = this.analyzer.analyze(pack);
    const certified = canCertify(analysis.checks, analysis.scores, analysis.findings);
    const rejected = analysis.findings.conflicts.length > 0 && analysis.scores.consistencyScore < PACK_CERT_CONSISTENCY_MIN;
    const status = certified
      ? "certified"
      : rejected
        ? "rejected"
        : improvements.length
          ? "improved"
          : "needs-improvement";

    if (certified) {
      pack = await this.markPackCertified(pack, analysis.scores);
    } else if (status === "rejected") {
      pack = await this.markPackStatus(pack, "rejected");
    } else if (status === "improved" || status === "needs-improvement") {
      pack = await this.markPackStatus(pack, status === "improved" ? "validated" : pack.status === "weak" ? "weak" : "generated");
    }

    const result: KnowledgePackValidationResult = {
      packId: pack.packId,
      packSlug: pack.packSlug,
      packVersion: pack.version,
      valid: analysis.issues.filter((issue) => issue.startsWith("Conflict:")).length === 0 && analysis.checks.metadataCompleteness,
      certified,
      status: certified ? "certified" : rejected ? "rejected" : improvements.length ? "improved" : "needs-improvement",
      scores: analysis.scores,
      checks: analysis.checks,
      findings: analysis.findings,
      improvements,
      issues: analysis.issues,
      warnings: analysis.warnings,
      foundationImportDeferred: true,
      validatedAt: new Date().toISOString(),
    };

    this.results.set(pack.packId, result);
    await this.persistResult(result);
    await this.persistIndex();

    // Explicitly do NOT promote foundation records / import permanent knowledge.
    return structuredClone(result);
  }

  async validateAllPacks(options?: { improve?: boolean }): Promise<KnowledgePackValidationResult[]> {
    this.ensureStarted();
    const extraction = this.foundation?.getKnowledgeExtractionEngine();
    if (!extraction?.isStartupComplete()) return [];
    const packs = extraction.listPacks();
    const outputs: KnowledgePackValidationResult[] = [];
    for (const pack of packs) {
      outputs.push(await this.validatePack(pack.packSlug, options));
    }
    return outputs;
  }

  explainPackKnowledge(packSlug: KnowledgePackSlug): string {
    this.ensureStarted();
    const result = this.getResult(packSlug);
    const pack = this.foundation?.getKnowledgeExtractionEngine().listPacks().find((entry) => entry.packSlug === packSlug);
    if (!pack) return `No knowledge pack available for ${packSlug}.`;
    const scores = result?.scores;
    return (
      `"${pack.title}" (${pack.status}) contains ${pack.items.length} item(s), ` +
      `${pack.structuredKnowledge.workflowSteps.length} workflow(s), ` +
      `${pack.structuredKnowledge.bestPractices.length} best practice(s), ` +
      `${pack.structuredKnowledge.decisionRules.length} decision rule(s). ` +
      (scores
        ? `Scores — quality ${scores.qualityScore}, confidence ${scores.confidenceScore}, completeness ${scores.completenessScore}, readiness ${scores.professionalReadinessScore}. `
        : "Not yet validated. ") +
      `Foundation import deferred until Step 7.`
    );
  }

  comparePacks(left: KnowledgePackSlug, right: KnowledgePackSlug): string {
    this.ensureStarted();
    const a = this.getResult(left);
    const b = this.getResult(right);
    if (!a || !b) return `Compare requires validated packs for both ${left} and ${right}.`;
    const winner =
      a.scores.professionalReadinessScore === b.scores.professionalReadinessScore
        ? "tied"
        : a.scores.professionalReadinessScore > b.scores.professionalReadinessScore
          ? left
          : right;
    return (
      `${left} readiness ${a.scores.professionalReadinessScore} vs ${right} readiness ${b.scores.professionalReadinessScore}. ` +
      `Higher professional readiness: ${winner}. ` +
      `Certified: ${left}=${a.certified}, ${right}=${b.certified}.`
    );
  }

  recommendBestPractices(packSlug?: KnowledgePackSlug, limit = 5): string[] {
    this.ensureStarted();
    const packs = this.foundation?.getKnowledgeExtractionEngine().listPacks() ?? [];
    const filtered = packSlug ? packs.filter((pack) => pack.packSlug === packSlug) : packs;
    return unique(filtered.flatMap((pack) => pack.structuredKnowledge.bestPractices)).slice(0, limit);
  }

  applyDecisionRules(packSlug: KnowledgePackSlug, limit = 5): string[] {
    this.ensureStarted();
    const pack = this.foundation?.getKnowledgeExtractionEngine().listPacks().find((entry) => entry.packSlug === packSlug);
    return pack?.structuredKnowledge.decisionRules.slice(0, limit) ?? [];
  }

  getAiMeAwareness(): AiMePackValidationAwareness {
    this.ensureStarted();
    const results = [...this.results.values()];
    const certified = results.filter((result) => result.certified).length;
    const rejected = results.filter((result) => result.status === "rejected").length;
    const needsImprovement = results.filter((result) => result.status === "needs-improvement" || result.status === "improved").length;
    return {
      totalValidated: results.length,
      certified,
      rejected,
      needsImprovement,
      averageQuality: average(results.map((result) => result.scores.qualityScore)),
      averageConfidence: average(results.map((result) => result.scores.confidenceScore)),
      averageCompleteness: average(results.map((result) => result.scores.completenessScore)),
      averageProfessionalReadiness: average(results.map((result) => result.scores.professionalReadinessScore)),
      canExplain: results.length > 0,
      canCompare: results.length >= 2,
      canRecommend: this.recommendBestPractices(undefined, 1).length > 0,
      canApplyDecisionRules: results.some((result) => this.applyDecisionRules(result.packSlug, 1).length > 0),
      summary:
        `Pack validation: ${results.length} validated, ${certified} certified, ${rejected} rejected, ` +
        `${needsImprovement} need improvement. Permanent Foundation import deferred (Step 7).`,
    };
  }

  async repair(): Promise<KnowledgePackValidationRepairResult> {
    this.ensureReady();
    const actions: string[] = [];
    const remainingIssues: string[] = [];
    await fs.mkdir(this.certRoot, { recursive: true });
    actions.push("Ensured knowledge/validation/packs directory.");

    for (const result of this.results.values()) {
      const certPath = path.join(this.certRoot, `${result.packSlug}.json`);
      try {
        await fs.access(certPath);
      } catch {
        await this.persistResult(result);
        actions.push(`Restored missing certification sidecar for ${result.packSlug}`);
      }
      if (result.certified && !result.foundationImportDeferred) {
        remainingIssues.push(`Certified pack ${result.packSlug} missing foundationImportDeferred flag.`);
      }
    }

    await this.persistIndex();
    actions.push("Persisted pack validation index.");
    const repair = { repaired: remainingIssues.length === 0, actions, remainingIssues };
    this.lastRepair = repair;
    return repair;
  }

  buildReport(issuesFound: string[] = [], issuesRepaired: string[] = []): KnowledgePackValidationReportData {
    this.ensureStarted();
    const results = [...this.results.values()];
    const qualities = results.map((result) => result.scores.qualityScore);
    const confidences = results.map((result) => result.scores.confidenceScore);
    const completeness = results.map((result) => result.scores.completenessScore);
    return {
      generatedAt: new Date().toISOString(),
      existingValidationCapability: [
        "AiKnowledgeValidationEngine record-level validateKnowledge / scores / repair",
        "KnowledgeQualityScorer (quality, confidence, completeness, consistency)",
        "Consistency / relationship / integrity validators",
      ],
      componentsUpgraded: [
        "AiKnowledgeValidationEngine (pack validation ownership + deferred-record guard)",
        "KnowledgeValidationRunner (skip permanent promotion for validationDeferred payloads)",
        "KnowledgeSourceValidator (knowledge-extraction-engine source)",
        "KnowledgePack status model (validated / certified / rejected)",
      ],
      componentsCreated: [
        "KnowledgePackQualityAnalyzer",
        "KnowledgePackImprover",
        "KnowledgePackValidationEngine",
        "knowledge-pack-validation-types",
      ],
      packsValidated: results.map((result) => ({
        packSlug: result.packSlug,
        status: result.status,
        certified: result.certified,
      })),
      qualityScores: range(qualities),
      confidenceScores: range(confidences),
      completenessScores: range(completeness),
      certifiedPacks: results.filter((result) => result.certified).map((result) => result.packSlug),
      aiMeValidation:
        "AI Me can explain, compare, recommend best practices, and apply decision rules for validated packs without Foundation import.",
      issuesFound,
      issuesRepaired,
      remainingWorkBeforeStep7: [
        "Import only certified Knowledge Packs into the permanent Knowledge Foundation.",
        "Promote linked Pending records after explicit Foundation import approval.",
        "Wire certified packs into Knowledge Graph domain installation.",
      ],
    };
  }

  private async writeImprovedPack(pack: KnowledgePack): Promise<KnowledgePack> {
    const saved = await this.packStore.writePack({ ...pack, updatedAt: new Date().toISOString() });
    await this.foundation?.getKnowledgeExtractionEngine().reloadPacks();
    return saved;
  }

  private async markPackCertified(
    pack: KnowledgePack,
    scores: KnowledgePackValidationResult["scores"]
  ): Promise<KnowledgePack> {
    const saved = await this.packStore.writePack(
      {
        ...pack,
        status: "certified",
        issues: unique([...pack.issues, `Certified with readiness ${scores.professionalReadinessScore}`]),
      },
      { metadataOnly: true }
    );
    await this.foundation?.getKnowledgeExtractionEngine().reloadPacks();
    return saved;
  }

  private async markPackStatus(pack: KnowledgePack, status: KnowledgePack["status"]): Promise<KnowledgePack> {
    if (pack.status === status) return pack;
    const saved = await this.packStore.writePack({ ...pack, status }, { metadataOnly: true });
    await this.foundation?.getKnowledgeExtractionEngine().reloadPacks();
    return saved;
  }

  private async persistResult(result: KnowledgePackValidationResult): Promise<void> {
    await fs.writeFile(path.join(this.certRoot, `${result.packSlug}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  private async persistIndex(): Promise<void> {
    await fs.writeFile(
      path.join(this.certRoot, "index.json"),
      `${JSON.stringify({ results: [...this.results.values()] }, null, 2)}\n`,
      "utf8"
    );
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.certRoot, "index.json"), "utf8");
      const parsed = JSON.parse(raw) as { results?: KnowledgePackValidationResult[] };
      this.results.clear();
      for (const result of parsed.results ?? []) {
        this.results.set(result.packId, result);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private ensureReady(): void {
    if (!this.initialized) {
      throw new KnowledgePackValidationError("Knowledge Pack Validation Engine is not initialized", "NOT_INITIALIZED");
    }
  }

  private ensureStarted(): void {
    this.ensureReady();
    if (!this.startupComplete) {
      throw new KnowledgePackValidationError("Knowledge Pack Validation Engine startup is incomplete", "NOT_STARTED");
    }
  }
}

function canCertify(
  checks: KnowledgePackValidationResult["checks"],
  scores: KnowledgePackValidationResult["scores"],
  findings: KnowledgePackValidationResult["findings"]
): boolean {
  if (findings.conflicts.length > 0) return false;
  if (!checks.completeness || !checks.metadataCompleteness) return false;
  if (!checks.workflowCompleteness || !checks.bestPractices || !checks.examples || !checks.decisionRules) return false;
  return (
    scores.qualityScore >= PACK_CERT_QUALITY_MIN &&
    scores.confidenceScore >= PACK_CERT_CONFIDENCE_MIN &&
    scores.completenessScore >= PACK_CERT_COMPLETENESS_MIN &&
    scores.professionalReadinessScore >= PACK_CERT_READINESS_MIN &&
    scores.consistencyScore >= PACK_CERT_CONSISTENCY_MIN
  );
}

function meetsCertification(scores: KnowledgePackValidationResult["scores"]): boolean {
  return (
    scores.qualityScore >= PACK_CERT_QUALITY_MIN &&
    scores.confidenceScore >= PACK_CERT_CONFIDENCE_MIN &&
    scores.completenessScore >= PACK_CERT_COMPLETENESS_MIN &&
    scores.professionalReadinessScore >= PACK_CERT_READINESS_MIN
  );
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function range(values: number[]): { average: number; min: number; max: number } {
  if (!values.length) return { average: 0, min: 0, max: 0 };
  return { average: average(values), min: Math.min(...values), max: Math.max(...values) };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
