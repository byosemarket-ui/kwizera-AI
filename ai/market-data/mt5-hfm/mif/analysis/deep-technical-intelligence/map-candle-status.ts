import type { MifCandleState } from "../../canonical/types.js";
import type { HfmDeepTechnicalCandleStatus } from "./types.js";

/**
 * Map canonical tip candle state to Phase 06 vocabulary.
 * Does not change upstream engine confirmation rules.
 */
export function mapCanonicalCandleStatus(
  tip: MifCandleState | null | undefined,
  opts?: { incompleteHistory?: boolean; invalidTimestamp?: boolean },
): HfmDeepTechnicalCandleStatus {
  if (opts?.invalidTimestamp) return "INVALID_TIMESTAMP";
  if (opts?.incompleteHistory) return "INCOMPLETE_HISTORY";
  switch (tip) {
    case "CLOSED":
      return "CLOSED_CANDLE";
    case "FORMING":
      return "FORMING_CANDLE";
    case "STALE":
      return "STALE_DATA";
    case "MISSING":
      return "MISSING_DATA";
    case "INVALID":
      return "INVALID_TIMESTAMP";
    default:
      return tip ? "MISSING_DATA" : "MISSING_DATA";
  }
}
