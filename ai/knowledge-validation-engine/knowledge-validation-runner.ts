import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeRecordStatus,
} from "../knowledge-storage-engine/types.js";
import { KnowledgeVerificationStatus } from "../knowledge-foundation/types.js";
import { KnowledgeConsistencyValidator } from "./knowledge-consistency-validator.js";
import { KnowledgeIntegrityValidator } from "./knowledge-integrity-validator.js";
import { KnowledgeQualityScorer } from "./knowledge-quality-scorer.js";
import { KnowledgeRelationshipValidator } from "./knowledge-relationship-validator.js";
import { KnowledgeSourceValidator } from "./knowledge-source-validator.js";
import { KnowledgeStructureValidator } from "./knowledge-structure-validator.js";
import { KnowledgeVersionValidator } from "./knowledge-version-validator.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import {
  KnowledgeBatchValidationResult,
  KnowledgeRecordValidationResult,
  KnowledgeRepairResult,
  KnowledgeValidationLevel,
  KnowledgeQualityScores,
  TRUSTED_CONFIDENCE_MIN,
  TRUSTED_CONSISTENCY_MIN,
  TRUSTED_QUALITY_MIN,
  TRUSTED_RELIABILITY_MIN,
} from "./types.js";

export class KnowledgeValidationRunner {
  private readonly structureValidator = new KnowledgeStructureValidator();
  private readonly versionValidator = new KnowledgeVersionValidator();
  private readonly qualityScorer = new KnowledgeQualityScorer();
  private validationState = new Map<string, KnowledgeRecordValidationResult>();

  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly sourceValidator: KnowledgeSourceValidator,
    private readonly relationshipValidator: KnowledgeRelationshipValidator,
    private readonly consistencyValidator: KnowledgeConsistencyValidator,
    private readonly integrityValidator: KnowledgeIntegrityValidator,
    private readonly logger: KnowledgeValidationLogger,
    private readonly statePath: string
  ) {
    this.loadState();
  }

  async validateRecord(knowledgeId: string): Promise<KnowledgeRecordValidationResult> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const issues: string[] = [];
    const warnings: string[] = [];
    const repairs: string[] = [];

    const indexEntry = storage.findIndexEntry(knowledgeId);
    if (!indexEntry) {
      const result = this.buildResult(knowledgeId, false, KnowledgeValidationLevel.Rejected, {
        qualityScore: 0,
        reliabilityScore: 0,
        completenessScore: 0,
        consistencyScore: 0,
        confidenceScore: 0,
      }, issues, warnings, repairs, start, {
        structureValid: false,
        sourceValid: false,
        versionValid: false,
        relationshipValid: false,
        metadataValid: false,
      });
      return result;
    }

    const read = await storage.getRecord(knowledgeId, "knowledge-validation-engine").catch((error) => ({
      success: false as const,
      record: undefined,
      durationMs: 0,
      message: error instanceof Error ? error.message : String(error),
    }));
    if (!read.success || !read.record) {
      issues.push(read.message ?? "Failed to read knowledge record");
      const result = this.buildResult(knowledgeId, false, KnowledgeValidationLevel.Rejected, {
        qualityScore: 0,
        reliabilityScore: 0,
        completenessScore: 0,
        consistencyScore: 0,
        confidenceScore: 0,
      }, issues, warnings, repairs, start, {
        structureValid: false,
        sourceValid: false,
        versionValid: false,
        relationshipValid: false,
        metadataValid: false,
      });
      return result;
    }

    const record = read.record;

    const structure = this.structureValidator.validate(record);
    issues.push(...structure.issues);
    warnings.push(...structure.warnings);

    const source = this.sourceValidator.validateRecordSource(record);
    issues.push(...source.issues);

    const version = this.versionValidator.validate(record);
    issues.push(...version.issues);

    const relationship = this.relationshipValidator.validateRecord(record);
    issues.push(...relationship.issues);

    const metadataValid =
      Boolean(record.classification) &&
      record.searchableText.length > 0 &&
      record.contentHash.length > 0;
    if (!metadataValid) {
      issues.push("Metadata integrity check failed");
    }

    if (relationship.issues.some((i) => i.includes("Self-referential"))) {
      const fixed = record.relatedKnowledge.filter((id) => id !== record.knowledgeId);
      await storage.updateRecord(
        knowledgeId,
        { relatedKnowledge: fixed },
        "knowledge-validation-engine"
      );
      repairs.push("Removed self-referential relationship");
    }

    const scores = this.qualityScorer.score(
      record,
      structure.warnings,
      relationship.issues,
      source.issues
    );

    const validationLevel = this.resolveValidationLevel(record, scores, issues);
    const trusted = validationLevel === KnowledgeValidationLevel.Trusted;
    const valid =
      structure.valid &&
      source.valid &&
      version.valid &&
      relationship.valid &&
      metadataValid &&
      validationLevel !== KnowledgeValidationLevel.Rejected;

    if (
      valid &&
      validationLevel === KnowledgeValidationLevel.Validated &&
      record.verificationStatus !== KnowledgeVerificationStatus.Verified
    ) {
      await storage.updateRecord(
        knowledgeId,
        {
          verificationStatus: KnowledgeVerificationStatus.Verified,
          qualityScore: scores.qualityScore,
          confidenceScore: scores.confidenceScore,
        },
        "knowledge-validation-engine"
      );
    }

    if (
      trusted &&
      (record.status !== KnowledgeRecordStatus.Verified ||
        record.verificationStatus !== KnowledgeVerificationStatus.Verified)
    ) {
      await storage.updateRecord(
        knowledgeId,
        {
          verificationStatus: KnowledgeVerificationStatus.Verified,
          status: KnowledgeRecordStatus.Verified,
          qualityScore: scores.qualityScore,
          confidenceScore: scores.confidenceScore,
        },
        "knowledge-validation-engine"
      );
    }

    const result = this.buildResult(
      knowledgeId,
      valid,
      validationLevel,
      scores,
      issues,
      warnings,
      repairs,
      start,
      {
        structureValid: structure.valid,
        sourceValid: source.valid,
        versionValid: version.valid,
        relationshipValid: relationship.valid,
        metadataValid,
      }
    );

    this.validationState.set(knowledgeId, result);
    this.persistState();

    this.logger.log(valid ? "info" : "warn", "validation", "Knowledge record validated", {
      knowledgeId,
      validationLevel,
      trusted,
      qualityScore: scores.qualityScore,
    });

    return result;
  }

  async validateAll(): Promise<KnowledgeBatchValidationResult> {
    const start = Date.now();
    const storage = this.foundation.getStorageEngine();
    const results: KnowledgeRecordValidationResult[] = [];

    for (const entry of storage.getIndexEntries()) {
      results.push(await this.validateRecord(entry.knowledgeId));
    }

    return {
      totalRecords: results.length,
      validRecords: results.filter((r) => r.valid).length,
      trustedRecords: results.filter((r) => r.trusted).length,
      rejectedRecords: results.filter((r) => r.validationLevel === KnowledgeValidationLevel.Rejected).length,
      repairedRecords: results.filter((r) => r.repairs.length > 0).length,
      results,
      durationMs: Date.now() - start,
    };
  }

  async repairSafeIssues(): Promise<KnowledgeRepairResult> {
    const start = Date.now();
    const quarantined = await this.integrityValidator.quarantineCorruptRecords();
    const consistency = await this.consistencyValidator.validateAll(true);
    const relationship = await this.relationshipValidator.validateAll(true);
    const rejected = await this.consistencyValidator.rejectInvalidRecords();

    const diagnostics = [...consistency.diagnostics, ...relationship.diagnostics];

    this.logger.log("info", "repair", "Safe issue repair complete", {
      repairsApplied: consistency.repairsApplied + relationship.issuesRepaired,
      quarantined,
      rejected,
    });

    return {
      repaired: consistency.repairsApplied + relationship.issuesRepaired + quarantined,
      rejected,
      diagnostics,
      durationMs: Date.now() - start,
    };
  }

  getValidationResult(knowledgeId: string): KnowledgeRecordValidationResult | undefined {
    return this.validationState.get(knowledgeId);
  }

  getAllResults(): KnowledgeRecordValidationResult[] {
    return [...this.validationState.values()];
  }

  isTrusted(knowledgeId: string): boolean {
    return this.validationState.get(knowledgeId)?.trusted ?? false;
  }

  getValidationLevel(knowledgeId: string): KnowledgeValidationLevel {
    return this.validationState.get(knowledgeId)?.validationLevel ?? KnowledgeValidationLevel.PendingValidation;
  }

  private resolveValidationLevel(
    record: { status: KnowledgeRecordStatus; qualityScore: number },
    scores: KnowledgeQualityScores,
    issues: string[]
  ): KnowledgeValidationLevel {
    if (record.status === KnowledgeRecordStatus.Archived) {
      return KnowledgeValidationLevel.Archived;
    }
    if (record.status === KnowledgeRecordStatus.Rejected || issues.some((i) => i.includes("corrupt"))) {
      return KnowledgeValidationLevel.Rejected;
    }
    if (issues.length > 0 && scores.qualityScore < 40) {
      return KnowledgeValidationLevel.Rejected;
    }
    if (scores.qualityScore < 50 && scores.completenessScore < 50) {
      return KnowledgeValidationLevel.Draft;
    }
    if (
      scores.qualityScore >= TRUSTED_QUALITY_MIN &&
      scores.confidenceScore >= TRUSTED_CONFIDENCE_MIN &&
      scores.reliabilityScore >= TRUSTED_RELIABILITY_MIN &&
      scores.consistencyScore >= TRUSTED_CONSISTENCY_MIN &&
      issues.length === 0
    ) {
      return KnowledgeValidationLevel.Trusted;
    }
    if (issues.length === 0 && scores.qualityScore >= 60) {
      return KnowledgeValidationLevel.Validated;
    }
    return KnowledgeValidationLevel.PendingValidation;
  }

  private buildResult(
    knowledgeId: string,
    valid: boolean,
    validationLevel: KnowledgeValidationLevel,
    scores: KnowledgeRecordValidationResult["scores"],
    issues: string[],
    warnings: string[],
    repairs: string[],
    start: number,
    checks: {
      structureValid: boolean;
      sourceValid: boolean;
      versionValid: boolean;
      relationshipValid: boolean;
      metadataValid: boolean;
    }
  ): KnowledgeRecordValidationResult {
    const trusted = validationLevel === KnowledgeValidationLevel.Trusted;
    const verificationStatus =
      validationLevel === KnowledgeValidationLevel.Rejected
        ? KnowledgeVerificationStatus.Rejected
        : trusted || validationLevel === KnowledgeValidationLevel.Validated
          ? KnowledgeVerificationStatus.Verified
          : KnowledgeVerificationStatus.Pending;

    return {
      knowledgeId,
      valid,
      validationLevel,
      verificationStatus,
      trusted,
      scores,
      structureValid: checks.structureValid,
      sourceValid: checks.sourceValid,
      versionValid: checks.versionValid,
      relationshipValid: checks.relationshipValid,
      metadataValid: checks.metadataValid,
      issues,
      warnings,
      repairs,
      durationMs: Date.now() - start,
    };
  }

  private loadState(): void {
    if (fs.existsSync(this.statePath)) {
      const data = JSON.parse(fs.readFileSync(this.statePath, "utf8")) as KnowledgeRecordValidationResult[];
      for (const item of data) {
        this.validationState.set(item.knowledgeId, item);
      }
    }
  }

  private persistState(): void {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(
      this.statePath,
      JSON.stringify([...this.validationState.values()], null, 2),
      "utf8"
    );
  }
}
