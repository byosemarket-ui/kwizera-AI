import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const execFileAsync = promisify(execFile);
const DEFAULT_SETTINGS = { autoUnloadMinutes: 30, cacheLimit: 3, preferGpu: true, validateOnLoad: true, allowExternalArtifacts: false };
const CATALOG = [
    { id: "studio-image-base", name: "Studio Image Base", category: "image", version: "1.0.0", description: "Prepared image-generation model profile", requirements: { ramMb: 4096, vramMb: 4096, storageMb: 2048 }, capabilities: ["image-generation", "prompt-conditioning"] },
    { id: "studio-image-commercial", name: "Studio Image Commercial", category: "image", version: "1.0.0", description: "Prepared commercial product-image model profile", requirements: { ramMb: 3072, vramMb: 3072, storageMb: 1536 }, capabilities: ["image-generation", "product-placement", "brand-composition"] },
    { id: "studio-video-base", name: "Studio Video Base", category: "video", version: "1.0.0", description: "Prepared video-generation model profile", requirements: { ramMb: 8192, vramMb: 8192, storageMb: 6144 }, capabilities: ["video-generation", "motion-planning"] },
    { id: "studio-audio-base", name: "Studio Audio Base", category: "audio", version: "1.0.0", description: "Prepared audio-generation model profile", requirements: { ramMb: 2048, storageMb: 1024 }, capabilities: ["audio-generation"] },
    { id: "studio-language-base", name: "Studio Language Base", category: "language", version: "1.0.0", description: "Prepared language model profile", requirements: { ramMb: 4096, storageMb: 2048 }, capabilities: ["planning", "language"] },
    { id: "studio-vision-base", name: "Studio Vision Base", category: "vision", version: "1.0.0", description: "Prepared vision model profile", requirements: { ramMb: 2048, storageMb: 1024 }, capabilities: ["vision", "analysis"] },
    { id: "studio-embedding-base", name: "Studio Embedding Base", category: "embedding", version: "1.0.0", description: "Prepared embedding model profile", requirements: { ramMb: 1024, storageMb: 512 }, capabilities: ["embedding", "retrieval"] },
];
/** Central lifecycle controller for local model metadata and local artifacts. It never performs generation. */
export class AiModelManager {
    root = "";
    core = null;
    store = { models: [], settings: DEFAULT_SETTINGS, logs: [] };
    cache = new Map();
    registry = new ModelRegistry(this);
    local = new LocalModelManager(this);
    installer = new ModelInstaller(this);
    downloader = new ModelDownloader(this);
    loader = new ModelLoader(this);
    configuration = new ModelConfigurationManager(this);
    versions = new ModelVersionManager(this);
    updates = new ModelUpdateManager(this);
    validation = new ModelValidationManager(this);
    health = new ModelHealthMonitor(this);
    gpu = new GpuDetectionManager();
    cpu = new CpuDetectionManager();
    ram = new RamDetectionManager();
    storage = new StorageDetectionManager();
    resources = new AiResourceManager(this);
    performance = new ModelPerformanceMonitor(this);
    cacheManager = new ModelCacheManager(this);
    security = new ModelSecurityManager(this);
    settings = new AiSettingsManager(this);
    async initialize(storageRoot, core) {
        this.root = path.join(storageRoot, "ai-model-management");
        this.core = core ?? null;
        await fs.mkdir(path.join(this.root, "artifacts"), { recursive: true });
        this.store = await this.readStore();
        await this.recover();
        this.log("info", "initialization", "AI Model Management initialized");
        await this.persist();
    }
    isInitialized() { return Boolean(this.root); }
    async dashboard() {
        const hardware = await this.detectHardware();
        return { installed: this.list().filter((model) => model.status !== "available" && model.status !== "removed"), available: CATALOG.filter((catalog) => !this.store.models.some((model) => model.id === catalog.id && model.status !== "removed")).map((catalog) => ({ ...catalog, status: "available", health: "healthy", usageCount: 0 })), hardware, settings: { ...this.store.settings }, logs: [...this.store.logs], performance: this.performance.snapshot(), integrations: this.integrationStatus() };
    }
    list() { return this.store.models.map((model) => structuredClone(model)); }
    async register(input) { this.assertReady(); this.security.assertSafeModel(input); if (this.store.models.some((model) => model.id === input.id && model.status !== "removed"))
        throw new Error("Model is already registered"); const model = { ...input, status: "installed", health: "healthy", usageCount: 0, installedAt: new Date().toISOString() }; this.store.models.push(model); this.log("info", "registration", `Registered ${model.name}`, model.id); await this.persist(); return structuredClone(model); }
    async install(modelId, sourcePath) { const catalog = CATALOG.find((model) => model.id === modelId); if (!catalog)
        throw new Error("Model is not in the available registry"); const existing = this.store.models.find((model) => model.id === modelId && model.status !== "removed"); if (existing)
        return structuredClone(existing); let artifactPath; let checksum; if (sourcePath) {
        this.security.assertSafeArtifactPath(sourcePath);
        const target = path.join(this.root, "artifacts", `${modelId}-${path.basename(sourcePath)}`);
        await fs.copyFile(sourcePath, target);
        artifactPath = target;
        checksum = await hashFile(target);
    } const model = await this.register({ ...catalog, artifactPath, checksum }); this.log("info", "installation", `Installed ${model.name}${artifactPath ? " with verified local artifact" : " as a managed model profile"}`, model.id); await this.persist(); return model; }
    async load(modelId) { const model = this.getMutable(modelId); await this.validation.validate(model); const hardware = await this.detectHardware(); this.resources.assertAvailable(model, hardware); model.status = "loaded"; model.loadedAt = new Date().toISOString(); model.usageCount += 1; model.lastUsedAt = model.loadedAt; this.cacheManager.touch(model); this.log("info", "loading", `Loaded ${model.name}`, model.id); await this.persist(); return structuredClone(model); }
    async unload(modelId) { const model = this.getMutable(modelId); if (model.status === "loaded")
        model.status = "installed"; this.cache.delete(modelId); this.log("info", "unloading", `Unloaded ${model.name}`, model.id); await this.persist(); return structuredClone(model); }
    async remove(modelId) { const model = this.getMutable(modelId); await this.unload(modelId); if (model.artifactPath)
        await fs.rm(model.artifactPath, { force: true }); model.status = "removed"; this.log("warning", "removal", `Removed ${model.name}`, model.id); await this.persist(); }
    async update(modelId, version) { const model = this.getMutable(modelId); if (!/^\d+\.\d+\.\d+([-.][a-zA-Z0-9.]+)?$/.test(version))
        throw new Error("Version must use semantic version format"); model.status = "updating"; model.version = version; model.status = "installed"; this.log("info", "update", `Updated ${model.name} to ${version}`, model.id); await this.persist(); return structuredClone(model); }
    async selectBest(category) { const hardware = await this.detectHardware(); return this.list().filter((model) => model.category === category && (model.status === "installed" || model.status === "loaded") && model.health !== "unhealthy").filter((model) => this.resources.canUse(model, hardware)).sort((a, b) => b.usageCount - a.usageCount || a.requirements.ramMb - b.requirements.ramMb)[0] ?? null; }
    async detectHardware() { const [gpu, cpu, ram, storage] = await Promise.all([this.gpu.detect(), this.cpu.detect(), this.ram.detect(), this.storage.detect(this.root)]); return { detectedAt: new Date().toISOString(), gpu, cpu, ram, storage }; }
    async recover() { for (const model of this.store.models)
        if (model.status === "loaded") {
            model.status = "installed";
            this.log("warning", "recovery", `Recovered ${model.name} to installed state after restart`, model.id);
        } }
    getMutable(id) { const model = this.store.models.find((item) => item.id === id && item.status !== "removed"); if (!model)
        throw new Error("Registered model not found"); return model; }
    log(level, event, detail, modelId) { this.store.logs.unshift({ at: new Date().toISOString(), level, event, detail, modelId }); this.store.logs.splice(100, Number.MAX_SAFE_INTEGER); this.core?.logger.info("model-management", detail, { event, modelId }); }
    async persist() { await fs.writeFile(path.join(this.root, "models.json"), `${JSON.stringify(this.store, null, 2)}\n`, "utf8"); }
    async readStore() { try {
        const saved = JSON.parse(await fs.readFile(path.join(this.root, "models.json"), "utf8"));
        return { models: saved.models ?? [], settings: { ...DEFAULT_SETTINGS, ...saved.settings }, logs: saved.logs ?? [] };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { models: [], settings: DEFAULT_SETTINGS, logs: [] };
        throw error;
    } }
    integrationStatus() { return { aiCore: Boolean(this.core), moduleManager: Boolean(this.core?.moduleManager), stateManager: Boolean(this.core?.stateManager), memoryFoundation: Boolean(this.core?.memoryFoundation), knowledgeFoundation: Boolean(this.core?.knowledgeFoundation), creativePipeline: Boolean(this.core?.workflowEngine), configurationManager: Boolean(this.core?.configuration) }; }
    assertReady() { if (!this.root)
        throw new Error("AI Model Manager is not initialized"); }
}
export class ModelRegistry {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    list() { return this.manager.list(); }
    async register(model) { return this.manager.register(model); }
}
export class LocalModelManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async unload(modelId) { return this.manager.unload(modelId); }
    async remove(modelId) { return this.manager.remove(modelId); }
}
export class ModelInstaller {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async install(modelId, sourcePath) { return this.manager.install(modelId, sourcePath); }
}
export class ModelDownloader {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async stageLocalArtifact(modelId, sourcePath) { return this.manager.install(modelId, sourcePath); }
}
export class ModelLoader {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async load(modelId) { return this.manager.load(modelId); }
    async unload(modelId) { return this.manager.unload(modelId); }
}
export class ModelConfigurationManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async configure(settings) { return this.manager.settings.update(settings); }
}
export class ModelVersionManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    getVersion(modelId) { return this.manager.getMutable(modelId).version; }
}
export class ModelUpdateManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async update(modelId, version) { return this.manager.update(modelId, version); }
}
export class ModelValidationManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async validate(model) { if (model.artifactPath) {
        const digest = await hashFile(model.artifactPath);
        if (model.checksum && digest !== model.checksum) {
            model.health = "unhealthy";
            this.manager.log("error", "validation", `Integrity validation failed for ${model.name}`, model.id);
            throw new Error("Model artifact integrity validation failed");
        }
    } model.lastValidatedAt = new Date().toISOString(); model.health = "healthy"; }
}
export class ModelHealthMonitor {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    async scan() { for (const model of this.manager.list()) {
        try {
            await this.manager.validation.validate(this.manager.getMutable(model.id));
        }
        catch { /* validation records unhealthy state */ }
    } await this.manager.persist(); return this.manager.list(); }
}
export class GpuDetectionManager {
    async detect() { try {
        const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"], { timeout: 1_500, windowsHide: true });
        const [name, memory, driver] = stdout.trim().split(",").map((value) => value.trim());
        return { available: Boolean(name), name: name || "Unknown GPU", memoryMb: Number(memory) || undefined, driver };
    }
    catch {
        return { available: false, name: "No supported GPU detected" };
    } }
}
export class CpuDetectionManager {
    async detect() { const cpus = os.cpus(); const load = os.loadavg()[0] || 0; return { model: cpus[0]?.model ?? "Unknown CPU", cores: cpus.length, load: Math.round((load / Math.max(cpus.length, 1)) * 100) }; }
}
export class RamDetectionManager {
    async detect() { const totalMb = Math.round(os.totalmem() / 1024 / 1024); const freeMb = Math.round(os.freemem() / 1024 / 1024); return { totalMb, freeMb, usedMb: totalMb - freeMb }; }
}
export class StorageDetectionManager {
    async detect(root) { const stats = await fs.statfs(root); const totalMb = Math.round((stats.blocks * stats.bsize) / 1024 / 1024); const freeMb = Math.round((stats.bavail * stats.bsize) / 1024 / 1024); return { totalMb, freeMb, usedMb: totalMb - freeMb }; }
}
export class AiResourceManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    canUse(model, hardware) { const gpuCompatible = !model.requirements.vramMb || !this.manager.settings.get().preferGpu || !hardware.gpu.available || (hardware.gpu.memoryMb ?? 0) >= model.requirements.vramMb; return hardware.ram.freeMb >= model.requirements.ramMb && hardware.storage.freeMb >= model.requirements.storageMb && gpuCompatible; }
    assertAvailable(model, hardware) { if (!this.canUse(model, hardware)) {
        this.manager.log("warning", "resources", `Insufficient resources for ${model.name}`, model.id);
        throw new Error("Insufficient RAM, storage, or compatible GPU memory for this model");
    } }
}
export class ModelPerformanceMonitor {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    snapshot() { const models = this.manager.list(); return { registeredModels: models.length, loadedModels: models.filter((model) => model.status === "loaded").length, healthyModels: models.filter((model) => model.health === "healthy").length, cacheEntries: this.manager.cacheManager.size() }; }
}
export class ModelCacheManager {
    manager;
    cache = new Map();
    constructor(manager) {
        this.manager = manager;
    }
    touch(model) { this.cache.set(model.id, new Date().toISOString()); while (this.cache.size > this.manager.settings.get().cacheLimit)
        this.cache.delete(this.cache.keys().next().value); }
    size() { return this.cache.size; }
}
export class ModelSecurityManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    assertSafeModel(model) { if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(model.id) || !model.name.trim())
        throw new Error("Model id or name is invalid"); if (model.sourcePath)
        this.assertSafeArtifactPath(model.sourcePath); }
    assertSafeArtifactPath(value) { if (!path.isAbsolute(value) || value.includes("\0") || (!this.manager.settings.get().allowExternalArtifacts && value.includes("..")))
        throw new Error("Unsafe model artifact path"); }
}
export class AiSettingsManager {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    get() { return { ...this.manager["store"].settings }; }
    async update(changes) { const next = { ...this.manager["store"].settings, ...changes }; if (!Number.isInteger(next.cacheLimit) || next.cacheLimit < 1 || next.cacheLimit > 20 || next.autoUnloadMinutes < 0)
        throw new Error("Invalid model settings"); this.manager["store"].settings = next; this.manager.log("info", "settings", "Model management settings updated"); await this.manager.persist(); return this.get(); }
}
async function hashFile(filePath) { return createHash("sha256").update(await fs.readFile(filePath)).digest("hex"); }
//# sourceMappingURL=ai-model-manager.js.map