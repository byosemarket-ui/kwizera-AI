import { HealthMonitorLogger } from "./health-logger.js";
import { HealthAlert, ResourceUsage } from "./types.js";

let alertCounter = 0;

export class AlertManager {
  private readonly alerts: HealthAlert[] = [];
  private readonly recentAlertKeys = new Set<string>();

  constructor(private readonly logger: HealthMonitorLogger) {}

  evaluate(
    resources: ResourceUsage,
    moduleErrors: Array<{ component: string; message: string }>,
    systemHealthy: boolean
  ): HealthAlert[] {
    const newAlerts: HealthAlert[] = [];

    if (resources.memoryPercent >= 90) {
      newAlerts.push(this.createAlert("high-memory", "critical", `High memory usage: ${resources.memoryPercent}%`, "system"));
    } else if (resources.memoryPercent >= 75) {
      newAlerts.push(this.createAlert("high-memory", "warning", `Elevated memory: ${resources.memoryPercent}%`, "system"));
    }

    if (resources.cpuUsagePercent >= 90) {
      newAlerts.push(this.createAlert("high-cpu", "critical", `High CPU usage: ${resources.cpuUsagePercent}%`, "system"));
    }

    for (const err of moduleErrors) {
      const type = this.inferAlertType(err.component, err.message);
      newAlerts.push(this.createAlert(type, "critical", err.message, err.component));
    }

    if (!systemHealthy) {
      newAlerts.push(this.createAlert("application-failure", "critical", "Application health check failed", "application"));
    }

    const filtered = newAlerts.filter((a) => !a.falseAlarmFiltered);
    for (const alert of filtered) {
      this.alerts.push(alert);
      this.logger.log(alert.severity === "critical" ? "error" : "warn", "alert", alert.message, {
        alertId: alert.alertId,
        component: alert.component,
      });
    }

    return filtered;
  }

  getAlerts(): ReadonlyArray<HealthAlert> {
    return this.alerts;
  }

  private createAlert(
    type: string,
    severity: HealthAlert["severity"],
    message: string,
    component: string
  ): HealthAlert {
    const key = `${type}:${component}:${severity}`;
    const isDuplicate = this.recentAlertKeys.has(key);
    if (!isDuplicate) {
      this.recentAlertKeys.add(key);
    }

    return {
      alertId: `alert-${++alertCounter}-${Date.now()}`,
      type,
      severity,
      message,
      component,
      timestamp: new Date().toISOString(),
      falseAlarmFiltered: isDuplicate,
    };
  }

  private inferAlertType(component: string, message: string): string {
    if (message.includes("storage")) return "storage-failure";
    if (message.includes("database")) return "database-failure";
    if (message.includes("communication")) return "communication-failure";
    if (message.includes("workflow")) return "workflow-failure";
    if (message.includes("configuration")) return "configuration-failure";
    if (component.includes("module")) return "module-failure";
    return "module-failure";
  }
}
