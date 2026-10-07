/**
 * Entry zone from objective Phase 18 structure (BASIC_SWINGS) + ATR padding.
 * No fabricated support/resistance — Market State.supportResistance is always null.
 */
import type { ForexBinanceMarketState } from "../../forex-market-state/types.js";
import type { ForexMultiTimeframeMarketState } from "../mtf/types.js";
import { FOREX_ENTRY_ZONE_ATR_PAD } from "./config.js";
import type { ForexDecisionScenario, ForexEntryZone } from "./types.js";

function pickPrimaryState(mtf: ForexMultiTimeframeMarketState): ForexBinanceMarketState | null {
  const prefer = ["15m", "1h", "30m", "5m", "4h"] as const;
  for (const tf of prefer) {
    const slot = mtf.slots.find((s) => s.timeframe === tf && s.marketState);
    if (slot?.marketState?.marketStructure?.structureState === "BASIC_SWINGS") {
      return slot.marketState;
    }
  }
  for (const slot of mtf.slots) {
    if (slot.marketState) return slot.marketState;
  }
  return null;
}

function unavailable(
  symbol: string,
  scenario: ForexDecisionScenario,
  reason: string,
  currentPrice: number | null,
  dataQuality: string,
): ForexEntryZone {
  return {
    id: `entry-unavailable-${symbol}`,
    symbol,
    timeframe: null,
    scenario: scenario.type,
    status: "UNAVAILABLE",
    lowerBound: null,
    upperBound: null,
    referencePrice: null,
    currentPrice,
    basis: [],
    supportingFacts: [],
    confirmationRequired: [],
    invalidationLevel: null,
    createdAt: new Date().toISOString(),
    dataTimestamp: null,
    dataQuality,
    unavailableReason: reason,
  };
}

/**
 * Derive a candidate entry zone only from lastSwingHigh/Low + optional ATR pad.
 * If BASIC_SWINGS or swings are missing → ENTRY_ZONE_UNAVAILABLE.
 */
export function buildEntryZone(
  mtf: ForexMultiTimeframeMarketState,
  scenario: ForexDecisionScenario,
): ForexEntryZone {
  const symbol = mtf.symbol;
  const state = pickPrimaryState(mtf);
  const currentPrice = state?.price?.last
    ?? mtf.slots.find((s) => s.compact.price != null)?.compact.price
    ?? null;

  if (scenario.type === "INSUFFICIENT_DATA" || scenario.type === "CONFLICT" || scenario.type === "WAIT") {
    return unavailable(
      symbol,
      scenario,
      `Entry zone not applicable while scenario is ${scenario.type}.`,
      currentPrice,
      mtf.dataQuality,
    );
  }

  if (!state) {
    return unavailable(symbol, scenario, "No Market State available for entry zone derivation.", currentPrice, mtf.dataQuality);
  }

  // Explicit: no dedicated S/R engine — never invent levels from null supportResistance
  if (state.supportResistance !== null) {
    // Defensive — Phase 18 contract is always null
  }

  const structure = state.marketStructure;
  if (!structure || structure.structureState !== "BASIC_SWINGS") {
    return unavailable(
      symbol,
      scenario,
      "ENTRY_ZONE_UNAVAILABLE — market structure is not BASIC_SWINGS (insufficient swing window).",
      currentPrice,
      mtf.dataQuality,
    );
  }

  const swingHigh = structure.lastSwingHigh;
  const swingLow = structure.lastSwingLow;
  if (swingHigh == null || swingLow == null || !Number.isFinite(swingHigh) || !Number.isFinite(swingLow)) {
    return unavailable(
      symbol,
      scenario,
      "ENTRY_ZONE_UNAVAILABLE — lastSwingHigh/lastSwingLow not established.",
      currentPrice,
      mtf.dataQuality,
    );
  }
  if (swingHigh <= swingLow) {
    return unavailable(
      symbol,
      scenario,
      "ENTRY_ZONE_UNAVAILABLE — invalid swing high/low relationship.",
      currentPrice,
      mtf.dataQuality,
    );
  }

  const atr = state.volatility?.atr ?? state.indicators?.atr14 ?? null;
  const pad = atr != null && Number.isFinite(atr) && atr > 0 ? atr * FOREX_ENTRY_ZONE_ATR_PAD : 0;

  let lowerBound: number;
  let upperBound: number;
  let referencePrice: number;
  let invalidationLevel: number | null;
  const basis: string[] = [
    `${state.timeframe} marketStructure.structureState=BASIC_SWINGS`,
    `${state.timeframe} lastSwingLow=${swingLow}`,
    `${state.timeframe} lastSwingHigh=${swingHigh}`,
  ];
  if (atr != null) basis.push(`${state.timeframe} ATR14=${atr} (pad×${FOREX_ENTRY_ZONE_ATR_PAD})`);
  else basis.push("ATR unavailable — zone uses raw swing bounds only");

  // Bullish scenarios: zone near swing low (pullback toward structure)
  // Bearish scenarios: zone near swing high
  if (scenario.direction === "BULLISH") {
    referencePrice = swingLow;
    lowerBound = swingLow - pad;
    upperBound = Math.min(swingLow + pad * 2, (swingLow + swingHigh) / 2);
    invalidationLevel = swingLow - (pad || 0);
  } else if (scenario.direction === "BEARISH") {
    referencePrice = swingHigh;
    upperBound = swingHigh + pad;
    lowerBound = Math.max(swingHigh - pad * 2, (swingLow + swingHigh) / 2);
    invalidationLevel = swingHigh + (pad || 0);
  } else {
    // Neutral/range — mid-range watch band from swings (still factual bounds)
    referencePrice = (swingLow + swingHigh) / 2;
    lowerBound = swingLow;
    upperBound = swingHigh;
    invalidationLevel = null;
    basis.push("Neutral scenario uses full swing range as observation band, not an entry instruction.");
  }

  if (!(upperBound > lowerBound) || !Number.isFinite(lowerBound) || !Number.isFinite(upperBound)) {
    return unavailable(symbol, scenario, "ENTRY_ZONE_UNAVAILABLE — computed bounds invalid.", currentPrice, mtf.dataQuality);
  }

  const supportingFacts = [
    `symbol=${symbol}`,
    `timeframe=${state.timeframe}`,
    `currentPrice=${currentPrice ?? "UNAVAILABLE"}`,
    `scenario=${scenario.type}`,
    ...scenario.evidence.slice(0, 4),
  ];

  return {
    id: `entry-${symbol}-${state.timeframe}-${scenario.type}`,
    symbol,
    timeframe: state.timeframe,
    scenario: scenario.type,
    status: "WAITING_CONFIRMATION",
    lowerBound,
    upperBound,
    referencePrice,
    currentPrice,
    basis,
    supportingFacts,
    confirmationRequired: [
      "Higher timeframe bias remains consistent with scenario direction",
      "Lower timeframe structure/momentum confirmation",
    ],
    invalidationLevel,
    createdAt: new Date().toISOString(),
    dataTimestamp: state.lastMarketUpdate != null
      ? new Date(state.lastMarketUpdate).toISOString()
      : null,
    dataQuality: state.dataQuality.stale ? "STALE" : state.dataQuality.connection,
    unavailableReason: null,
  };
}
