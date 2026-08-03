import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const CRITICAL_ROOTS = new Set(["config", "database", "projects", "state", "ai-model-management", "connector-management", "plugin-management"]);
/** Official local-environment boundary. All file paths are relative to registered roots. */
export class AiDesktopIntegrationManager {
    files = new FileSystemManager(this);
    folders = new FolderManager(this);
    environment = new LocalEnvironmentManager(this);
    root = "";
    core = null;
    tools = null;
    initialized = false;
    roots = new Map();
    backups = new Map();
    watchers = new Map();
    applications = new Map();
    processes = new Map();
    events = [];
    async initialize(core, tools, storageRoot) { this.root = path.join(storageRoot, "desktop-integration"); this.core = core; this.tools = tools; await fsp.mkdir(path.join(this.root, "backups"), { recursive: true }); await fsp.mkdir(path.join(this.root, "cache"), { recursive: true }); await fsp.mkdir(path.join(this.root, "temp"), { recursive: true }); await this.restore(); this.roots.set("studio", { id: "studio", path: path.resolve(storageRoot), label: "KWIZERA AI Studio Storage", projectRoot: true, registeredAt: new Date().toISOString() }); this.initialized = true; await this.persist(); await this.log("desktop", "initialize", undefined, undefined, "Desktop Integration Manager initialized"); }
    isInitialized() { return this.initialized; }
    async shutdown() { for (const id of [...this.watchers.keys()])
        this.stopWatcher(id); for (const child of this.processes.values())
        child.kill(); this.processes.clear(); for (const application of this.applications.values()) {
        application.status = "stopped";
        application.processId = undefined;
    } await this.log("desktop", "shutdown", undefined, undefined, "Desktop Integration Manager shut down"); this.initialized = false; }
    listRoots() { return [...this.roots.values()].map((root) => structuredClone(root)); }
    listBackups() { return [...this.backups.values()].map((backup) => structuredClone(backup)); }
    listEvents() { return this.events; }
    async registerRoot(id, rootPath, label, projectRoot, permissions) { this.requirePermission(permissions, "desktop.roots.manage"); if (!/^[a-z0-9][a-z0-9.-]{2,80}$/i.test(id) || !label.trim() || !path.isAbsolute(rootPath))
        throw new Error("Desktop root configuration is invalid"); const resolved = path.resolve(rootPath); await fsp.mkdir(resolved, { recursive: true }); const root = { id, path: resolved, label, projectRoot, registeredAt: new Date().toISOString() }; this.roots.set(id, root); await this.persist(); await this.log("security", "register-root", id, undefined, `Registered root ${label}`); return structuredClone(root); }
    async unregisterRoot(id, permissions) { this.requirePermission(permissions, "desktop.roots.manage"); if (id === "studio")
        throw new Error("The primary studio root cannot be removed"); this.roots.delete(id); await this.persist(); await this.log("security", "unregister-root", id, undefined, "Root registration removed"); }
    async verifyProject(rootId = "studio", relativePath = "projects", permissions = ["project.access", "filesystem.read"]) { const target = await this.resolve(rootId, relativePath, permissions, "read"); const entries = await this.files.search(rootId, relativePath, "", permissions); const hashes = await Promise.all(entries.map((entry) => this.integrityForAbsolute(entry.path))); const aggregateHash = createHash("sha256").update(hashes.map((item) => `${item.relativePath ?? item.path}:${item.hash}`).sort().join("\n")).digest("hex"); await this.log("system", "verify-project", rootId, this.relative(target.root.path, target.path), `${entries.length} file(s) verified`); return { valid: true, files: entries.length, aggregateHash }; }
    async monitorResources() { const snapshot = await this.environment.detect(); await this.log("resource", "monitor", undefined, undefined, `CPU ${snapshot.cpu.usagePercent}%, RAM ${snapshot.ram.usedMb}MB`); return snapshot; }
    async createTemporaryFile(name, data, permissions) { this.requirePermission(permissions, "filesystem.write"); const safeName = path.basename(name); if (safeName !== name || !safeName)
        throw new Error("Temporary file name is invalid"); const target = path.join(this.root, "temp", `${randomUUID()}-${safeName}`); await fsp.writeFile(target, data); await this.log("file", "create-temp", undefined, safeName, "Temporary file created"); return target; }
    async clearTemporaryFiles(permissions) { this.requirePermission(permissions, "filesystem.delete"); const temp = path.join(this.root, "temp"); const entries = await fsp.readdir(temp); await Promise.all(entries.map((entry) => fsp.rm(path.join(temp, entry), { recursive: true, force: true }))); await this.log("file", "clear-temp", undefined, undefined, `${entries.length} temporary file(s) removed`); return entries.length; }
    async clearCache(permissions) { this.requirePermission(permissions, "filesystem.delete"); const cache = path.join(this.root, "cache"); const entries = await fsp.readdir(cache); await Promise.all(entries.map((entry) => fsp.rm(path.join(cache, entry), { recursive: true, force: true }))); await this.log("file", "clear-cache", undefined, undefined, `${entries.length} cache item(s) removed`); return entries.length; }
    async recoverBackup(backupId, permissions) { this.requirePermission(permissions, "filesystem.write"); const backup = this.backups.get(backupId); if (!backup)
        throw new Error("Local backup not found"); const target = await this.resolve(backup.rootId, backup.relativePath, permissions, "recovery"); await fsp.rm(target.path, { recursive: true, force: true }); await fsp.mkdir(path.dirname(target.path), { recursive: true }); if (backup.isDirectory)
        await fsp.cp(backup.backupPath, target.path, { recursive: true });
    else
        await fsp.copyFile(backup.backupPath, target.path); await this.log("recovery", "restore-backup", backup.rootId, backup.relativePath, `Restored backup ${backupId}`); }
    async registerApplication(id, command, fixedArgs, rootId, permissions) { this.requirePermission(permissions, "desktop.application.manage"); if (!/^[a-z0-9][a-z0-9.-]{2,80}$/i.test(id) || !path.isAbsolute(command) || fixedArgs.some((arg) => arg.includes("\0")))
        throw new Error("Local application registration is invalid"); await fsp.access(command); this.requireRoot(rootId); this.applications.set(id, { id, command, fixedArgs: [...fixedArgs], rootId, status: "registered" }); await this.log("desktop", "register-application", rootId, undefined, `Registered application ${id}`); }
    async startApplication(id, args, permissions) { this.requirePermission(permissions, "desktop.process.execute"); const app = this.applications.get(id); if (!app)
        throw new Error("Local application is not registered"); if (this.processes.has(id))
        throw new Error("Local application is already running"); if (args.some((arg) => arg.includes("\0")))
        throw new Error("Application arguments are invalid"); const child = spawn(app.command, [...app.fixedArgs, ...args], { cwd: this.requireRoot(app.rootId).path, shell: false, windowsHide: true, stdio: "ignore" }); this.processes.set(id, child); app.status = "running"; app.processId = child.pid; child.once("exit", () => { this.processes.delete(id); app.status = "stopped"; app.processId = undefined; }); child.once("error", () => { this.processes.delete(id); app.status = "failed"; }); await this.log("desktop", "start-application", app.rootId, undefined, `Started ${id}`); return structuredClone(app); }
    async stopApplication(id, permissions) { this.requirePermission(permissions, "desktop.process.execute"); const child = this.processes.get(id); if (!child)
        throw new Error("Local application is not running"); child.kill(); await this.log("desktop", "stop-application", this.applications.get(id)?.rootId, undefined, `Stopped ${id}`); }
    getStatus() { return { initialized: this.initialized, rootCount: this.roots.size, watcherCount: this.watchers.size, backupCount: this.backups.size, integrations: { aiCore: Boolean(this.core), toolRegistry: Boolean(this.tools), toolManager: Boolean(this.tools), pluginManager: Boolean(this.core?.pluginManager), connectorManager: Boolean(this.core?.connectorManager), workflowEngine: Boolean(this.core?.workflowEngine), automationEngine: Boolean(this.core?.workflowEngine), taskScheduler: Boolean(this.core?.taskManager), communicationBus: Boolean(this.core?.communicationBus), multiAgentSystem: false } }; }
    async resolve(rootId, relativePath, permissions, operation) { this.ensureReady(); this.requireOperationPermission(permissions, operation); const root = this.requireRoot(rootId); if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0"))
        throw new Error("A non-empty relative path is required"); const target = path.resolve(root.path, relativePath); if (target !== root.path && !target.startsWith(`${root.path}${path.sep}`)) {
        await this.log("security", "deny-path", rootId, relativePath, "Path traversal attempt denied");
        throw new Error("Path escapes registered root");
    } await assertNoSymlink(root.path, target); return { root, path: target }; }
    async backup(rootId, relativePath, operation, permissions) { const target = await this.resolve(rootId, relativePath, permissions, "backup"); if (!(await exists(target.path)))
        return null; const id = randomUUID(); const isDirectory = (await fsp.lstat(target.path)).isDirectory(); const backupPath = path.join(this.root, "backups", id); if (isDirectory)
        await fsp.cp(target.path, backupPath, { recursive: true });
    else {
        await fsp.mkdir(path.dirname(backupPath), { recursive: true });
        await fsp.copyFile(target.path, backupPath);
    } const backup = { id, rootId, relativePath, backupPath, operation, createdAt: new Date().toISOString(), isDirectory }; this.backups.set(id, backup); await this.persist(); await this.log("recovery", "backup", rootId, relativePath, `Backup created for ${operation}`); return structuredClone(backup); }
    assertDeletable(rootId, relativePath, permissions) { this.requirePermission(permissions, "filesystem.delete"); if (rootId === "studio" && CRITICAL_ROOTS.has(relativePath.split(/[\\/]/)[0]) && !permissions.includes("filesystem.critical-delete"))
        throw new Error("Deletion of critical studio data requires filesystem.critical-delete"); }
    watcher(id, watcher) { if (watcher)
        this.watchers.set(id, watcher); return this.watchers.get(id); }
    stopWatcher(id) { const watcher = this.watchers.get(id); if (!watcher)
        return false; watcher.close(); this.watchers.delete(id); return true; }
    async log(event, operation, rootId, relativePath, detail) { const entry = { at: new Date().toISOString(), event, operation, rootId, relativePath, detail }; this.events.unshift(entry); this.events.splice(100); await fsp.appendFile(path.join(this.root, "desktop-events.jsonl"), `${JSON.stringify(entry)}\n`, "utf8"); }
    relative(root, target) { return path.relative(root, target).split(path.sep).join("/"); }
    integrityForAbsolute = async (filePath) => { const stats = await fsp.stat(filePath); return { path: filePath, algorithm: "sha256", hash: createHash("sha256").update(await fsp.readFile(filePath)).digest("hex"), sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() }; };
    requirePermission(permissions, required) { if (!permissions.includes(required))
        throw new Error(`Required desktop permission was not granted: ${required}`); }
    requireOperationPermission(permissions, operation) { const permission = operation === "read" || operation === "search" ? "filesystem.read" : operation === "watch" ? "filesystem.watch" : operation === "delete" ? "filesystem.delete" : operation === "backup" || operation === "recovery" ? "filesystem.write" : "filesystem.write"; this.requirePermission(permissions, permission); }
    requireRoot(id) { const root = this.roots.get(id); if (!root)
        throw new Error(`Desktop root not found: ${id}`); return root; }
    ensureReady() { if (!this.initialized || !this.core || !this.tools)
        throw new Error("Desktop Integration Manager is not initialized"); }
    async restore() { try {
        const saved = JSON.parse(await fsp.readFile(path.join(this.root, "desktop-state.json"), "utf8"));
        for (const root of saved.roots ?? [])
            this.roots.set(root.id, root);
        for (const backup of saved.backups ?? [])
            this.backups.set(backup.id, backup);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    } }
    async persist() { const target = path.join(this.root, "desktop-state.json"); const temporary = `${target}.${randomUUID()}.tmp`; await fsp.writeFile(temporary, `${JSON.stringify({ roots: [...this.roots.values()], backups: [...this.backups.values()] }, null, 2)}\n`, "utf8"); await fsp.rename(temporary, target); }
}
export class FileSystemManager {
    desktop;
    constructor(desktop) {
        this.desktop = desktop;
    }
    async create(rootId, relativePath, data, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "create"); if (await exists(target.path))
        throw new Error("File already exists"); await fsp.mkdir(path.dirname(target.path), { recursive: true }); await fsp.writeFile(target.path, data); await this.desktop.log("file", "create", rootId, relativePath, "File created"); }
    async read(rootId, relativePath, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "read"); const data = await fsp.readFile(target.path); await this.desktop.log("file", "read", rootId, relativePath, "File read"); return data; }
    async update(rootId, relativePath, data, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "update"); if (!(await exists(target.path)))
        throw new Error("File not found"); await this.desktop.backup(rootId, relativePath, "update", permissions); await fsp.writeFile(target.path, data); await this.desktop.log("file", "update", rootId, relativePath, "File updated after backup"); }
    async delete(rootId, relativePath, permissions) { this.desktop.assertDeletable(rootId, relativePath, permissions); const target = await this.desktop.resolve(rootId, relativePath, permissions, "delete"); if (!(await fsp.lstat(target.path)).isFile())
        throw new Error("Target is not a file"); await this.desktop.backup(rootId, relativePath, "delete", permissions); await fsp.rm(target.path); await this.desktop.log("file", "delete", rootId, relativePath, "File deleted after backup"); }
    async copy(rootId, source, destination, permissions) { const from = await this.desktop.resolve(rootId, source, permissions, "copy"); const to = await this.desktop.resolve(rootId, destination, permissions, "copy"); if (await exists(to.path))
        await this.desktop.backup(rootId, destination, "copy", permissions); await fsp.mkdir(path.dirname(to.path), { recursive: true }); await fsp.copyFile(from.path, to.path); await this.desktop.log("file", "copy", rootId, source, `Copied to ${destination}`); }
    async move(rootId, source, destination, permissions) { const from = await this.desktop.resolve(rootId, source, permissions, "move"); const to = await this.desktop.resolve(rootId, destination, permissions, "move"); await this.desktop.backup(rootId, source, "move", permissions); if (await exists(to.path))
        await this.desktop.backup(rootId, destination, "move", permissions); await fsp.mkdir(path.dirname(to.path), { recursive: true }); await fsp.rename(from.path, to.path); await this.desktop.log("file", "move", rootId, source, `Moved to ${destination}`); }
    async rename(rootId, source, name, permissions) { if (path.basename(name) !== name)
        throw new Error("New file name is invalid"); await this.move(rootId, source, path.join(path.dirname(source), name), permissions); }
    async search(rootId, relativePath, query, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "search"); const results = []; const visit = async (directory) => { for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        if (results.length >= 10000)
            throw new Error("File search result limit reached");
        const candidate = path.join(directory, entry.name);
        if (entry.isDirectory())
            await visit(candidate);
        else if (!query || entry.name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fsp.stat(candidate);
            results.push({ path: candidate, relativePath: this.desktop.relative(target.root.path, candidate), sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() });
        }
    } }; await visit(target.path); await this.desktop.log("file", "search", rootId, relativePath, `${results.length} result(s)`); return results; }
    async verifyIntegrity(rootId, relativePath, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "read"); const result = await this.desktop.integrityForAbsolute(target.path); await this.desktop.log("file", "verify-integrity", rootId, relativePath, "SHA-256 verified"); return result; }
    async watch(rootId, relativePath, onChange, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "watch"); const id = randomUUID(); const watcher = fs.watch(target.path, { recursive: process.platform === "win32" }, (event, filename) => onChange(event, filename?.toString() ?? "")); this.desktop.watcher(id, watcher); await this.desktop.log("file", "watch", rootId, relativePath, `Watcher ${id} active`); return id; }
    async unwatch(id) { if (!this.desktop.stopWatcher(id))
        throw new Error("Watcher not found"); await this.desktop.log("file", "unwatch", undefined, undefined, `Watcher ${id} stopped`); }
}
export class FolderManager {
    desktop;
    constructor(desktop) {
        this.desktop = desktop;
    }
    async create(rootId, relativePath, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "create"); await fsp.mkdir(target.path, { recursive: true }); await this.desktop.log("folder", "create", rootId, relativePath, "Folder created"); }
    async delete(rootId, relativePath, permissions) { this.desktop.assertDeletable(rootId, relativePath, permissions); const target = await this.desktop.resolve(rootId, relativePath, permissions, "delete"); if (!(await fsp.lstat(target.path)).isDirectory())
        throw new Error("Target is not a folder"); await this.desktop.backup(rootId, relativePath, "delete", permissions); await fsp.rm(target.path, { recursive: true }); await this.desktop.log("folder", "delete", rootId, relativePath, "Folder deleted after backup"); }
    async copy(rootId, source, destination, permissions) { const from = await this.desktop.resolve(rootId, source, permissions, "copy"); const to = await this.desktop.resolve(rootId, destination, permissions, "copy"); if (await exists(to.path))
        await this.desktop.backup(rootId, destination, "copy", permissions); await fsp.cp(from.path, to.path, { recursive: true }); await this.desktop.log("folder", "copy", rootId, source, `Copied to ${destination}`); }
    async move(rootId, source, destination, permissions) { const from = await this.desktop.resolve(rootId, source, permissions, "move"); const to = await this.desktop.resolve(rootId, destination, permissions, "move"); await this.desktop.backup(rootId, source, "move", permissions); await fsp.rename(from.path, to.path); await this.desktop.log("folder", "move", rootId, source, `Moved to ${destination}`); }
    async scan(rootId, relativePath, permissions) { return this.desktop.files.search(rootId, relativePath, "", permissions); }
    async watch(rootId, relativePath, onChange, permissions) { return this.desktop.files.watch(rootId, relativePath, onChange, permissions); }
    async organize(rootId, relativePath, permissions) { const target = await this.desktop.resolve(rootId, relativePath, permissions, "update"); await this.desktop.backup(rootId, relativePath, "update", permissions); for (const entry of await fsp.readdir(target.path, { withFileTypes: true }))
        if (entry.isFile()) {
            const extension = path.extname(entry.name).slice(1).toLowerCase() || "other";
            const folder = path.join(target.path, extension);
            await fsp.mkdir(folder, { recursive: true });
            await fsp.rename(path.join(target.path, entry.name), path.join(folder, entry.name));
        } await this.desktop.log("folder", "organize", rootId, relativePath, "Files organized by extension"); }
}
export class LocalEnvironmentManager {
    desktop;
    constructor(desktop) {
        this.desktop = desktop;
    }
    async detect() { const root = this.desktop.listRoots().find((item) => item.id === "studio"); const stats = await fsp.statfs(root.path); const cpus = os.cpus(); const totalMb = Math.round(os.totalmem() / 1024 / 1024); const freeMb = Math.round(os.freemem() / 1024 / 1024); const modelHardware = this.desktop["core"]?.modelManager ? await this.desktop["core"].modelManager.detectHardware() : null; let dependencies = []; try {
        dependencies = Object.keys(JSON.parse(await fsp.readFile(path.join(process.cwd(), "package.json"), "utf8")).dependencies ?? {}).concat(Object.keys(JSON.parse(await fsp.readFile(path.join(process.cwd(), "package.json"), "utf8")).devDependencies ?? {}));
    }
    catch { /* Dependency manifest is optional outside the development workspace. */ } return { operatingSystem: { platform: process.platform, release: os.release(), architecture: process.arch, hostname: os.hostname() }, cpu: { model: cpus[0]?.model ?? "Unknown CPU", cores: cpus.length, usagePercent: Math.round((os.loadavg()[0] / Math.max(cpus.length, 1)) * 100) }, gpu: modelHardware?.gpu ?? { available: false, name: "No supported GPU detected" }, ram: { totalMb, freeMb, usedMb: totalMb - freeMb }, storage: { totalMb: Math.round((stats.blocks * stats.bsize) / 1024 / 1024), freeMb: Math.round((stats.bavail * stats.bsize) / 1024 / 1024), usedMb: Math.round(((stats.blocks - stats.bavail) * stats.bsize) / 1024 / 1024) }, installedModels: this.desktop["core"]?.modelManager?.list().filter((model) => model.status !== "removed").map((model) => model.id) ?? [], installedDependencies: dependencies.sort(), capturedAt: new Date().toISOString() }; }
}
async function exists(filePath) { try {
    await fsp.access(filePath);
    return true;
}
catch {
    return false;
} }
async function assertNoSymlink(rootPath, targetPath) { const relative = path.relative(rootPath, targetPath); let current = rootPath; for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
        if ((await fsp.lstat(current)).isSymbolicLink())
            throw new Error("Symlink traversal is not permitted");
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
        break;
    }
} }
//# sourceMappingURL=desktop-integration-manager.js.map