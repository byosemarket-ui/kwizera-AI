/**
 * Lightweight Phase 53.1 smoke (no full app / no OpenAI network / no broker orders).
 */
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_MONITOR_TIMEFRAMES,
  latestClosedCandleOpenSec,
  parseAtMonitorTimeframe,
  renderAtMarketChartPng,
} from "../ai/forex-ai/automated-trading/index.ts";
import { isOpenAiVisionEligibleModel } from "../ai/forex-ai/multi-image-openai/vision-policy.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("PASS:", msg);
}

assert(AUTOMATED_EXECUTION_BANNER.includes("PHASE 53.1"), "banner phase 53.1");
assert(AT_MONITOR_TIMEFRAMES.includes("15m"), "15m supported");
assert(parseAtMonitorTimeframe("H2") === null, "H2 unsupported");
assert(isOpenAiVisionEligibleModel("gpt-6-luna"), "gpt-6-luna vision eligible");

const t0 = Math.floor(Date.now() / 1000) - 20 * 900;
const opens = Array.from({ length: 20 }, (_, i) => t0 + i * 900);
const closed = latestClosedCandleOpenSec(opens, "15m");
assert(closed && closed.closed === true, "closed candle detected");

const candles = opens.map((time, i) => ({
  time,
  open: 1.1 + i * 0.0001,
  high: 1.1005 + i * 0.0001,
  low: 1.0995 + i * 0.0001,
  close: 1.1002 + i * 0.0001,
  isClosed: true,
}));
const chart = renderAtMarketChartPng({
  instrument: "EUR/USD",
  timeframe: "15m",
  timeframeLabel: "M15",
  candles,
  observationUtc: new Date().toISOString(),
});
assert(chart.ok === true, "server chart render ok");
assert(chart.ok && chart.source === "server-ohlc-render", "server-ohlc source");

if (failed) {
  console.error(`\nPhase 53.1 smoke FAILED (${failed})`);
  process.exit(1);
}
console.log("\nPhase 53.1 smoke OK");
