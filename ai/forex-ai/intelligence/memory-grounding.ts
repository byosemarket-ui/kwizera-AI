/**
 * Phase 24 — Prevent AI from treating historical memory as current market fact,
 * or rewriting stored historical outcomes.
 */
import type { ForexMemorySourceRef } from "./context-builder.js";
import type { ForexDecisionDeterministicPack } from "../decision/types.js";

export function detectMemoryGroundingViolations(
  text: string,
  input: {
    pack: ForexDecisionDeterministicPack;
    memorySources: ForexMemorySourceRef[];
  },
): string[] {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  // Memory cannot override current alignment/trend as "currently"
  if (input.memorySources.length > 0) {
    if (
      /\b(currently|right now|at this moment)\b.{0,40}\b(because|due to)\b.{0,60}\b(previous|histor(?:y|ical)|past)\b/i
        .test(text)
    ) {
      violations.push("Historical memory used as cause of current market state.");
    }
    if (
      /\b(therefore|so)\b.{0,40}\b(this trade will|btc will|price will)\b/i.test(lower)
    ) {
      violations.push("Memory-derived future certainty / trade claim is not allowed.");
    }
  }

  // Do not rewrite historical outcomes from supplied memory sources
  for (const src of input.memorySources) {
    if (!src.outcome || src.outcome === "NONE" || src.outcome === "PENDING") continue;
    const outcome = src.outcome.toUpperCase();
    // If AI claims the opposite outcome for a past case id
    if (src.memoryId && text.includes(src.memoryId)) {
      const opposite =
        outcome === "CONFIRMED" ? "INVALIDATED"
          : outcome === "INVALIDATED" ? "CONFIRMED"
            : null;
      if (opposite && new RegExp(`${src.memoryId}.{0,80}${opposite}`, "i").test(text)) {
        violations.push(`Historical outcome rewritten for memory ${src.memoryId}.`);
      }
    }
  }

  // Current pack trend vs "aligned bullish from history"
  const align = input.pack.alignment.overall;
  if (
    (align === "ALIGNED_BEARISH" || align === "CONFLICTING" || input.pack.alignment.higherBias === "BEARISH")
    && /\b(histor(?:y|ical)|previous|past)\b.{0,50}\b(so|therefore|thus)\b.{0,40}\bbullish\b/i.test(text)
  ) {
    violations.push("Memory bullish bias overriding current bearish/conflict Market State.");
  }

  return violations;
}
