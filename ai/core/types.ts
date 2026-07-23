/**
 * KWIZERA AI STUDIO — AI Core shared types (Step 2A)
 */

export const AI_ASSISTANT_NAME = "KWIZERA AI" as const;
export const APPLICATION_NAME = "KWIZERA AI STUDIO" as const;

/** AI Core lifecycle states per Step 2A */
export enum AiLifecycleState {
  Initializing = "initializing",
  Loading = "loading",
  Ready = "ready",
  Running = "running",
  Paused = "paused",
  Recovering = "recovering",
  Stopping = "stopping",
  Stopped = "stopped",
  Failed = "failed",
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "startup"
  | "shutdown"
  | "error"
  | "warning"
  | "initialization"
  | "recovery"
  | "configuration"
  | "module-registration"
  | "lifecycle"
  | "health"
  | "session";

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

export interface ApplicationConfig {
  applicationName: string;
  applicationShortName: string;
  applicationVersion: string;
  assistantName: string;
  officialLogoFile: string;
}

export interface EnvironmentConfig {
  configVersion: string;
  nodeEnv: string;
  port: number;
  host: string;
}

export interface StorageConfig {
  storageRoot: string;
  directories: Record<string, string>;
}

export interface LanguageConfig {
  defaultLocale: string;
  fallbackLocale: string;
  supportedLocales: string[];
}

export interface BrandAppConfig {
  officialLogoFile: string;
  productDisplayName: string;
  assistantDisplayName: string;
}

export interface AiSettingsConfig {
  startupTimeoutMs: number;
  shutdownTimeoutMs: number;
  maxConcurrentSessions: number;
  healthCheckIntervalMs: number;
  enableRecovery: boolean;
  logLevel: LogLevel;
}

export interface FutureModuleDefinition {
  id: string;
  name: string;
  enabled: boolean;
}

export interface FutureModulesConfig {
  futureModules: FutureModuleDefinition[];
}

/** Centralized AI Core configuration bundle */
export interface AiCoreConfiguration {
  application: ApplicationConfig;
  environment: EnvironmentConfig;
  storage: StorageConfig;
  language: LanguageConfig;
  brand: BrandAppConfig;
  ai: AiSettingsConfig;
  futureModules: FutureModulesConfig;
  loadedAt: string;
  configRoot: string;
}

export type ModuleRegistrationStatus =
  | "slot-reserved"
  | "registered"
  | "initialized"
  | "running"
  | "failed"
  | "disabled";

/** Future AI module plugin contract — implementation deferred to later phases */
export interface AiModulePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<ModuleHealthResult>;
}

export interface ModuleRegistryEntry {
  id: string;
  name: string;
  status: ModuleRegistrationStatus;
  enabled: boolean;
  registeredAt?: string;
  initializedAt?: string;
  plugin?: AiModulePlugin;
  lastError?: string;
}

export interface ModuleHealthResult {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface AiSession {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  status: "active" | "paused" | "closed";
  metadata: Record<string, unknown>;
}

export interface AiRuntimeContext {
  correlationId: string;
  startedAt: string;
  lifecycleState: AiLifecycleState;
  activeSessionId?: string;
  metadata: Record<string, unknown>;
}

export interface AiInitializationDiagnostic {
  stage: string;
  success: boolean;
  message: string;
  timestamp: string;
  error?: string;
}

export interface AiCoreHealthReport {
  healthy: boolean;
  lifecycleState: AiLifecycleState;
  checks: HealthCheckResult[];
  timestamp: string;
}

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface AiCoreStatusReport {
  aiCoreStatus: string;
  initializationStatus: string;
  lifecycleStatus: AiLifecycleState;
  registryStatus: string;
  configurationStatus: string;
  loggingStatus: string;
  healthStatus: string;
  readinessScore: number;
  diagnostics: AiInitializationDiagnostic[];
  registeredModules: ModuleRegistryEntry[];
  timestamp: string;
}

export class AiCoreError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly diagnostic?: AiInitializationDiagnostic
  ) {
    super(message);
    this.name = "AiCoreError";
  }
}
