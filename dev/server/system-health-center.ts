/**
 * Phase 7 Step 4 — Windows Machine Integration & System Health Center
 *
 * Reuses: storage paths, PMC, online knowledge, resource probes, /api/health.
 * Does NOT delete user data, run arbitrary shell, or auto-install updates.
 */

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeResourceMetrics } from "../../ai/local-resource-manager/resource-probes.js";
import { resolveBindHost, resolveBindPort, resolveHealthProbeHost } from "../../config/runtime-env.js";
import { resolveStoragePath, resolveStorageRoot } from "../../storage/paths/storage-paths.js";
import { persistentMemoryCenter } from "./persistent-memory-center.js";
import { onlineKnowledgeEngine } from "./online-knowledge-engine.js";

export type ServiceStatus = "STARTING" | "READY" | "DEGRADED" | "FAILED" | "STOPPED" | "UNKNOWN";
export type ServiceCriticality = "required" | "optional" | "external";
export type RepairLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type DiskThreshold = "HEALTHY" | "WARNING" | "CRITICAL";
export type UpdatePhase =
  | "IDLE"
  | "CHECK"
  | "AVAILABLE"
  | "VALIDATING"
  | "BACKING_UP"
  | "INSTALLING"
  | "MIGRATING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

export type AllowedRepairAction =
  | "restart-registered-service"
  | "ensure-temp-dirs"
  | "ensure-cache-dirs"
  | "rebuild-knowledge-index-noop"
  | "create-safety-backup"
  | "flush-logs-marker"
  | "diagnose-only";

export interface RegisteredService {
  id: string;
  name: string;
  type: string;
  criticality: ServiceCriticality;
  status: ServiceStatus;
  lastError: string | null;
  lastCheckedAt: string | null;
  restartAttempts: number;
  maxRestarts: number;
  port?: number;
  detail?: string;
}

export interface SubsystemHealth {
  id: string;
  label: string;
  status: ServiceStatus;
  required: boolean;
  detail: string;
  score: number; // 0-100
}

export interface SystemHealthReport {
  ready: boolean;
  overallStatus: ServiceStatus;
  healthScore: number;
  checkedAt: string;
  applicationVersion: string;
  windowsVersion: string;
  appRoot: string;
  storageRoot: string;
  subsystems: SubsystemHealth[];
  services: RegisteredService[];
  resources: {
    cpuUsage: number;
    ramUsage: number;
    ramUsedMb: number;
    ramTotalMb: number;
    diskUsage: number;
    diskThreshold: DiskThreshold;
    storageUsedGb: number;
    storageTotalGb: number;
    gpu: string;
    vram: string;
    gpuUsage: number | null;
  };
  network: { state: string; mode: string; detail: string };
  update: UpdateState;
  issues: string[];
  offlineCapable: true;
}

export interface RepairLogEntry {
  id: string;
  at: string;
  component: string;
  problem: string;
  diagnosis: string;
  level: RepairLevel;
  action: AllowedRepairAction;
  result: "success" | "failed" | "skipped" | "diagnosis-only";
  backupId: string | null;
  error: string | null;
  finalStatus: string;
}

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion: string | null;
  lastCheckAt: string | null;
  lastError: string | null;
  rollbackAvailable: boolean;
  note: string;
}

export interface DiagnosticBundleMeta {
  generatedAt: string;
  path: string;
  includes: string[];
  excluded: string[];
}

const APP_VERSION = readAppVersion();
const MAX_REPAIR_LOG = 200;
const ALLOWED_REPAIRS: AllowedRepairAction[] = [
  "diagnose-only",
  "restart-registered-service",
  "ensure-temp-dirs",
  "ensure-cache-dirs",
  "rebuild-knowledge-index-noop",
  "create-safety-backup",
  "flush-logs-marker",
];

function readAppVersion(): string {
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function httpGetJson(url: string, timeoutMs = 2500): Promise<{ ok: boolean; status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body: unknown = raw;
        try { body = JSON.parse(raw); } catch { /* keep */ }
        resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", () => resolve({ ok: false, status: 0, body: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: null });
    });
  });
}

function dirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.health-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function diskThreshold(usage: number): DiskThreshold {
  if (usage >= 92) return "CRITICAL";
  if (usage >= 80) return "WARNING";
  return "HEALTHY";
}

function redactSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key|password|token|secret|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]");
}

export class SystemHealthCenter {
  private ready = false;
  private storageRoot = "";
  private appRoot = "";
  private healthRoot = "";
  private services = new Map<string, RegisteredService>();
  private repairLog: RepairLogEntry[] = [];
  private updateState: UpdateState = {
    phase: "IDLE",
    currentVersion: APP_VERSION,
    availableVersion: null,
    lastCheckAt: null,
    lastError: null,
    rollbackAvailable: false,
    note: "Controlled update architecture only — no automatic downloads. Install via trusted desktop:pack / Setup EXE.",
  };
  private lastReport: SystemHealthReport | null = null;
  private crashMarkerPath = "";
  private lastInterruptedPath = "";
  private pendingInterruptedAt: string | null = null;

  async boot(storageRootOverride?: string): Promise<void> {
    this.storageRoot = resolveStorageRoot(storageRootOverride);
    this.appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    this.healthRoot = path.join(resolveStoragePath(this.storageRoot, "logs"), "system-health");
    fs.mkdirSync(this.healthRoot, { recursive: true });
    this.crashMarkerPath = path.join(this.healthRoot, "session-interrupted.marker");
    this.lastInterruptedPath = path.join(this.healthRoot, "last-interrupted.json");
    this.registerDefaultServices();
    this.loadRepairLog();
    this.detectInterruptedSession();
    this.ready = true;
    await this.runFastHealthCheck();
    console.log(`[KWIZERA] System Health Center ready v${APP_VERSION}`);
  }

  isReady(): boolean {
    return this.ready;
  }

  getVersion(): string {
    return APP_VERSION;
  }

  getLastReport(): SystemHealthReport | null {
    return this.lastReport;
  }

  listServices(): RegisteredService[] {
    return [...this.services.values()].map((s) => ({ ...s }));
  }

  listRepairLog(limit = 50): RepairLogEntry[] {
    return this.repairLog.slice(0, limit);
  }

  getUpdateState(): UpdateState {
    return { ...this.updateState };
  }

  getInterruptedSession(): { interrupted: boolean; markerAt: string | null } {
    if (this.pendingInterruptedAt) {
      return { interrupted: true, markerAt: this.pendingInterruptedAt };
    }
    if (fs.existsSync(this.lastInterruptedPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.lastInterruptedPath, "utf8")) as { at?: string };
        return { interrupted: true, markerAt: raw.at ?? null };
      } catch {
        return { interrupted: true, markerAt: null };
      }
    }
    return { interrupted: false, markerAt: null };
  }

  markSessionRunning(): void {
    fs.writeFileSync(
      this.crashMarkerPath,
      JSON.stringify({ at: new Date().toISOString(), pid: process.pid, version: APP_VERSION }, null, 2),
      "utf8",
    );
  }

  clearInterruptedSession(): void {
    this.pendingInterruptedAt = null;
    try {
      if (fs.existsSync(this.lastInterruptedPath)) fs.unlinkSync(this.lastInterruptedPath);
    } catch { /* ignore */ }
  }

  /** Clean exit — remove dirty session marker so next launch is not treated as a crash. */
  markCleanExit(): void {
    try {
      if (fs.existsSync(this.crashMarkerPath)) fs.unlinkSync(this.crashMarkerPath);
    } catch { /* ignore */ }
  }

  async runFastHealthCheck(): Promise<SystemHealthReport> {
    const checkedAt = new Date().toISOString();
    const issues: string[] = [];
    const subsystems: SubsystemHealth[] = [];

    // Application
    subsystems.push({
      id: "application",
      label: "Application",
      status: "READY",
      required: true,
      detail: `KWIZERA AI STUDIO v${APP_VERSION}`,
      score: 100,
    });

    // Backend / local API (self)
    const port = resolveBindPort();
    const bindHost = resolveBindHost();
    const probeHost = resolveHealthProbeHost(bindHost);
    const health = await httpGetJson(`http://${probeHost}:${port}/api/health`);
    const backendOk = health.ok && typeof health.body === "object" && health.body && (health.body as { ok?: boolean }).ok;
    this.setService("local-api", backendOk ? "READY" : "STARTING", backendOk ? null : "Health endpoint not ready yet");
    subsystems.push({
      id: "backend",
      label: "Backend / Local API",
      status: backendOk ? "READY" : "STARTING",
      required: true,
      detail: backendOk ? `Responding on ${probeHost}:${port}` : `Waiting for /api/health on port ${port}`,
      score: backendOk ? 100 : 55,
    });

    // Storage / projects / outputs
    const projectsDir = resolveStoragePath(this.storageRoot, "projects");
    const creativeWorkspaceDir = path.join(this.storageRoot, "creative-workspace");
    const exportsDir = resolveStoragePath(this.storageRoot, "exports");
    const mediaDir = resolveStoragePath(this.storageRoot, "media");
    const storageOk = dirWritable(this.storageRoot) && dirWritable(projectsDir);
    const creativeOk = dirWritable(creativeWorkspaceDir);
    const outputsOk = dirWritable(exportsDir) && dirWritable(mediaDir);
    this.setService("storage", storageOk ? "READY" : "FAILED", storageOk ? null : "Storage not writable");
    subsystems.push({
      id: "storage",
      label: "Storage",
      status: storageOk ? "READY" : "FAILED",
      required: true,
      detail: storageOk ? this.storageRoot : "Cannot write storage root",
      score: storageOk ? 100 : 0,
    });
    // Product Creation source of truth is creative-workspace/
    let creativeDetail = creativeWorkspaceDir;
    let creativeStatus: ServiceStatus = creativeOk ? "READY" : "FAILED";
    let creativeScore = creativeOk ? 100 : 0;
    try {
      const sessionPath = path.join(creativeWorkspaceDir, "workspace-session.json");
      if (fs.existsSync(sessionPath)) {
        const index = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as {
          projectIds?: string[];
          activeProjectId?: string | null;
        };
        const count = Array.isArray(index.projectIds) ? index.projectIds.length : 0;
        creativeDetail = `${creativeWorkspaceDir} · ${count} project(s) · active=${index.activeProjectId ?? "none"}`;
      } else {
        creativeDetail = `${creativeWorkspaceDir} · index not yet created`;
        creativeStatus = creativeOk ? "DEGRADED" : "FAILED";
        creativeScore = creativeOk ? 70 : 0;
      }
    } catch (error) {
      creativeStatus = "DEGRADED";
      creativeScore = 40;
      creativeDetail = `Index unreadable: ${error instanceof Error ? error.message : String(error)}`;
      issues.push("Creative workspace index unreadable");
    }
    this.setService("creative-workspace", creativeStatus, creativeOk ? null : "Creative workspace not writable");
    subsystems.push({
      id: "creative-workspace",
      label: "Product Creation Persistence",
      status: creativeStatus,
      required: true,
      detail: creativeDetail,
      score: creativeScore,
    });
    subsystems.push({
      id: "projects",
      label: "Projects (legacy dir)",
      status: storageOk ? "READY" : "FAILED",
      required: false,
      detail: `${projectsDir} (Product Creation SoT is creative-workspace/)`,
      score: storageOk ? 100 : 0,
    });
    subsystems.push({
      id: "outputs",
      label: "Outputs",
      status: outputsOk ? "READY" : "DEGRADED",
      required: false,
      detail: outputsOk ? "Exports/media writable" : "Output dirs not writable",
      score: outputsOk ? 100 : 40,
    });
    if (!storageOk) issues.push("Storage root not writable");
    if (!creativeOk) issues.push("Creative workspace not writable");

    // Database dir (JSON architecture — reserved directory)
    const dbDir = resolveStoragePath(this.storageRoot, "database");
    const dbOk = dirWritable(dbDir);
    this.setService("database", dbOk ? "READY" : "FAILED", dbOk ? null : "Database directory not writable");
    subsystems.push({
      id: "database",
      label: "Database",
      status: dbOk ? "READY" : "FAILED",
      required: true,
      detail: dbOk ? `${dbDir} (JSON-file architecture; no SQLite schema)` : "Database directory failed",
      score: dbOk ? 100 : 0,
    });

    // Memory / Knowledge (Step 2)
    const memReady = persistentMemoryCenter.isReady();
    const memHealth = memReady ? persistentMemoryCenter.health() : null;
    const memStatus: ServiceStatus = !memReady
      ? "STARTING"
      : memHealth?.memory === "READY"
        ? "READY"
        : "FAILED";
    this.setService("memory", memStatus, memReady ? null : "Persistent Memory Center starting");
    subsystems.push({
      id: "memory",
      label: "Memory",
      status: memStatus,
      required: true,
      detail: memReady
        ? `${memHealth?.memoryCount ?? 0} records · ${memHealth?.memoryRoot ?? ""}`
        : "Booting Persistent Memory Center",
      score: memStatus === "READY" ? 100 : memStatus === "STARTING" ? 50 : 0,
    });

    const knowStatus: ServiceStatus = !memReady
      ? "STARTING"
      : memHealth?.knowledge === "READY"
        ? "READY"
        : "FAILED";
    this.setService("knowledge", knowStatus, null);
    subsystems.push({
      id: "knowledge",
      label: "Knowledge",
      status: knowStatus,
      required: true,
      detail: memReady
        ? `LOCAL KNOWLEDGE AVAILABLE · ${memHealth?.knowledgeCount ?? 0} items`
        : "Knowledge center starting",
      score: knowStatus === "READY" ? 100 : 50,
    });

    // AI engine — KWIZERA AI Core is the foundation.
    const statusUrl = await httpGetJson(`http://${probeHost}:${port}/api/desktop-workspace/status`);
    const aiCore = statusUrl.ok && statusUrl.body && typeof statusUrl.body === "object"
      ? Boolean((statusUrl.body as { aiCore?: boolean }).aiCore)
      : false;
    const localInference = statusUrl.ok && statusUrl.body && typeof statusUrl.body === "object"
      ? Boolean((statusUrl.body as { localInference?: boolean }).localInference)
      : false;

    let aiDetail = "KWIZERA AI Core not ready";
    let aiStatus: ServiceStatus = "DEGRADED";
    let aiScore = 50;

    if (aiCore) {
      aiStatus = "READY";
      aiScore = 100;
      aiDetail = "KWIZERA AI Core ready (memory · knowledge · intelligence)";
    } else if (localInference) {
      aiStatus = "DEGRADED";
      aiScore = 55;
      aiDetail = "Model manager present without KWIZERA AI Core (enable persistent runtime)";
    }

    this.setService("ai-engine", aiStatus, aiStatus === "READY" ? null : aiDetail);
    subsystems.push({
      id: "ai-engine",
      label: "AI Engine",
      status: aiStatus,
      required: false,
      detail: aiDetail,
      score: aiScore,
    });

    // Network (Step 3)
    let networkState = "UNKNOWN";
    let networkMode = "OFFLINE_KNOWLEDGE";
    let networkDetail = "Online knowledge engine not ready";
    if (onlineKnowledgeEngine.isReady()) {
      const net = onlineKnowledgeEngine.getNetwork();
      networkState = net.state;
      networkMode = net.mode;
      networkDetail = net.detail;
    }
    const netStatus: ServiceStatus =
      networkState === "ONLINE" || networkState === "LIMITED"
        ? "READY"
        : networkState === "OFFLINE"
          ? "DEGRADED"
          : "UNKNOWN";
    this.setService("network", netStatus, networkState === "ERROR" ? networkDetail : null);
    subsystems.push({
      id: "network",
      label: "Network",
      status: netStatus,
      required: false,
      detail: `${networkState} · ${networkMode} — ${networkDetail}`,
      score: networkState === "ONLINE" ? 100 : networkState === "OFFLINE" ? 70 : 50,
    });

    // Desktop-shell integration is Windows-only; on Linux/VPS it is not a health failure.
    subsystems.push({
      id: "windows-integration",
      label: "Windows Integration",
      status: "READY",
      required: false,
      detail: process.platform === "win32"
        ? "Launcher/scripts available (Electron desktop + install shortcuts)"
        : `Platform ${process.platform} — Windows desktop shortcuts not applicable`,
      score: 100,
    });

    // Resources
    const metrics = probeResourceMetrics(this.storageRoot);
    const allowGpu = process.env.KWIZERA_LRM_EXTERNAL_PROBES === "1";
    const resources = {
      cpuUsage: metrics.cpuUsage,
      ramUsage: metrics.ramUsage,
      ramUsedMb: metrics.systemRamUsedMb,
      ramTotalMb: metrics.systemRamTotalMb,
      diskUsage: metrics.diskUsage,
      diskThreshold: diskThreshold(metrics.diskUsage),
      storageUsedGb: metrics.storageUsedGb,
      storageTotalGb: metrics.storageTotalGb,
      gpu: allowGpu && metrics.gpuMemoryTotalMb
        ? `Detected · ${metrics.gpuMemoryUsedMb ?? 0}/${metrics.gpuMemoryTotalMb} MB`
        : allowGpu
          ? "Probe enabled — GPU details limited"
          : "NOT AVAILABLE (set KWIZERA_LRM_EXTERNAL_PROBES=1 for nvidia-smi)",
      vram: metrics.gpuMemoryTotalMb != null
        ? `${metrics.vramUsage}%`
        : "NOT AVAILABLE",
      gpuUsage: allowGpu ? metrics.gpuUsage : null,
    };
    if (resources.diskThreshold === "CRITICAL") {
      issues.push("Disk space CRITICAL — free space before large productions");
    } else if (resources.diskThreshold === "WARNING") {
      issues.push("Disk space WARNING");
    }

    // Update / recovery stubs
    subsystems.push({
      id: "update-system",
      label: "Update System",
      status: "READY",
      required: false,
      detail: this.updateState.note,
      score: 90,
    });
    subsystems.push({
      id: "recovery-system",
      label: "Recovery System",
      status: "READY",
      required: false,
      detail: "Crash marker + PMC backup/restore + allowlisted repairs",
      score: 95,
    });

    const requiredFailed = subsystems.filter((s) => s.required && (s.status === "FAILED"));
    const requiredNotReady = subsystems.filter((s) => s.required && (s.status === "FAILED" || s.status === "STARTING"));
    const scores = subsystems.map((s) => s.score);
    const healthScore = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1));
    const overallStatus: ServiceStatus = requiredFailed.length
      ? "FAILED"
      : requiredNotReady.length
        ? "DEGRADED"
        : subsystems.some((s) => s.status === "DEGRADED")
          ? "DEGRADED"
          : "READY";

    const report: SystemHealthReport = {
      ready: overallStatus === "READY" || overallStatus === "DEGRADED",
      overallStatus,
      healthScore,
      checkedAt,
      applicationVersion: APP_VERSION,
      windowsVersion: `${os.type()} ${os.release()}`,
      appRoot: this.appRoot,
      storageRoot: this.storageRoot,
      subsystems,
      services: this.listServices(),
      resources,
      network: { state: networkState, mode: networkMode, detail: networkDetail },
      update: this.getUpdateState(),
      issues,
      offlineCapable: true,
    };
    this.lastReport = report;
    this.appendHealthLog(report);
    return report;
  }

  async runFullDiagnostic(): Promise<SystemHealthReport & { deep: Record<string, unknown> }> {
    const fast = await this.runFastHealthCheck();
    const deep = {
      interruptedSession: this.getInterruptedSession(),
      repairLogCount: this.repairLog.length,
      backups: persistentMemoryCenter.isReady() ? persistentMemoryCenter.listBackups().slice(0, 5) : [],
      onlineKnowledge: onlineKnowledgeEngine.isReady() ? onlineKnowledgeEngine.getStatus() : null,
      cpus: os.cpus().length,
      hostname: os.hostname(),
      arch: os.arch(),
      freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
    };
    return { ...fast, deep };
  }

  async selfTest(): Promise<{ checks: Array<{ id: string; ok: boolean; detail: string }>; passed: number; total: number }> {
    const report = await this.runFastHealthCheck();
    const checks = report.subsystems.map((s) => ({
      id: s.id,
      ok: s.status === "READY" || (!s.required && s.status === "DEGRADED"),
      detail: `${s.status} — ${s.detail}`,
    }));
    const passed = checks.filter((c) => c.ok).length;
    return { checks, passed, total: checks.length };
  }

  /**
   * Allowlisted repairs only. Never deletes user data.
   */
  async repair(opts: {
    action: AllowedRepairAction;
    component?: string;
    level?: RepairLevel;
    problem?: string;
  }): Promise<RepairLogEntry> {
    const action = opts.action;
    const level = opts.level ?? (action === "diagnose-only" ? 0 : action === "restart-registered-service" ? 1 : 2);
    const component = opts.component ?? "system";
    const problem = opts.problem ?? "Manual repair request";
    const id = `repair-${Date.now()}`;

    if (!ALLOWED_REPAIRS.includes(action)) {
      const denied: RepairLogEntry = {
        id,
        at: new Date().toISOString(),
        component,
        problem,
        diagnosis: "Action not on allowlist",
        level: 5,
        action: "diagnose-only",
        result: "failed",
        backupId: null,
        error: `Forbidden repair action: ${action}`,
        finalStatus: "DENIED",
      };
      this.pushRepair(denied);
      return denied;
    }

    let backupId: string | null = null;
    let result: RepairLogEntry["result"] = "success";
    let error: string | null = null;
    let finalStatus = "OK";
    let diagnosis = "";

    try {
      switch (action) {
        case "diagnose-only": {
          const report = await this.runFastHealthCheck();
          diagnosis = `Health score ${report.healthScore}; overall ${report.overallStatus}`;
          result = "diagnosis-only";
          finalStatus = report.overallStatus;
          break;
        }
        case "create-safety-backup": {
          if (!persistentMemoryCenter.isReady()) throw new Error("Memory center not ready");
          const bak = persistentMemoryCenter.createBackup();
          if (!bak.ok) throw new Error(bak.error ?? "Backup failed");
          backupId = bak.backupId;
          // Also snapshot Product Creation creative-workspace (non-destructive copy)
          const cwSrc = path.join(this.storageRoot, "creative-workspace");
          const cwDest = path.join(
            resolveStoragePath(this.storageRoot, "backups"),
            "creative-workspace",
            `safety-${bak.backupId}`,
          );
          let cwNote = "creative-workspace skipped (missing)";
          if (fs.existsSync(cwSrc)) {
            fs.mkdirSync(cwDest, { recursive: true });
            fs.cpSync(cwSrc, path.join(cwDest, "creative-workspace"), { recursive: true });
            fs.writeFileSync(
              path.join(cwDest, "manifest.json"),
              `${JSON.stringify({ backupId: bak.backupId, kind: "creative-workspace-safety", source: cwSrc, createdAt: new Date().toISOString() }, null, 2)}\n`,
              "utf8",
            );
            cwNote = `creative-workspace copied to ${cwDest}`;
          }
          diagnosis = `Safety backup created (${bak.backupId}); ${cwNote}`;
          finalStatus = "BACKUP_OK";
          break;
        }
        case "ensure-temp-dirs":
        case "ensure-cache-dirs": {
          const dirs = [
            resolveStoragePath(this.storageRoot, "temp"),
            resolveStoragePath(this.storageRoot, "cache"),
            path.join(resolveStoragePath(this.storageRoot, "logs"), "tmp"),
          ];
          for (const d of dirs) fs.mkdirSync(d, { recursive: true });
          diagnosis = `Ensured temporary/cache directories: ${dirs.join(", ")}`;
          finalStatus = "DIRS_OK";
          break;
        }
        case "rebuild-knowledge-index-noop": {
          // Safe no-op placeholder — full reindex belongs to knowledge engines; we only verify readability
          if (!persistentMemoryCenter.isReady()) throw new Error("Knowledge not ready");
          const h = persistentMemoryCenter.health();
          diagnosis = `Knowledge readable (${h.knowledgeCount} items). Full reindex not forced.`;
          finalStatus = h.knowledge === "READY" ? "INDEX_OK" : "INDEX_DEGRADED";
          break;
        }
        case "flush-logs-marker": {
          const marker = path.join(this.healthRoot, "log-flush.marker");
          fs.writeFileSync(marker, new Date().toISOString(), "utf8");
          diagnosis = "Log flush marker written";
          finalStatus = "LOGS_OK";
          break;
        }
        case "restart-registered-service": {
          const svc = this.services.get(component);
          if (!svc) throw new Error(`Unknown registered service: ${component}`);
          if (svc.restartAttempts >= svc.maxRestarts) {
            throw new Error(`Max restarts reached for ${component} (${svc.maxRestarts})`);
          }
          svc.restartAttempts += 1;
          svc.status = "STARTING";
          // Soft restart: re-run health; we do not kill foreign Windows processes
          if (component === "memory" || component === "knowledge") {
            await persistentMemoryCenter.boot(this.storageRoot);
          }
          if (component === "network") {
            await onlineKnowledgeEngine.refreshNetwork();
          }
          await this.runFastHealthCheck();
          const after = this.services.get(component);
          diagnosis = `Soft restart attempted for ${component}`;
          finalStatus = after?.status ?? "UNKNOWN";
          if (after?.status === "FAILED") {
            result = "failed";
            error = "Service still failed after soft restart — USER ACTION REQUIRED";
          }
          break;
        }
        default:
          throw new Error("Unhandled allowlisted action");
      }
    } catch (e) {
      result = "failed";
      error = e instanceof Error ? e.message : String(e);
      finalStatus = "FAILED";
      diagnosis = diagnosis || "Repair failed";
    }

    const entry: RepairLogEntry = {
      id,
      at: new Date().toISOString(),
      component,
      problem,
      diagnosis,
      level,
      action,
      result,
      backupId,
      error,
      finalStatus,
    };
    this.pushRepair(entry);
    return entry;
  }

  /**
   * Update foundation — validates manifests conceptually; does not download arbitrary packages.
   */
  checkForUpdate(manifest?: {
    version?: string;
    releaseId?: string;
    checksum?: string;
    packageUrl?: string;
  }): UpdateState {
    this.updateState.lastCheckAt = new Date().toISOString();
    this.updateState.phase = "CHECK";
    if (!manifest?.version) {
      this.updateState.phase = "IDLE";
      this.updateState.availableVersion = null;
      this.updateState.note = "No update manifest supplied. Use trusted desktop:pack / Setup EXE offline.";
      return this.getUpdateState();
    }
    if (manifest.packageUrl && !/^https:\/\/(github\.com|release\.local)\//i.test(manifest.packageUrl) && !manifest.packageUrl.startsWith("file:")) {
      this.updateState.phase = "FAILED";
      this.updateState.lastError = "Update source not in trusted allowlist";
      return this.getUpdateState();
    }
    if (manifest.version === APP_VERSION) {
      this.updateState.phase = "IDLE";
      this.updateState.availableVersion = null;
      this.updateState.note = "Already on current version";
      return this.getUpdateState();
    }
    this.updateState.phase = "AVAILABLE";
    this.updateState.availableVersion = manifest.version;
    this.updateState.note = `Update ${manifest.version} noted (release ${manifest.releaseId ?? "n/a"}). Install only via validated package + backup.`;
    return this.getUpdateState();
  }

  async prepareUpdateBackup(): Promise<{ ok: boolean; backupId?: string; error?: string }> {
    this.updateState.phase = "BACKING_UP";
    if (!persistentMemoryCenter.isReady()) {
      this.updateState.phase = "FAILED";
      this.updateState.lastError = "Cannot backup — memory center not ready";
      return { ok: false, error: this.updateState.lastError };
    }
    const bak = persistentMemoryCenter.createBackup();
    if (!bak.ok) {
      this.updateState.phase = "FAILED";
      this.updateState.lastError = bak.error ?? "Backup failed";
      return { ok: false, error: this.updateState.lastError };
    }
    this.updateState.rollbackAvailable = true;
    this.updateState.phase = "VALIDATING";
    this.updateState.note = `Pre-update backup ${bak.backupId} created. Proceed with trusted installer manually.`;
    return { ok: true, backupId: bak.backupId };
  }

  simulateRollback(): UpdateState {
    if (!this.updateState.rollbackAvailable && !persistentMemoryCenter.listBackups().length) {
      this.updateState.phase = "FAILED";
      this.updateState.lastError = "No rollback point available";
      return this.getUpdateState();
    }
    this.updateState.phase = "ROLLED_BACK";
    this.updateState.note = "Rollback foundation: restore last PMC backup + keep previous app binaries. User data preserved.";
    return this.getUpdateState();
  }

  writeDiagnosticReport(): { ok: boolean; path: string } {
    const report = this.lastReport ?? null;
    const payload = {
      generatedAt: new Date().toISOString(),
      version: APP_VERSION,
      windows: `${os.type()} ${os.release()}`,
      hostname: os.hostname(),
      report,
      services: this.listServices(),
      repairs: this.listRepairLog(20),
      interrupted: this.getInterruptedSession(),
      update: this.getUpdateState(),
    };
    const out = path.join(this.healthRoot, `diagnostic-${Date.now()}.json`);
    fs.writeFileSync(out, redactSecrets(JSON.stringify(payload, null, 2)), "utf8");
    return { ok: true, path: out };
  }

  createSupportBundle(): DiagnosticBundleMeta {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = path.join(resolveStoragePath(this.storageRoot, "backups"), "support-bundles", `support-${stamp}`);
    fs.mkdirSync(dest, { recursive: true });
    const includes: string[] = [];
    const copyIf = (src: string, name: string) => {
      try {
        if (!fs.existsSync(src)) return;
        const target = path.join(dest, name);
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, target, { recursive: true });
        } else {
          fs.copyFileSync(src, target);
        }
        includes.push(name);
      } catch { /* skip */ }
    };
    this.writeDiagnosticReport();
    copyIf(this.healthRoot, "system-health");
    copyIf(path.join(resolveStoragePath(this.storageRoot, "logs"), "desktop-shell.log"), "desktop-shell.log");
    copyIf(path.join(this.appRoot, "package.json"), "package.json");
    const meta: DiagnosticBundleMeta = {
      generatedAt: new Date().toISOString(),
      path: dest,
      includes,
      excluded: ["passwords", "api keys", "tokens", "project media binaries", "full memory dumps"],
    };
    fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(meta, null, 2), "utf8");
    return meta;
  }

  private registerDefaultServices(): void {
    const defs: Array<Omit<RegisteredService, "status" | "lastError" | "lastCheckedAt" | "restartAttempts">> = [
      { id: "local-api", name: "Local API", type: "http", criticality: "required", maxRestarts: 3, port: resolveBindPort() },
      { id: "database", name: "Database", type: "storage", criticality: "required", maxRestarts: 1 },
      { id: "storage", name: "Storage", type: "filesystem", criticality: "required", maxRestarts: 1 },
      { id: "memory", name: "Memory Center", type: "ai-memory", criticality: "required", maxRestarts: 3 },
      { id: "knowledge", name: "Knowledge Center", type: "ai-knowledge", criticality: "required", maxRestarts: 3 },
      { id: "ai-engine", name: "AI Engine", type: "ai", criticality: "optional", maxRestarts: 3 },
      { id: "network", name: "Network / Online Knowledge", type: "network", criticality: "external", maxRestarts: 2 },
    ];
    for (const d of defs) {
      this.services.set(d.id, {
        ...d,
        status: "UNKNOWN",
        lastError: null,
        lastCheckedAt: null,
        restartAttempts: 0,
      });
    }
  }

  private setService(id: string, status: ServiceStatus, error: string | null): void {
    const svc = this.services.get(id);
    if (!svc) return;
    svc.status = status;
    svc.lastError = error;
    svc.lastCheckedAt = new Date().toISOString();
    if (status === "READY") svc.restartAttempts = 0;
  }

  private detectInterruptedSession(): void {
    if (!fs.existsSync(this.crashMarkerPath)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(this.crashMarkerPath, "utf8")) as { at?: string };
      const at = raw.at ?? new Date().toISOString();
      this.pendingInterruptedAt = at;
      fs.writeFileSync(
        this.lastInterruptedPath,
        JSON.stringify({ at, detectedAt: new Date().toISOString(), reason: "previous session interrupted" }, null, 2),
        "utf8",
      );
    } catch {
      this.pendingInterruptedAt = new Date().toISOString();
    }
  }

  private pushRepair(entry: RepairLogEntry): void {
    this.repairLog.unshift(entry);
    this.repairLog.splice(MAX_REPAIR_LOG);
    try {
      fs.writeFileSync(
        path.join(this.healthRoot, "repair-log.json"),
        redactSecrets(JSON.stringify(this.repairLog, null, 2)),
        "utf8",
      );
    } catch { /* ignore */ }
  }

  private loadRepairLog(): void {
    try {
      const p = path.join(this.healthRoot, "repair-log.json");
      if (!fs.existsSync(p)) return;
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as RepairLogEntry[];
      if (Array.isArray(raw)) this.repairLog.push(...raw.slice(0, MAX_REPAIR_LOG));
    } catch { /* ignore */ }
  }

  private appendHealthLog(report: SystemHealthReport): void {
    try {
      const line = `[${report.checkedAt}] score=${report.healthScore} status=${report.overallStatus} issues=${report.issues.length}\n`;
      fs.appendFileSync(path.join(this.healthRoot, "health.log"), line, "utf8");
    } catch { /* ignore */ }
  }
}

export const systemHealthCenter = new SystemHealthCenter();
