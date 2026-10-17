/**
 * Phase 49B — Review + explicit Confirm & Send to OpenAI for multi-image analysis.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartCaptureListItem } from "../../../ai/forex-chart-capture/types";
import { captureImageUrl } from "../chart/capture/capture-client";
import type { SnapshotAnalysisPanelData } from "../SnapshotAiResultPanels";
import { SnapshotProviderResultPanel } from "../SnapshotAiResultPanels";

type ReviewPayload = {
  selectionFingerprint: string;
  imageCount: number;
  captures: Array<{
    captureId: string;
    capturedAtUtc: string;
    timeframe: string;
    mode: string;
    instrument: { displaySymbol: string; provider: string; symbol: string };
    quote: { feedHealth: string; bid: number | null; ask: number | null; lastPrice: number | null };
    marketSnapshot: { snapshotId: string | null };
  }>;
  model: string;
  modelVisionEligible: boolean;
  modelVisionNote: string;
  analysisTime: {
    snapshotId: string | null;
    contentFingerprint: string | null;
    quoteFreshness: string | null;
    feedHealth: string | null;
    bid: number | null;
    ask: number | null;
    lastPrice: number | null;
    observedAtUtc: string | null;
    provider: string | null;
    symbol: string | null;
    note: string;
  };
  mtfRoster?: {
    distinctTimeframes: string[];
    sameTimeframeDuplicates: boolean;
    captureSpanMs: number | null;
    note: string;
    roles: Array<{
      timeframe: string;
      role: string;
      imageCount: number;
      captureIds: string[];
      note: string | null;
    }>;
  };
  warnings: string[];
  note: string;
};

function selectedIdsKey(items: ChartCaptureListItem[]): string {
  return items.map((i) => i.captureId).sort().join("|");
}

export function MultiImageAnalysisPanel({
  selected,
  snapshotId,
  contentFingerprint,
  tradeAllocation,
}: {
  selected: ChartCaptureListItem[];
  snapshotId: string | null;
  contentFingerprint: string | null;
  tradeAllocation?: { amount: number; currency: string } | null;
}) {
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SnapshotAnalysisPanelData | null>(null);
  const [ackedTransmit, setAckedTransmit] = useState(false);
  const inFlight = useRef(false);
  const reviewedKey = useRef<string>("");

  // Invalidate review when selection changes.
  useEffect(() => {
    const key = selectedIdsKey(selected);
    if (review && reviewedKey.current && reviewedKey.current !== key) {
      setReview(null);
      setAckedTransmit(false);
      setSubmitError("Selection changed — re-review before sending.");
    }
  }, [selected, review]);

  const buildReview = useCallback(async () => {
    if (selected.length === 0) {
      setReviewError("Select at least one capture in the library.");
      return;
    }
    setReviewBusy(true);
    setReviewError(null);
    setSubmitError(null);
    setResult(null);
    setAckedTransmit(false);
    try {
      const res = await fetch("/api/forex/ai-analysis/openai/multi-image/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captureIds: selected.map((s) => s.captureId),
          snapshotId: snapshotId || undefined,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        code?: string;
        review?: ReviewPayload;
      };
      if (!res.ok || !data.ok || !data.review) {
        setReview(null);
        setReviewError(data.error ?? data.code ?? `Review failed (${res.status})`);
        return;
      }
      setReview(data.review);
      reviewedKey.current = selectedIdsKey(selected);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Review request failed.");
    } finally {
      setReviewBusy(false);
    }
  }, [selected, snapshotId]);

  const confirmSend = useCallback(async () => {
    if (!review || inFlight.current) return;
    if (!ackedTransmit) {
      setSubmitError("Acknowledge that images will be transmitted to OpenAI before confirming.");
      return;
    }
    if (!review.modelVisionEligible) {
      setSubmitError(review.modelVisionNote);
      return;
    }
    inFlight.current = true;
    setConfirmBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/forex/ai-analysis/openai/multi-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          selectionFingerprint: review.selectionFingerprint,
          captureIds: review.captures.map((c) => c.captureId),
          snapshotId: snapshotId || undefined,
          contentFingerprint: contentFingerprint || undefined,
          tradeAllocation: tradeAllocation ?? null,
        }),
      });
      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        code?: string;
        analysis?: SnapshotAnalysisPanelData & {
          multiImage?: SnapshotAnalysisPanelData["multiImage"];
          analysisProvider?: string;
        };
      };
      if (!res.ok || !data.ok || !data.analysis) {
        setSubmitError(data.error ?? data.code ?? `Analysis failed (${res.status})`);
        return;
      }
      setResult({
        ...data.analysis,
        analysisProvider: data.analysis.analysisProvider ?? "OPENAI",
        multiImage: data.analysis.multiImage,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Confirm request failed.");
    } finally {
      setConfirmBusy(false);
      inFlight.current = false;
    }
  }, [review, ackedTransmit, snapshotId, contentFingerprint, tradeAllocation]);

  return (
    <section className="fx-multi-image-panel" data-fx-multi-image="true" data-phase-49b="true">
      <header className="fx-capture-library-head">
        <div>
          <h2>Multi-image OpenAI analysis</h2>
          <p className="fx-panel-meta">
            Review selected chart screenshots with capture-time metadata and optional ANALYSIS_TIME snapshot.
            Images are <strong>not</strong> sent until you confirm.
          </p>
        </div>
        <button
          type="button"
          className="fx-text-button"
          disabled={reviewBusy || selected.length === 0}
          onClick={() => void buildReview()}
        >
          {reviewBusy ? "Building review…" : "Review selection"}
        </button>
      </header>

      {reviewError ? <p className="fx-capture-status is-error" role="alert">{reviewError}</p> : null}

      {review ? (
        <div className="fx-multi-image-review" data-fx-multi-image-review="true">
          <p className="fx-panel-meta">
            {review.imageCount} image(s) · model <code>{review.model}</code>
            {" · "}
            vision {review.modelVisionEligible ? "eligible" : "NOT eligible"}
          </p>
          {!review.modelVisionEligible ? (
            <p className="fx-capture-status is-error">{review.modelVisionNote}</p>
          ) : null}

          <ul className="fx-capture-list">
            {review.captures.map((c) => (
              <li key={c.captureId} className="fx-capture-card">
                <img
                  className="fx-capture-thumb"
                  src={captureImageUrl(c.captureId)}
                  alt=""
                  width={120}
                  height={68}
                />
                <div className="fx-capture-card-meta">
                  <strong>{c.instrument.displaySymbol}</strong>
                  <span>{c.timeframe} · {c.mode}</span>
                  <span>{c.capturedAtUtc}</span>
                  <span>Feed {c.quote.feedHealth}</span>
                  <span>Capture snapshot {c.marketSnapshot.snapshotId ?? "none"}</span>
                </div>
              </li>
            ))}
          </ul>

          {review.mtfRoster ? (
            <div className="fx-multi-image-context" data-fx-mtf-roster="true">
              <h3>Multi-timeframe roster</h3>
              <p className="fx-panel-meta">{review.mtfRoster.note}</p>
              <dl className="fx-capture-meta-grid">
                {review.mtfRoster.roles.map((r) => (
                  <div key={`${r.role}-${r.timeframe}`}>
                    <dt>{r.role} · {r.timeframe}</dt>
                    <dd>
                      {r.imageCount} image(s)
                      {r.note ? ` — ${r.note}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
              {review.mtfRoster.sameTimeframeDuplicates ? (
                <p className="fx-capture-status is-error">
                  Duplicate same-timeframe images are not independent MTF confirmation.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="fx-multi-image-context">
            <h3>ANALYSIS_TIME market context</h3>
            <p className="fx-panel-meta">{review.analysisTime.note}</p>
            <dl className="fx-capture-meta-grid">
              <div><dt>Snapshot</dt><dd>{review.analysisTime.snapshotId ?? "none linked"}</dd></div>
              <div><dt>Fingerprint</dt><dd>{review.analysisTime.contentFingerprint ?? "—"}</dd></div>
              <div><dt>Provider / symbol</dt><dd>{review.analysisTime.provider ?? "—"} / {review.analysisTime.symbol ?? "—"}</dd></div>
              <div><dt>Feed / freshness</dt><dd>{review.analysisTime.feedHealth ?? "—"} / {review.analysisTime.quoteFreshness ?? "—"}</dd></div>
              <div><dt>Bid / Ask / Last</dt><dd>{review.analysisTime.bid ?? "—"} / {review.analysisTime.ask ?? "—"} / {review.analysisTime.lastPrice ?? "—"}</dd></div>
              <div><dt>Observed</dt><dd>{review.analysisTime.observedAtUtc ?? "—"}</dd></div>
            </dl>
            {review.warnings.length > 0 ? (
              <ul className="fx-multi-image-warnings">
                {review.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : null}
            <p className="fx-panel-meta">Online research: not included. {review.note}</p>
          </div>

          <label className="fx-capture-select fx-multi-image-ack">
            <input
              type="checkbox"
              checked={ackedTransmit}
              onChange={(e) => setAckedTransmit(e.target.checked)}
            />
            I understand the selected chart images and associated market context will be transmitted to the configured OpenAI service.
          </label>

          <button
            type="button"
            className="fx-capture-button"
            data-fx-confirm-send="true"
            disabled={confirmBusy || !review.modelVisionEligible || !ackedTransmit}
            onClick={() => void confirmSend()}
          >
            {confirmBusy ? "Sending to OpenAI…" : "Confirm & Send to OpenAI"}
          </button>
        </div>
      ) : (
        <p className="fx-panel-meta">
          Select captures above, optionally prepare an ANALYSIS_TIME snapshot on this page, then click Review selection.
        </p>
      )}

      {submitError ? <p className="fx-capture-status is-error" role="alert">{submitError}</p> : null}

      {result ? (
        <SnapshotProviderResultPanel
          title="OpenAI multi-image analysis"
          data={result}
          busy={false}
          error={null}
          dataAttr="openai"
          onRetry={() => void confirmSend()}
          retryDisabled={confirmBusy}
        />
      ) : null}
    </section>
  );
}
