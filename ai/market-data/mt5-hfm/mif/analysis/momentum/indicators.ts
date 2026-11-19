/**
 * Phase 5D.6 — deterministic momentum indicators on CLOSED closes only.
 *
 * ROC(period): 100 * (close[i] - close[i-period]) / close[i-period]
 *   Units: percent. Warm-up: needs period prior closed bars.
 *
 * RSI(period) Wilder:
 *   avgGain/avgLoss seeded with SMA of first `period` changes, then
 *   avg = (prev*(period-1) + current) / period
 *   RSI = 100 - 100/(1 + avgGain/avgLoss); if avgLoss=0 → 100; both 0 → 50
 *   Range: [0,100]. Warm-up: period+1 closed bars minimum for first RSI.
 *
 * Never uses tickVolume as global FX volume.
 * Never fabricates values during warm-up (returns null).
 */

export function rateOfChange(
  closes: readonly number[],
  period: number,
): { value: number | null; warmUpComplete: boolean } {
  if (period < 1 || closes.length <= period) {
    return { value: null, warmUpComplete: false };
  }
  const cur = closes[closes.length - 1]!;
  const prev = closes[closes.length - 1 - period]!;
  if (!(prev > 0) || !Number.isFinite(cur) || !Number.isFinite(prev)) {
    return { value: null, warmUpComplete: true };
  }
  return { value: (100 * (cur - prev)) / prev, warmUpComplete: true };
}

export function wilderRsi(
  closes: readonly number[],
  period: number,
): { value: number | null; warmUpComplete: boolean } {
  if (period < 1 || closes.length < period + 1) {
    return { value: null, warmUpComplete: false };
  }
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gainSum += d;
    else lossSum += -d;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0 && avgGain === 0) return { value: 50, warmUpComplete: true };
  if (avgLoss === 0) return { value: 100, warmUpComplete: true };
  const rs = avgGain / avgLoss;
  return { value: 100 - 100 / (1 + rs), warmUpComplete: true };
}

/** Prior ROC for acceleration comparison (one bar earlier). */
export function priorRateOfChange(
  closes: readonly number[],
  period: number,
): number | null {
  if (closes.length <= period + 1) return null;
  return rateOfChange(closes.slice(0, -1), period).value;
}
