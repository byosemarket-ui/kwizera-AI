/**
 * KWIZERA AI STUDIO — AI Health Monitor types (Step 2K)
 */

export enum SystemHealthLevel {
  Excellent = "excellent",
  Good = "good",
  Warning = "warning",
  Critical = "critical",
  Failed = "failed",
}

export enum HealthCheckCategory {
  Application = "application",
  Module = "module",
  Database = "database",
  Storage = "storage",
  Configuration = "configuration",
  Runtime = "runtime",
  Communication = "communication",
  Memory = "memory",
  Cpu = "cpu",
  Disk = "disk",
  Queue = "queue",
  Task = "task",
  Workflow = "workflow",
  Project = "project",
  Session = "session",
}

export interface SystemHealthCheckResult {
  name: string;
  category: HealthCheckCategory;
  passed: boolean;
  message: string;
  responseTimeMs?: number;
}

export interface ModuleHealthScore {
  moduleId: string;
  moduleName: string;
  score: number;
  level: SystemHealthLevel;
  available: boolean;
  responseTimeMs: number;
  warnings: string[];
  errors: string[];
}

export interface ResourceUsage {
  memoryUsageMb: number;
  memoryPercent: number;
  cpuUsagePercent: number;
  diskUsageMb: number;
  diskFreeMb: number;
}

export interface ResponseTimeMetrics {
  moduleResponseMs: number;
  apiResponseMs: number;
  databaseResponseMs: number;
  storageResponseMs: number;
  communicationLatencyMs: number;
  aiResponseMs: number;
}

export interface HealthAlert {
  alertId: string;
  type: string;
  severity: "warning" | "critical";
  message: string;
  component: string;
  timestamp: string;
  falseAlarmFiltered: boolean;
}

export interface HealthRecommendation {
  component: string;
  message: string;
  priority: "low" | "medium" | "high";
}

export interface HealthHistoryRecord {
  healthId: string;
  timestamp: string;
  module: string;
  healthScore: number;
  level: SystemHealthLevel;
  warnings: string[];
  errors: string[];
  recoveryResult?: string;
  performanceMs: number;
  recommendations: string[];
}

export interface HealthDashboardData {
  applicationHealth: SystemHealthLevel;
  systemScore: number;
  moduleHealth: ModuleHealthScore[];
  resourceUsage: ResourceUsage;
  responseTimes: ResponseTimeMetrics;
  warnings: string[];
  errors: string[];
  recoveryActivity: string[];
  performanceTrends: Array<{ timestamp: string; score: number }>;
  alerts: HealthAlert[];
  lastUpdated: string;
}

export interface HealthMonitorStatusReport {
  healthMonitorStatus: string;
  applicationHealth: SystemHealthLevel;
  moduleHealth: string;
  performance: {
    scanTimeMs: number;
    totalScans: number;
    averageScanMs: number;
  };
  warnings: string[];
  knownIssues: string[];
  readinessScore: number;
  timestamp: string;
}

export class HealthMonitorError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "HealthMonitorError";
  }
}

export interface MonitoredComponentDefinition {
  moduleId: string;
  moduleName: string;
  implemented: boolean;
  pluginId?: string;
}
