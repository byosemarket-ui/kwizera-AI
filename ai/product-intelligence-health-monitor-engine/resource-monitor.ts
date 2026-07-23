import fs from "node:fs";
import path from "node:path";
import type { AiProductIntelligenceFoundation } from "../product-intelligence-foundation/product-intelligence-foundation.js";

export interface ProductIntelligenceResourceMetrics {
  diskUsageMb: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  searchPerformanceMs: number;
  planningPerformanceMs: number;
  relationshipDetectionMs: number;
}

export class ProductIntelligenceResourceMonitor {
  constructor(
    private readonly foundation: AiProductIntelligenceFoundation,
    private readonly storageRoot: string
  ) {}

  measure(): ProductIntelligenceResourceMetrics {
    const script = this.foundation.getScriptPlanningEngine().buildStatusReport();
    const production = this.foundation.getProductionPlanningEngine().buildStatusReport();
    const analysis = this.foundation.getProductAnalysisEngine().buildStatusReport();

    let diskUsageMb = 0;
    const intelligenceRoot = this.foundation.getIntelligenceRoot();
    if (fs.existsSync(intelligenceRoot)) {
      diskUsageMb = Math.round(this.dirSize(intelligenceRoot) / (1024 * 1024));
    }

    const mem = process.memoryUsage();

    return {
      diskUsageMb,
      memoryUsageMb: Math.round(mem.heapUsed / (1024 * 1024)),
      cpuUsagePercent: 0,
      searchPerformanceMs: Math.max(
        script.performance.averageSearchMs,
        analysis.performance.averageSearchMs
      ),
      planningPerformanceMs: production.performance.averagePlanningMs,
      relationshipDetectionMs: script.performance.averageRelationshipMs ?? 0,
    };
  }

  private dirSize(dir: string): number {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) size += this.dirSize(p);
      else if (entry.isFile()) size += fs.statSync(p).size;
    }
    return size;
  }
}

export function deriveProductIntelligencePerformanceIssues(
  metrics: ProductIntelligenceResourceMetrics
): string[] {
  const issues: string[] = [];
  if (metrics.planningPerformanceMs > 120000) issues.push("Slow product planning detected");
  if (metrics.searchPerformanceMs > 200) issues.push("Slow product search detected");
  if (metrics.diskUsageMb > 5000) issues.push("High product intelligence disk usage");
  if (metrics.memoryUsageMb > 512) issues.push("High memory usage during monitoring");
  return issues;
}
