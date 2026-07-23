import fs from "node:fs";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { KnowledgeHealthMonitorLogger } from "./health-logger.js";
import { KnowledgeAuditResult } from "./types.js";

export class KnowledgeAuditor {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly storageRoot: string,
    private readonly logger: KnowledgeHealthMonitorLogger
  ) {}

  async runAudit(): Promise<KnowledgeAuditResult> {
    const start = Date.now();
    const auditId = `audit-${Date.now()}`;

    let knowledgeIntegrity = false;
    try {
      const integrity = await this.foundation.getKnowledgeValidationEngine().validateIntegrity();
      knowledgeIntegrity = integrity.valid;
    } catch {
      knowledgeIntegrity = false;
    }

    const consistency = await this.foundation
      .getKnowledgeValidationEngine()
      .validateConsistency(false);
    const knowledgeConsistency = consistency.valid;

    const relationships = await this.foundation
      .getKnowledgeValidationEngine()
      .validateRelationships(false);
    const relationshipIntegrity = relationships.valid;

    const graphIntegrity = this.foundation.getGraphEngine().validateIntegrity().valid;

    const validationStatus =
      this.foundation.getKnowledgeValidationEngine().buildStatusReport().readinessScore >= 75;

    const optimizationStatus =
      this.foundation.getKnowledgeOptimizationEngine().buildStatusReport().readinessScore >= 75;

    const retrieval = this.foundation.getRetrievalEngine().buildStatusReport();
    const searchQuality = retrieval.readinessScore >= 75;

    const graph = this.foundation.getGraphEngine().buildStatusReport();
    const recommendationQuality = graph.readinessScore >= 75;

    const validationReport = this.foundation.getKnowledgeValidationEngine().buildStatusReport();
    const knowledgeQuality = validationReport.trustedCount >= 0;

    const knowledgeRoot = this.foundation.getKnowledgeRoot();
    const storageOk = fs.existsSync(knowledgeRoot);

    const valid =
      storageOk &&
      knowledgeIntegrity &&
      relationshipIntegrity &&
      graphIntegrity &&
      validationStatus &&
      optimizationStatus &&
      searchQuality;

    this.logger.log("info", "audit", "Knowledge audit complete", {
      auditId,
      valid,
      durationMs: Date.now() - start,
    });

    return {
      auditId,
      timestamp: new Date().toISOString(),
      knowledgeIntegrity,
      knowledgeConsistency,
      relationshipIntegrity,
      graphIntegrity,
      validationStatus,
      optimizationStatus,
      searchQuality,
      recommendationQuality,
      knowledgeQuality,
      valid,
      durationMs: Date.now() - start,
    };
  }
}
