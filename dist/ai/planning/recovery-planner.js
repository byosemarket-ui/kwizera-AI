export class RecoveryPlanner {
    create(tasks, workflowId) {
        const checkpoints = tasks
            .filter((t) => t.priority === "critical" || t.priority === "high")
            .map((t) => `checkpoint-after-${t.id}`);
        return {
            primary: `Resume from last checkpoint in ${workflowId}`,
            fallback: "Rollback to pre-execution snapshot and re-plan",
            checkpoints: checkpoints.length > 0 ? checkpoints : ["checkpoint-after-validation"],
            rollbackSteps: [
                "Stop active workflow tasks",
                "Restore last checkpoint state",
                "Notify Decision Engine of failure",
                "Re-submit for replanning if needed",
            ],
        };
    }
}
//# sourceMappingURL=recovery-planner.js.map