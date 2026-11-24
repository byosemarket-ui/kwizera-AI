import { createHash } from "node:crypto";
import type { HfmDatasetValidationReport, HfmResearchSourceMode } from "../strategy-research/types.js";
import type { HfmResearchInputGateReport } from "./types.js";

export function evaluateResearchInputGate(input: {
  dataset: HfmDatasetValidationReport | null;
  strategyId: string | null;
  strategyVersion: string | null;
  sourceMode: HfmResearchSourceMode | null;
  relatedResearchRunId: string | null;
  validationTimestamp: string;
}): HfmResearchInputGateReport {
  const warnings: string[] = [];
  const blockReasons: string[] = [];
  const dataset = input.dataset;

  if (!dataset) {
    blockReasons.push("dataset_missing");
  } else {
    if (!dataset.mayProceed) {
      blockReasons.push(...dataset.blockReasons);
      if (dataset.qualityStatus === "INSUFFICIENT_HISTORY") {
        blockReasons.push("INSUFFICIENT_HISTORY");
      }
      if (dataset.qualityStatus === "INVALID") {
        blockReasons.push("INVALID_DATASET");
      }
    }
    if (dataset.qualityStatus === "VALID_WITH_WARNINGS" || dataset.warnings.length) {
      warnings.push(...dataset.warnings);
    }
    if (dataset.sourceMode === "FIXTURE" || dataset.sourceMode === "SYNTHETIC_TEST_DATA") {
      warnings.push(`sourceMode=${dataset.sourceMode} — not live market history`);
    }
    if (dataset.sourceMode === "LIVE_SOURCE" && dataset.providerId !== "HFM_MT5") {
      blockReasons.push("SOURCE_UNVERIFIED");
    }
  }

  if (!input.strategyId) {
    warnings.push("strategy_id_missing");
  }

  let gate: HfmResearchInputGateReport["gate"];
  if (blockReasons.some((b) => b.includes("SOURCE_UNVERIFIED") || b === "SOURCE_UNVERIFIED")) {
    gate = "SOURCE_UNVERIFIED";
  } else if (blockReasons.some((b) => b.includes("INSUFFICIENT"))) {
    gate = "INSUFFICIENT_DATA";
  } else if (blockReasons.length) {
    gate = "RESEARCH_BLOCKED";
  } else if (warnings.length) {
    gate = "RESEARCH_ALLOWED_WITH_WARNINGS";
  } else {
    gate = "RESEARCH_ALLOWED";
  }

  const validationRecordId = createHash("sha256")
    .update(
      JSON.stringify({
        datasetId: dataset?.datasetId ?? null,
        contentHash: dataset?.contentHash ?? null,
        gate,
        ts: input.validationTimestamp,
        related: input.relatedResearchRunId,
      }),
    )
    .digest("hex")
    .slice(0, 24);

  return {
    gate,
    datasetId: dataset?.datasetId ?? null,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    sourceMode: input.sourceMode ?? dataset?.sourceMode ?? null,
    blockReasons: [...new Set(blockReasons)],
    warnings: [...new Set(warnings)],
    relatedResearchRunId: input.relatedResearchRunId,
    validationRecordId: `rrv_${validationRecordId}`,
    evidenceKind: "MEASURED",
  };
}
