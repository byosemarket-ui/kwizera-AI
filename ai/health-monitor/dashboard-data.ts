import {
  HealthAlert,
  HealthDashboardData,
  ModuleHealthScore,
  ResourceUsage,
  ResponseTimeMetrics,
  SystemHealthLevel,
} from "./types.js";
import type { HealthHistoryStore } from "./health-history-store.js";

export class DashboardDataBuilder {
  build(
    systemScore: number,
    systemLevel: SystemHealthLevel,
    moduleScores: ModuleHealthScore[],
    resources: ResourceUsage,
    responseTimes: ResponseTimeMetrics,
    warnings: string[],
    errors: string[],
    recoveryActivity: string[],
    alerts: HealthAlert[],
    history: HealthHistoryStore
  ): HealthDashboardData {
    return {
      applicationHealth: systemLevel,
      systemScore,
      moduleHealth: moduleScores,
      resourceUsage: resources,
      responseTimes,
      warnings,
      errors,
      recoveryActivity,
      performanceTrends: history.getPerformanceTrends(),
      alerts: [...alerts],
      lastUpdated: new Date().toISOString(),
    };
  }
}
