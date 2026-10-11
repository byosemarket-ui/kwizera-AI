/**
 * BOS / CHoCH detection — market-structure-v1.
 *
 * Only when trendState is BULLISH or BEARISH (UNKNOWN/RANGE → no events).
 *
 * BOS (continuation):
 * - BULLISH: closed close above last confirmed swing high (+ buffer)
 * - BEARISH: closed close below last confirmed swing low (− buffer)
 *
 * CHoCH (against structure):
 * - BULLISH: closed close below last confirmed swing low
 * - BEARISH: closed close above last confirmed swing high
 *
 * requireCloseBeyond: close beyond → CONFIRMED; wick beyond without close → CANDIDATE.
 * Dedup key = `${type}:${direction}:${levelTime}:${breakCandleTime}`.
 */

import type {
  StructureCandle,
  StructureEvent,
  StructureEventDirection,
  StructureEventType,
  StructureRuleParams,
  StructureSwing,
  TrendState,
} from "./types.js";
import { isStructureCandleClosed, priceScale } from "./validate.js";

function eventKey(
  type: StructureEventType,
  direction: StructureEventDirection,
  levelTime: number,
  breakCandleTime: number,
): string {
  return `${type}:${direction}:${levelTime}:${breakCandleTime}`;
}

function beyondLevel(
  price: number,
  level: number,
  direction: "ABOVE" | "BELOW",
  bufferRel: number,
): boolean {
  const buffer = bufferRel * priceScale(level);
  if (direction === "ABOVE") return price > level + buffer;
  return price < level - buffer;
}

function tryEmit(
  seen: Set<string>,
  events: StructureEvent[],
  partial: Omit<StructureEvent, "id" | "eventKey"> & { eventKey?: string },
): void {
  const key = eventKey(
    partial.type,
    partial.direction,
    partial.levelTime,
    partial.breakCandleTime,
  );
  if (seen.has(key)) return;
  seen.add(key);
  events.push({
    ...partial,
    id: `evt-${key}`,
    eventKey: key,
  });
}

/**
 * Scan closed (and optional trailing forming) candles for structure breaks.
 * Level references are the latest confirmed swing high/low at or before the break candle.
 */
export function detectStructureEvents(
  candles: StructureCandle[],
  closedCount: number,
  swings: StructureSwing[],
  trendState: TrendState,
  params: StructureRuleParams,
  includeForming: boolean,
): StructureEvent[] {
  if (trendState !== "BULLISH" && trendState !== "BEARISH") {
    return [];
  }

  const confirmed = swings
    .filter((s) => s.status === "CONFIRMED")
    .sort((a, b) => a.index - b.index);

  if (confirmed.length === 0) return [];

  const scanStart = Math.max(0, closedCount - params.scanBars);
  const lastScan = includeForming && closedCount < candles.length
    ? candles.length - 1
    : closedCount - 1;

  const seen = new Set<string>();
  const events: StructureEvent[] = [];

  for (let i = scanStart; i <= lastScan; i += 1) {
    const candle = candles[i]!;
    const isClosed = i < closedCount && isStructureCandleClosed(candle);
    const isForming = !isClosed;

    // Relevant levels: last confirmed high/low with index < i (level established before break)
    let lastHigh: StructureSwing | null = null;
    let lastLow: StructureSwing | null = null;
    for (const swing of confirmed) {
      if (swing.index >= i) break;
      if (swing.kind === "HIGH") lastHigh = swing;
      else lastLow = swing;
    }
    if (!lastHigh && !lastLow) continue;

    if (trendState === "BULLISH") {
      // BOS bullish — break above last swing high
      if (lastHigh) {
        const closeBreak = beyondLevel(candle.close, lastHigh.price, "ABOVE", params.bosBufferRel);
        const wickBreak = beyondLevel(candle.high, lastHigh.price, "ABOVE", params.bosBufferRel);
        if (params.requireCloseBeyond) {
          if (closeBreak && isClosed) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BULLISH",
              status: "CONFIRMED",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `BOS bullish: close ${candle.close} > swing high ${lastHigh.price}`,
                `break candle time=${candle.time}`,
              ],
            });
          } else if (wickBreak && !closeBreak) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BULLISH",
              status: "CANDIDATE",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `BOS bullish CANDIDATE: wick high ${candle.high} > level ${lastHigh.price} but close ${candle.close} did not confirm`,
              ],
            });
          } else if (closeBreak && isForming) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BULLISH",
              status: "CANDIDATE",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `BOS bullish CANDIDATE on forming candle: close ${candle.close} > ${lastHigh.price}`,
              ],
            });
          }
        } else if (wickBreak || closeBreak) {
          tryEmit(seen, events, {
            type: "BOS",
            direction: "BULLISH",
            status: isClosed && closeBreak ? "CONFIRMED" : "CANDIDATE",
            level: lastHigh.price,
            levelTime: lastHigh.time,
            levelSwingId: lastHigh.id,
            breakCandleTime: candle.time,
            breakCandleIndex: i,
            evidence: [`BOS bullish break vs ${lastHigh.price}`],
          });
        }
      }

      // CHoCH bearish — break below last swing low
      if (lastLow) {
        const closeBreak = beyondLevel(candle.close, lastLow.price, "BELOW", params.bosBufferRel);
        const wickBreak = beyondLevel(candle.low, lastLow.price, "BELOW", params.bosBufferRel);
        if (params.requireCloseBeyond) {
          if (closeBreak && isClosed) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BEARISH",
              status: "CONFIRMED",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `CHoCH bearish: close ${candle.close} < swing low ${lastLow.price}`,
              ],
            });
          } else if (wickBreak && !closeBreak) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BEARISH",
              status: "CANDIDATE",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `CHoCH bearish CANDIDATE: wick low ${candle.low} < ${lastLow.price} without close confirm`,
              ],
            });
          } else if (closeBreak && isForming) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BEARISH",
              status: "CANDIDATE",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `CHoCH bearish CANDIDATE on forming candle`,
              ],
            });
          }
        }
      }
    } else {
      // BEARISH trend
      if (lastLow) {
        const closeBreak = beyondLevel(candle.close, lastLow.price, "BELOW", params.bosBufferRel);
        const wickBreak = beyondLevel(candle.low, lastLow.price, "BELOW", params.bosBufferRel);
        if (params.requireCloseBeyond) {
          if (closeBreak && isClosed) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BEARISH",
              status: "CONFIRMED",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `BOS bearish: close ${candle.close} < swing low ${lastLow.price}`,
              ],
            });
          } else if (wickBreak && !closeBreak) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BEARISH",
              status: "CANDIDATE",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `BOS bearish CANDIDATE: wick without close confirm`,
              ],
            });
          } else if (closeBreak && isForming) {
            tryEmit(seen, events, {
              type: "BOS",
              direction: "BEARISH",
              status: "CANDIDATE",
              level: lastLow.price,
              levelTime: lastLow.time,
              levelSwingId: lastLow.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [`BOS bearish CANDIDATE on forming candle`],
            });
          }
        }
      }

      if (lastHigh) {
        const closeBreak = beyondLevel(candle.close, lastHigh.price, "ABOVE", params.bosBufferRel);
        const wickBreak = beyondLevel(candle.high, lastHigh.price, "ABOVE", params.bosBufferRel);
        if (params.requireCloseBeyond) {
          if (closeBreak && isClosed) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BULLISH",
              status: "CONFIRMED",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `CHoCH bullish: close ${candle.close} > swing high ${lastHigh.price}`,
              ],
            });
          } else if (wickBreak && !closeBreak) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BULLISH",
              status: "CANDIDATE",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [
                `CHoCH bullish CANDIDATE: wick without close confirm`,
              ],
            });
          } else if (closeBreak && isForming) {
            tryEmit(seen, events, {
              type: "CHOCH",
              direction: "BULLISH",
              status: "CANDIDATE",
              level: lastHigh.price,
              levelTime: lastHigh.time,
              levelSwingId: lastHigh.id,
              breakCandleTime: candle.time,
              breakCandleIndex: i,
              evidence: [`CHoCH bullish CANDIDATE on forming candle`],
            });
          }
        }
      }
    }
  }

  // Newest first; cap
  events.sort((a, b) => {
    if (a.breakCandleTime !== b.breakCandleTime) return b.breakCandleTime - a.breakCandleTime;
    return a.eventKey.localeCompare(b.eventKey);
  });

  return events.slice(0, params.maxEvents);
}
