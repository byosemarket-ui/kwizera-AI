/**
 * P8.B — Point-in-Time Market Replay Integrity contracts.
 * Analytical / research only. No broker execution.
 */

export const MIF_PIT_REPLAY_CONTRACT_ID =
  "kwizera.mif.pit-replay-integrity.v1" as const;
export const MIF_PIT_REPLAY_CONTRACT_VERSION = "1.0.0" as const;

export const MIF_PIT_REPLAY_ENGINE_ID = "mif-pit-replay-integrity" as const;
export const MIF_PIT_REPLAY_ENGINE_VERSION = "1.0.0" as const;

export const MIF_PIT_REPLAY_MANIFEST_POLICY_ID =
  "pit-replay-input-manifest-policy" as const;
export const MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION = "1.0.0" as const;

export const MIF_PIT_PRIORITY_SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD"] as const;
export const MIF_PIT_PRIORITY_TIMEFRAMES = ["H4", "H1", "M30", "M15", "M5"] as const;

/** Documented approximate MTF overlap from P8.B audit (must be re-verified from manifests). */
export const MIF_PIT_DOCUMENTED_MTF_OVERLAP = {
  approxStartIso: "2026-11-17T20:35:00.000Z",
  approxEndIso: "2026-11-20T20:00:00.000Z",
  note:
    "Approximately three calendar days, limited by COMPLETE M5 coverage. Not sufficient for long-term strategy performance claims.",
} as const;
