export function createModelManagementPlugin(manager, core) {
    return { id: "ai-model-management", name: "KWIZERA AI Model Management", version: "0.1.0", async initialize() { if (!manager.isInitialized())
            throw new Error("AI Model Manager must be initialized before plugin registration"); }, async shutdown() { for (const model of manager.list().filter((item) => item.status === "loaded"))
            await manager.unload(model.id); }, async healthCheck() { const models = await manager.health.scan(); return { healthy: models.every((model) => model.health !== "unhealthy"), message: `${models.length} managed models checked` }; } };
}
//# sourceMappingURL=model-management-plugin.js.map