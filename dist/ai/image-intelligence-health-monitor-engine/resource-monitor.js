import fs from "node:fs";
import path from "node:path";
export class ImageIntelligenceResourceMonitor {
    foundation;
    storageRoot;
    constructor(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
    }
    measure() {
        const production = this.foundation.getProductionImagePlanningEngine().buildStatusReport();
        const analysis = this.foundation.getImageAnalysisEngine().buildStatusReport();
        const qp = this.foundation.getImageQualityPredictionEngine().buildStatusReport();
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
            searchPerformanceMs: Math.max(analysis.performance.averageSearchMs, qp.performance.averageSearchMs),
            planningPerformanceMs: production.performance.averagePlanningMs,
            relationshipDetectionMs: production.performance.averageRelationshipMs ?? 0,
        };
    }
    dirSize(dir) {
        let size = 0;
        if (!fs.existsSync(dir))
            return 0;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory())
                size += this.dirSize(p);
            else if (entry.isFile())
                size += fs.statSync(p).size;
        }
        return size;
    }
}
export function deriveImageIntelligencePerformanceIssues(metrics) {
    const issues = [];
    if (metrics.planningPerformanceMs > 120000)
        issues.push("Slow image planning detected");
    if (metrics.searchPerformanceMs > 200)
        issues.push("Slow image search detected");
    if (metrics.diskUsageMb > 5000)
        issues.push("High image intelligence disk usage");
    if (metrics.memoryUsageMb > 512)
        issues.push("High memory usage during monitoring");
    return issues;
}
//# sourceMappingURL=resource-monitor.js.map