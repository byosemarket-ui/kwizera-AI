export class ApproachComparator {
    compare(approaches) {
        const ranked = [...approaches].sort((a, b) => a.estimatedRisk - b.estimatedRisk);
        const tradeoffs = approaches.map((a) => ({
            approachId: a.id,
            note: `${a.label}: risk ${a.estimatedRisk}, ${a.advantages.length} advantages, ${a.disadvantages.length} disadvantages`,
        }));
        return {
            summary: `Compared ${approaches.length} approaches; lowest risk: ${ranked[0]?.label ?? "none"}`,
            rankedApproachIds: ranked.map((a) => a.id),
            tradeoffs,
        };
    }
}
//# sourceMappingURL=approach-comparator.js.map