/**
 * Phase 5F STEP 1 — point-in-time metadata contracts.
 * Today's catalog is CURRENT_METADATA_ONLY / observation — never historical authority.
 */
import type {
  MifResearchPitInstrumentSpec,
  MifResearchPitMetadataBundle,
  MifResearchPitSessionMetadata,
} from "./types.js";

export interface MifResearchCatalogInstrumentSnapshot {
  providerSymbol: string;
  digits?: number | null;
  point?: number | null;
  tickSize?: number | null;
  contractSize?: number | null;
  sessions?: unknown;
  catalogVersion?: string | null;
  catalogPath?: string | null;
}

/**
 * Capture instrument specs as a current observation.
 * Does not claim historical effective authority.
 */
export function capturePitInstrumentSpec(input: {
  instrument: string;
  catalogRow?: MifResearchCatalogInstrumentSnapshot | null;
  observedAt?: string;
}): MifResearchPitInstrumentSpec {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const row = input.catalogRow ?? null;
  const hasAny =
    row != null &&
    (row.digits != null ||
      row.point != null ||
      row.tickSize != null ||
      row.contractSize != null);

  if (!hasAny) {
    return {
      providerSymbol: String(input.instrument).trim().toUpperCase(),
      digits: null,
      point: null,
      tickSize: null,
      contractSize: null,
      observedAt,
      effectiveAt: null,
      availability: "UNAVAILABLE",
      sourceIdentity: "none",
      confidence: "NONE",
      limitation:
        "historical instrument specifications unavailable; no fabrication; do not back-apply unknown history",
    };
  }

  return {
    providerSymbol: String(input.instrument).trim().toUpperCase(),
    digits: typeof row!.digits === "number" ? row!.digits : null,
    point: typeof row!.point === "number" ? row!.point : null,
    tickSize: typeof row!.tickSize === "number" ? row!.tickSize : null,
    contractSize: typeof row!.contractSize === "number" ? row!.contractSize : null,
    observedAt,
    // Historical effective time unknown — catalog is present-day observation.
    effectiveAt: null,
    availability: "CURRENT_METADATA_ONLY",
    sourceIdentity: row!.catalogVersion
      ? `hfm.catalog:${row!.catalogVersion}`
      : row!.catalogPath
        ? `hfm.catalog.path:${row!.catalogPath}`
        : "hfm.catalog.current_observation",
    confidence: "CURRENT_OBSERVATION",
    limitation:
      "instrument specs captured as current catalog observation only; not historically authoritative; holidays/early closures unknown",
  };
}

/**
 * Capture session metadata without claiming historical session authority.
 * Preserves existing session-authority limitations.
 */
export function capturePitSessionMetadata(input: {
  instrument: string;
  catalogRow?: MifResearchCatalogInstrumentSnapshot | null;
  observedAt?: string;
}): MifResearchPitSessionMetadata {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const row = input.catalogRow ?? null;
  const sessionsPresent = row != null && row.sessions != null;

  if (!sessionsPresent) {
    return {
      providerSymbol: String(input.instrument).trim().toUpperCase(),
      sessionsPresent: false,
      historicalAuthority: false,
      observedAt,
      effectiveAt: null,
      availability: "UNAVAILABLE",
      sourceIdentity: "none",
      confidence: "NONE",
      limitation:
        "no session schedule available at observation time; do not invent sessions/holidays/early closures",
      catalogRef: null,
      unknownBeforeObservedAt: true,
    };
  }

  return {
    providerSymbol: String(input.instrument).trim().toUpperCase(),
    sessionsPresent: true,
    historicalAuthority: false,
    observedAt,
    effectiveAt: null,
    availability: "CURRENT_METADATA_ONLY",
    sourceIdentity: row!.catalogVersion
      ? `hfm.catalog.sessions:${row!.catalogVersion}`
      : "hfm.catalog.sessions.current_observation",
    confidence: "CURRENT_OBSERVATION",
    limitation:
      "session windows are current catalog observation only; must not be applied retrospectively as historical authority; holidays/DST/early closures remain uncertain",
    catalogRef: row!.catalogVersion ?? row!.catalogPath ?? null,
    unknownBeforeObservedAt: true,
  };
}

export function buildPitMetadataBundle(input: {
  instrument: string;
  catalogRow?: MifResearchCatalogInstrumentSnapshot | null;
  observedAt?: string;
}): MifResearchPitMetadataBundle {
  const collectedAt = input.observedAt ?? new Date().toISOString();
  return {
    instrumentSpec: capturePitInstrumentSpec({
      instrument: input.instrument,
      catalogRow: input.catalogRow,
      observedAt: collectedAt,
    }),
    sessions: capturePitSessionMetadata({
      instrument: input.instrument,
      catalogRow: input.catalogRow,
      observedAt: collectedAt,
    }),
    collectedAt,
    observationCoverage: {
      observedAt: collectedAt,
      appliesRetrospectively: false,
      unknownPeriodsNote:
        "Metadata before this observation time is unknown; do not back-apply current catalog as historical truth",
    },
  };
}
