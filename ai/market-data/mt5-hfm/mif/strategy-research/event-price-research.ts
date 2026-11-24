/**
 * Phase 08 event→price research — correlation windows only; no causation.
 * Uses Phase 07 event shapes + OHLC bars. Fixture source must stay labeled.
 */
import { MIF_STRATEGY_RESEARCH_MAX_EVENT_WINDOWS } from "./contracts.js";
import type { HfmEconomicEvent } from "../../fundamentals/types.js";
import { eventRelevantToSymbol } from "../../fundamentals/impact.js";
import type {
  HfmEventPriceWindowResult,
  HfmResearchBarInput,
  HfmResearchSourceMode,
} from "./types.js";

const WINDOWS: Array<{
  label: HfmEventPriceWindowResult["windowLabel"];
  beforeSec: number;
  afterSec: number;
}> = [
  { label: "BEFORE", beforeSec: 3600, afterSec: 0 },
  { label: "IMMEDIATE", beforeSec: 0, afterSec: 900 },
  { label: "POST", beforeSec: 0, afterSec: 3600 },
  { label: "EXTENDED_POST", beforeSec: 0, afterSec: 14400 },
];

function barsInRange(
  bars: readonly HfmResearchBarInput[],
  startSec: number,
  endSec: number,
): HfmResearchBarInput[] {
  return bars.filter((b) => b.time >= startSec && b.time <= endSec && !b.forming);
}

function pctChange(bars: readonly HfmResearchBarInput[]): {
  priceChangePct: number | null;
  highLowRangePct: number | null;
} {
  if (bars.length < 2) {
    return { priceChangePct: null, highLowRangePct: null };
  }
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  if (!(first.open > 0)) return { priceChangePct: null, highLowRangePct: null };
  const priceChangePct = ((last.close - first.open) / first.open) * 100;
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of bars) {
    hi = Math.max(hi, b.high);
    lo = Math.min(lo, b.low);
  }
  const highLowRangePct = first.open > 0 ? ((hi - lo) / first.open) * 100 : null;
  return { priceChangePct, highLowRangePct };
}

export function researchEventPriceWindows(input: {
  symbol: string;
  events: readonly HfmEconomicEvent[];
  bars: readonly HfmResearchBarInput[];
  sourceMode: HfmResearchSourceMode;
  asOfUtc?: string;
}): HfmEventPriceWindowResult[] {
  const out: HfmEventPriceWindowResult[] = [];
  const relevant = input.events.filter((e) => eventRelevantToSymbol(e, input.symbol));
  for (const e of relevant) {
    if (out.length >= MIF_STRATEGY_RESEARCH_MAX_EVENT_WINDOWS) break;
    const eventSec = e.scheduledTs;
    if (!Number.isFinite(eventSec)) continue;
    for (const w of WINDOWS) {
      if (out.length >= MIF_STRATEGY_RESEARCH_MAX_EVENT_WINDOWS) break;
      const start = eventSec - w.beforeSec;
      const end = eventSec + w.afterSec;
      const slice = barsInRange(input.bars, start, end);
      const { priceChangePct, highLowRangePct } = pctChange(slice);
      const observed = priceChangePct != null;
      out.push({
        eventId: e.eventId,
        eventTitle: e.title,
        currency: e.currency,
        scheduledAtUtc: new Date(eventSec * 1000).toISOString(),
        windowLabel: w.label,
        windowStartUtc: new Date(start * 1000).toISOString(),
        windowEndUtc: new Date(end * 1000).toISOString(),
        priceChangePct,
        highLowRangePct,
        observation: observed ? "DIRECTLY_OBSERVED" : "UNAVAILABLE",
        causationClaimed: false,
        sourceMode: input.sourceMode,
        note: observed
          ? "Temporal price observation only — not causation. Not a trade signal."
          : "Insufficient bars in window",
      });
    }
  }
  return out;
}
