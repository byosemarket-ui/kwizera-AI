import { CandidateSolution, DecisionRequest, ScoredSolution } from "./types.js";
export declare class SolutionScorer {
    score(solutions: CandidateSolution[], request: DecisionRequest, qualityScore: number): ScoredSolution[];
    compare(scored: ScoredSolution[]): string;
    private scoreGoalAlignment;
    private scoreResourceFit;
}
//# sourceMappingURL=solution-scorer.d.ts.map