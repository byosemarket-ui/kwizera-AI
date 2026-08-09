/**
 * Connectivity detection for Online Research Mode.
 * Offline First: default assumptions stay offline until a probe confirms connectivity.
 */

import dns from "node:dns/promises";
import type {
  ConnectionStability,
  ConnectivitySnapshot,
  NetworkQuality,
} from "./types.js";

export type ConnectivityProbe = () => Promise<{
  online: boolean;
  latencyMs: number | null;
  error?: string;
}>;

/** Offline-first default probe — never touches the network. */
export const offlineConnectivityProbe: ConnectivityProbe = async () => ({
  online: false,
  latencyMs: null,
  error: "Offline-first default probe (no network access).",
});

/** Best-effort DNS probe used only when Professional Research Mode opts into live checks. */
export const dnsConnectivityProbe: ConnectivityProbe = async () => {
  const started = Date.now();
  try {
    await Promise.race([
      dns.lookup("example.com"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("connectivity probe timeout")), 2500)),
    ]);
    return { online: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      online: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

function classifyQuality(latencyMs: number | null, online: boolean): NetworkQuality {
  if (!online || latencyMs == null) return "unavailable";
  if (latencyMs < 120) return "excellent";
  if (latencyMs < 300) return "good";
  if (latencyMs < 800) return "fair";
  return "poor";
}

function classifyStability(samples: Array<{ online: boolean; latencyMs: number | null }>): ConnectionStability {
  if (samples.length === 0) return "unknown";
  const onlineCount = samples.filter((sample) => sample.online).length;
  if (onlineCount === 0) return "offline";
  if (onlineCount === samples.length) {
    const latencies = samples.map((sample) => sample.latencyMs).filter((value): value is number => value != null);
    if (latencies.length >= 2) {
      const avg = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
      const variance = latencies.reduce((sum, value) => sum + (value - avg) ** 2, 0) / latencies.length;
      return variance > 40_000 ? "unstable" : "stable";
    }
    return "stable";
  }
  return "unstable";
}

/** Detects internet availability, quality, and stability while preserving Offline First defaults. */
export class ConnectivityDetector {
  private readonly samples: Array<{ online: boolean; latencyMs: number | null; at: string }> = [];
  private lastSnapshot: ConnectivitySnapshot | null = null;

  constructor(private probe: ConnectivityProbe = offlineConnectivityProbe) {}

  setProbe(probe: ConnectivityProbe): void {
    this.probe = probe;
  }

  getLastSnapshot(): ConnectivitySnapshot | null {
    return this.lastSnapshot ? structuredClone(this.lastSnapshot) : null;
  }

  async detect(): Promise<ConnectivitySnapshot> {
    const result = await this.probe();
    this.samples.push({ online: result.online, latencyMs: result.latencyMs, at: new Date().toISOString() });
    this.samples.splice(0, Math.max(0, this.samples.length - 8));

    const quality = classifyQuality(result.latencyMs, result.online);
    const stability = classifyStability(this.samples);
    const snapshot: ConnectivitySnapshot = {
      checkedAt: new Date().toISOString(),
      internetAvailable: result.online,
      mode: result.online ? "online" : "offline",
      networkQuality: quality,
      connectionStability: stability,
      latencyMs: result.latencyMs,
      professionalResearchMode: result.online,
      detail: result.online
        ? `Internet available (latency=${result.latencyMs ?? "n/a"}ms; quality=${quality}; stability=${stability}).`
        : `Offline mode active. ${result.error ?? "Using local Knowledge Foundation only."}`,
    };
    this.lastSnapshot = snapshot;
    return structuredClone(snapshot);
  }
}
