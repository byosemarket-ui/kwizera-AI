import { HealthAlert, HealthDashboardData, ModuleHealthScore, ResourceUsage, ResponseTimeMetrics, SystemHealthLevel } from "./types.js";
import type { HealthHistoryStore } from "./health-history-store.js";
export declare class DashboardDataBuilder {
    build(systemScore: number, systemLevel: SystemHealthLevel, moduleScores: ModuleHealthScore[], resources: ResourceUsage, responseTimes: ResponseTimeMetrics, warnings: string[], errors: string[], recoveryActivity: string[], alerts: HealthAlert[], history: HealthHistoryStore): HealthDashboardData;
}
//# sourceMappingURL=dashboard-data.d.ts.map