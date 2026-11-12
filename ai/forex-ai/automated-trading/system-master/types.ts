/**
 * Phase 4.18F.8R — Owner-controlled System Master for Automated Trading.
 * Authorizes analysis-system operation only. Never authorizes broker execution.
 */
export const AT_SYSTEM_MASTER_SCHEMA = "at-system-master-v1" as const;
export const AT_SYSTEM_MASTER_PHASE = "4.18F.8R" as const;

export type SystemMasterOwnerState = "OFF" | "ON";

export type SystemMasterOperationalState =
  | "OFF"
  | "STARTING"
  | "ON"
  | "STOPPING"
  | "BLOCKED"
  | "ERROR";

export type SystemMasterModuleId =
  | "analysis_worker"
  | "five_minute_scheduler"
  | "market_data_collection"
  | "tick_capture"
  | "candle_history"
  | "technical_intelligence"
  | "mtf_analysis"
  | "chart_render"
  | "openai_analysis"
  | "canonical_reconciliation"
  | "analysis_history"
  | "result_intake"
  | "dashboard_status";

/** Shared infrastructure NOT exclusively owned by System Master. */
export const AT_SYSTEM_MASTER_SHARED_SERVICES = [
  "gateway_http",
  "forexconnect_sidecar",
  "storage_root",
] as const;

/** Modules exclusively controlled by System Master when ON/OFF. */
export const AT_SYSTEM_MASTER_OWNED_MODULES: SystemMasterModuleId[] = [
  "analysis_worker",
  "five_minute_scheduler",
  "market_data_collection",
  "tick_capture",
  "candle_history",
  "technical_intelligence",
  "mtf_analysis",
  "chart_render",
  "openai_analysis",
  "canonical_reconciliation",
  "analysis_history",
  "result_intake",
  "dashboard_status",
];

export interface SystemMasterPersisted {
  schemaVersion: typeof AT_SYSTEM_MASTER_SCHEMA;
  phase: typeof AT_SYSTEM_MASTER_PHASE;
  stateVersion: number;
  /** Owner intent — survives restart. Never silently defaulted to ON. */
  masterEnabled: boolean;
  ownerState: SystemMasterOwnerState;
  operationalState: SystemMasterOperationalState;
  changedAtUtc: string;
  changedBy: string;
  lastStartAtUtc: string | null;
  lastStopAtUtc: string | null;
  activeModules: SystemMasterModuleId[];
  blockedModules: SystemMasterModuleId[];
  lastError: string | null;
  lastBlockerCode: string | null;
  /**
   * Phase 2 — bumped on every OFF transition so in-flight analysis cannot
   * publish downstream effects after System Master stops.
   */
  analysisGeneration: number;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
}

export interface SystemMasterPublicStatus {
  phase: typeof AT_SYSTEM_MASTER_PHASE;
  stateVersion: number;
  masterEnabled: boolean;
  ownerState: SystemMasterOwnerState;
  operationalState: SystemMasterOperationalState;
  changedAtUtc: string;
  changedBy: string;
  lastStartAtUtc: string | null;
  lastStopAtUtc: string | null;
  activeModules: SystemMasterModuleId[];
  blockedModules: SystemMasterModuleId[];
  activeModuleCount: number;
  lastError: string | null;
  lastBlockerCode: string | null;
  analysisGeneration: number;
  sharedServices: readonly string[];
  ownedModules: readonly SystemMasterModuleId[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  executionStatusLabel: "EXECUTION_FORBIDDEN";
  note: string;
}

export function defaultSystemMasterPersisted(): SystemMasterPersisted {
  return {
    schemaVersion: AT_SYSTEM_MASTER_SCHEMA,
    phase: AT_SYSTEM_MASTER_PHASE,
    stateVersion: 1,
    masterEnabled: false,
    ownerState: "OFF",
    operationalState: "OFF",
    changedAtUtc: new Date().toISOString(),
    changedBy: "system",
    lastStartAtUtc: null,
    lastStopAtUtc: null,
    activeModules: [],
    blockedModules: [],
    lastError: null,
    lastBlockerCode: null,
    analysisGeneration: 0,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
  };
}

export function toSystemMasterPublicStatus(p: SystemMasterPersisted): SystemMasterPublicStatus {
  return {
    phase: AT_SYSTEM_MASTER_PHASE,
    stateVersion: p.stateVersion,
    masterEnabled: p.masterEnabled === true && p.ownerState === "ON",
    ownerState: p.ownerState,
    operationalState: p.operationalState,
    changedAtUtc: p.changedAtUtc,
    changedBy: p.changedBy,
    lastStartAtUtc: p.lastStartAtUtc,
    lastStopAtUtc: p.lastStopAtUtc,
    activeModules: [...p.activeModules],
    blockedModules: [...p.blockedModules],
    activeModuleCount: p.activeModules.length,
    lastError: p.lastError,
    lastBlockerCode: p.lastBlockerCode,
    analysisGeneration: Number.isFinite(p.analysisGeneration) ? Math.max(0, Math.floor(p.analysisGeneration)) : 0,
    sharedServices: AT_SYSTEM_MASTER_SHARED_SERVICES,
    ownedModules: AT_SYSTEM_MASTER_OWNED_MODULES,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    executionStatusLabel: "EXECUTION_FORBIDDEN",
    note:
      "System Master ON authorizes Automated Trading analysis modules only. Broker execution remains DISABLED. Shared ForexConnect sidecar/gateway are not stopped on OFF.",
  };
}
