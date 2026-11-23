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

/**
 * Phase 01 — priority-preserving cap: keep production catalog refs and items
 * cited by candidate support/conflict lists before filling remaining slots.
 */
export function prioritizeEvidenceItemsForCap(
  items: readonly MifUnifiedMarketEvidence[],
  maxItems: number,
): { kept: MifUnifiedMarketEvidence[]; droppedIds: string[] } {
  if (items.length <= maxItems) {
    return { kept: [...items], droppedIds: [] };
  }
  const cited = new Set<string>();
  for (const it of items) {
    for (const id of it.supportingEvidenceIds ?? []) cited.add(id);
    for (const id of it.conflictingEvidenceIds ?? []) cited.add(id);
  }
  const priority: MifUnifiedMarketEvidence[] = [];
  const rest: MifUnifiedMarketEvidence[] = [];
  for (const it of items) {
    const isCatalogRef = (it.limitations ?? []).includes("productionEvidenceRef");
    const isCited = cited.has(it.evidenceId);
    if (isCatalogRef || isCited) priority.push(it);
    else rest.push(it);
  }
  const kept: MifUnifiedMarketEvidence[] = [];
  for (const it of [...priority, ...rest]) {
    if (kept.length >= maxItems) break;
    kept.push(it);
  }
  const keptIds = new Set(kept.map((k) => k.evidenceId));
  const droppedIds = items
    .map((i) => i.evidenceId)
    .filter((id) => !keptIds.has(id));
  return { kept, droppedIds };
}

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
  const prioritized = prioritizeEvidenceItemsForCap(
    input.items,
    MIF_MARKET_EVIDENCE_MAX_ITEMS,
  );
  if (prioritized.droppedIds.length > 0) {
    warnings.push(
      `items_truncated_from_${input.items.length}_to_${MIF_MARKET_EVIDENCE_MAX_ITEMS}`,
    );
    warnings.push(
      `items_dropped_ids_sample=${prioritized.droppedIds.slice(0, 12).join(",")}`,
    );
  }
  const cappedInput = prioritized.kept;
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