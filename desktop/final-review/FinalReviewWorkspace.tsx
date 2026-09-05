import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download, Loader2, MoreHorizontal, RefreshCw,
} from "lucide-react";
import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import {
  finalReviewEngine,
  PRODUCTION_STAGES,
  stageCompletion,
} from "./final-review-engine";
import type { FinalReviewSnapshot } from "./final-review-engine";
import "./final-review.css";

function saveMenu(
  anchor: HTMLElement | null,
  onClose: () => void,
  actions: Array<{ label: string; onClick: () => void }>,
) {
  if (!anchor) return null;
  return (
    <div className="fr-overflow-menu" role="menu">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          onClick={() => { action.onClick(); onClose(); }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function FinalReviewWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<FinalReviewSnapshot>(() => finalReviewEngine.snapshot());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const lastAutoplayUrl = useRef<string | null>(null);

  useEffect(() => {
    const unsub = finalReviewEngine.subscribe(setSnap);
    void finalReviewEngine.hydrate().then(() => {
      if (!startedRef.current && finalReviewEngine.snapshot().context) {
        startedRef.current = true;
        void finalReviewEngine.startProduction();
      }
    });
    return () => {
      unsub();
      finalReviewEngine.stopPolling();
    };
  }, []);

  const ctx = snap.context;
  const isReady = snap.uiStage === "completed" && Boolean(snap.outputUrl);
  const isFailed = snap.uiStage === "failed";
  const isAwaitingOutput = snap.uiStage === "awaiting-output";
  const inFlight = snap.busy
    || ["queued", "preparing", "rendering", "validating", "registering", "awaiting-output", "initializing", "creating-timeline"].includes(snap.uiStage);

  useEffect(() => {
    if (!isReady || !snap.outputUrl) return;
    if (lastAutoplayUrl.current === snap.outputUrl) return;
    lastAutoplayUrl.current = snap.outputUrl;
    const el = videoRef.current;
    if (!el) return;
    el.load();
    void el.play().catch(() => undefined);
  }, [isReady, snap.outputUrl]);

  const onRetry = useCallback(async () => {
    if (inFlight && snap.uiStage !== "failed" && snap.uiStage !== "completed" && snap.uiStage !== "awaiting-output") {
      notify("info", "Render in progress", "A production job is already running for this project.", "updates");
      return;
    }
    await finalReviewEngine.retryProduction();
    notify("info", "Retrying production", "Restarting video render.", "updates");
  }, [notify, inFlight, snap.uiStage]);

  const onDownload = useCallback(() => {
    if (!snap.outputUrl || !ctx) return;
    const link = document.createElement("a");
    link.href = snap.outputUrl;
    link.download = `${ctx.productName.replace(/\s+/g, "-")}-video.mp4`;
    link.rel = "noopener";
    link.click();
  }, [snap.outputUrl, ctx]);

  const progress = Math.min(100, Math.max(0, snap.progress));

  return (
    <div className="fr-page">
      <WorkflowProgress currentStep={4} projectName={ctx?.productName} />

      <div className="fr-layout">
        <main className="fr-main">
          <header className="fr-header">
            <span className="kw-workflow-progress__step-label">
              {isReady ? "VIDEO READY" : "STEP 4 OF 4 · CREATING YOUR VIDEO"}
            </span>
            <h1>{isReady ? "Your Video Is Ready" : "Creating Your Video"}</h1>
            {ctx ? (
              <div className="fr-meta">
                <strong>{ctx.productName}</strong>
                <span>{ctx.styleLabel}</span>
                <span>{ctx.platformLabel} · {ctx.formatLabel} · {ctx.durationSeconds} sec</span>
                {ctx.language ? <span>{ctx.language}</span> : null}
              </div>
            ) : (
              <p className="fr-hint">Complete Video Style (Step 3) to start production.</p>
            )}
            {ctx && (ctx.brandName || ctx.website || ctx.phone || ctx.cta || ctx.logoUrl) ? (
              <div className="fr-brand-identity">
                {ctx.logoUrl ? <img className="fr-brand-logo" src={ctx.logoUrl} alt="" /> : null}
                <div>
                  {ctx.brandName ? <div><strong>{ctx.brandName}</strong></div> : null}
                  {ctx.cta ? <div>{ctx.cta}</div> : null}
                  {ctx.website ? <div>{ctx.website.replace(/^https?:\/\//i, "")}</div> : null}
                  {ctx.phone ? <div>{ctx.phone}</div> : null}
                </div>
              </div>
            ) : null}
          </header>

          {!ctx ? (
            <section className="fr-panel">
              <button type="button" className="fr-btn" onClick={() => switchWorkspace("video-style")}>
                Go to Step 3
              </button>
            </section>
          ) : isReady ? (
            <section className="fr-panel fr-ready">
              <div className="fr-player-wrap">
                <video
                  ref={videoRef}
                  key={snap.outputUrl!}
                  src={snap.outputUrl!}
                  controls
                  playsInline
                  preload="metadata"
                  className="fr-player"
                />
              </div>
              <div className="fr-ready-actions">
                <button type="button" className="fr-btn fr-btn--primary" onClick={onDownload}>
                  <Download size={16} /> Download
                </button>
                <button type="button" className="fr-btn" onClick={() => switchWorkspace("video-style")}>
                  Edit &amp; Re-render
                </button>
                <button type="button" className="fr-btn" disabled={inFlight && snap.uiStage !== "completed"} onClick={() => void onRetry()}>
                  Create New Version
                </button>
                <button type="button" className="fr-btn fr-btn--ghost" onClick={() => switchWorkspace("new-project")}>
                  New Project
                </button>
              </div>
              {(snap.video?.versions?.length ?? 0) > 0 ? (
                <div className="fr-versions">
                  <h3>Version history</h3>
                  <ul>
                    {(snap.video?.versions ?? []).slice().reverse().map((version, index) => (
                      <li key={version.versionId}>
                        Version {(snap.video?.versions?.length ?? 0) - index}
                        {" · "}
                        {new Date(version.createdAt).toLocaleString()}
                        {" · "}
                        {Math.round(version.durationMs / 1000)}s
                        {version.output.url === snap.outputUrl ? " (current)" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {snap.qualityReview ? (
                <div className="fr-quality">
                  <h3>Quality review</h3>
                  <p>
                    Score: <strong>{snap.qualityReview.score}/100</strong>
                    {" · "}
                    {snap.qualityReview.source === "ai" ? "AI-assisted review" : "Technical review"}
                  </p>
                  {snap.qualityReview.suggestions.length ? (
                    <ul>
                      {snap.qualityReview.suggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="fr-hint">No improvement suggestions — video passed quality checks.</p>
                  )}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="fr-panel">
              {isFailed ? (
                <div className="fr-error">
                  <p>Video production encountered a problem.</p>
                  <p className="fr-error-detail">{snap.error ?? "Unknown error"}</p>
                  <div className="fr-ready-actions">
                    <button type="button" className="fr-btn fr-btn--primary" onClick={() => void onRetry()}>
                      <RefreshCw size={16} /> Retry
                    </button>
                    <button type="button" className="fr-btn" onClick={() => switchWorkspace("video-style")}>
                      Regenerate plan
                    </button>
                    <button type="button" className="fr-btn" onClick={() => switchWorkspace("new-project")}>
                      Edit images
                    </button>
                    <button type="button" className="fr-btn" onClick={() => switchWorkspace("home")}>
                      Return Home
                    </button>
                  </div>
                </div>
              ) : isAwaitingOutput ? (
                <div className="fr-error fr-error--info">
                  <p>Render finished — verifying the final video file…</p>
                  <p className="fr-error-detail">{snap.currentStageLabel}</p>
                  <div className="fr-ready-actions">
                    <button type="button" className="fr-btn fr-btn--primary" onClick={() => void finalReviewEngine.hydrate()}>
                      <RefreshCw size={16} /> Check again
                    </button>
                    <button type="button" className="fr-btn" onClick={() => void onRetry()}>
                      Re-render
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="fr-progress-head">
                    <span className="fr-progress-pct">{progress}%</span>
                    <span className="fr-progress-stage">{snap.currentStageLabel}</span>
                    {snap.busy ? <Loader2 size={18} className="fr-spin" /> : null}
                  </div>
                  {snap.job?.sceneIndex && snap.job?.sceneCount ? (
                    <p className="fr-hint">
                      Rendering scene {snap.job.sceneIndex} of {snap.job.sceneCount}
                    </p>
                  ) : null}
                  <div className="fr-progress-bar" aria-hidden="true">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <ol className="fr-stages">
                    {PRODUCTION_STAGES.map((stage) => {
                      const state = stageCompletion(progress, stage.minProgress);
                      return (
                        <li key={stage.id} className={`fr-stage is-${state}`}>
                          <span className="fr-stage-icon">
                            {state === "done" ? "✓" : state === "active" ? "●" : "○"}
                          </span>
                          {stage.label}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </section>
          )}
        </main>

        {ctx ? (
          <aside className="fr-summary">
            <h2>Project Summary</h2>
            <div className="fr-summary-thumb">
              {ctx.heroUrl ? <img src={ctx.heroUrl} alt="" /> : null}
            </div>
            <dl>
              <div><dt>Product</dt><dd>{ctx.productName}</dd></div>
              <div><dt>Style</dt><dd>{ctx.styleLabel}</dd></div>
              <div><dt>Platform</dt><dd>{ctx.platformLabel}</dd></div>
              <div><dt>Format</dt><dd>{ctx.formatLabel}</dd></div>
              <div><dt>Duration</dt><dd>{ctx.durationSeconds} sec</dd></div>
              {ctx.language ? <div><dt>Language</dt><dd>{ctx.language}</dd></div> : null}
              {ctx.priceLabel ? <div><dt>Price</dt><dd>{ctx.priceLabel}</dd></div> : null}
              {ctx.discountLabel ? <div><dt>Discount</dt><dd>{ctx.discountLabel}</dd></div> : null}
              <div><dt>Scenes</dt><dd>{ctx.sceneCount}</dd></div>
              <div><dt>Images</dt><dd>{ctx.handoff.assetIds.length}</dd></div>
            </dl>
            <div className="fr-summary-actions" ref={menuRef}>
              <button
                type="button"
                className="fr-btn fr-btn--icon"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && saveMenu(menuRef.current, () => setMenuOpen(false), [
                ...(snap.outputUrl ? [{ label: "Download Video", onClick: onDownload }] : []),
                { label: "Edit Project", onClick: () => switchWorkspace("video-style") },
                { label: "Re-render", onClick: () => void onRetry() },
                { label: "View Production Details", onClick: () => switchWorkspace("generated-videos") },
                { label: "New Project", onClick: () => switchWorkspace("new-project") },
              ])}
            </div>
            {!isReady && !isFailed ? (
              <button type="button" className="fr-btn fr-btn--ghost" onClick={() => switchWorkspace("video-style")}>
                ← Back to Step 3
              </button>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
