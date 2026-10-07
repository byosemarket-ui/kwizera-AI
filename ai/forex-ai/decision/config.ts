/**
 * Phase 22 — Scenario / Entry / Decision configuration.
 * Reuses Phase 21 MTF stack; does not invent unsupported timeframes.
 */
import {
  FOREX_MTF_DEFAULT_STACK,
  FOREX_MTF_PROMPT_CHAR_BUDGET,
  FOREX_MTF_REQUIRED,
} from "../mtf/config.js";

export const FOREX_DECISION_SCHEMA_VERSION = "forex-decision-analysis-v1" as const;
export const FOREX_DECISION_PROMPT_VERSION = "forex-decision-prompt-v1";
export const FOREX_DECISION_ENGINE_VERSION = "forex-decision-engine-v1";

/** Same default MTF hierarchy as Phase 21. */
export const FOREX_DECISION_DEFAULT_STACK = FOREX_MTF_DEFAULT_STACK;
export const FOREX_DECISION_REQUIRED = FOREX_MTF_REQUIRED;

/**
 * Keep prompt budget at Phase 21 size — do not inflate for llama3.2:1b.
 */
export const FOREX_DECISION_PROMPT_CHAR_BUDGET = FOREX_MTF_PROMPT_CHAR_BUDGET;

/** ATR half-width multiplier for swing-based entry zone padding (deterministic). */
export const FOREX_ENTRY_ZONE_ATR_PAD = 0.25;
