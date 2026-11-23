/**
 * Unit-aware economic surprise when forecast/actual are parseable.
 * Does not interpret bullish/bearish for the currency (context-dependent).
 */
import type { HfmNumericSurprise, HfmSurpriseDirection } from "./types.js";

export function parseEconomicNumber(raw: string): {
  value: number | null;
  unit: string | null;
} {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null, unit: null };
  const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*(%|k|K|m|M|b|B|bp|bps)?$/);
  if (!m) return { value: null, unit: null };
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return { value: null, unit: null };
  const unit = m[2] ? m[2].toLowerCase() : null;
  return { value, unit };
}

export function computeNumericSurprise(
  forecast: string,
  actual: string,
): HfmNumericSurprise {
  const f = parseEconomicNumber(forecast);
  const a = parseEconomicNumber(actual);
  if (f.value == null || a.value == null) {
    const bothPresent = Boolean(forecast.trim() && actual.trim());
    return {
      direction: bothPresent ? "NOT_COMPARABLE" : "MISSING_VALUES",
      delta: null,
      unit: null,
      comparable: false,
      note: bothPresent
        ? "forecast/actual present but not parseable as compatible numbers"
        : "missing forecast and/or actual",
      isDirectionalTradeSignal: false,
    };
  }
  if (f.unit !== a.unit) {
    return {
      direction: "NOT_COMPARABLE",
      delta: null,
      unit: null,
      comparable: false,
      note: `incompatible units forecast=${f.unit ?? "none"} actual=${a.unit ?? "none"}`,
      isDirectionalTradeSignal: false,
    };
  }
  const delta = a.value - f.value;
  let direction: HfmSurpriseDirection = "IN_LINE";
  if (Math.abs(delta) < 1e-12) direction = "IN_LINE";
  else if (delta > 0) direction = "ABOVE_FORECAST";
  else direction = "BELOW_FORECAST";
  return {
    direction,
    delta,
    unit: f.unit,
    comparable: true,
    note: `actual(${a.value}${f.unit ?? ""}) - forecast(${f.value}${f.unit ?? ""}) = ${delta}`,
    isDirectionalTradeSignal: false,
  };
}
