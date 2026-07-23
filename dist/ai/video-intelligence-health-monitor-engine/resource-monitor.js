import fs from "node:fs";
import path from "node:path";
export class VideoIntelligenceResourceMonitor {
    foundation;
    storageRoot;
    constructor(foundation, storageRoot) {
        this.foundation = foundation;
        this.storageRoot = storageRoot;
    }
    measure() {
        const production = this.foundation.getProductionVideoPlanningEngine().buildStatusReport();
        const analysis = this.foundation.getVideoAnalysisEngine().buildStatusReport();
        const qp = this.foundation.getVideoQualityPredictionEngine().buildStatusReport();
        const timeline = this.foundation.getTimelineIntelligenceEngine().buildStatusReport();
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
            gpuUsagePercent: 0,
            searchPerformanceMs: Math.max(analysis.performance.averageSearchMs, qp.performance.averageSearchMs),
            planningPerformanceMs: production.performance.averagePlanningMs,
            timelineProcessingMs: timeline.performance.averageAnalysisMs,
            analysisPerformanceMs: analysis.performance.averageAnalysisMs,
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
export function deriveVideoIntelligencePerformanceIssues(metrics) {
    const issues = [];
    if (metrics.planningPerformanceMs > 120000)
        issues.push("Slow video planning detected");
    if (metrics.analysisPerformanceMs > 120000)
        issues.push("Slow video analysis detected");
    if (metrics.timelineProcessingMs > 120000)
        issues.push("Slow timeline processing detected");
    if (metrics.searchPerformanceMs > 200)
        issues.push("Slow video search detected");
    if (metrics.diskUsageMb > 5000)
        issues.push("High video intelligence disk usage");
    if (metrics.memoryUsageMb > 512)
        issues.push("High memory usage during monitoring");
    if (metrics.gpuUsagePercent > 85)
        issues.push("High GPU usage detected");
    return issues;
}
//# sourceMappingURL=resource-monitor.js.map