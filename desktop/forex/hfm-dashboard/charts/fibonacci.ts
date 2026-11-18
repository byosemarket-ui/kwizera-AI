import { HFM_FIB_RETRACEMENT_LEVELS } from "./types";

export function fibRetracementLevels(high: number, low: number): Array<{ ratio: number; price: number }> {
  const top = Math.max(high, low);
  const bottom = Math.min(high, low);
  const range = top - bottom;
  return HFM_FIB_RETRACEMENT_LEVELS.map((ratio) => ({
    ratio,
    price: top - range * ratio,
  }));
}

/** Extension from A→B projected from C. */
export function fibExtensionLevels(
  a: number,
  b: number,
  c: number,
): Array<{ ratio: number; price: number }> {
  const range = b - a;
  return [0, 0.618, 1, 1.618, 2.618].map((ratio) => ({
    ratio,
    price: c + range * ratio,
  }));
}
