/**
 * KWIZERA AI STUDIO — AI Module Manager types (Step 2G)
 */
import type { AiModulePlugin } from "../core/types.js";
export declare enum ManagedModuleState {
    Registered = "registered",
    Initializing = "initializing",
    Loading = "loading",
    Ready = "ready",
    Running = "running",
    Paused = "paused",
    Recovering = "recovering",
    Restarting = "restarting",
    Stopping = "stopping",
    Stopped = "stopped",
    Disabled = "disabled",
    Failed = "failed",
    Removed = "removed"
}
export declare enum ModuleHealthStatus {
    Healthy = "healthy",
    Degraded = "degraded",
    Unhealthy = "unhealthy",
    Isolated = "isolated",
    Unknown = "unknown"
}
export interface ModuleCapabilities {
    features: string[];
    interfaces: string[];
}
export interface ModuleRegistryRecord {
    moduleId: string;
    moduleName: string;
    version: string;
    status: ManagedModuleState;
    dependencies: string[];
    capabilities: ModuleCapabilities;
    owner: string;
    registrationDate: string;
    healthStatus: ModuleHealthStatus;
    lastActivity: string;
    compatibility: string;
    enabled: boolean;
    slotId?: string;
    lastError?: string;
}
export interface ModuleDependencyResult {
    compatible: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        message: string;
    }>;
    rejectionReason?: string;
}
export interface ModuleCommunicationRecord {
    id: string;
    sender: string;
    receiver: string;
    request: string;
    response?: string;
    executionTimeMs: number;
    errors: string[];
    warnings: string[];
    recoveryAttempts: number;
    timestamp: string;
    success: boolean;
}
export interface ModuleHistoryEvent {
    moduleId: string;
    eventType: string;
    detail: string;
    timestamp: string;
}
export interface ModulePerformanceStats {
    moduleId: string;
    startupMs: number;
    responseTimeMs: number;
    restartCount: number;
    failureCount: number;
}
export interface ModuleManagerStatusReport {
    moduleManagerStatus: string;
    registeredModules: number;
    healthStatus: string;
    dependencyStatus: string;
    recoveryStatus: string;
    performance: {
        averageStartupMs: number;
        averageCommunicationMs: number;
        totalModules: number;
    };
    knownIssues: string[];
    readinessScore: number;
    timestamp: string;
}
export declare class ModuleManagerError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export interface RegisterModuleOptions {
    plugin: AiModulePlugin;
    dependencies?: string[];
    capabilities?: ModuleCapabilities;
    owner?: string;
    slotId?: string;
}
export interface CommunicationRequest {
    senderId: string;
    receiverId: string;
    action: string;
    payload?: Record<string, unknown>;
}
export interface CommunicationResponse {
    success: boolean;
    result?: unknown;
    message: string;
    record: ModuleCommunicationRecord;
}
//# sourceMappingURL=types.d.ts.map