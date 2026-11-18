/**
 * Chart image identity validation — fail-closed against snapshot mismatch.
 */
import {
  HFM_ANALYSIS_IMAGE_HEIGHT,
  HFM_ANALYSIS_IMAGE_MAX_BYTES,
  HFM_ANALYSIS_IMAGE_WIDTH,
  HFM_ANALYSIS_PROVIDER,
  HFM_ANALYSIS_RENDERER_VERSION,
} from "./constants.js";
import { isValidPngBuffer } from "./png-encode.js";
import type { HfmAnalysisChartImageMeta, HfmAnalysisMultiTfSnapshot } from "./types.js";

export function validateChartImageIdentity(input: {
  meta: HfmAnalysisChartImageMeta;
  png: Buffer;
  snapshot: HfmAnalysisMultiTfSnapshot;
  timeframe: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const { meta, png, snapshot, timeframe } = input;
  const tf = timeframe.toUpperCase();
  const ds = snapshot.timeframes[tf];

  if (meta.provider !== HFM_ANALYSIS_PROVIDER) errors.push("provider mismatch");
  if (meta.symbol.toUpperCase() !== snapshot.symbol.toUpperCase()) errors.push("symbol mismatch");
  if (meta.timeframe.toUpperCase() !== tf) errors.push("timeframe mismatch");
  if (meta.snapshotId !== snapshot.snapshotId) errors.push("snapshotId mismatch");
  if (meta.snapshotHash !== snapshot.snapshotHash) errors.push("snapshotHash mismatch");
  if (meta.capturedAt !== snapshot.capturedAt) errors.push("capturedAt mismatch");
  if (meta.imageFormat !== "png") errors.push("imageFormat invalid");
  if (meta.rendererVersion !== HFM_ANALYSIS_RENDERER_VERSION) {
    errors.push("rendererVersion mismatch");
  }
  if (!isValidPngBuffer(png)) errors.push("invalid PNG bytes");
  if (png.length !== meta.imageSizeBytes) errors.push("imageSizeBytes mismatch");
  if (meta.imageWidth < 320 || meta.imageWidth > HFM_ANALYSIS_IMAGE_WIDTH * 2) {
    errors.push("imageWidth out of bounds");
  }
  if (meta.imageHeight < 240 || meta.imageHeight > HFM_ANALYSIS_IMAGE_HEIGHT * 2) {
    errors.push("imageHeight out of bounds");
  }
  if (meta.imageSizeBytes > HFM_ANALYSIS_IMAGE_MAX_BYTES) errors.push("image too large");
  if (!ds) errors.push("timeframe missing from snapshot");
  else {
    const hist = ds.historical;
    if (!hist.length) errors.push("no candles for timeframe");
    else {
      if (meta.candleStart != null && meta.candleStart !== hist[0]!.timestamp && hist.length) {
        // display slice may start mid-history — allow start >= first historical
        const okStart = hist.some((c) => c.timestamp === meta.candleStart);
        if (!okStart) errors.push("candleStart not in snapshot series");
      }
      const lastHist = hist[hist.length - 1]!.timestamp;
      const tip = ds.current?.timestamp ?? lastHist;
      if (meta.candleEnd != null && meta.candleEnd !== lastHist && meta.candleEnd !== tip) {
        const okEnd = hist.some((c) => c.timestamp === meta.candleEnd) || tip === meta.candleEnd;
        if (!okEnd) errors.push("candleEnd not in snapshot series");
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function rejectForeignImageMeta(
  meta: HfmAnalysisChartImageMeta,
  expected: { symbol: string; timeframe: string; snapshotId: string; snapshotHash: string },
): string[] {
  const errors: string[] = [];
  if (meta.symbol.toUpperCase() !== expected.symbol.toUpperCase()) errors.push("wrong symbol");
  if (meta.timeframe.toUpperCase() !== expected.timeframe.toUpperCase()) errors.push("wrong timeframe");
  if (meta.snapshotId !== expected.snapshotId) errors.push("wrong snapshot");
  if (meta.snapshotHash !== expected.snapshotHash) errors.push("wrong snapshot hash");
  return errors;
}
