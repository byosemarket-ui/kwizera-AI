/**
 * Phase 53.2 — Binary BUY/SELL direction + confidence + forecast horizon policy.
 * Analytical forecast only — never authorizes broker orders.
 */

export type AtBinaryDirection = "BUY" | "SELL";

export const AT_DIRECTIONAL_CONFIDENCE_NOTE =
  "Estimated directional confidence — NOT CALIBRATED";

export const AT_BINARY_DIRECTION_SCHEMA = "at-openai-binary-direction-v1";

const NON_DIRECTIONAL = new Set([
  "WAIT",
  "HOLD",
  "NEUTRAL",
  "BOTH",
  "NONE",
  "UNKNOWN",
  "NO_TRADE",
  "UNCERTAIN",
  "",
]);

const TF_LABEL: Record<string, string> = {
  "1m": "M1",
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
  "1w": "W1",
};

const TF_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

/**
 * Explicit forecast horizon policy for AT OpenAI binary direction:
 * predict directional movement through the close of the next one candle
 * of the selected primary timeframe after the observation timestamp.
 * This is not a price-target guarantee and does not authorize orders.
 */
export function resolveAtForecastHorizon(primaryTimeframe: string | null | undefined): {
  ok: true;
  forecastHorizon: string;
  horizonMs: number;
  timeframe: string;
  timeframeLabel: string;
} | {
  ok: false;
  code: "MISSING_FORECAST_HORIZON";
  message: string;
} {
  const tf = String(primaryTimeframe ?? "").trim().toLowerCase();
  const ms = TF_MS[tf];
  if (!tf || !ms) {
    return {
      ok: false,
      code: "MISSING_FORECAST_HORIZON",
      message:
        "Primary timeframe missing or unsupported — cannot define a binary forecast horizon.",
    };
  }
  const label = TF_LABEL[tf] ?? tf.toUpperCase();
  return {
    ok: true,
    timeframe: tf,
    timeframeLabel: label,
    horizonMs: ms,
    forecastHorizon:
      `Next 1× ${label} candle close after observation `
      + `(${ms}ms horizon; directional forecast only — not an order).`,
  };
}

export function parseAtBinaryDirection(raw: unknown): {
  ok: true;
  direction: AtBinaryDirection;
} | {
  ok: false;
  code: "DIRECTION_REJECTED" | "DIRECTION_MISSING";
  message: string;
  rejectedValue: string;
} {
  const text = String(raw ?? "").trim().toUpperCase();
  if (!text) {
    return {
      ok: false,
      code: "DIRECTION_MISSING",
      message: "Binary direction is required (BUY or SELL).",
      rejectedValue: "",
    };
  }
  if (text === "BUY" || text === "SELL") {
    return { ok: true, direction: text };
  }
  if (NON_DIRECTIONAL.has(text) || /WAIT|HOLD|NEUTRAL|BOTH/.test(text)) {
    return {
      ok: false,
      code: "DIRECTION_REJECTED",
      message: `Unsupported direction "${text}" — successful AT predictions must be BUY or SELL only.`,
      rejectedValue: text,
    };
  }
  // Map common bias tokens only when explicit binary field is absent (caller decides).
  if (text === "BULLISH" || text === "LONG") {
    return { ok: true, direction: "BUY" };
  }
  if (text === "BEARISH" || text === "SHORT") {
    return { ok: true, direction: "SELL" };
  }
  return {
    ok: false,
    code: "DIRECTION_REJECTED",
    message: `Unsupported direction "${text.slice(0, 40)}" — expected BUY or SELL.`,
    rejectedValue: text.slice(0, 40),
  };
}

export function parseAtDirectionalConfidencePct(raw: unknown): {
  ok: true;
  directionalConfidencePct: number;
} | {
  ok: false;
  code: "CONFIDENCE_INVALID";
  message: string;
} {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return {
      ok: false,
      code: "CONFIDENCE_INVALID",
      message: "directionalConfidencePct must be a finite number between 0 and 100.",
    };
  }
  if (n < 0 || n > 100) {
    return {
      ok: false,
      code: "CONFIDENCE_INVALID",
      message: `directionalConfidencePct ${n} is outside the permitted 0–100 range.`,
    };
  }
  return { ok: true, directionalConfidencePct: Math.round(n * 10) / 10 };
}

/** Prefer explicit `direction`; else map directionalBias BULLISH/BEARISH only. */
export function resolveBinaryDirectionFromModel(raw: Record<string, unknown>): {
  ok: true;
  direction: AtBinaryDirection;
} | {
  ok: false;
  code: "DIRECTION_REJECTED" | "DIRECTION_MISSING";
  message: string;
  rejectedValue: string;
} {
  if (raw.direction != null && String(raw.direction).trim() !== "") {
    return parseAtBinaryDirection(raw.direction);
  }
  const bias = String(raw.directionalBias ?? "").trim().toUpperCase();
  if (bias === "BULLISH") return { ok: true, direction: "BUY" };
  if (bias === "BEARISH") return { ok: true, direction: "SELL" };
  if (bias === "NEUTRAL" || bias === "UNKNOWN" || bias === "WAIT" || bias === "HOLD") {
    return {
      ok: false,
      code: "DIRECTION_REJECTED",
      message: `directionalBias "${bias}" is not a valid binary BUY/SELL prediction.`,
      rejectedValue: bias,
    };
  }
  return {
    ok: false,
    code: "DIRECTION_MISSING",
    message: "Model response omitted direction (BUY|SELL).",
    rejectedValue: "",
  };
}

export function biasFromDirection(direction: AtBinaryDirection): "BULLISH" | "BEARISH" {
  return direction === "BUY" ? "BULLISH" : "BEARISH";
}
