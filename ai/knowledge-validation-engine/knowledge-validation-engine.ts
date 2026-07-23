import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import {
  KnowledgeAccessPermission,
  KnowledgeCategory,
  KnowledgeModuleStatus,
  KnowledgeSource,
  KnowledgeVerificationStatus,
} from "../knowledge-foundation/types.js";
import { KnowledgeConsistencyValidator } from "./knowledge-consistency-validator.js";
import { KnowledgeIntegrityValidator } from "./knowledge-integrity-validator.js";
import { KnowledgeRelationshipValidator } from "./knowledge-relationship-validator.js";
import { KnowledgeSourceValidator } from "./knowledge-source-validator.js";
import { KnowledgeValidationRunner } from "./knowledge-validation-runner.js";
import { KnowledgeValidationLogger } from "./validation-logger.js";
import { ValidationReportGenerator } from "./validation-report-generator.js";
import {
  KnowledgeBatchValidationResult,
  KnowledgeConsistencyValidationResult,
  KnowledgeIntegrityValidationResult,
  KnowledgeRecordValidationResult,
  KnowledgeRelationshipValidationResult,
  KnowledgeRepairResult,
  KnowledgeSourceValidationResult,
  KnowledgeValidationEngineError,
  KnowledgeValidationLevel,
  KnowledgeValidationStatusReport,
} from "./types.js";

/**
 * Knowledge Validation Engine — verifies accuracy, consistency, and trustworthiness of all knowledge.
 */
export class AiKnowledgeValidationEngine {
  private foundation: AiKnowledgeFoundation | null = null;
  private storageRoot = "";
  private validationDir = "";
  private initialized = false;
  private startupComplete = false;

  readonly logger = new KnowledgeValidationLogger();

  private sourceValidator: KnowledgeSourceValidator | null = null;
  private relationshipValidator: KnowledgeRelationshipValidator | null = null;
  private consistencyValidator: KnowledgeConsistencyValidator | null = null;
  private integrityValidator: KnowledgeIntegrityValidator | null = null;
  private runner: KnowledgeValidationRunner | null = null;
  private reportGenerator: ValidationReportGenerator | null = null;

  private validationTimes: number[] = [];
  private totalValidations = 0;
  private lastValidationMs = 0;
  private lastBatchMs = 0;
  private readonly activeValidations = new Set<string>();
  private batchValidationActive = false;

  initialize(foundation: AiKnowledgeFoundation, storageRoot: string): void {
    this.foundation = foundation;
    this.storageRoot = storageRoot;
    this.validationDir = path.join(storageRoot, "knowledge", "validation", "engine");
    fs.mkdirSync(this.validationDir, { recursive: true });

    const logDir = path.join(storageRoot, "logs");
    this.logger.initialize(logDir);

    this.sourceValidator = new KnowledgeSourceValidator(foundation, this.logger);
    this.relationshipValidator = new KnowledgeRelationshipValidator(foundation, this.logger);
    this.consistencyValidator = new KnowledgeConsistencyValidator(foundation, this.logger);
    this.integrityValidator = new KnowledgeIntegrityValidator(foundation, this.logger);

    const statePath = path.join(this.validationDir, "validation-state.json");
    this.runner = new KnowledgeValidationRunner(
      foundation,
      this.sourceValidator,
      this.relationshipValidator,
      this.consistencyValidator,
      this.integrityValidator,
      this.logger,
      statePath
    );

    this.reportGenerator = new ValidationReportGenerator(
      storageRoot,
      this.runner,
      this.integrityValidator,
      this.relationshipValidator
    );

    this.initialized = true;
    this.logger.log("info", "startup", "Knowledge Validation Engine initialized", { storageRoot });
  }

  async runStartup(): Promise<void> {
    this.ensureReady();
    const start = Date.now();

    this.foundation!.registerKnowledgeModule({
      knowledgeId: "knowledge-validation",
      knowledgeName: "Knowledge Validation",
      category: KnowledgeCategory.Validation,
      version: "0.1.0",
      status: KnowledgeModuleStatus.Active,
      dependencies: ["knowledge-engine", "memory-engine"],
      source: KnowledgeSource.KnowledgeModule,
      qualityScore: 95,
      confidenceScore: 93,
      storageLocation: this.validationDir,
      accessPermissions: [
        KnowledgeAccessPermission.Read,
        KnowledgeAccessPermission.Write,
        KnowledgeAccessPermission.Validate,
        KnowledgeAccessPermission.Admin,
      ],
      implemented: true,
    });

    this.startupComplete = true;
    this.logger.log("info", "startup", "Knowledge Validation Engine startup complete", {
      durationMs: Date.now() - start,
    });
  }

  async validateKnowledge(knowledgeId: string): Promise<KnowledgeRecordValidationResult> {
    this.ensureReady();
    if (this.activeValidations.has(knowledgeId)) {
      return (
        this.runner!.getValidationResult(knowledgeId) ?? {
          knowledgeId,
          valid: false,
          validationLevel: KnowledgeValidationLevel.PendingValidation,
          verificationStatus: KnowledgeVerificationStatus.Pending,
          trusted: false,
          scores: {
            qualityScore: 0,
            reliabilityScore: 0,
            completenessScore: 0,
            consistencyScore: 0,
            confidenceScore: 0,
          },
          structureValid: false,
          sourceValid: false,
          versionValid: false,
          relationshipValid: false,
          metadataValid: false,
          issues: ["Validation already in progress"],
          warnings: [],
          repairs: [],
          durationMs: 0,
        }
      );
    }

    this.activeValidations.add(knowledgeId);
    const start = Date.now();
    try {
      const result = await this.runner!.validateRecord(knowledgeId);
      this.recordValidationTiming(Date.now() - start);
      return result;
    } finally {
      this.activeValidations.delete(knowledgeId);
    }
  }

  async validateAll(): Promise<KnowledgeBatchValidationResult> {
    this.ensureReady();
    this.batchValidationActive = true;
    const start = Date.now();
    try {
      const result = await this.runner!.validateAll();
      this.lastBatchMs = Date.now() - start;
      this.recordValidationTiming(this.lastBatchMs);
      return result;
    } finally {
      this.batchValidationActive = false;
    }
  }

  validateSource(source: string): KnowledgeSourceValidationResult {
    this.ensureReady();
    return this.sourceValidator!.validateSource(source);
  }

  async validateRelationships(repair = false): Promise<KnowledgeRelationshipValidationResult> {
    this.ensureReady();
    return this.relationshipValidator!.validateAll(repair);
  }

  async validateConsistency(repair = false): Promise<KnowledgeConsistencyValidationResult> {
    this.ensureReady();
    return this.consistencyValidator!.validateAll(repair);
  }

  async validateIntegrity(): Promise<KnowledgeIntegrityValidationResult> {
    this.ensureReady();
    return this.integrityValidator!.validateAll();
  }

  async quarantineCorruptRecords(): Promise<number> {
    this.ensureReady();
    return this.integrityValidator!.quarantineCorruptRecords();
  }

  async repairSafeIssues(): Promise<KnowledgeRepairResult> {
    this.ensureReady();
    this.batchValidationActive = true;
    try {
      return await this.runner!.repairSafeIssues();
    } finally {
      this.batchValidationActive = false;
    }
  }

  async rejectInvalidKnowledge(): Promise<number> {
    this.ensureReady();
    this.batchValidationActive = true;
    try {
      return await this.consistencyValidator!.rejectInvalidRecords();
    } finally {
      this.batchValidationActive = false;
    }
  }

  isTrusted(knowledgeId: string): boolean {
    this.ensureReady();
    return this.runner!.isTrusted(knowledgeId);
  }

  getValidationLevel(knowledgeId: string): KnowledgeValidationLevel {
    this.ensureReady();
    return this.runner!.getValidationLevel(knowledgeId);
  }

  async generateReports(): Promise<{
    validationReportPath: string;
    qualityReportPath: string;
    integrityReportPath: string;
  }> {
    this.ensureReady();
    return this.reportGenerator!.generateAll(this.buildStatusReport());
  }

  async handleKnowledgeChange(
    knowledgeId: string,
    operation: "create" | "update"
  ): Promise<void> {
    this.ensureReady();
    await this.revalidateOnChange(knowledgeId, operation);
  }

  buildStatusReport(): KnowledgeValidationStatusReport {
    const avg = (times: number[]) =>
      times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    let readinessScore = 100;
    if (!this.initialized) readinessScore = 0;
    if (!this.startupComplete) readinessScore -= 25;

    const results = this.runner?.getAllResults() ?? [];
    const trustedCount = results.filter((r) => r.trusted).length;
    const rejectedCount = results.filter(
      (r) => r.validationLevel === KnowledgeValidationLevel.Rejected
    ).length;

    return {
      engineStatus: this.startupComplete ? "operational" : "initializing",
      knowledgeValidationStatus:
        this.totalValidations > 0
          ? `${this.totalValidations} validation(s) completed`
          : "awaiting first validation",
      qualityStatus:
        results.length > 0
          ? `${trustedCount}/${results.length} trusted`
          : "awaiting validation run",
      integrityStatus: "integrity validation enabled",
      relationshipValidationStatus: "relationship validation enabled",
      totalValidations: this.totalValidations,
      trustedCount,
      rejectedCount,
      performance: {
        averageValidationMs: avg(this.validationTimes),
        lastValidationMs: this.lastValidationMs,
        lastBatchMs: this.lastBatchMs,
      },
      knownIssues: [],
      readinessScore: Math.max(0, readinessScore),
      timestamp: new Date().toISOString(),
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isStartupComplete(): boolean {
    return this.startupComplete;
  }

  private async revalidateOnChange(
    knowledgeId: string,
    operation: "create" | "update"
  ): Promise<void> {
    if (this.batchValidationActive || this.activeValidations.has(knowledgeId)) {
      return;
    }

    this.logger.log("info", "validation", "Revalidating knowledge after change", {
      knowledgeId,
      operation,
    });
    await this.validateKnowledge(knowledgeId);
  }

  private recordValidationTiming(durationMs: number): void {
    this.totalValidations++;
    this.lastValidationMs = durationMs;
    this.validationTimes.push(durationMs);
  }

  private ensureReady(): void {
    if (!this.initialized || !this.foundation) {
      throw new KnowledgeValidationEngineError(
        "Knowledge Validation Engine not initialized",
        "NOT_INITIALIZED"
      );
    }
  }
}
