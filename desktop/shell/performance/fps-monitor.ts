import type { PerformanceMetricsSample } from "./types";

export class FpsMonitor {
  private frames = 0;
  private lastTs = 0;
  private fps = 60;
  private lagMs = 0;
  private raf = 0;
  private running = false;

  start(): void {
    if (this.running || typeof requestAnimationFrame === "undefined") return;
    this.running = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.frames += 1;
      const delta = ts - this.lastTs;
      if (delta >= 1000) {
        this.fps = Math.round((this.frames * 1000) / delta);
        this.lagMs = Math.max(0, Math.round(delta / Math.max(this.frames, 1) - 16.7));
        this.frames = 0;
        this.lastTs = ts;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  sample(): { fps: number; uiLagMs: number } {
    return { fps: this.fps, uiLagMs: this.lagMs };
  }
}

export async function collectClientResourceHints(): Promise<{
  jsHeapMb: number | null;
  diskUsedGb: number;
  diskTotalGb: number;
  diskUsage: number;
  deviceMemoryGb: number | null;
  cores: number;
}> {
  let jsHeapMb: number | null = null;
  const perfMemory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  if (perfMemory?.usedJSHeapSize) {
    jsHeapMb = Math.round(perfMemory.usedJSHeapSize / (1024 * 1024));
  }

  let diskUsedGb = 0;
  let diskTotalGb = 0;
  let diskUsage = 0;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 0;
      diskUsedGb = Math.round((usage / (1024 ** 3)) * 10) / 10;
      diskTotalGb = Math.round((quota / (1024 ** 3)) * 10) / 10;
      diskUsage = quota ? Math.round((usage / quota) * 100) : 0;
    }
  } catch {
    /* offline / denied */
  }

  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  return {
    jsHeapMb,
    diskUsedGb,
    diskTotalGb,
    diskUsage,
    deviceMemoryGb: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? 4,
  };
}

export function mergeMetricsSample(
  fps: { fps: number; uiLagMs: number },
  api: {
    memoryMb?: number;
    cpuUserMs?: number;
    gpu?: string;
    activeJobs?: number;
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    ramTotalMb?: number;
    vramUsage?: number;
    diskUsage?: number;
    diskUsedGb?: number;
    diskTotalGb?: number;
    activeAiModels?: number;
  } | null | undefined,
  client: Awaited<ReturnType<typeof collectClientResourceHints>>,
): PerformanceMetricsSample {
  const ramUsedMb = api?.memoryMb ?? client.jsHeapMb ?? 0;
  const ramTotalMb = api?.ramTotalMb ?? (client.deviceMemoryGb ? client.deviceMemoryGb * 1024 : Math.max(ramUsedMb * 2, 8192));
  const ramUsage = api?.ramUsage ?? Math.min(100, Math.round((ramUsedMb / Math.max(ramTotalMb, 1)) * 100));
  const gpuLabel = api?.gpu ?? "unavailable";
  const gpuUsage = api?.gpuUsage ?? (gpuLabel === "unavailable" ? 12 : 30);

  return {
    at: new Date().toISOString(),
    fps: fps.fps,
    uiLagMs: fps.uiLagMs,
    cpuUsage: api?.cpuUsage ?? Math.min(100, Math.round((api?.cpuUserMs ?? 0) / 100) || 18),
    gpuUsage,
    ramUsage,
    ramUsedMb,
    ramTotalMb,
    vramUsage: api?.vramUsage ?? Math.round(gpuUsage * 0.8),
    diskUsage: api?.diskUsage ?? client.diskUsage,
    diskUsedGb: api?.diskUsedGb ?? client.diskUsedGb,
    diskTotalGb: api?.diskTotalGb ?? client.diskTotalGb,
    jsHeapMb: client.jsHeapMb,
    activeAiModels: api?.activeAiModels ?? (api?.activeJobs && api.activeJobs > 0 ? 1 : 0),
    activeProductionTasks: api?.activeJobs ?? 0,
    source: api ? "api" : "heuristic",
  };
}

export const fpsMonitor = new FpsMonitor();
