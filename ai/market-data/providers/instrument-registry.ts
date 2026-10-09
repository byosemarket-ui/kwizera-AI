/**
 * Central instrument registry — Phase 31.
 * Provider adapters feed this; consumers never hold separate Binance/FXCM registries.
 */
import { marketIdentityKey, normalizeCanonicalSymbol, type MarketIdentity } from "./identity.js";
import type { MarketAssetType, MarketInstrument, MarketProviderId } from "./types.js";

export class MarketInstrumentRegistry {
  private readonly byKey = new Map<string, MarketInstrument>();

  clear(): void {
    this.byKey.clear();
  }

  upsert(instrument: MarketInstrument): void {
    const key = marketIdentityKey({
      provider: instrument.provider,
      marketType: instrument.marketType,
      symbol: instrument.canonicalSymbol || instrument.providerSymbol,
    });
    this.byKey.set(key, instrument);
  }

  upsertMany(instruments: MarketInstrument[]): void {
    for (const instrument of instruments) this.upsert(instrument);
  }

  getInstrument(identity: Pick<MarketIdentity, "provider" | "marketType" | "canonicalSymbol">): MarketInstrument | null {
    const key = marketIdentityKey({
      provider: identity.provider,
      marketType: identity.marketType,
      symbol: identity.canonicalSymbol,
    });
    return this.byKey.get(key) ?? null;
  }

  findByCanonical(provider: MarketProviderId, canonicalSymbol: string): MarketInstrument | null {
    const compact = normalizeCanonicalSymbol(canonicalSymbol);
    for (const instrument of this.byKey.values()) {
      if (instrument.provider !== provider) continue;
      if (normalizeCanonicalSymbol(instrument.canonicalSymbol) === compact) return instrument;
    }
    return null;
  }

  findByProviderSymbol(provider: MarketProviderId, providerSymbol: string): MarketInstrument | null {
    const target = String(providerSymbol).trim().toUpperCase();
    const compact = normalizeCanonicalSymbol(providerSymbol);
    for (const instrument of this.byKey.values()) {
      if (instrument.provider !== provider) continue;
      if (instrument.providerSymbol.toUpperCase() === target) return instrument;
      if (normalizeCanonicalSymbol(instrument.providerSymbol) === compact) return instrument;
      if (normalizeCanonicalSymbol(instrument.canonicalSymbol) === compact) return instrument;
    }
    return null;
  }

  search(query: string, options?: {
    provider?: MarketProviderId | null;
    marketType?: MarketAssetType | null;
    limit?: number;
  }): MarketInstrument[] {
    const q = String(query ?? "").trim().toUpperCase();
    const limit = options?.limit ?? 100;
    const out: MarketInstrument[] = [];
    for (const instrument of this.byKey.values()) {
      if (options?.provider && instrument.provider !== options.provider) continue;
      if (options?.marketType && instrument.marketType !== options.marketType) continue;
      if (q) {
        const hay = [
          instrument.providerSymbol,
          instrument.canonicalSymbol,
          instrument.displaySymbol,
          instrument.baseAsset ?? "",
          instrument.quoteAsset ?? "",
        ].join(" ").toUpperCase();
        if (!hay.includes(q)) continue;
      }
      out.push(instrument);
      if (out.length >= limit) break;
    }
    return out;
  }

  listByProvider(provider: MarketProviderId): MarketInstrument[] {
    return [...this.byKey.values()].filter((item) => item.provider === provider);
  }

  listByMarketType(marketType: MarketAssetType): MarketInstrument[] {
    return [...this.byKey.values()].filter((item) => item.marketType === marketType);
  }

  listAll(): MarketInstrument[] {
    return [...this.byKey.values()];
  }

  size(): number {
    return this.byKey.size;
  }
}

export function createMarketInstrumentRegistry(): MarketInstrumentRegistry {
  return new MarketInstrumentRegistry();
}
