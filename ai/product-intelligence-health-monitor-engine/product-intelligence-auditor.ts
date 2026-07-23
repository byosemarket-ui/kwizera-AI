import fs from "node:fs";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";
import { ProductIntelligenceModuleStatus } from "../product-intelligence-foundation/types.js";
import { ProductIntelligenceHealthMonitorLogger } from "./health-logger.js";
import { ProductIntelligenceAuditResult } from "./types.js";

const EXTERNAL_PI_DEPENDENCIES = new Set(["product-engine", "knowledge-engine", "memory-engine"]);

function isDependencySatisfied(
  foundation: AiProductIntelligenceFoundation,
  dep: string
): boolean {
  if (EXTERNAL_PI_DEPENDENCIES.has(dep)) {
    const status = foundation.integration.getStatus();
    if (dep === "knowledge-engine") return status.knowledgeEngine;
    if (dep === "memory-engine") return status.memoryEngine;
    return true;
  }
  const depMod = foundation.getRegistry().getModule(dep);
  return Boolean(
    depMod?.implemented ||
      depMod?.status === ProductIntelligenceModuleStatus.Prepared ||
      depMod?.status === ProductIntelligenceModuleStatus.Registered ||
      depMod?.status === ProductIntelligenceModuleStatus.Active
  );
}

export class ProductIntelligenceAuditor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly storageRoot: string,
    private readonly logger: ProductIntelligenceHealthMonitorLogger
  ) {}

  async runAudit(): Promise<ProductIntelligenceAuditResult> {
    const start = Date.now();
    const auditId = `pi-audit-${Date.now()}`;

    const scriptReport = this.foundation.getScriptPlanningEngine().buildStatusReport();
    const visualReport = this.foundation.getVisualPlanningEngine().buildStatusReport();
    const audioReport = this.foundation.getAudioPlanningEngine().buildStatusReport();
    const productionReport = this.foundation.getProductionPlanningEngine().buildStatusReport();
    const storyboardReport = this.foundation.getStoryboardIntelligenceEngine().buildStatusReport();

    const planningIntegrity =
      scriptReport.readinessScore >= 75 &&
      visualReport.readinessScore >= 75 &&
      audioReport.readinessScore >= 75 &&
      productionReport.readinessScore >= 75 &&
      storyboardReport.readinessScore >= 75;

    const qpReport = this.foundation.getQualityPredictionEngine().buildStatusReport();
    const relationshipIntegrity =
      qpReport.readinessScore >= 75 &&
      (qpReport.predictionsPrepared === 0 || qpReport.averageOverallQualityScore >= 55);

    const creativeReport = this.foundation.getCreativeDirectionEngine().buildStatusReport();
    const creativeConsistency =
      creativeReport.readinessScore >= 75 &&
      (creativeReport.averageCreativeQualityScore === 0 ||
        creativeReport.averageCreativeQualityScore >= 55);

    const strategyReport = this.foundation.getMarketingStrategyIntelligenceEngine().buildStatusReport();
    const marketingConsistency =
      strategyReport.readinessScore >= 75 &&
      (strategyReport.averageStrategyQualityScore === 0 ||
        strategyReport.averageStrategyQualityScore >= 55);

    const understandingReport = this.foundation.getProductUnderstandingEngine().buildStatusReport();
    const brandConsistency =
      understandingReport.readinessScore >= 75 &&
      (understandingReport.averageUnderstandingScore === 0 ||
        understandingReport.averageUnderstandingScore >= 55);

    const registry = this.foundation.getRegistry();
    const implemented = registry.getAllModules().filter((m) => m.implemented);
    const dependencyValidation = implemented.every((mod) =>
      mod.dependencies.every((dep) => isDependencySatisfied(this.foundation, dep))
    );

    const optimizationStatus =
      this.foundation.getProductIntelligenceOptimizationEngine().buildStatusReport().readinessScore >= 75;

    const qualityPredictionStatus = qpReport.readinessScore >= 75;

    const intelligenceRoot = this.foundation.getIntelligenceRoot();
    const storageOk = fs.existsSync(intelligenceRoot);

    const valid =
      storageOk &&
      planningIntegrity &&
      relationshipIntegrity &&
      dependencyValidation &&
      optimizationStatus &&
      qualityPredictionStatus;

    this.logger.log("info", "audit", "Product intelligence audit complete", {
      auditId,
      valid,
      durationMs: Date.now() - start,
    });

    return {
      auditId,
      timestamp: new Date().toISOString(),
      planningIntegrity,
      relationshipIntegrity,
      creativeConsistency,
      marketingConsistency,
      brandConsistency,
      dependencyValidation,
      optimizationStatus,
      qualityPredictionStatus,
      valid,
      durationMs: Date.now() - start,
    };
  }
}
