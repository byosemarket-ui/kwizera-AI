/**
 * STEP 2A subscription registry — interface for STEP 2B lifecycle.
 * Default preserves the existing nine-symbol quote universe.
 * Never auto-activates the full HFM catalog.
 */
import { HFM_DEFAULT_QUOTE_SYMBOLS } from "./quote-types.js";

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

export class HfmQuoteSubscriptionRegistry {
  private readonly maxActive: number;
  private readonly bySymbol = new Map<string, HfmQuoteSubscription>();

  constructor(opts?: { maxActive?: number; seedDefaults?: boolean }) {
    this.maxActive = Math.min(
      HFM_QUOTE_SUBSCRIPTION_MAX,
      Math.max(1, opts?.maxActive ?? HFM_DEFAULT_QUOTE_SYMBOLS.length),
    );
    if (opts?.seedDefaults !== false) {
      for (const [i, symbol] of HFM_DEFAULT_QUOTE_SYMBOLS.entries()) {
        this.bySymbol.set(symbol, {
          symbol,
          priority: 1000 - i,
          activatedAt: new Date().toISOString(),
          source: "default",
        });
      }
    }
  }

  list(): HfmQuoteSubscriptionSnapshot {
    const active = [...this.bySymbol.values()].sort((a, b) => b.priority - a.priority);
    return {
      provider: "HFM_MT5",
      environment: "demo",
      maxActive: this.maxActive,
      active,
      symbols: active.map((s) => s.symbol),
    };
  }

  isSubscribed(symbol: string): boolean {
    if (this.bySymbol.has(symbol)) return true;
    const u = symbol.toUpperCase();
    for (const key of this.bySymbol.keys()) {
      if (key.toUpperCase() === u) return true;
    }
    return false;
  }

  /**
   * Activate a symbol. Rejects when over cap unless replacing an existing entry.
   * Exact broker spelling preferred; does not rename.
   */
  activate(
    symbol: string,
    opts?: { priority?: number; source?: HfmQuoteSubscription["source"] },
  ): { ok: boolean; reason: string | null; snapshot: HfmQuoteSubscriptionSnapshot } {
    const sym = String(symbol ?? "").trim();
    if (!sym) {
      return { ok: false, reason: "SYMBOL_EMPTY", snapshot: this.list() };
    }
    if (this.bySymbol.has(sym) || this.isSubscribed(sym)) {
      const existing =
        this.bySymbol.get(sym) ??
        [...this.bySymbol.values()].find((s) => s.symbol.toUpperCase() === sym.toUpperCase())!;
      existing.priority = opts?.priority ?? existing.priority;
      existing.source = opts?.source ?? existing.source;
      this.bySymbol.set(existing.symbol, existing);
      return { ok: true, reason: null, snapshot: this.list() };
    }
    if (this.bySymbol.size >= this.maxActive) {
      return { ok: false, reason: "SUBSCRIPTION_LIMIT", snapshot: this.list() };
    }
    this.bySymbol.set(sym, {
      symbol: sym,
      priority: opts?.priority ?? 100,
      activatedAt: new Date().toISOString(),
      source: opts?.source ?? "manual",
    });
    return { ok: true, reason: null, snapshot: this.list() };
  }

  deactivate(symbol: string): HfmQuoteSubscriptionSnapshot {
    const sym = String(symbol ?? "").trim();
    if (this.bySymbol.delete(sym)) return this.list();
    const u = sym.toUpperCase();
    for (const key of [...this.bySymbol.keys()]) {
      if (key.toUpperCase() === u) this.bySymbol.delete(key);
    }
    return this.list();
  }

  /** Replace active set (bounded). Empty input restores defaults. */
  replaceAll(symbols: string[], source: HfmQuoteSubscription["source"] = "manual"): HfmQuoteSubscriptionSnapshot {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const s of symbols) {
      const sym = String(s ?? "").trim();
      if (!sym) continue;
      const key = sym.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(sym);
      if (unique.length >= this.maxActive) break;
    }
    this.bySymbol.clear();
    const seed = unique.length > 0 ? unique : [...HFM_DEFAULT_QUOTE_SYMBOLS];
    for (const [i, symbol] of seed.entries()) {
      this.bySymbol.set(symbol, {
        symbol,
        priority: 1000 - i,
        activatedAt: new Date().toISOString(),
        source: unique.length > 0 ? source : "default",
      });
    }
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
}
