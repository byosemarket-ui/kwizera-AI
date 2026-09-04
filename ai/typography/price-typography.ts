/**
 * STEP 3 — price / currency typography helpers.
 * Reuses existing commercial formatting; never invents prices.
 */
export interface PriceFragment {
  text: string;
  start: number;
  end: number;
  kind: "currency_amount" | "number";
}

const CURRENCY_AMOUNT =
  /(?:(?:RWF|USD|EUR|GBP|\$|€|£)\s*[\d,.]+(?:\.\d+)?)|(?:[\d,.]+(?:\.\d+)?\s*(?:RWF|USD|EUR|GBP|\$|€|£))/gi;

/**
 * Keep currency token adjacent to its amount (no awkward split preference).
 * Does not rewrite business values — only normalizes excess whitespace.
 */
export function keepCurrencyWithAmount(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\b(RWF|USD|EUR|GBP)\s+(\d)/gi, "$1 $2")
    .replace(/(\d)\s+(RWF|USD|EUR|GBP)\b/gi, "$1 $2")
    .trim();
}

export function parsePriceFragments(text: string): PriceFragment[] {
  const cleaned = keepCurrencyWithAmount(text);
  const fragments: PriceFragment[] = [];
  for (const match of cleaned.matchAll(CURRENCY_AMOUNT)) {
    if (match.index == null) continue;
    fragments.push({
      text: match[0]!,
      start: match.index,
      end: match.index + match[0]!.length,
      kind: "currency_amount",
    });
  }
  if (!fragments.length) {
    const numberOnly = cleaned.match(/[\d,.]+/);
    if (numberOnly && numberOnly.index != null) {
      fragments.push({
        text: numberOnly[0]!,
        start: numberOnly.index,
        end: numberOnly.index + numberOnly[0]!.length,
        kind: "number",
      });
    }
  }
  return fragments;
}

/** Prefer wrapping that does not split currency from amount. */
export function preferPriceSafeWrap(lines: string[]): string[] {
  if (lines.length < 2) return lines;
  const joined = lines.join(" ");
  const bad = lines.some((line) => /^(RWF|USD|EUR|GBP|\$|€|£)$/i.test(line.trim()));
  if (!bad) return lines;
  return [keepCurrencyWithAmount(joined)];
}
