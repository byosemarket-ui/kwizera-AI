/**
 * STEP 2A/2B subscription registry adapter.
 * Preserves the existing nine-symbol default universe and delegates to
 * HfmSubscriptionManager (no competing subscription managers).
 */
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "./quote-types.js";
import {
  getHfmSubscriptionManager,
  resetHfmSubscriptionManagerForTests,
  HfmSubscriptionManager,
} from "./subscription-manager.js";

export interface HfmQuoteSubscription {
  symbol: string;
  priority: number;
  activatedAt: string;
  source: "default" | "manual" | "step2b";
}

export interface HfmQuoteSubscriptionSnapshot {
  provider: "HFM_MT5";
  environment: "demo";
  maxActive: number;
  active: HfmQuoteSubscription[];
  symbols: string[];
}

/** Hard cap — VPS / Market Watch / payload safety (not full catalog). */
export const HFM_QUOTE_SUBSCRIPTION_MAX = 32;

function sourceFromRequestedBy(requestedBy: string): HfmQuoteSubscription["source"] {
  if (requestedBy === "default") return "default";
  if (requestedBy === "step2b") return "step2b";
  return "manual";
}

function toSnap(mgr: HfmSubscriptionManager): HfmQuoteSubscriptionSnapshot {
  const cap = mgr.capacity();
  const active = mgr
    .listAll()
    .filter((s) => s.status === "ACTIVE" || s.status === "RECOVERING" || s.status === "PAUSED")
    .map((s) => ({
      symbol: s.symbol,
      priority: s.priorityWeight,
      activatedAt: s.createdAt,
      source: sourceFromRequestedBy(s.requestedBy),
    }));
  return {
    provider: "HFM_MT5",
    environment: "demo",
    maxActive: cap.maxActive,
    active,
    symbols: mgr.listAcquisitionSymbols(),
  };
}

export class HfmQuoteSubscriptionRegistry {
  private readonly mgr: HfmSubscriptionManager;
  private readonly isolated: boolean;

  constructor(opts?: { maxActive?: number; seedDefaults?: boolean }) {
    if (opts) {
      this.mgr = new HfmSubscriptionManager({
        maxActive: opts.maxActive,
        seedDefaults: opts.seedDefaults,
      });
      this.isolated = true;
    } else {
      this.mgr = getHfmSubscriptionManager();
      this.isolated = false;
    }
  }

  list(): HfmQuoteSubscriptionSnapshot {
    return toSnap(this.mgr);
  }

  isSubscribed(symbol: string): boolean {
    const row = this.mgr.get(symbol);
    if (!row) return false;
    return row.status === "ACTIVE" || row.status === "RECOVERING" || row.status === "PAUSED";
  }

  activate(
    symbol: string,
    opts?: { priority?: number; source?: HfmQuoteSubscription["source"] },
  ): { ok: boolean; reason: string | null; snapshot: HfmQuoteSubscriptionSnapshot } {
    const r = this.mgr.activateSync(symbol, {
      priority: opts?.priority,
      requestedBy: opts?.source ?? "manual",
    });
    return { ok: r.ok, reason: r.reason, snapshot: this.list() };
  }

  deactivate(symbol: string): HfmQuoteSubscriptionSnapshot {
    this.mgr.deactivateSync(symbol);
    return this.list();
  }

  /** Replace active set (bounded). Empty input restores defaults. */
  replaceAll(symbols: string[], source: HfmQuoteSubscription["source"] = "manual"): HfmQuoteSubscriptionSnapshot {
    this.mgr.replaceActiveSet(symbols, source);
    return this.list();
  }
}

let singleton: HfmQuoteSubscriptionRegistry | null = null;

export function getHfmQuoteSubscriptionRegistry(): HfmQuoteSubscriptionRegistry {
  if (!singleton) singleton = new HfmQuoteSubscriptionRegistry();
  return singleton;
}

export function resetHfmQuoteSubscriptionRegistryForTests(): void {
  singleton = null;
  resetHfmSubscriptionManagerForTests();
}

// Re-export default symbols for callers that imported from this module historically.
export { HFM_DEFAULT_QUOTE_SYMBOLS };
