import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiModelManager } from "../model-management/ai-model-manager.js";
import type { HardwareSnapshot } from "../model-management/types.js";

export interface ProductionHardwarePlan {
  backend: "cuda" | "directml" | "cpu";
  inferenceParallelism: number;
  cpuWorkers: number;
  gpuAvailable: boolean;
  cudaAvailable: boolean;
  directMlSupported: boolean;
  onnxRuntimeAvailable: boolean;
  rationale: string;
}

export interface ProductionMonitoringSnapshot {
  capturedAt: string;
  cpuUsagePercent: number;
  ramUsedMb: number;
  ramFreeMb: number;
  storageFreeMb: number;
  inference: Awaited<ReturnType<AiModelManager["runtimeStatus"]>>;
  hardware: HardwareSnapshot;
  plan: ProductionHardwarePlan;
}

export interface ProductionRecoveryResult {
  cleanedTemporaryFiles: number;
  inferenceCapacity: number;
  recoveredAt: string;
}

/**
 * Production control for the existing generation optimizer. It reports only
 * verified local capabilities and never claims an unavailable accelerator.
 */
export class ProductionOptimizationEngine {
  private root = "";
  private models: AiModelManager | null = null;
  private plan: ProductionHardwarePlan | null = null;
  private readonly history: ProductionMonitoringSnapshot[] = [];
  private recoveries = 0;

  async initialize(storageRoot: string, models: AiModelManager): Promise<void> {
    this.root = path.join(storageRoot, "generation-optimization-runtime", "production");
    this.models = models;
    await fs.mkdir(path.join(this.root, "temporary"), { recursive: true });
    await this.restore();
    await this.refresh();
  }

  async refresh(): Promise<ProductionMonitoringSnapshot> {
    this.ensureReady();
    const hardware = await this.models!.detectHardware();
    this.plan = createHardwarePlan(hardware, this.models!.settings.get());
    this.models!.inference.setMaxParallel(this.plan.inferenceParallelism);
    const [inference, storage] = await Promise.all([this.models!.runtimeStatus(), fs.statfs(this.root)]);
    const processUsage = process.cpuUsage();
    const uptimeMicros = Math.max(1, process.uptime() * 1_000_000);
    const snapshot: ProductionMonitoringSnapshot = {
      capturedAt: new Date().toISOString(),
      cpuUsagePercent: Math.min(100, Math.round(((processUsage.user + processUsage.system) / uptimeMicros) * 100)),
      ramUsedMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      ramFreeMb: hardware.ram.freeMb,
      storageFreeMb: Math.round((storage.bavail * storage.bsize) / 1024 / 1024),
      inference,
      hardware,
      plan: { ...this.plan },
    };
    this.history.unshift(snapshot);
    this.history.splice(100);
    await this.persist();
    return snapshot;
  }

  async recover(): Promise<ProductionRecoveryResult> {
    this.ensureReady();
    const cleanedTemporaryFiles = await this.cleanupTemporaryFiles();
    const snapshot = await this.refresh();
    this.recoveries += 1;
    await this.persist();
    return { cleanedTemporaryFiles, inferenceCapacity: snapshot.plan.inferenceParallelism, recoveredAt: new Date().toISOString() };
  }

  getDashboard(): { latest: ProductionMonitoringSnapshot | null; history: ProductionMonitoringSnapshot[]; recoveryCount: number } {
    return { latest: this.history[0] ?? null, history: this.history.map((entry) => structuredClone(entry)), recoveryCount: this.recoveries };
  }

  getTemporaryDirectory(): string {
    this.ensureReady();
    return path.join(this.root, "temporary");
  }

  private async cleanupTemporaryFiles(): Promise<number> {
    const temporary = this.getTemporaryDirectory();
    const cutoff = Date.now() - 24 * 60 * 60_000;
    const entries = await fs.readdir(temporary, { withFileTypes: true });
    let removed = 0;
    for (const entry of entries) {
      const target = path.join(temporary, entry.name);
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) continue;
      if (stat.mtimeMs < cutoff) {
        await fs.rm(target, { recursive: entry.isDirectory(), force: true });
        removed += 1;
      }
    }
    return removed;
  }

  private ensureReady(): void {
    if (!this.root || !this.models) throw new Error("Production optimization engine is not initialized");
  }

  private async restore(): Promise<void> {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.root, "monitoring.json"), "utf8")) as { history?: ProductionMonitoringSnapshot[]; recoveries?: number };
      this.history.push(...(saved.history ?? []).slice(0, 100));
      this.recoveries = saved.recoveries ?? 0;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async persist(): Promise<void> {
    const target = path.join(this.root, "monitoring.json");
    const temporary = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify({ history: this.history, recoveries: this.recoveries }, null, 2)}\n`, "utf8");
    await fs.rename(temporary, target);
  }
}

function createHardwarePlan(hardware: HardwareSnapshot, settings: { preferGpu: boolean }): ProductionHardwarePlan {
  const cudaAvailable = hardware.gpu.available;
  const directMlSupported = process.platform === "win32";
  const onnxRuntimeAvailable = Boolean(process.env.ONNXRUNTIME_HOME || process.env.ORT_DML_AVAILABLE);
  const backend = settings.preferGpu && cudaAvailable ? "cuda" : settings.preferGpu && directMlSupported && onnxRuntimeAvailable ? "directml" : "cpu";
  const cpuWorkers = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2) || 1));
  const inferenceParallelism = backend === "cuda" ? (hardware.gpu.memoryMb ?? 0) >= 16_384 ? 2 : 1 : Math.min(2, cpuWorkers);
  return {
    backend,
    inferenceParallelism,
    cpuWorkers,
    gpuAvailable: hardware.gpu.available,
    cudaAvailable,
    directMlSupported,
    onnxRuntimeAvailable,
    rationale: backend === "cuda" ? "NVIDIA GPU was verified through local hardware detection." : backend === "directml" ? "DirectML support and an ONNX Runtime capability flag were detected." : "No verified local GPU execution backend is available; CPU concurrency is bounded.",
  };
}