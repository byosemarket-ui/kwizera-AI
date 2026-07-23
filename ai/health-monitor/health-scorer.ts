import { HealthCheckCategory, SystemHealthCheckResult, ModuleHealthScore, SystemHealthLevel } from "./types.js";

export class HealthScorer {
  scoreFromChecks(checks: SystemHealthCheckResult[]): number {
    if (checks.length === 0) return 0;
    const passed = checks.filter((c) => c.passed).length;
    return Math.round((passed / checks.length) * 100);
  }

  scoreToLevel(score: number): SystemHealthLevel {
    if (score >= 95) return SystemHealthLevel.Excellent;
    if (score >= 80) return SystemHealthLevel.Good;
    if (score >= 60) return SystemHealthLevel.Warning;
    if (score >= 30) return SystemHealthLevel.Critical;
    return SystemHealthLevel.Failed;
  }

  scoreModule(
    moduleId: string,
    moduleName: string,
    checks: SystemHealthCheckResult[],
    responseTimeMs: number,
    implemented: boolean
  ): ModuleHealthScore {
    const warnings = checks.filter((c) => !c.passed && c.message.includes("framework")).map((c) => c.message);
    const errors = checks.filter((c) => !c.passed && !c.message.includes("framework")).map((c) => c.message);

    let score: number;
    if (!implemented) {
      score = 100;
      warnings.push("Framework slot — not yet implemented");
    } else {
      score = this.scoreFromChecks(checks);
    }

    return {
      moduleId,
      moduleName,
      score,
      level: this.scoreToLevel(score),
      available: implemented ? errors.length === 0 : false,
      responseTimeMs,
      warnings,
      errors,
    };
  }

  aggregateSystemScore(moduleScores: ModuleHealthScore[]): number {
    const implemented = moduleScores.filter((m) => m.available || m.errors.length > 0 || m.score < 100);
    if (implemented.length === 0) {
      const avg = moduleScores.reduce((a, m) => a + m.score, 0) / moduleScores.length;
      return Math.round(avg);
    }
    const avg = implemented.reduce((a, m) => a + m.score, 0) / implemented.length;
    return Math.round(avg);
  }
}
