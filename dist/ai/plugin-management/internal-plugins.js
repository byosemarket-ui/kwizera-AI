function statusPlugin(toolId, permission) { return () => ({ async initialize() { }, async execute(action, input, sandbox) { if (action !== "status")
        throw new Error("Unsupported plugin action"); return sandbox.executeTool(toolId, input, [permission]); }, async shutdown() { }, async healthCheck() { return { healthy: true, message: "Trusted internal adapter operational" }; } }); }
export function createInternalPlugins(_core) {
    return [
        { manifest: { id: "internal.system-tools", name: "System Tools Extension", description: "Trusted adapter for local system status tooling.", version: "0.1.0", author: "KWIZERA AI", category: "utility", requiredPermissions: ["system.read"], dependencies: ["ai-core"], compatiblePlatformVersion: ">=0.1.0", entryPoint: "trusted:internal.system-tools", configuration: {}, external: false }, factory: statusPlugin("system.runtime-status", "system.read") },
        { manifest: { id: "internal.workflow-tools", name: "Workflow Tools Extension", description: "Trusted adapter for workflow status tooling.", version: "0.1.0", author: "KWIZERA AI", category: "workflow", requiredPermissions: ["workflow.read"], dependencies: ["workflow-engine"], compatiblePlatformVersion: ">=0.1.0", entryPoint: "trusted:internal.workflow-tools", configuration: {}, external: false }, factory: statusPlugin("workflow.status", "workflow.read") },
    ];
}
//# sourceMappingURL=internal-plugins.js.map