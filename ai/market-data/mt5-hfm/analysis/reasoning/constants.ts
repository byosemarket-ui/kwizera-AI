/**
 * Phase 5 — HFM AI Reasoning constants (analysis-only; no execution).
 */

/** Current write schema (Phase 5 unified AI analysis). Legacy stored records may still be v1 / v1.1. */
export const HFM_REASONING_SCHEMA_VERSION = "hfm-ai-analysis-v1.2" as const;
export const HFM_REASONING_SCHEMA_VERSION_LEGACY_V11 = "hfm-ai-analysis-v1.1" as const;
export const HFM_REASONING_SCHEMA_VERSION_LEGACY = "hfm-ai-analysis-v1" as const;
export const HFM_REASONING_PROMPT_VERSION = "hfm-ai-reasoning-prompt-v1.2" as const;
export const HFM_REASONING_PROVIDER = "HFM_MT5" as const;

/** Vision / image timeframes (unchanged — H4 is text context only). */
export const HFM_REASONING_REQUIRED_TFS = ["H1", "M30", "M15", "M5"] as const;

/** Text/context timeframes including H4 (no fifth image). */
export const HFM_REASONING_CONTEXT_TFS = ["H4", "H1", "M30", "M15", "M5"] as const;

/** Unified AI analysis input contract. */
export const HFM_UNIFIED_AI_INPUT_CONTRACT_ID =
  "kwizera.hfm.unified-ai-analysis-input.v1" as const;
export const HFM_UNIFIED_AI_INPUT_CONTRACT_VERSION = "1.0.0" as const;

/** Payload caps (~80 evidence / ~20 candidates; respect stricter callers). */
export const HFM_UNIFIED_AI_MAX_EVIDENCE = 80;
export const HFM_UNIFIED_AI_MAX_CANDIDATES = 20;
export const HFM_UNIFIED_AI_MAX_NOTE_CHARS = 240;
export const HFM_UNIFIED_AI_MAX_JSON_CHARS = 180_000;
export const HFM_UNIFIED_AI_MAX_CANDLES_PER_TF = 40;

/** Max age of a prepared context before reasoning rejects it (hours). */
export const HFM_REASONING_MAX_CONTEXT_AGE_HOURS = 6;

export const HFM_REASONING_OPENAI_TIMEOUT_MS = 120_000;

/** Analysis result retention (aligned with Phase 2 history). */
export const HFM_REASONING_RETENTION_DAYS = 90;

export const HFM_REASONING_DISCLAIMER =
  "Analytical output only. Not execution authorization. No broker orders are placed.";

export const HFM_REASONING_NOT_PROVIDED = "NOT_PROVIDED" as const;

/** decision.confidence is model-reported analytical confidence — never win probability. */
export const HFM_REASONING_CONFIDENCE_DEFINITION =
  "Model-reported analytical confidence (0-100). NOT win probability, NOT statistical probability of profit, NOT a calibrated historical success rate, and NOT a guarantee of market outcome." as const;
