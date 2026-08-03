import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PLUGIN_CATEGORIES } from "./types.js";
export const PLATFORM_VERSION = "0.1.0";
const health = () => ({ available: false, compatible: false, executionCount: 0, failureCount: 0, errorRate: 0, responseTimeMs: 0, cpuUsageMs: 0, ramUsageBytes: 0, stability: "healthy", lastCheckedAt: new Date().toISOString() });
/** Manifest-driven local extension manager. Only trusted, compiled factories are executable. */
export class AiPluginManager {
    root = "";
    core = null;
    tools = null;
    initialized = false;
    plugins = new Map();
    factories = new Map();
    runtimes = new Map();
    logs = [];
    async initialize(core, tools, storageRoot) { this.core = core; this.tools = tools; this.root = path.join(storageRoot, "plugin-management"); await fs.mkdir(this.root, { recursive: true }); await this.restore(); this.initialized = true; }
    isInitialized() { return this.initialized; }
    list() { return [...this.plugins.values()].filter((plugin) => plugin.status !== "removed").map((plugin) => structuredClone(plugin)); }
    get(pluginId) { const plugin = this.plugins.get(pluginId); return plugin && plugin.status !== "removed" ? structuredClone(plugin) : null; }
    getLogs() { return this.logs; }
    async install(manifest, factory) {
        this.ensureReady();
        this.validateManifest(manifest);
        if (manifest.external)
            throw new Error("External plugin code is disabled until a signed sandbox host is available");
        if (this.plugins.has(manifest.id) && this.plugins.get(manifest.id).status !== "removed")
            throw new Error(`Plugin already installed: ${manifest.id}`);
        if (this.factories.has(manifest.id))
            throw new Error(`Plugin conflict: ${manifest.id}`);
        const now = new Date().toISOString();
        const plugin = { ...manifest, status: "installed", health: health(), installedAt: now, updatedAt: now };
        this.plugins.set(plugin.id, plugin);
        this.factories.set(plugin.id, factory);
        await this.log("installation", plugin.id, `Installed ${plugin.name} v${plugin.version}`);
        await this.persist();
        return structuredClone(plugin);
    }
    async discover(plugins) { let count = 0; for (const plugin of plugins) {
        const existing = this.plugins.get(plugin.manifest.id);
        if (!existing) {
            await this.install(plugin.manifest, plugin.factory);
            count++;
        }
        else if (existing.status !== "removed") {
            this.factories.set(plugin.manifest.id, plugin.factory);
            if (existing.status === "initialized" || existing.status === "loaded" || existing.status === "paused") {
                existing.status = "installed";
                existing.updatedAt = new Date().toISOString();
            }
        }
    } await this.persist(); return count; }
    async initializePlugin(pluginId) { const plugin = this.require(pluginId); this.validatePlugin(plugin); const runtime = this.factories.get(pluginId)?.(); if (!runtime)
        throw new Error("Trusted plugin factory is unavailable"); await runtime.initialize(this.sandbox(plugin)); this.runtimes.set(pluginId, runtime); plugin.status = "initialized"; plugin.updatedAt = new Date().toISOString(); await this.log("initialization", pluginId, "Plugin initialized"); await this.persist(); }
    async load(pluginId) { const plugin = this.require(pluginId); if (plugin.status === "disabled")
        throw new Error("Plugin is disabled"); if (!this.runtimes.has(pluginId))
        await this.initializePlugin(pluginId); plugin.status = "loaded"; plugin.updatedAt = new Date().toISOString(); await this.log("loading", pluginId, "Plugin loaded"); await this.persist(); }
    async unload(pluginId) { const plugin = this.require(pluginId); const runtime = this.runtimes.get(pluginId); if (runtime)
        await runtime.shutdown(); this.runtimes.delete(pluginId); if (plugin.status !== "disabled")
        plugin.status = "installed"; plugin.updatedAt = new Date().toISOString(); await this.log("unloading", pluginId, "Plugin unloaded"); await this.persist(); }
    async enable(pluginId) { const plugin = this.require(pluginId); plugin.status = "installed"; plugin.updatedAt = new Date().toISOString(); await this.persist(); }
    async disable(pluginId) { const plugin = this.require(pluginId); await this.unload(pluginId); plugin.status = "disabled"; plugin.updatedAt = new Date().toISOString(); await this.persist(); }
    async shutdown() { for (const pluginId of [...this.runtimes.keys()])
        await this.unload(pluginId); this.initialized = false; }
    async pause(pluginId) { const plugin = this.require(pluginId); if (plugin.status !== "loaded")
        throw new Error("Only loaded plugins can be paused"); plugin.status = "paused"; await this.persist(); }
    async resume(pluginId) { const plugin = this.require(pluginId); if (plugin.status !== "paused")
        throw new Error("Only paused plugins can be resumed"); plugin.status = "loaded"; await this.persist(); }
    async remove(pluginId) { const plugin = this.require(pluginId); await this.unload(pluginId); plugin.status = "removed"; this.factories.delete(pluginId); plugin.updatedAt = new Date().toISOString(); await this.persist(); }
    async update(pluginId, version) { const plugin = this.require(pluginId); if (!/^\d+\.\d+\.\d+$/.test(version))
        throw new Error("Plugin version must be semantic"); plugin.version = version; plugin.updatedAt = new Date().toISOString(); await this.log("update", pluginId, `Plugin updated to ${version}`); await this.persist(); return structuredClone(plugin); }
    async configure(pluginId, configuration) { const plugin = this.require(pluginId); plugin.configuration = structuredClone(configuration); plugin.updatedAt = new Date().toISOString(); await this.persist(); return structuredClone(plugin); }
    validate(pluginId) { const plugin = this.require(pluginId); try {
        this.validatePlugin(plugin);
        return { valid: true, errors: [] };
    }
    catch (error) {
        return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
    } }
    async execute(request) { const started = performance.now(); const memoryBefore = process.memoryUsage().heapUsed; const plugin = this.plugins.get(request.pluginId); try {
        if (!plugin)
            throw new Error("Plugin not found");
        if (plugin.status !== "loaded")
            throw new Error("Plugin is not loaded");
        this.validatePermissions(plugin, request.permissions);
        const runtime = this.runtimes.get(plugin.id);
        if (!runtime)
            throw new Error("Plugin runtime is unavailable");
        const output = await runtime.execute(request.action, structuredClone(request.input), this.sandbox(plugin));
        this.record(plugin, started, memoryBefore, true);
        await this.log("execution", plugin.id, `Action ${request.action} completed in ${Math.round(performance.now() - started)}ms`);
        await this.persist();
        return { pluginId: plugin.id, status: "succeeded", output, durationMs: Math.round(performance.now() - started) };
    }
    catch (error) {
        if (plugin) {
            plugin.lastError = error instanceof Error ? error.message : String(error);
            this.record(plugin, started, memoryBefore, false);
            await this.log("security-or-error", plugin.id, plugin.lastError);
            await this.persist();
        }
        return { pluginId: request.pluginId, status: "rejected", error: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - started) };
    } }
    async monitor(pluginId) { const targets = pluginId ? [this.require(pluginId)] : this.list().map((plugin) => this.require(plugin.id)); for (const plugin of targets) {
        const runtime = this.runtimes.get(plugin.id);
        plugin.health.available = Boolean(runtime);
        plugin.health.compatible = this.isCompatible(plugin) && plugin.dependencies.every((dependency) => dependency === "ai-core" || Boolean(this.core?.registry.getEntry(dependency)));
        if (runtime?.healthCheck) {
            const result = await runtime.healthCheck();
            plugin.health.stability = result.healthy ? "healthy" : "degraded";
        }
        plugin.health.lastCheckedAt = new Date().toISOString();
    } await this.persist(); return Object.fromEntries(targets.map((plugin) => [plugin.id, structuredClone(plugin.health)])); }
    getIntegrationStatus() { return { aiCore: Boolean(this.core), toolRegistry: Boolean(this.tools), toolManager: Boolean(this.tools), workflowEngine: Boolean(this.core?.workflowEngine), communicationBus: Boolean(this.core?.communicationBus), taskScheduler: Boolean(this.core?.taskManager), automationEngine: Boolean(this.core?.workflowEngine), multiAgentSystem: false }; }
    sandbox(plugin) { return { getConfiguration: () => structuredClone(plugin.configuration), executeTool: async (toolId, input, grantedPermissions = []) => { this.validatePermissions(plugin, grantedPermissions); const result = await this.tools.execute({ toolId, input, permissions: grantedPermissions }); if (result.status !== "succeeded" || !result.output)
            throw new Error(result.error ?? "Tool execution failed"); return result.output; } }; }
    record(plugin, started, memoryBefore, success) { plugin.health.executionCount++; if (!success)
        plugin.health.failureCount++; plugin.health.responseTimeMs = Math.round(performance.now() - started); plugin.health.cpuUsageMs += plugin.health.responseTimeMs; plugin.health.ramUsageBytes = Math.max(0, process.memoryUsage().heapUsed - memoryBefore); plugin.health.errorRate = Math.round(plugin.health.failureCount / plugin.health.executionCount * 100); plugin.health.stability = plugin.health.errorRate >= 50 ? "unhealthy" : plugin.health.errorRate > 0 ? "degraded" : "healthy"; plugin.health.lastCheckedAt = new Date().toISOString(); }
    validatePlugin(plugin) { this.validateManifest(plugin); if (!this.isCompatible(plugin))
        throw new Error(`Plugin requires platform ${plugin.compatiblePlatformVersion}`); if (!this.factories.has(plugin.id))
        throw new Error("Trusted plugin factory is unavailable"); }
    validateManifest(manifest) { if (!/^[a-z0-9][a-z0-9.-]{2,100}$/i.test(manifest.id))
        throw new Error("Plugin id is invalid"); if (!manifest.name.trim() || !manifest.description.trim() || !manifest.author.trim())
        throw new Error("Plugin name, description, and author are required"); if (!PLUGIN_CATEGORIES.includes(manifest.category))
        throw new Error("Plugin category is invalid"); if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
        throw new Error("Plugin version must be semantic"); if (!/^>=\d+\.\d+\.\d+$/.test(manifest.compatiblePlatformVersion))
        throw new Error("Plugin platform compatibility is invalid"); if (!manifest.entryPoint.startsWith("trusted:"))
        throw new Error("Plugin entry point must be a trusted factory"); }
    isCompatible(plugin) { const minimum = plugin.compatiblePlatformVersion.slice(2).split(".").map(Number); const current = PLATFORM_VERSION.split(".").map(Number); return current[0] > minimum[0] || (current[0] === minimum[0] && (current[1] > minimum[1] || (current[1] === minimum[1] && current[2] >= minimum[2]))); }
    validatePermissions(plugin, grantedPermissions) { const granted = new Set(grantedPermissions ?? []); if (plugin.requiredPermissions.some((permission) => !granted.has(permission)))
        throw new Error("Required plugin permission was not granted"); }
    require(pluginId) { this.ensureReady(); const plugin = this.plugins.get(pluginId); if (!plugin || plugin.status === "removed")
        throw new Error(`Plugin not found: ${pluginId}`); return plugin; }
    ensureReady() { if (!this.initialized || !this.tools)
        throw new Error("Plugin Manager is not initialized"); }
    async log(event, pluginId, detail) { const entry = { at: new Date().toISOString(), event, pluginId, detail }; this.logs.unshift(entry); this.logs.splice(100); await fs.appendFile(path.join(this.root, "plugin-events.jsonl"), `${JSON.stringify(entry)}\n`, "utf8"); }
    async restore() { try {
        const values = JSON.parse(await fs.readFile(path.join(this.root, "plugins.json"), "utf8"));
        for (const plugin of values)
            this.plugins.set(plugin.id, plugin);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    } }
    async persist() { const target = path.join(this.root, "plugins.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temporary, `${JSON.stringify(this.list(), null, 2)}\n`, "utf8"); await fs.rename(temporary, target); }
}
//# sourceMappingURL=plugin-manager.js.map