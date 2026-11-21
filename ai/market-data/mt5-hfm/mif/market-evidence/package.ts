import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  MIF_MARKET_EVIDENCE_MAX_ITEMS,
  MIF_MARKET_EVIDENCE_MAX_WARNINGS,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID,
  MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION,
} from "./contracts.js";
import { dedupeAndRelateEvidence } from "./dedupe.js";
import { buildPackageId } from "./identity.js";
import type { MifMarketEvidencePackage, MifUnifiedMarketEvidence } from "./types.js";
import { validateMarketEvidencePackage } from "./validate.js";

export function assembleMarketEvidencePackage(input: {
  items: readonly MifUnifiedMarketEvidence[];
  analysisId?: string | null;
  runId?: string | null;
  snapshotId?: string | null;
  snapshotIdSourceVerified?: boolean;
  providerSymbol: string;
  limitations?: readonly string[];
}): MifMarketEvidencePackage {
  const warnings: string[] = [];
  if (input.items.length > MIF_MARKET_EVIDENCE_MAX_ITEMS) {
    warnings.push(`items_truncated_from_${input.items.length}_to_${MIF_MARKET_EVIDENCE_MAX_ITEMS}`);
  }
  const cappedInput = input.items.slice(0, MIF_MARKET_EVIDENCE_MAX_ITEMS);
  const { items, relations, droppedDuplicateCount } = dedupeAndRelateEvidence(cappedInput);
  const snapshotId = input.snapshotId ?? null;
  const snapshotIdSourceVerified =
    snapshotId == null ? false : input.snapshotIdSourceVerified === true;
  const assembledAt = new Date().toISOString();
  const packageId = buildPackageId({
    providerSymbol: input.providerSymbol,
    analysisId: input.analysisId ?? null,
    runId: input.runId ?? null,
    snapshotId,
    itemFingerprints: items.map((i) => i.provenance.sourceFingerprint),
  });

  const pkg: MifMarketEvidencePackage = {
    contractId: MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_ID,
    contractVersion: MIF_MARKET_EVIDENCE_PACKAGE_CONTRACT_VERSION,
    packageId,
    analysisId: input.analysisId ?? null,
    runId: input.runId ?? null,
    snapshotId,
    snapshotIdSourceVerified,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: input.providerSymbol,
    assembledAt,
    items,
    relations,
    droppedDuplicateCount,
    warnings: warnings.slice(0, MIF_MARKET_EVIDENCE_MAX_WARNINGS),
    limitations: (input.limitations ?? []).slice(0, MIF_MARKET_EVIDENCE_MAX_WARNINGS),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalEvidencePackageOnly: true,
    notExecutable: true,
  };

  const vr = validateMarketEvidencePackage(pkg);
  if (!vr.ok) {
    throw new Error(`Invalid market evidence package: ${vr.errors.join("; ")}`);
  }

  return pkg;
}