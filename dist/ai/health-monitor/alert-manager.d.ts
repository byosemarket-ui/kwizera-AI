import { HealthMonitorLogger } from "./health-logger.js";
import { HealthAlert, ResourceUsage } from "./types.js";
export declare class AlertManager {
    private readonly logger;
    private readonly alerts;
    private readonly recentAlertKeys;
    constructor(logger: HealthMonitorLogger);
    evaluate(resources: ResourceUsage, moduleErrors: Array<{
        component: string;
        message: string;
    }>, systemHealthy: boolean): HealthAlert[];
    getAlerts(): ReadonlyArray<HealthAlert>;
    private createAlert;
    private inferAlertType;
}
//# sourceMappingURL=alert-manager.d.ts.map