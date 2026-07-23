import { CandidateSolution, DecisionRequest, ScoredSolution } from "./types.js";

export class SolutionScorer {
  score(
    solutions: CandidateSolution[],
    request: DecisionRequest,
    qualityScore: number
  ): ScoredSolution[] {
    return solutions
      .map((solution) => {
        const goalAlignment = this.scoreGoalAlignment(solution, request);
        const resourceFit = this.scoreResourceFit(solution, request);
        const qualityPotential = (solution.estimatedQuality + qualityScore) / 2;
        const risk = solution.id.includes("minimal") ? 30 : 15;
        const overall = Math.round(
          goalAlignment * 0.35 +
            resourceFit * 0.25 +
            qualityPotential * 0.3 +
            (100 - risk) * 0.1
        );

        return {
          ...solution,
          scores: {
            overall,
            goalAlignment,
            resourceFit,
            qualityPotential,
            risk,
          },
        };
      })
      .sort((a, b) => b.scores.overall - a.scores.overall);
  }

  compare(scored: ScoredSolution[]): string {
    if (scored.length < 2) {
      return "Single solution available";
    }
    const best = scored[0];
    const second = scored[1];
    return `Best: ${best.id} (${best.scores.overall}) vs ${second.id} (${second.scores.overall})`;
  }

  private scoreGoalAlignment(solution: CandidateSolution, request: DecisionRequest): number {
    if (solution.id === "sol-primary") {
      return 90;
    }
    if (request.priority === "critical" && solution.id === "sol-conservative") {
      return 88;
    }
    return 75;
  }

  private scoreResourceFit(solution: CandidateSolution, request: DecisionRequest): number {
    const required = request.requiredModules ?? [];
    if (required.length === 0) {
      return 80;
    }
    const overlap = solution.requiredModules.filter((m) => required.includes(m)).length;
    return Math.round((overlap / required.length) * 100);
  }
}
