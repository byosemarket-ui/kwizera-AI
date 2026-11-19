/**
 * Phase 5C Step 1B — chart pattern contract / engine / policy identifiers.
 */

export const MIF_CHART_PATTERNS_CONTRACT_ID = "kwizera.mif.chart-patterns.v1" as const;
export const MIF_CHART_PATTERNS_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_CHART_PATTERNS_ENGINE_ID = "mif-chart-patterns" as const;
export const MIF_CHART_PATTERNS_ENGINE_VERSION = "1.0.0" as const;

export const MIF_CHART_PATTERNS_POLICY_ID = "mif-hfm-chart-patterns" as const;
export const MIF_CHART_PATTERNS_POLICY_VERSION = "1.0.0" as const;

/** ATR method used for residual / equality normalization in this policy family. */
export const MIF_CHART_PATTERNS_ATR_METHOD_ID = "SMA_OF_TR" as const;
