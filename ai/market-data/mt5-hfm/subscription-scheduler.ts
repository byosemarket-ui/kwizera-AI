/**
 * STEP 2B — priority-aware fair round-robin acquisition scheduler (bounded).
 * Integrates with STEP 2A acquisition; does not create OnTick polling.
 */
import { getHfmSubscriptionManager } from "./subscription-manager.js";
import {
  HFM_SUB_ENVIRONMENT,
  HFM_SUB_PROVIDER,
  HFM_SUBSCRIPTION_DEFAULTS,
  type HfmSchedulerStatus,
  type HfmSubscriptionRecord,
} from "./subscription-types.js";

export class HfmSubscriptionScheduler {
  private cursor = 0;
  private cycleInFlight = false;
  private overlappingPrevented = 0;
  private missedCycles = 0;
  private lastCycleAt: string | null = null;
  private lastCycleDurationMs: number | null = null;
  private lastSymbolsScheduled: string[] = [];
  private readonly batchSize: number;
  private readonly acquisitionIntervalMs: number;

  constructor(opts?: { batchSize?: number; acquisitionIntervalMs?: number }) {
    this.batchSize = Math.max(1, opts?.batchSize ?? HFM_SUBSCRIPTION_DEFAULTS.maxBatch);
    this.acquisitionIntervalMs = Math.max(
      1000,
      opts?.acquisitionIntervalMs ?? HFM_SUBSCRIPTION_DEFAULTS.acquisitionIntervalMs,
    );
  }

  /**
   * Select next acquisition batch using priority-weighted fair round-robin.
   * Higher priority symbols appear more often but low priority is never starved.
   */
  nextBatch(now = Date.now()): {
    symbols: string[];
    deferred: Array<{ symbol: string; reason: string }>;
    skippedOverlap: boolean;
  } {
    if (this.cycleInFlight) {
      this.overlappingPrevented += 1;
      this.missedCycles += 1;
      return { symbols: [], deferred: [], skippedOverlap: true };
    }

    const mgr = getHfmSubscriptionManager();
    const eligible = mgr
      .listAll()
      .filter((s) => s.status === "ACTIVE" || s.status === "RECOVERING");

    if (eligible.length === 0) {
      return { symbols: [], deferred: [], skippedOverlap: false };
    }

    // Build a weighted ring: CRITICAL x4, HIGH x3, NORMAL x2, LOW x1
    const ring: HfmSubscriptionRecord[] = [];
    for (const s of eligible) {
      const reps =
        s.priority === "CRITICAL" ? 4 : s.priority === "HIGH" ? 3 : s.priority === "NORMAL" ? 2 : 1;
      for (let i = 0; i < reps; i++) ring.push(s);
    }

    const picked: string[] = [];
    const seen = new Set<string>();
    const deferred: Array<{ symbol: string; reason: string }> = [];
    let steps = 0;
    while (picked.length < this.batchSize && steps < ring.length) {
      const idx = (this.cursor + steps) % ring.length;
      const row = ring[idx]!;
      steps += 1;
      if (seen.has(row.symbol)) continue;
      seen.add(row.symbol);
      if (picked.length >= this.batchSize) {
        deferred.push({ symbol: row.symbol, reason: "BATCH_CAPACITY" });
        mgr.markDelayedForCapacity(row.symbol, true);
        continue;
      }
      mgr.markDelayedForCapacity(row.symbol, false);
      picked.push(row.symbol);
    }
    this.cursor = (this.cursor + Math.max(1, steps)) % Math.max(1, ring.length);
    this.lastSymbolsScheduled = picked;
    this.lastCycleAt = new Date(now).toISOString();
    return { symbols: picked, deferred, skippedOverlap: false };
  }

  beginCycle(): boolean {
    if (this.cycleInFlight) {
      this.overlappingPrevented += 1;
      return false;
    }
    this.cycleInFlight = true;
    return true;
  }

  endCycle(durationMs: number): void {
    this.cycleInFlight = false;
    this.lastCycleDurationMs = durationMs;
  }

  status(): HfmSchedulerStatus {
    return {
      provider: HFM_SUB_PROVIDER,
      environment: HFM_SUB_ENVIRONMENT,
      acquisitionIntervalMs: this.acquisitionIntervalMs,
      batchSize: this.batchSize,
      lastCycleAt: this.lastCycleAt,
      lastCycleDurationMs: this.lastCycleDurationMs,
      lastSymbolsScheduled: [...this.lastSymbolsScheduled],
      overlappingPrevented: this.overlappingPrevented,
      missedCycles: this.missedCycles,
      roundRobinCursor: this.cursor,
    };
  }
}

let singleton: HfmSubscriptionScheduler | null = null;

export function getHfmSubscriptionScheduler(): HfmSubscriptionScheduler {
  if (!singleton) singleton = new HfmSubscriptionScheduler();
  return singleton;
}

export function resetHfmSubscriptionSchedulerForTests(): void {
  singleton = null;
}
