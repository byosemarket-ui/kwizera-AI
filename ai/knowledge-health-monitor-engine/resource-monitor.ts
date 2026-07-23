import fs from "node:fs";
import path from "node:path";
import type { AiKnowledgeFoundation } from "../knowledge-foundation/knowledge-foundation.js";
import { MonitoredKnowledgeModuleHealthScore } from "./types.js";

export interface KnowledgeResourceMetrics {
  diskUsageMb: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  searchPerformanceMs: number;
  retrievalPerformanceMs: number;
  validationPerformanceMs: number;
}

export class KnowledgeResourceMonitor {
  constructor(
    private readonly foundation: AiKnowledgeFoundation,
    private readonly storageRoot: string
  ) {}

  measure(): KnowledgeResourceMetrics {
    const retrieval = this.foundation.getRetrievalEngine().buildStatusReport();
    const validation = this.foundation.getKnowledgeValidationEngine().buildStatusReport();

    let diskUsageMb = 0;
    const knowledgeRoot = this.foundation.getKnowledgeRoot();
    if (fs.existsSync(knowledgeRoot)) {
      diskUsageMb = Math.round(this.dirSize(knowledgeRoot) / (1024 * 1024));
    }

    const mem = process.memoryUsage();

    return {
      diskUsageMb,
      memoryUsageMb: Math.round(mem.heapUsed / (1024 * 1024)),
      cpuUsagePercent: 0,
      searchPerformanceMs: retrieval.searchPerformance.averageSearchMs,
      retrievalPerformanceMs: retrieval.searchPerformance.averageRetrievalMs,
      validationPerformanceMs: validation.performance.averageValidationMs,
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

export function deriveKnowledgePerformanceIssues(metrics: KnowledgeResourceMetrics): string[] {
  const issues: string[] = [];
  if (metrics.retrievalPerformanceMs > 200) issues.push("Slow knowledge retrieval detected");
  if (metrics.searchPerformanceMs > 200) issues.push("Slow knowledge search detected");
  if (metrics.diskUsageMb > 5000) issues.push("High knowledge disk usage");
  if (metrics.memoryUsageMb > 512) issues.push("High memory usage during monitoring");
  return issues;
}
