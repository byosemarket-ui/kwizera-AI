export const PLUGIN_CATEGORIES = ["ai", "image", "video", "audio", "marketing", "rendering", "workflow", "database", "memory", "knowledge", "utility", "external-integration"] as const;
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];
export type PluginStatus = "installed" | "initialized" | "loaded" | "paused" | "disabled" | "failed" | "removed";

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: PluginCategory;
  requiredPermissions: string[];
  dependencies: string[];
  compatiblePlatformVersion: string;
  entryPoint: string;
  configuration: Record<string, unknown>;
  external: boolean;
}
export interface PluginHealth { available: boolean; compatible: boolean; executionCount: number; failureCount: number; errorRate: number; responseTimeMs: number; cpuUsageMs: number; ramUsageBytes: number; stability: "healthy" | "degraded" | "unhealthy"; lastCheckedAt: string; }
export interface RegisteredPlugin extends PluginManifest { status: PluginStatus; health: PluginHealth; installedAt: string; updatedAt: string; lastError?: string; }
export interface PluginExecutionRequest { pluginId: string; action: string; input: Record<string, unknown>; permissions?: string[]; }
export interface PluginExecutionResult { pluginId: string; status: "succeeded" | "rejected" | "failed"; output?: Record<string, unknown>; error?: string; durationMs: number; }
export interface PluginSandbox { executeTool(toolId: string, input: Record<string, unknown>, permissions?: string[]): Promise<Record<string, unknown>>; getConfiguration(): Record<string, unknown>; }
export interface PluginRuntime { initialize(sandbox: PluginSandbox): Promise<void>; execute(action: string, input: Record<string, unknown>, sandbox: PluginSandbox): Promise<Record<string, unknown>>; shutdown(): Promise<void>; healthCheck?(): Promise<{ healthy: boolean; message: string }>; }
export type PluginFactory = () => PluginRuntime;