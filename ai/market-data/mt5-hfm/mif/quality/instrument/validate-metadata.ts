/**
 * Phase 5B.2 Step 2 — instrument metadata validation (no invented fields).
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QI_CATALOG_PROVENANCE_UNKNOWN,
  MIF_QI_INVALID_METADATA,
  MIF_QI_METADATA_INCOMPLETE,
  MIF_QI_MISSING_DIGITS,
  MIF_QI_MISSING_POINT,
  MIF_QI_MISSING_TICK_SIZE,
  MIF_QI_PROVIDER_MISMATCH,
  MIF_QI_SYMBOL_MISMATCH,
} from "../codes.js";
import type { MifQualityFinding } from "../types.js";

export interface MetadataValidationResult {
  findings: MifQualityFinding[];
  metadataComplete: boolean;
  digitsOk: boolean;
  pointOk: boolean;
  tickSizeOk: boolean;
}

function finiteNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 12;
}

function finitePositive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export function validateInstrumentMetadata(
  instrument: MifCanonicalInstrument | null,
  expectedSymbol: string,
): MetadataValidationResult {
  const findings: MifQualityFinding[] = [];
  if (!instrument) {
    findings.push({
      code: MIF_QI_METADATA_INCOMPLETE,
      severity: "degraded",
      message: "instrument is null",
    });
    return {
      findings,
      metadataComplete: false,
      digitsOk: false,
      pointOk: false,
      tickSizeOk: false,
    };
  }

  if (instrument.providerId !== MIF_PROVIDER_ID) {
    findings.push({
      code: MIF_QI_PROVIDER_MISMATCH,
      severity: "blocking",
      message: `providerId ${String(instrument.providerId)} != HFM_MT5`,
    });
  }
  if (instrument.providerSymbol.toUpperCase() !== expectedSymbol.toUpperCase()) {
    findings.push({
      code: MIF_QI_SYMBOL_MISMATCH,
      severity: "blocking",
      message: `instrument symbol ${instrument.providerSymbol} != ${expectedSymbol}`,
    });
  }

  let digitsOk = true;
  let pointOk = true;
  let tickSizeOk = true;

  if (instrument.digits == null) {
    digitsOk = false;
    findings.push({
      code: MIF_QI_MISSING_DIGITS,
      severity: "warning",
      message: "digits missing",
    });
  } else if (!finiteNonNegInt(instrument.digits)) {
    digitsOk = false;
    findings.push({
      code: MIF_QI_INVALID_METADATA,
      severity: "blocking",
      message: "digits invalid (expect integer 0..12)",
      evidence: { digits: String(instrument.digits) },
    });
  }

  if (instrument.point == null) {
    pointOk = false;
    findings.push({
      code: MIF_QI_MISSING_POINT,
      severity: "warning",
      message: "point missing",
    });
  } else if (!finitePositive(instrument.point)) {
    pointOk = false;
    findings.push({
      code: MIF_QI_INVALID_METADATA,
      severity: "blocking",
      message: "point must be finite and > 0 when present",
      evidence: { point: String(instrument.point) },
    });
  }

  if (instrument.tickSize == null) {
    tickSizeOk = false;
    findings.push({
      code: MIF_QI_MISSING_TICK_SIZE,
      severity: "warning",
      message: "tickSize missing",
    });
  } else if (!finitePositive(instrument.tickSize)) {
    tickSizeOk = false;
    findings.push({
      code: MIF_QI_INVALID_METADATA,
      severity: "blocking",
      message: "tickSize must be finite and > 0 when present",
      evidence: { tickSize: String(instrument.tickSize) },
    });
  }

  if (!instrument.catalogVersion) {
    findings.push({
      code: MIF_QI_CATALOG_PROVENANCE_UNKNOWN,
      severity: "warning",
      message: "catalogVersion unknown; provenance not established",
    });
  }

  const metadataComplete =
    digitsOk &&
    pointOk &&
    tickSizeOk &&
    Boolean(instrument.catalogVersion) &&
    instrument.digits != null &&
    instrument.point != null &&
    instrument.tickSize != null;

  if (!metadataComplete) {
    findings.push({
      code: MIF_QI_METADATA_INCOMPLETE,
      severity: "warning",
      message: "instrument metadata incomplete",
      evidence: {
        digitsOk,
        pointOk,
        tickSizeOk,
        catalogVersion: instrument.catalogVersion,
        declaredComplete: instrument.metadataComplete,
      },
    });
  }

  return { findings, metadataComplete, digitsOk, pointOk, tickSizeOk };
}
