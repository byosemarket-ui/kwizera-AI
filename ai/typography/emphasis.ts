/**
 * STEP 3 — smart emphasis spans (phrase / number / price / CTA).
 * Metadata only — does not invent STEP 4 contrast treatments.
 */
import type { EmphasisSpan, TextRole } from "./types.js";
import { keepCurrencyWithAmount, parsePriceFragments } from "./price-typography.js";

export function findEmphasisSpans(input: {
  text: string;
  role: TextRole;
}): EmphasisSpan[] {
  const text = keepCurrencyWithAmount(input.text.trim());
  if (!text) return [];
  const spans: EmphasisSpan[] = [];

  if (input.role === "cta") {
    spans.push({
      text,
      start: 0,
      end: text.length,
      kind: "cta",
      strength: "strong",
    });
    return spans;
  }

  if (input.role === "discount" || /save\s+\d+\s*%|\d+\s*%/i.test(text)) {
    const pct = text.match(/(\d+\s*%)/);
    if (pct && pct.index != null) {
      spans.push({
        text: pct[1]!,
        start: pct.index,
        end: pct.index + pct[1]!.length,
        kind: "discount",
        strength: "strong",
      });
    }
  }

  if (input.role === "price" || input.role === "previousPrice" || /rwf|\$|€|£|\d/i.test(text)) {
    const fragments = parsePriceFragments(text);
    for (const fragment of fragments) {
      spans.push({
        text: fragment.text,
        start: fragment.start,
        end: fragment.end,
        kind: fragment.kind === "currency_amount" ? "currency_amount" : "number",
        strength: input.role === "previousPrice" ? "subtle" : "strong",
      });
    }
  }

  if (!spans.length && (input.role === "headline" || input.role === "hook" || input.role === "benefit")) {
    const words = text.split(/\s+/);
    if (words.length <= 4) {
      spans.push({ text, start: 0, end: text.length, kind: "full", strength: "medium" });
    } else {
      const first = words.slice(0, Math.min(3, words.length)).join(" ");
      spans.push({ text: first, start: 0, end: first.length, kind: "phrase", strength: "medium" });
    }
  }

  if (!spans.length) {
    spans.push({ text, start: 0, end: text.length, kind: "full", strength: "subtle" });
  }

  return spans;
}
