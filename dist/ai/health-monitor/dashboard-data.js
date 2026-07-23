export class DashboardDataBuilder {
    build(systemScore, systemLevel, moduleScores, resources, responseTimes, warnings, errors, recoveryActivity, alerts, history) {
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
//# sourceMappingURL=dashboard-data.js.map