export declare const TOOL_CATEGORIES: readonly ["ai", "image", "video", "audio", "marketing", "rendering", "database", "memory", "knowledge", "file", "system", "utility", "external"];
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolStatus = "registered" | "enabled" | "disabled" | "loaded" | "failed";
export type ToolExecutionType = "synchronous" | "asynchronous";
export interface ToolSchema {
    type: "object";
    required?: string[];
    properties?: Record<string, string>;
}
export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    version: string;
    author: string;
    status?: ToolStatus;
    inputSchema: ToolSchema;
    outputSchema: ToolSchema;
    requiredPermissions: string[];
    dependencies: string[];
    supportedModels: string[];
    executionType: ToolExecutionType;
    locality: "local" | "external";
}
export interface ToolExecutionRequest {
    toolId: string;
    input: Record<string, unknown>;
    permissions?: string[];
    correlationId?: string;
}
export interface ToolExecutionResult {
    executionId: string;
    toolId: string;
    status: "succeeded" | "failed" | "rejected";
    output?: Record<string, unknown>;
    error?: string;
    durationMs: number;
}
export interface ToolHealth {
    available: boolean;
    compatible: boolean;
    responseTimeMs: number;
    executionCount: number;
    failureCount: number;
    errorRate: number;
    lastCheckedAt: string;
}
export interface RegisteredTool extends ToolDefinition {
    status: ToolStatus;
    configuration: Record<string, unknown>;
    health: ToolHealth;
    registeredAt: string;
    updatedAt: string;
}
export type ToolHandler = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
//# sourceMappingURL=types.d.ts.map