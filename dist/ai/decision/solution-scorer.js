export class SolutionScorer {
    score(solutions, request, qualityScore) {
        return solutions
            .map((solution) => {
            const goalAlignment = this.scoreGoalAlignment(solution, request);
            const resourceFit = this.scoreResourceFit(solution, request);
            const qualityPotential = (solution.estimatedQuality + qualityScore) / 2;
            const risk = solution.id.includes("minimal") ? 30 : 15;
            const overall = Math.round(goalAlignment * 0.35 +
                resourceFit * 0.25 +
                qualityPotential * 0.3 +
                (100 - risk) * 0.1);
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
    compare(scored) {
        if (scored.length < 2) {
            return "Single solution available";
        }
        const best = scored[0];
        const second = scored[1];
        return `Best: ${best.id} (${best.scores.overall}) vs ${second.id} (${second.scores.overall})`;
    }
    scoreGoalAlignment(solution, request) {
        if (solution.id === "sol-primary") {
            return 90;
        }
        if (request.priority === "critical" && solution.id === "sol-conservative") {
            return 88;
        }
        return 75;
    }
    scoreResourceFit(solution, request) {
        const required = request.requiredModules ?? [];
        if (required.length === 0) {
            return 80;
        }
        const overlap = solution.requiredModules.filter((m) => required.includes(m)).length;
        return Math.round((overlap / required.length) * 100);
    }
}
//# sourceMappingURL=solution-scorer.js.map