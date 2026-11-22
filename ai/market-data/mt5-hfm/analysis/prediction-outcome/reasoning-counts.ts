/**
 * P8.D — bounded read-only reasoning-store population counts.
 * Does not invent totals. Returns UNAVAILABLE when storage cannot be scanned safely.
 */
import { HfmReasoningStorage } from "../reasoning/storage.js";
import type { HfmChartsReasoningPopulationCounts } from "./analytics-types.js";

const MAX_SCAN = 5_000;

export async function scanReasoningPopulationCounts(input?: {
  storage?: HfmReasoningStorage;
  storageRoot?: string;
  startUtc?: string | null;
  endUtc?: string | null;
  maxScan?: number;
}): Promise<HfmChartsReasoningPopulationCounts> {
  try {
    const storage =
      input?.storage
      ?? new HfmReasoningStorage(input?.storageRoot);
    await storage.ensureReady();
    // list() caps at 100; scan via readdir path for authoritative bounded census.
    const fs = await import("node:fs/promises");
    const names = (await fs.readdir(storage.root)).filter((n) => n.endsWith(".json"));
    const maxScan = Math.min(input?.maxScan ?? MAX_SCAN, MAX_SCAN);
    const startMs = input?.startUtc ? Date.parse(input.startUtc) : null;
    const endMs = input?.endUtc ? Date.parse(input.endUtc) : null;

    let scanned = 0;
    let completed = 0;
    let failed = 0;
    let rejected = 0;
    let buy = 0;
    let sell = 0;
    let noTrade = 0;
    let waiting = 0;
    let withPredictionLinkage = 0;
    let withoutPredictionLinkage = 0;

    for (const name of names.slice(0, maxScan)) {
      const rec = await storage.load(name.slice(0, -5));
      if (!rec) continue;
      scanned += 1;

      if (startMs != null || endMs != null) {
        const t = Date.parse(String(rec.createdAt || ""));
        if (!Number.isFinite(t)) continue;
        if (startMs != null && t < startMs) continue;
        if (endMs != null && t > endMs) continue;
      }

      const status = String(rec.status || "").toUpperCase();
      if (status === "COMPLETED") completed += 1;
      else if (status === "FAILED") failed += 1;
      else if (status === "REJECTED") rejected += 1;

      const action = String(rec.result?.decision?.action || "").toUpperCase();
      if (action === "BUY") buy += 1;
      else if (action === "SELL") sell += 1;
      else if (action === "NO_TRADE") noTrade += 1;
      else if (action === "WAITING_FOR_CONFIRMATION") waiting += 1;

      const link = rec.predictionLinkage;
      if (link && typeof link === "object" && (link.predictionId || link.status)) {
        withPredictionLinkage += 1;
      } else {
        withoutPredictionLinkage += 1;
      }
    }

    return {
      authority: "REASONING_STORE",
      unavailableReason: null,
      scanned,
      completed,
      failed,
      rejected,
      buy,
      sell,
      noTrade,
      waiting,
      withPredictionLinkage,
      withoutPredictionLinkage,
      timeBasis: "reasoning.createdAt",
    };
  } catch (err) {
    return {
      authority: "UNAVAILABLE",
      unavailableReason:
        err instanceof Error ? err.message.slice(0, 200) : "reasoning store scan failed",
      scanned: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      buy: 0,
      sell: 0,
      noTrade: 0,
      waiting: 0,
      withPredictionLinkage: 0,
      withoutPredictionLinkage: 0,
      timeBasis: "reasoning.createdAt",
    };
  }
}
