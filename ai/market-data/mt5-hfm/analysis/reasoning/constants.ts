/**
 * Phase 3 — HFM AI Reasoning constants (analysis-only; no execution).
 */

export const HFM_REASONING_SCHEMA_VERSION = "hfm-ai-analysis-v1" as const;
export const HFM_REASONING_PROMPT_VERSION = "hfm-ai-reasoning-prompt-v1" as const;
export const HFM_REASONING_PROVIDER = "HFM_MT5" as const;

export const HFM_REASONING_REQUIRED_TFS = ["H1", "M30", "M15", "M5"] as const;

/** Max age of a prepared context before reasoning rejects it (hours). */
export const HFM_REASONING_MAX_CONTEXT_AGE_HOURS = 6;

export const HFM_REASONING_OPENAI_TIMEOUT_MS = 120_000;

/** Analysis result retention (aligned with Phase 2 history). */
export const HFM_REASONING_RETENTION_DAYS = 90;

export const HFM_REASONING_DISCLAIMER =
  "Analytical output only. Not execution authorization. No broker orders are placed.";
