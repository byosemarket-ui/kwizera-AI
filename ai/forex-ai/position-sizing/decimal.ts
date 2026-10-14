/**
 * Decimal-safe helpers for quantity / money (avoid float drift on steps).
 */

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function decimalsOfStep(step: number): number {
  if (!isFiniteNumber(step) || step <= 0) return 0;
  const s = step.toString().toLowerCase();
  if (s.includes("e-")) {
    const exp = Number(s.split("e-")[1]);
    return Number.isFinite(exp) ? Math.min(12, Math.max(0, exp)) : 8;
  }
  const dot = s.indexOf(".");
  return dot < 0 ? 0 : Math.min(12, s.length - dot - 1);
}

/** Round to `decimals` using banker's-unfriendly but deterministic half-up via integer scale. */
export function roundTo(value: number, decimals: number): number {
  if (!isFiniteNumber(value)) return NaN;
  const d = Math.max(0, Math.min(12, Math.floor(decimals)));
  const factor = 10 ** d;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Round DOWN to the nearest quantity step. Never rounds up through the risk budget.
 */
export function floorToStep(value: number, step: number): number {
  if (!isFiniteNumber(value) || !isFiniteNumber(step) || value <= 0 || step <= 0) return 0;
  const decimals = decimalsOfStep(step);
  const factor = 10 ** Math.max(decimals, 8);
  const valueInt = Math.floor(value * factor + 1e-9);
  const stepInt = Math.round(step * factor);
  if (stepInt <= 0) return 0;
  const units = Math.floor(valueInt / stepInt);
  return roundTo((units * stepInt) / factor, decimals);
}

/** Integer-scaled price distance in points/pips to avoid IEEE drift (e.g. 1.1-1.09). */
export function priceDistanceInPoints(move: number, pointSize: number): number | null {
  if (!isFiniteNumber(move) || !isFiniteNumber(pointSize) || move <= 0 || pointSize <= 0) {
    return null;
  }
  const scale = 10 ** 10;
  const moveInt = Math.round(move * scale);
  const pointInt = Math.round(pointSize * scale);
  if (pointInt <= 0) return null;
  return moveInt / pointInt;
}

export function clampMinMax(value: number, min: number | null, max: number | null): number {
  let v = value;
  if (isFiniteNumber(min) && v < min) return 0;
  if (isFiniteNumber(max) && v > max) v = max;
  return v;
}
