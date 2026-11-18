/**
 * Multi-timeframe synchronization for HFM Analysis pack.
 */
import { HFM_ANALYSIS_DEFAULT_TF_PACK, HFM_ANALYSIS_PROVIDER } from "./constants.js";
import type {
  HfmAnalysisQualityIssue,
  HfmAnalysisQualityStatus,
  HfmAnalysisQuoteContext,
  HfmAnalysisSyncReport,
  HfmAnalysisTfDataset,
} from "./types.js";

function issue(
  code: string,
  message: string,
  severity: "error" | "warning",
  extra?: Partial<HfmAnalysisQualityIssue>,
): HfmAnalysisQualityIssue {
  return {
    code,
    message,
    severity,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function synchronizeAnalysisTimeframes(input: {
  symbol: string;
  datasets: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  requiredTimeframes?: readonly string[];
}): HfmAnalysisSyncReport {
  const required = input.requiredTimeframes ?? HFM_ANALYSIS_DEFAULT_TF_PACK;
  const errors: HfmAnalysisQualityIssue[] = [];
  const warnings: HfmAnalysisQualityIssue[] = [];
  const present: string[] = [];
  const missing: string[] = [];
  const latestCandleByTf: Record<string, number | null> = {};

  for (const tf of required) {
    const ds = input.datasets[tf];
    if (!ds) {
      missing.push(tf);
      errors.push(issue("SYNC_MISSING_TF", `missing ${tf}`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
      latestCandleByTf[tf] = null;
      continue;
    }
    present.push(tf);
    latestCandleByTf[tf] = ds.current?.timestamp ?? ds.newestTimestamp;
    if (ds.symbol.toUpperCase() !== input.symbol.toUpperCase()) {
      errors.push(issue("SYNC_SYMBOL_MISMATCH", `${tf} symbol ${ds.symbol}`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
    }
    if (ds.timeframe.toUpperCase() !== tf.toUpperCase()) {
      errors.push(issue("SYNC_TF_LABEL_MISMATCH", `dataset labeled ${ds.timeframe}`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
    }
    if (input.quote.symbol.toUpperCase() !== input.symbol.toUpperCase()) {
      errors.push(issue("SYNC_QUOTE_SYMBOL", "quote symbol mismatch", "error", {
        symbol: input.symbol,
        sourceField: "quote",
      }));
    }
  }

  // Higher TF may still be forming while lower TF advanced — record as info warning only when tips diverge widely.
  const tips = Object.values(latestCandleByTf).filter((t): t is number => t != null);
  if (tips.length >= 2) {
    const min = Math.min(...tips);
    const max = Math.max(...tips);
    if (max - min > 3600 * 6) {
      warnings.push(
        issue(
          "SYNC_TIP_DIVERGENCE",
          `candle tip spread ${max - min}s across TFs (may be normal across sessions)`,
          "warning",
          { symbol: input.symbol },
        ),
      );
    }
  }

  let status: HfmAnalysisQualityStatus = "VALID";
  if (missing.length) status = "INCOMPLETE";
  else if (errors.length) status = "INVALID";
  else if (warnings.length) status = "DEGRADED";

  return {
    status,
    symbol: input.symbol.toUpperCase(),
    timeframesPresent: present,
    timeframesMissing: missing,
    latestQuoteTimestamp: input.quote.brokerTimestamp,
    latestCandleByTf,
    warnings,
    errors,
  };
}

export function assertProviderExclusive(provider: string): boolean {
  return provider === HFM_ANALYSIS_PROVIDER;
}
