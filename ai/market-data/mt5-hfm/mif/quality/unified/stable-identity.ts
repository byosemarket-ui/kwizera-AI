/**
 * Phase 5B.2 Step 3 — deterministic unified input identity.
 */
import { createHash } from "node:crypto";
import {
  MIF_QUALITY_STEP3_UNIFIED_ENGINE_ID,
  MIF_QUALITY_STEP3_UNIFIED_ENGINE_VERSION,
  MIF_UNIFIED_QUALITY_CONTRACT_ID,
  MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
} from "../contracts.js";
import { stableSerialize } from "../stable-identity.js";
import type { AssessMifUnifiedQualityInput } from "./types.js";

export function computeUnifiedInputIdentity(input: {
  providerSymbol: string;
  consumerId: string;
  policyId: string;
  policyVersion: string;
  dataIntegrityId: string | null;
  quoteId: string | null;
  instrumentId: string | null;
  multiTimeframeId: string | null;
  shadowId: string | null;
  includeShadow: boolean;
}): string {
  const payload = {
    contractId: MIF_UNIFIED_QUALITY_CONTRACT_ID,
    contractVersion: MIF_UNIFIED_QUALITY_CONTRACT_VERSION,
    engineId: MIF_QUALITY_STEP3_UNIFIED_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP3_UNIFIED_ENGINE_VERSION,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    consumerId: input.consumerId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    subsystems: {
      dataIntegrity: input.dataIntegrityId,
      quote: input.quoteId,
      instrument: input.instrumentId,
      multiTimeframe: input.multiTimeframeId,
    },
    shadow: input.includeShadow ? input.shadowId : null,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function unifiedIdentityFromAssessInput(
  input: AssessMifUnifiedQualityInput,
  shadowId: string | null,
): string {
  return computeUnifiedInputIdentity({
    providerSymbol: input.providerSymbol,
    consumerId: input.consumerId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    dataIntegrityId: input.dataIntegrity?.inputIdentity ?? null,
    quoteId: input.quote?.inputIdentity ?? null,
    instrumentId: input.instrument?.inputIdentity ?? null,
    multiTimeframeId: input.multiTimeframe?.inputIdentity ?? null,
    shadowId,
    includeShadow: input.phase2Quality != null,
  });
}
