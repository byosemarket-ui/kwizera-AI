/**
 * STEP 2 — HFM tick acquisition helpers (CopyTicks + OnTick chart tick).
 */
import { callMt5HfmAgent } from "./agent-client.js";
import {
  isValidHfmTick,
  normalizeTickStream,
  type HfmValidatedTick,
} from "./live-candle-engine.js";

export interface HfmTickFetchResult {
  provider: "HFM_MT5";
  environment: "demo";
  symbol: string;
  available: boolean;
  ticks: HfmValidatedTick[];
  count: number;
  source: string | null;
  acquisition: "CopyTicks" | "OnTick" | "unavailable";
  errors: string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export async function fetchHfmTicks(opts: {
  symbol: string;
  limit?: number;
  fromMs?: number;
  toMs?: number;
}): Promise<HfmTickFetchResult> {
  const symbol = String(opts.symbol || "").trim().toUpperCase();
  const limit = Math.min(500, Math.max(1, Number(opts.limit ?? 100) || 100));
  const agentRes = await callMt5HfmAgent("demo.ticks", {
    symbol,
    limit,
    fromMs: opts.fromMs ?? 0,
    toMs: opts.toMs ?? 0,
  });
  const result = (agentRes.result ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(result.ticks) ? result.ticks : [];
  const receiveMs = Date.now();
  const mapped: HfmValidatedTick[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const bid = typeof r.bid === "number" ? r.bid : Number(r.bid);
    const ask = typeof r.ask === "number" ? r.ask : Number(r.ask);
    const timeSec = typeof r.time === "number" ? r.time : Number(r.time);
    const tick: HfmValidatedTick = {
      symbol,
      bid,
      ask,
      last: typeof r.last === "number" ? r.last : null,
      timeSec,
      timeMsc: typeof r.timeMsc === "number" ? r.timeMsc : null,
      receiveMs,
      volume: typeof r.volume === "number" ? r.volume : null,
      flags: typeof r.flags === "number" ? r.flags : null,
      acquisition: "CopyTicks",
    };
    if (isValidHfmTick(tick)) mapped.push(tick);
  }
  const ticks = normalizeTickStream(mapped);
  const errors: string[] = [];
  if (!agentRes.ok && agentRes.code) errors.push(String(agentRes.code));
  if (typeof result.unavailableReason === "string" && result.unavailableReason) {
    errors.push(result.unavailableReason);
  }
  return {
    provider: "HFM_MT5",
    environment: "demo",
    symbol,
    available: Boolean(agentRes.ok && result.available === true && ticks.length > 0),
    ticks,
    count: ticks.length,
    source: typeof result.source === "string" ? result.source : null,
    acquisition: ticks.length ? "CopyTicks" : "unavailable",
    errors,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

export async function fetchHfmChartTick(): Promise<HfmTickFetchResult> {
  const agentRes = await callMt5HfmAgent("demo.chart_tick", {});
  const result = (agentRes.result ?? {}) as Record<string, unknown>;
  const symbol = typeof result.symbol === "string" ? result.symbol.toUpperCase() : "";
  const receiveMs = Date.now();
  const ticks: HfmValidatedTick[] = [];
  if (symbol) {
    const tick: HfmValidatedTick = {
      symbol,
      bid: Number(result.bid),
      ask: Number(result.ask),
      last: typeof result.last === "number" ? result.last : null,
      timeSec: Number(result.time),
      timeMsc: typeof result.timeMsc === "number" ? result.timeMsc : null,
      receiveMs,
      volume: typeof result.volume === "number" ? result.volume : null,
      flags: typeof result.flags === "number" ? result.flags : null,
      acquisition: "OnTick",
    };
    if (isValidHfmTick(tick)) ticks.push(tick);
  }
  return {
    provider: "HFM_MT5",
    environment: "demo",
    symbol,
    available: Boolean(agentRes.ok && result.available === true && ticks.length > 0),
    ticks,
    count: ticks.length,
    source: typeof result.source === "string" ? result.source : "mql5_ontick",
    acquisition: ticks.length ? "OnTick" : "unavailable",
    errors: ticks.length ? [] : [String(result.unavailableReason ?? "CHART_TICK_UNAVAILABLE")],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

export async function setHfmQuoteWatch(symbols: string[]): Promise<{
  requested: boolean;
  symbols: string[];
}> {
  const agentRes = await callMt5HfmAgent("demo.quote_watch", { symbols });
  const result = (agentRes.result ?? {}) as Record<string, unknown>;
  return {
    requested: Boolean(agentRes.ok && result.requested === true),
    symbols: Array.isArray(result.symbols) ? result.symbols.map(String) : [],
  };
}
