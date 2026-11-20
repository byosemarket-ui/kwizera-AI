/**
 * Wilson score confidence interval for a binomial proportion.
 * Documented method: Wilson (1927) score interval — preferred over Wald for small n.
 */
import type { MifConfidenceInterval } from "./types.js";

/** Approximate inverse CDF for standard normal at confidence level (two-sided). */
function zForConfidence(confidenceLevel: number): number {
  // Common levels without external deps
  if (Math.abs(confidenceLevel - 0.9) < 1e-9) return 1.6448536269514722;
  if (Math.abs(confidenceLevel - 0.95) < 1e-9) return 1.959963984540054;
  if (Math.abs(confidenceLevel - 0.99) < 1e-9) return 2.5758293035489004;
  // Fallback: linear interp between 0.95 and 0.99 or clamp
  if (confidenceLevel < 0.95) return 1.6448536269514722 + (confidenceLevel - 0.9) * 6.3;
  return 1.959963984540054 + (confidenceLevel - 0.95) * 15.4;
}

/**
 * Wilson interval for successes/n at given confidence.
 * Returns null when n <= 0.
 */
export function wilsonConfidenceInterval(
  successes: number,
  n: number,
  confidenceLevel: number,
): MifConfidenceInterval | null {
  if (!(n > 0) || !Number.isFinite(successes) || successes < 0 || successes > n) return null;
  const z = zForConfidence(confidenceLevel);
  const phat = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  const lower = Math.max(0, (center - margin) / denom);
  const upper = Math.min(1, (center + margin) / denom);
  return {
    method: "WILSON",
    confidenceLevel,
    lower,
    upper,
    halfWidth: (upper - lower) / 2,
  };
}
