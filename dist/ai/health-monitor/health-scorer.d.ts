import { SystemHealthCheckResult, ModuleHealthScore, SystemHealthLevel } from "./types.js";
export declare class HealthScorer {
    scoreFromChecks(checks: SystemHealthCheckResult[]): number;
    scoreToLevel(score: number): SystemHealthLevel;
    scoreModule(moduleId: string, moduleName: string, checks: SystemHealthCheckResult[], responseTimeMs: number, implemented: boolean): ModuleHealthScore;
    aggregateSystemScore(moduleScores: ModuleHealthScore[]): number;
}
//# sourceMappingURL=health-scorer.d.ts.map