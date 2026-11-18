/**
 * Phase 5C Step 1A — pure Fibonacci level mathematics.
 * Mathematical reference levels only — no trade direction inference.
 */

export type FibOrientation = "BULLISH" | "BEARISH";

/**
 * Bullish impulse LOW L → HIGH H:
 *   retracement r: H - (H - L) * r
 *   extension e:   L + (H - L) * e
 * Bearish impulse HIGH H → LOW L:
 *   retracement r: L + (H - L) * r
 *   extension e:   H - (H - L) * e
 */
export function computeFibRetracementPrice(
  orientation: FibOrientation,
  low: number,
  high: number,
  ratio: number,
): number {
  const L = Math.min(low, high);
  const H = Math.max(low, high);
  const range = H - L;
  if (orientation === "BULLISH") {
    return H - range * ratio;
  }
  return L + range * ratio;
}

export function computeFibExtensionPrice(
  orientation: FibOrientation,
  low: number,
  high: number,
  ratio: number,
): number {
  const L = Math.min(low, high);
  const H = Math.max(low, high);
  const range = H - L;
  if (orientation === "BULLISH") {
    return L + range * ratio;
  }
  return H - range * ratio;
}

export function computeFibLevels(input: {
  orientation: FibOrientation;
  low: number;
  high: number;
  retracementRatios: readonly number[];
  extensionRatios: readonly number[];
}): {
  retracements: Array<{ ratio: number; price: number }>;
  extensions: Array<{ ratio: number; price: number }>;
} {
  const { orientation, low, high, retracementRatios, extensionRatios } = input;
  return {
    retracements: retracementRatios.map((ratio) => ({
      ratio,
      price: computeFibRetracementPrice(orientation, low, high, ratio),
    })),
    extensions: extensionRatios.map((ratio) => ({
      ratio,
      price: computeFibExtensionPrice(orientation, low, high, ratio),
    })),
  };
}
