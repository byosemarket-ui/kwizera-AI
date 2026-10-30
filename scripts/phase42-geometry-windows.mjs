/** Phase 4.2 — verify SMA/ATR/2R on live DEMO candles across closed windows (no fabricated trades). */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const { evaluateSmaCrossoverStrategy, atrAt, backtestSmaCrossover } = await import(
  "../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.ts"
);

function load(name) {
  const p = path.join(process.env.TEMP || os.tmpdir(), name);
  const raw = JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  const candles = (raw.candles || []).map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    closed: c.closed !== false,
  }));
  return { raw, candles, closed: candles.filter((c) => c.closed !== false) };
}

function checkGeometry(ev, pointSize) {
  if (ev.direction !== "BUY" && ev.direction !== "SELL") return null;
  const stopDist = Math.abs(ev.entryPrice - ev.stopLoss);
  const tpDist = Math.abs(ev.takeProfit - ev.entryPrice);
  const expectedStop = Math.max(ev.atr * 1.5, pointSize * 50);
  return {
    direction: ev.direction,
    code: ev.code,
    stopOk: Math.abs(stopDist - expectedStop) < 1e-9,
    tpIs2R: Math.abs(tpDist / stopDist - 2) < 1e-9,
    stopDist,
    tpDist,
    atr: ev.atr,
    fast: ev.fastSma,
    slow: ev.slowSma,
  };
}

for (const file of ["kw-xau-15m.json", "kw-eur-15m.json"]) {
  const { raw, closed } = load(file);
  const pointSize = file.includes("eur") ? 0.00001 : 0.01;
  const replay = backtestSmaCrossover({ candles: closed, pointSize });
  const geometric = [];
  for (const sig of replay.signals) {
    const slice = closed.filter((c) => c.time <= sig.time);
    const ev = evaluateSmaCrossoverStrategy({ candles: slice, pointSize });
    const g = checkGeometry(ev, pointSize);
    if (g) geometric.push({ time: sig.time, ...g });
  }
  // Independent SMA check on latest closed
  const closes = closed.map((c) => c.close);
  const i = closed.length - 1;
  let fast = 0;
  let slow = 0;
  for (let k = i - 8; k <= i; k++) fast += closes[k];
  for (let k = i - 20; k <= i; k++) slow += closes[k];
  fast /= 9;
  slow /= 21;
  const atr = atrAt(
    closed.map((c) => c.high),
    closed.map((c) => c.low),
    closes,
    14,
    i,
  );
  const latest = evaluateSmaCrossoverStrategy({ candles: closed, pointSize });
  console.log(
    JSON.stringify(
      {
        file,
        environment: raw.environment,
        closedCount: closed.length,
        latest: {
          direction: latest.direction,
          code: latest.code,
          fastMatch: Math.abs((latest.fastSma ?? NaN) - fast) < 1e-12,
          slowMatch: Math.abs((latest.slowSma ?? NaN) - slow) < 1e-12,
          atrMatch: Math.abs((latest.atr ?? NaN) - (atr ?? NaN)) < 1e-12,
        },
        replaySignalCount: replay.signals.length,
        geometricChecks: geometric.slice(-5),
        allGeometryOk: geometric.every((g) => g.stopOk && g.tpIs2R),
        buyCount: geometric.filter((g) => g.direction === "BUY").length,
        sellCount: geometric.filter((g) => g.direction === "SELL").length,
      },
      null,
      2,
    ),
  );
}
