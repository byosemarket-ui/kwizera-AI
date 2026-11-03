/**
 * Phase 4.18F.7+ — Deterministic evidence-integrity validation.
 * Ensures chart image and technical/OpenAI evidence refer to the same observation.
 * Fail-closed on mismatch. Never invents missing identifiers.
 */

export const EVIDENCE_INTEGRITY_SCHEMA = "kwizera.at-evidence-integrity.v1" as const;

export type EvidenceIntegrityStatus =
  | "VALID"
  | "MISSING_OBSERVATION"
  | "MISSING_IMAGE"
  | "OBSERVATION_MISMATCH"
  | "IMAGE_HASH_MISMATCH"
  | "INSTRUMENT_MISMATCH"
  | "TIMEFRAME_MISMATCH"
  | "FINGERPRINT_MISMATCH";

export interface EvidenceIntegrityInput {
  observationId: string | null | undefined;
  imageId: string | null | undefined;
  imageHash: string | null | undefined;
  instrument: string | null | undefined;
  primaryTimeframe: string | null | undefined;
  marketDataFingerprint: string | null | undefined;
  /** Correlated fields from delivery / analysis / monitor health. */
  deliveryObservationId?: string | null;
  deliveryImageId?: string | null;
  deliveryImageHash?: string | null;
  evidenceFingerprint?: string | null;
  analysisInstrument?: string | null;
  analysisPrimaryTimeframe?: string | null;
  includedImageBytesInRequest?: boolean | null;
  requireImage?: boolean;
}

export interface EvidenceIntegrityReport {
  schemaVersion: typeof EVIDENCE_INTEGRITY_SCHEMA;
  status: EvidenceIntegrityStatus;
  ok: boolean;
  observationId: string | null;
  imageId: string | null;
  imageHash: string | null;
  instrument: string | null;
  primaryTimeframe: string | null;
  marketDataFingerprint: string | null;
  includedImageBytesInRequest: boolean | null;
  reasons: string[];
}

function norm(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function sameId(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b;
  return a === b;
}

/**
 * Validate that observation / image / evidence identifiers correlate.
 * Missing required fields ⇒ fail-closed (not fabricated).
 */
export function validateEvidenceIntegrity(input: EvidenceIntegrityInput): EvidenceIntegrityReport {
  const observationId = norm(input.observationId);
  const imageId = norm(input.imageId);
  const imageHash = norm(input.imageHash);
  const instrument = norm(input.instrument);
  const primaryTimeframe = norm(input.primaryTimeframe);
  const marketDataFingerprint = norm(input.marketDataFingerprint);
  const reasons: string[] = [];
  const requireImage = input.requireImage !== false;

  if (!observationId) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "MISSING_OBSERVATION",
      ok: false,
      observationId: null,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: ["observationId is MISSING."],
    };
  }

  if (requireImage && (!imageId || !imageHash)) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "MISSING_IMAGE",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: [
        !imageId ? "imageId is MISSING." : null,
        !imageHash ? "imageHash is MISSING." : null,
      ].filter(Boolean) as string[],
    };
  }

  const deliveryObs = norm(input.deliveryObservationId);
  if (deliveryObs != null && !sameId(observationId, deliveryObs)) {
    reasons.push("delivery.observationId does not match chart observationId.");
  }

  const deliveryImg = norm(input.deliveryImageId);
  if (imageId && deliveryImg != null && !sameId(imageId, deliveryImg)) {
    reasons.push("delivery.imageId does not match chart imageId.");
  }

  const deliveryHash = norm(input.deliveryImageHash);
  if (imageHash && deliveryHash != null && !sameId(imageHash, deliveryHash)) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "IMAGE_HASH_MISMATCH",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: ["delivery.imageHash does not match chart imageHash."],
    };
  }

  const analysisInstrument = norm(input.analysisInstrument);
  if (instrument && analysisInstrument && instrument !== analysisInstrument) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "INSTRUMENT_MISMATCH",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: ["analysis.instrument does not match observation instrument."],
    };
  }

  const analysisTf = norm(input.analysisPrimaryTimeframe);
  if (primaryTimeframe && analysisTf && primaryTimeframe !== analysisTf) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "TIMEFRAME_MISMATCH",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: ["analysis.primaryTimeframe does not match observation timeframe."],
    };
  }

  const evidenceFp = norm(input.evidenceFingerprint);
  if (
    marketDataFingerprint
    && evidenceFp
    && marketDataFingerprint !== evidenceFp
  ) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "FINGERPRINT_MISMATCH",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons: ["chart marketDataFingerprint does not match evidence fingerprint."],
    };
  }

  if (reasons.length) {
    return {
      schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
      status: "OBSERVATION_MISMATCH",
      ok: false,
      observationId,
      imageId,
      imageHash,
      instrument,
      primaryTimeframe,
      marketDataFingerprint,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
      reasons,
    };
  }

  return {
    schemaVersion: EVIDENCE_INTEGRITY_SCHEMA,
    status: "VALID",
    ok: true,
    observationId,
    imageId,
    imageHash,
    instrument,
    primaryTimeframe,
    marketDataFingerprint,
    includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
    reasons: [],
  };
}
