/**
 * Clearly labelled TEST FIXTURES for Dynamic Spread Intelligence unit tests.
 * Never used as LIVE market data. Never submitted to a broker.
 */
import type { AtSimContractMetaInput } from "../simulation-risk/types.js";
import type { DynamicSpreadHistoricalObservation } from "./types.js";

export const DYNAMIC_SPREAD_TEST_FIXTURE_NOTE =
  "TEST FIXTURE — not LIVE market data; never submit to broker." as const;

/** EUR/USD verified contract fixture (pipCost $1 / lot / pip at pointSize 0.00001). */
export function fixtureEurUsdContract(): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.00001,
    tickSize: 0.00001,
    digits: 5,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 100_000,
    baseUnitSize: 1000,
    pipCostAccount: 0.1,
    marginPerLotAccount: 33,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "TEST_FIXTURE",
    unavailableReason: null,
  };
}

export function fixtureGbpUsdContract(): AtSimContractMetaInput {
  return {
    ...fixtureEurUsdContract(),
    source: "TEST_FIXTURE_GBPUSD",
  };
}

export function fixtureUsdJpyContract(): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.001,
    tickSize: 0.001,
    digits: 3,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 100_000,
    baseUnitSize: 1000,
    pipCostAccount: 0.091, // illustrative USD account cost per pip/lot — fixture only
    marginPerLotAccount: 40,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "TEST_FIXTURE_USDJPY",
    unavailableReason: null,
  };
}

export function fixtureXauUsdContract(): AtSimContractMetaInput {
  return {
    verified: true,
    pointSize: 0.01,
    tickSize: 0.01,
    digits: 2,
    quantityMin: 1,
    quantityStep: 1,
    quantityUnit: "contracts",
    quantityUnitAmbiguous: false,
    contractMultiplier: 1,
    baseUnitSize: 1,
    pipCostAccount: 0.01,
    marginPerLotAccount: 50,
    minStopDistance: null,
    minStopDistanceVerified: false,
    source: "TEST_FIXTURE_XAUUSD",
    unavailableReason: null,
  };
}

/**
 * Build n historical absolute-spread observations ending near `nowMs`.
 * Values cluster around `baseSpread` with tiny variation (not abnormal).
 */
export function fixtureRollingSpreads(input: {
  n: number;
  baseSpread: number;
  instrument: string;
  nowMs?: number;
  gapMs?: number;
}): DynamicSpreadHistoricalObservation[] {
  const nowMs = input.nowMs ?? Date.now();
  const gap = input.gapMs ?? 60_000;
  const out: DynamicSpreadHistoricalObservation[] = [];
  for (let i = 0; i < input.n; i++) {
    const atMs = nowMs - (input.n - i) * gap;
    // Slight variation well below P95 widening thresholds.
    const wobble = ((i % 5) - 2) * input.baseSpread * 0.01;
    out.push({
      spreadAbsolute: Math.max(input.baseSpread * 0.5, input.baseSpread + wobble),
      observedAtUtc: new Date(atMs).toISOString(),
      provenance: "LIVE",
      instrument: input.instrument,
    });
  }
  return out;
}
