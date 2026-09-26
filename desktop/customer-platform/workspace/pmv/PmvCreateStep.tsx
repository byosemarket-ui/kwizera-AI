import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Circle, Loader2, Pause, Sparkles } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import type { PmvWorkflowState } from "../../../pmv-workflow/usePmvWorkflow";
import type { CustomerWorkflowSummary } from "../../../pmv-workflow/api";
import { elapsedMs, etaText, formatElapsed, isRunActive, runStatusLine } from "./progress-model";
import { audioDisplayTitle } from "./audio-model";
import type { CustomerStageState } from "../../../../ai/pmv-orchestrator/views";
import { resolvePmvDestination } from "../../../../ai/pmv-shared/destination.js";
import {
  LANGUAGE_OPTIONS,
  customerStatus,
  durationLabel,
  formatPrice,
  isVideoDelivered,
  selectedStyleId,
  validateForCreate,
  videoStyleOptions,
  workflowErrorMessage,
  type PmvViewInput,
} from "./view-model";

function StageIcon({ state }: { state: CustomerStageState }) {
  if (state === "done") return <Check size={14} aria-hidden />;
  if (state === "active") return <Loader2 size={14} className="pmv-spin" aria-hidden />;
  if (state === "waiting") return <Pause size={13} aria-hidden />;
  if (state === "failed") return <AlertCircle size={14} aria-hidden />;
  return <Circle size={10} aria-hidden />;
}

const STAGE_STATE_TEXT: Record<CustomerStageState, string> = {
  done: "done",
  active: "in progress",
  pending: "not started",
  waiting: "waiting for you",
  failed: "stopped",
  cancelled: "cancelled",
};

/** Overall bar, current activity, elapsed time and (only when measurable) time left — all from the server's run state. */
function RunProgress({ workflow, percent, receivedAt }: { workflow: CustomerWorkflowSummary; percent: number; receivedAt: number }) {
  const active = isRunActive(workflow);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const elapsed = workflow.status === "WAITING_FOR_USER" || workflow.status === "CANCELLED"
    ? null
    : elapsedMs(workflow, receivedAt, active ? now : receivedAt);
  const eta = active ? etaText(workflow.etaSeconds) : null;
  const line = runStatusLine(workflow);
  return (
    <div className="pmv-run" data-pmv-run={workflow.status}>
      <div className="pmv-run__top">
        <strong className="pmv-run__percent" data-pmv-percent={percent}>{percent}%</strong>
        <span className="pmv-run__status" role="status" aria-live="polite">{line}</span>
      </div>
      <div
        className={`pmv-run__bar${workflow.status === "FAILED" ? " is-failed" : ""}`}
        role="progressbar"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% — ${line}`}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
      {elapsed !== null || eta ? (
        <div className="pmv-run__meta">
          {elapsed !== null ? <span>Elapsed {formatElapsed(elapsed)}</span> : null}
          {eta ? <span data-pmv-eta="true">{eta}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PmvCreateStep({
  snap,
  view,
  flow,
  cinematicAvailable,
  onEditProduct,
  onEditStyle,
  onViewVideo,
}: {
  snap: ProductSetupSnapshot;
  view: PmvViewInput;
  flow: PmvWorkflowState;
  cinematicAvailable: boolean | null;
  onEditProduct: () => void;
  onEditStyle: () => void;
  onViewVideo: () => void;
}) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const { workflow, pending, act } = flow;
  const status = customerStatus(workflow, view);
  const busy = working || pending !== null;
  const hero = snap.imageCards.find((c) => c.assetId === snap.heroAssetId) ?? snap.imageCards[0];
  const style = videoStyleOptions(cinematicAvailable).find((o) => o.id === selectedStyleId(snap.creativeDirection.generationMode));
  const price = formatPrice(snap.essentials.currentPrice, snap.essentials.currency);
  const destination = resolvePmvDestination(snap.videoSettings.platform, snap.videoSettings.aspectRatio);
  const language = LANGUAGE_OPTIONS.find((l) => l.value === (snap.videoSettings.language || "en"))?.label ?? snap.videoSettings.language;
  const inProgress = status === "CREATING" || status === "PROCESSING";
  const waitingForLock = workflow?.status === "WAITING_FOR_USER"
    && snap.intelligenceStatus === "REVIEW"
    && snap.identityLock?.status === "PENDING_CONFIRMATION";

  const run = async (task: () => Promise<unknown>, failure: string) => {
    setWorking(true);
    setLocalError(null);
    try {
      await task();
    } catch {
      setLocalError(failure);
    } finally {
      setWorking(false);
    }
  };

  const create = () => {
    const problem = validateForCreate(view);
    if (problem) {
      setLocalError(problem);
      return;
    }
    void run(() => act(workflow?.status === "CANCELLED" ? "resume" : "start"), "Video generation is temporarily unavailable.");
  };

  const confirmAndContinue = () => void run(async () => {
    await productSetupEngine.confirmProductIdentityLock();
    await act("resume");
  }, "We could not confirm your product. Please try again.");

  const analyzeAgain = () => void run(
    () => productSetupEngine.runProductIntelligence(),
    "We could not check your product photos. Please try again.",
  );

  const message = workflowErrorMessage(workflow);
  const showSummary = !workflow || workflow.status === "COMPLETED" || workflow.status === "CANCELLED";
  const delivered = isVideoDelivered(view) && workflow?.status !== "RUNNING" && workflow?.status !== "QUEUED";

  return (
    <section className="pmv-step" aria-labelledby="pmv-create-title" data-pmv-create-status={status}>
      {showSummary ? (
        <>
          <div className="pmv-step__head">
            <h2 id="pmv-create-title">{delivered ? "Create an updated video" : "Ready to create"}</h2>
          </div>
          <div className="pmv-summary">
            {hero?.url ? <img className="pmv-summary__thumb" src={hero.url} alt={`${snap.essentials.productName || "Product"} hero photo`} /> : null}
            <dl className="pmv-summary__list">
              <div><dt>Product</dt><dd>{snap.essentials.productName || "—"}</dd></div>
              <div><dt>Photos</dt><dd>{view.savedPhotoCount}</dd></div>
              {price ? <div><dt>Price</dt><dd>{price}</dd></div> : null}
              <div><dt>Video</dt><dd>{style?.title ?? "Not selected"}</dd></div>
              <div><dt>Platform</dt><dd>{destination.platformLabel}</dd></div>
              <div><dt>Format</dt><dd>{destination.format.label}</dd></div>
              <div><dt>Duration</dt><dd>{durationLabel(null, snap.videoSettings.durationSeconds)}</dd></div>
              <div><dt>Language</dt><dd>{language}</dd></div>
              {snap.selectedAudioTitle ? <div><dt>Music</dt><dd>{audioDisplayTitle({ title: snap.selectedAudioTitle, sourceType: "UPLOADED_AUDIO" })}</dd></div> : null}
            </dl>
          </div>
          {delivered ? (
            <p className="pmv-muted">
              Your current video is ready. Creating again keeps finished work and only redoes what changed.
            </p>
          ) : null}
          {localError || flow.error ? <p className="pmv-alert" role="alert">{localError ?? flow.error}</p> : null}
          <div className="pmv-actions">
            <button type="button" className="cp-button-secondary" onClick={onEditStyle}>
              <ArrowLeft size={14} aria-hidden /> Back
            </button>
            {delivered ? (
              <button type="button" className="cp-button-secondary" onClick={onViewVideo}>View video</button>
            ) : null}
            <button type="button" className="cp-button pmv-primary" disabled={busy} onClick={create} data-pmv-create="true">
              {busy ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
              {delivered ? "Create again" : "Create video"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pmv-step__head">
            <h2 id="pmv-create-title">
              {inProgress ? "Creating your video"
                : status === "REVIEW" ? "Your input is needed"
                : status === "FAILED" ? "Your video could not be completed"
                : "Video paused"}
            </h2>
          </div>

          {workflow ? <RunProgress workflow={workflow} percent={flow.percent} receivedAt={flow.receivedAt} /> : null}

          {workflow ? (
            <ol className="pmv-progress" aria-label="Video progress">
              {workflow.stages.map((stage) => (
                <li key={stage.label} data-state={stage.state}>
                  <span className="pmv-progress__icon"><StageIcon state={stage.state} /></span>
                  <span>{stage.label}</span>
                  <span className="pmv-sr">({STAGE_STATE_TEXT[stage.state]})</span>
                </li>
              ))}
            </ol>
          ) : null}

          {waitingForLock ? (
            <div className="pmv-confirm" data-pmv-confirm="true">
              {hero?.url ? <img src={hero.url} alt={`${snap.essentials.productName || "Product"} hero photo`} /> : null}
              {snap.canConfirmIdentityLock ? (
                <div>
                  <strong>Is this your product?</strong>
                  <p className="pmv-muted">
                    {snap.intelligenceReview?.productIdentified || snap.essentials.productName}
                  </p>
                  <p className="pmv-muted">We keep your product exactly as it looks in your photos.</p>
                </div>
              ) : (
                <div>
                  <strong>We could not clearly recognise your product</strong>
                  <p className="pmv-muted">Add a clearer photo, or check the photos again.</p>
                </div>
              )}
            </div>
          ) : message ? (
            <p className={status === "FAILED" ? "pmv-alert" : "pmv-note"} role={status === "FAILED" ? "alert" : "status"}>{message}</p>
          ) : null}

          {localError || flow.error ? <p className="pmv-alert" role="alert">{localError ?? flow.error}</p> : null}

          <div className="pmv-actions">
            {!inProgress ? (
              <button type="button" className="cp-button-secondary" onClick={onEditProduct}>
                {waitingForLock ? "Change photos" : "Edit product"}
              </button>
            ) : null}
            {snap.finalOutputUrl && !inProgress ? (
              <button type="button" className="cp-button-secondary" onClick={onViewVideo}>View video</button>
            ) : null}
            {workflow?.canCancel ? (
              <button type="button" className="cp-button-secondary" disabled={busy} onClick={() => void run(() => act("cancel"), "Could not cancel. Please try again.")}>
                Cancel
              </button>
            ) : null}
            {waitingForLock && snap.canConfirmIdentityLock ? (
              <button type="button" className="cp-button pmv-primary" disabled={busy} onClick={confirmAndContinue} data-pmv-confirm-product="true">
                {busy ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : <Check size={14} aria-hidden />}
                Yes, continue
              </button>
            ) : waitingForLock ? (
              <button type="button" className="cp-button pmv-primary" disabled={busy} onClick={analyzeAgain}>
                {busy ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : null}
                Check photos again
              </button>
            ) : workflow?.canResume ? (
              <button
                type="button"
                className="cp-button pmv-primary"
                disabled={busy}
                onClick={() => void run(() => act(workflow.canRetry ? "retry" : "resume"), "Video generation is temporarily unavailable.")}
              >
                {busy ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : null}
                {workflow.canRetry ? "Try again" : "Continue"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
