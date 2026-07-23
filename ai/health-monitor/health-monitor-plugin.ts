import type { AiModulePlugin } from "../core/types.js";
import type { AiCoreManager } from "../core/ai-core-manager.js";
import { AiSystemHealthMonitor } from "./health-monitor.js";

export function createHealthMonitorPlugin(
  monitor: AiSystemHealthMonitor,
  core: AiCoreManager
): AiModulePlugin {
  return {
    id: "health-monitor",
    name: "KWIZERA AI Health Monitor",
    version: "0.1.0",

    async initialize(): Promise<void> {
      void core;
      if (!monitor.isInitialized()) {
        throw new Error("Health Monitor must be initialized before plugin registration");
      }
    },

    async shutdown(): Promise<void> {
      // lightweight — monitoring stops with application
    },

    async healthCheck() {
      const report = monitor.buildStatusReport();
      return {
        healthy: monitor.isInitialized() && report.readinessScore >= 80,
        message: monitor.isInitialized()
          ? `Health Monitor operational — ${report.applicationHealth}`
          : "Health Monitor not initialized",
      };
    },
  };
}
