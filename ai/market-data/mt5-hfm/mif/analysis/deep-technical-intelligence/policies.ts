import {
  MIF_DEEP_TECHNICAL_POLICY_ID,
  MIF_DEEP_TECHNICAL_POLICY_VERSION,
  MIF_DTI_CONFLUENCE_MODERATE_MIN,
  MIF_DTI_CONFLUENCE_STRONG_MIN,
  MIF_DTI_MIN_MTF_FRAMES,
  MIF_DTI_WEIGHT_LEVELS,
  MIF_DTI_WEIGHT_MOMENTUM,
  MIF_DTI_WEIGHT_MTF,
  MIF_DTI_WEIGHT_PATTERNS,
  MIF_DTI_WEIGHT_PRESSURE,
  MIF_DTI_WEIGHT_REGIME,
  MIF_DTI_WEIGHT_STRUCTURE,
} from "./contracts.js";
import type { MifDeepTechnicalIntelligencePolicy } from "./types.js";

export function resolveDeepTechnicalIntelligencePolicy(
  overrides?: Partial<MifDeepTechnicalIntelligencePolicy> | null,
): MifDeepTechnicalIntelligencePolicy {
  const base: MifDeepTechnicalIntelligencePolicy = {
    policyId: MIF_DEEP_TECHNICAL_POLICY_ID,
    policyVersion: MIF_DEEP_TECHNICAL_POLICY_VERSION,
    minMtfFrames: MIF_DTI_MIN_MTF_FRAMES,
    weightStructure: MIF_DTI_WEIGHT_STRUCTURE,
    weightRegime: MIF_DTI_WEIGHT_REGIME,
    weightMtf: MIF_DTI_WEIGHT_MTF,
    weightLevels: MIF_DTI_WEIGHT_LEVELS,
    weightPatterns: MIF_DTI_WEIGHT_PATTERNS,
    weightMomentum: MIF_DTI_WEIGHT_MOMENTUM,
    weightPressure: MIF_DTI_WEIGHT_PRESSURE,
    confluenceStrongMin: MIF_DTI_CONFLUENCE_STRONG_MIN,
    confluenceModerateMin: MIF_DTI_CONFLUENCE_MODERATE_MIN,
    thresholdRationale: {
      confluenceStrongMin:
        "|directionalScore|≥0.55 with no unresolved family conflict → STRONG (analytical grade, not probability).",
      confluenceModerateMin:
        "|directionalScore|≥0.28 → MODERATE; below is WEAK/NONE.",
      pressureWeight:
        "Pressure weight 0.10 — candle-body proxy shares inputs with displacement/candlesticks; lower weight + dependency group guard.",
      doubleCountGuard:
        "One directional vote per inputDependencyGroup per assessment; pressure skipped when same tip already counted in candle-body group via displacement.",
    },
  };
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    thresholdRationale: {
      ...base.thresholdRationale,
      ...(overrides.thresholdRationale ?? {}),
    },
  };
}
