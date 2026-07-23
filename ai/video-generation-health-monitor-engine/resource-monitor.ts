import fs from "node:fs";
import path from "node:path";
import type { AiVideoGenerationFoundation } from "../video-generation-foundation/video-generation-foundation.js";

export interface VideoGenerationResourceMetrics {
  diskUsageMb: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  gpuUsagePercent: number;
  searchPerformanceMs: number;
  planningPerformanceMs: number;
  validationPerformanceMs: number;
  optimizationPerformanceMs: number;
}

export class VideoGenerationResourceMonitor {
  constructor(
    private readonly foundation: AiVideoGenerationFoundation,
    private readonly storageRoot: string
  ) {}

  measure(): VideoGenerationResourceMetrics {
    const production = this.foundation.getVideoProductionEngine().buildStatusReport();
    const story = this.foundation.getStoryGenerationEngine().buildStatusReport();
    const quality = this.foundation.getVideoQualityValidationEngine().buildStatusReport();
    const optimization = this.foundation.getVideoGenerationOptimizationEngine().buildStatusReport();

    let diskUsageMb = 0;
    const generationRoot = this.foundation.getGenerationRoot();
    if (fs.existsSync(generationRoot)) {
      diskUsageMb = Math.round(this.dirSize(generationRoot) / (1024 * 1024));
    }

    const mem = process.memoryUsage();

    return {
      diskUsageMb,
      memoryUsageMb: Math.round(mem.heapUsed / (1024 * 1024)),
      cpuUsagePercent: 0,
      gpuUsagePercent: 0,
      searchPerformanceMs: Math.max(
        story.performance.averageSearchMs,
        production.performance.averageSearchMs ?? 0
      ),
      planningPerformanceMs: production.performance.averagePlanningMs,
      validationPerformanceMs: quality.performance.averageValidationMs,
      optimizationPerformanceMs: optimization.performance.averageOptimizationMs,
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

export function deriveVideoGenerationPerformanceIssues(
  metrics: VideoGenerationResourceMetrics
): string[] {
  const issues: string[] = [];
  if (metrics.planningPerformanceMs > 120000) issues.push("Slow production planning detected");
  if (metrics.validationPerformanceMs > 120000) issues.push("Slow quality validation detected");
  if (metrics.optimizationPerformanceMs > 120000) issues.push("Slow optimization detected");
  if (metrics.searchPerformanceMs > 200) issues.push("Slow video generation search detected");
  if (metrics.diskUsageMb > 5000) issues.push("High video generation disk usage");
  if (metrics.memoryUsageMb > 512) issues.push("High memory usage during monitoring");
  if (metrics.gpuUsagePercent > 85) issues.push("High GPU usage detected");
  return issues;
}
