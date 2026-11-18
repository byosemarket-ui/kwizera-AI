/**
 * Phase 5B.2 Step 2 — scoped instrument metadata + precision assessment.
 */
import { createHash } from "node:crypto";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_CONTRACT_VERSION,
  MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_ID,
  MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_VERSION,
} from "../contracts.js";
import {
  MIF_QI_CATALOG_PROVENANCE_UNKNOWN,
  MIF_QI_METADATA_INCOMPLETE,
  MIF_QI_MISSING_DIGITS,
  MIF_QI_MISSING_POINT,
  MIF_QI_MISSING_TICK_SIZE,
  MIF_QI_PRICE_PRECISION_UNAVAILABLE,
} from "../codes.js";
import { deriveScopedQualityStatus, uniqueFindingCodes } from "../status.js";
import { stableSerialize } from "../stable-identity.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import { checkPricesAgainstInstrument } from "./price-precision.js";
import { validateInstrumentMetadata } from "./validate-metadata.js";
import type { AssessInstrumentQualityInput, MifInstrumentQualityAssessment } from "./types.js";

function computeInstrumentInputIdentity(input: AssessInstrumentQualityInput): string {
  const inst = input.instrument;
  const payload = {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    engineId: MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_VERSION,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    requirePositivePrices: input.requirePositivePrices === true,
    prices: (input.prices ?? []).map((p) => ({
      label: p.label,
      value: p.value ?? null,
      required: p.required === true,
      requirePositive: p.requirePositive ?? null,
    })),
    instrument: inst
      ? {
          providerId: inst.providerId,
          providerSymbol: inst.providerSymbol,
          catalogVersion: inst.catalogVersion,
          digits: inst.digits,
          point: inst.point,
          tickSize: inst.tickSize,
          metadataComplete: inst.metadataComplete,
          instrumentMetadataHash: inst.instrumentMetadataHash,
        }
      : null,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function assessMifInstrumentQuality(
  input: AssessInstrumentQualityInput,
): MifInstrumentQualityAssessment {
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const findings: MifQualityFinding[] = [];

  const meta = validateInstrumentMetadata(input.instrument, symbol);
  findings.push(...meta.findings);

  let precisionVerified: boolean | null = null;
  if (input.prices && input.prices.length > 0) {
    const prec = checkPricesAgainstInstrument({
      instrument: input.instrument,
      expectedSymbol: symbol,
      prices: input.prices,
      requirePositive: input.requirePositivePrices === true,
    });
    findings.push(...prec.findings);
    precisionVerified = prec.verified;
  }

  const status = deriveScopedQualityStatus(findings);
  const inputIdentity = computeInstrumentInputIdentity(input);
  const inst = input.instrument;

  const metrics: MifQualityMetric[] = [
    {
      metricId: "metadata_complete",
      value: meta.metadataComplete,
      unit: "boolean",
      status: meta.metadataComplete ? "ok" : "uncertain",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "precision_verified",
      value: precisionVerified,
      unit: "boolean",
      status:
        precisionVerified == null
          ? "not_applicable"
          : precisionVerified
            ? "ok"
            : "blocked",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
  ];

  return {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    scope: "step2-instrument-quality",
    assessmentId: input.assessmentId ?? `step2-inst:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    engineId: MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_INSTRUMENT_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date().toISOString(),
    status,
    metadataComplete: meta.metadataComplete,
    catalogVersion: inst?.catalogVersion ?? null,
    digits: inst?.digits ?? null,
    point: inst?.point ?? null,
    tickSize: inst?.tickSize ?? null,
    precisionVerified,
    metrics,
    findings,
    warningCodes: uniqueFindingCodes(findings, (f) => f.severity === "warning" || f.severity === "info"),
    blockingCodes: uniqueFindingCodes(findings, (f) => f.severity === "blocking"),
    uncertaintyCodes: uniqueFindingCodes(
      findings,
      (f) =>
        f.code === MIF_QI_METADATA_INCOMPLETE ||
        f.code === MIF_QI_MISSING_DIGITS ||
        f.code === MIF_QI_MISSING_POINT ||
        f.code === MIF_QI_MISSING_TICK_SIZE ||
        f.code === MIF_QI_CATALOG_PROVENANCE_UNKNOWN ||
        f.code === MIF_QI_PRICE_PRECISION_UNAVAILABLE,
    ),
    diagnosticsSummary: `step2-instrument status=${status}; complete=${meta.metadataComplete}; precision=${precisionVerified}`,
    doesNotApproveAiReasoning: true,
    notUnifiedOverallAssessment: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
