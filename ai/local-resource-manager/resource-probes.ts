import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import type { ProductionMode, ResourceMetrics, WorkloadClass } from "./types.js";

export const MODE_LIMITS: Record<
  ProductionMode,
  { maxPressure: number; maxParallel: number; backgroundThrottle: number; qualityBias: number }
> = {
  "maximum-quality": { maxPressure: 75, maxParallel: 1, backgroundThrottle: 0.85, qualityBias: 1 },
  balanced: { maxPressure: 85, maxParallel: 2, backgroundThrottle: 0.5, qualityBias: 0.6 },
  "maximum-performance": { maxPressure: 92, maxParallel: 3, backgroundThrottle: 0.7, qualityBias: 0.3 },
  "power-saving": { maxPressure: 60, maxParallel: 1, backgroundThrottle: 0.9, qualityBias: 0.4 },
};

export const WORKLOAD_ALLOCATION: Record<
  WorkloadClass,
  { cpuShare: number; gpuShare: number; ramMb: number; vramMb: number; diskMb: number }
> = {
  "image-generation": { cpuShare: 0.35, gpuShare: 0.7, ramMb: 2048, vramMb: 4096, diskMb: 512 },
  "video-generation": { cpuShare: 0.45, gpuShare: 0.85, ramMb: 4096, vramMb: 8192, diskMb: 2048 },
  "audio-generation": { cpuShare: 0.4, gpuShare: 0.2, ramMb: 1024, vramMb: 0, diskMb: 256 },
  rendering: { cpuShare: 0.5, gpuShare: 0.75, ramMb: 3072, vramMb: 6144, diskMb: 4096 },
  "knowledge-processing": { cpuShare: 0.55, gpuShare: 0.1, ramMb: 1536, vramMb: 0, diskMb: 512 },
  learning: { cpuShare: 0.4, gpuShare: 0.35, ramMb: 2048, vramMb: 2048, diskMb: 512 },
  background: { cpuShare: 0.15, gpuShare: 0.05, ramMb: 512, vramMb: 0, diskMb: 128 },
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function probeResourceMetrics(storageRoot?: string | null): ResourceMetrics {
  const cpus = os.cpus();
  const load = os.loadavg()[0] || 0;
  const cpuUsage = clamp(Math.round((load / Math.max(cpus.length, 1)) * 100) || estimateCpuBusy(cpus));
  const freq = cpus[0]?.speed ?? null;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const ramUsage = clamp(Math.round((usedMem / Math.max(totalMem, 1)) * 100));

  let diskUsage = 45;
  let storageUsedGb = 0;
  let storageTotalGb = 256;
  try {
    const root = storageRoot && fs.existsSync(storageRoot) ? storageRoot : process.cwd();
    const statfsSync = (fs as typeof fs & {
      statfsSync?: (p: string) => { bavail: number; blocks: number; bsize: number };
    }).statfsSync;
    if (statfsSync) {
      const stat = statfsSync(path.parse(root).root || root);
      const total = Number(stat.blocks) * Number(stat.bsize);
      const free = Number(stat.bavail) * Number(stat.bsize);
      storageTotalGb = Math.round(total / (1024 ** 3));
      storageUsedGb = Math.round((total - free) / (1024 ** 3));
      diskUsage = clamp(Math.round(((total - free) / Math.max(total, 1)) * 100));
    }
  } catch {
    /* keep heuristic */
  }

  // External probes are opt-in via env to keep validate/tests fast and offline-first.
  const allowExternal = process.env.KWIZERA_LRM_EXTERNAL_PROBES === "1";
  const gpu = allowExternal ? probeGpu() : { usage: 15, tempC: null as number | null, usedMb: null as number | null, totalMb: null as number | null, vramUsage: 10 };
  const battery = allowExternal ? probeBattery() : { percent: null as number | null, charging: null as boolean | null };

  return {
    at: new Date().toISOString(),
    cpuUsage,
    cpuTemperatureC: null,
    cpuFrequencyMhz: freq,
    gpuUsage: gpu.usage,
    gpuTemperatureC: gpu.tempC,
    gpuMemoryUsedMb: gpu.usedMb,
    gpuMemoryTotalMb: gpu.totalMb,
    vramUsage: gpu.vramUsage,
    systemRamUsedMb: Math.round(usedMem / (1024 ** 2)),
    systemRamTotalMb: Math.round(totalMem / (1024 ** 2)),
    ramUsage,
    storageUsedGb,
    storageTotalGb,
    diskUsage,
    storageSpeedMBps: null,
    diskReadMBps: null,
    diskWriteMBps: null,
    batteryPercent: battery.percent,
    batteryCharging: battery.charging,
    source: "live",
  };
}

function estimateCpuBusy(cpus: os.CpuInfo[]): number {
  // Fallback when loadavg is 0 (common on Windows): mild heuristic from times
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  if (total <= 0) return 30;
  return clamp(Math.round((1 - idle / total) * 100));
}

function probeGpu(): {
  usage: number;
  tempC: number | null;
  usedMb: number | null;
  totalMb: number | null;
  vramUsage: number;
} {
  try {
    const stdout = execFileSync(
      "nvidia-smi",
      [
        "--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 1500, windowsHide: true, encoding: "utf8" },
    );
    const parts = stdout.trim().split(/\r?\n/)[0]!.split(",").map((v) => v.trim());
    const usage = Number(parts[0]) || 0;
    const tempC = parts[1] != null && parts[1] !== "" ? Number(parts[1]) : null;
    const usedMb = parts[2] != null ? Number(parts[2]) : null;
    const totalMb = parts[3] != null ? Number(parts[3]) : null;
    const vramUsage =
      usedMb != null && totalMb != null && totalMb > 0
        ? clamp(Math.round((usedMb / totalMb) * 100))
        : 0;
    return { usage: clamp(usage), tempC, usedMb, totalMb, vramUsage };
  } catch {
    return { usage: 15, tempC: null, usedMb: null, totalMb: null, vramUsage: 10 };
  }
}

function probeBattery(): { percent: number | null; charging: boolean | null } {
  try {
    if (process.platform === "win32") {
      const stdout = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", "(Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining,BatteryStatus | ConvertTo-Json -Compress)"],
        { timeout: 2000, windowsHide: true, encoding: "utf8" },
      ).trim();
      if (!stdout || stdout === "null") return { percent: null, charging: null };
      const parsed = JSON.parse(stdout) as { EstimatedChargeRemaining?: number; BatteryStatus?: number };
      const percent = parsed.EstimatedChargeRemaining ?? null;
      const status = parsed.BatteryStatus;
      const charging = status == null ? null : status === 2;
      return { percent, charging };
    }
  } catch {
    /* no battery */
  }
  return { percent: null, charging: null };
}

export function mergeMetrics(
  live: ResourceMetrics,
  override: Partial<ResourceMetrics> | null,
): ResourceMetrics {
  if (!override) return live;
  return {
    ...live,
    ...override,
    at: new Date().toISOString(),
    source: "override",
  };
}

export function mapJobTypeToWorkload(jobType: string): WorkloadClass {
  if (jobType.includes("image-generation") || jobType === "image-enhancement" || jobType === "background-removal") {
    return "image-generation";
  }
  if (jobType.includes("video")) return "video-generation";
  if (jobType.includes("audio") || jobType.includes("music") || jobType === "audio-generation") {
    return "audio-generation";
  }
  if (jobType === "rendering" || jobType === "export") return "rendering";
  if (jobType.includes("knowledge")) return "knowledge-processing";
  if (jobType.includes("learning") || jobType === "ai-learning") return "learning";
  return "background";
}

export function recommendMode(metrics: ResourceMetrics, onBattery: boolean): ProductionMode {
  if (onBattery || (metrics.batteryPercent != null && metrics.batteryPercent < 30 && metrics.batteryCharging === false)) {
    return "power-saving";
  }
  const pressure = Math.max(metrics.cpuUsage, metrics.gpuUsage, metrics.ramUsage, metrics.vramUsage, metrics.diskUsage);
  if (pressure > 80) return "balanced";
  if (pressure < 40 && metrics.gpuMemoryTotalMb && metrics.gpuMemoryTotalMb >= 6144) return "maximum-quality";
  if (pressure < 50) return "maximum-performance";
  return "balanced";
}
