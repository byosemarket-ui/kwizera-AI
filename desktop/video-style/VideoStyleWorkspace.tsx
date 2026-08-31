import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { CreativeToneId, ProductionModeId } from "../../ai/video-production/production-mode-types.js";
import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import {
  motionLabel,
  scenePurposeLabel,
  videoStyleEngine,
} from "./video-style-engine";
import type { VideoStyleSnapshot } from "./types";
import "./video-style.css";

function saveLabel(state: VideoStyleSnapshot["saveState"]): string {
  switch (state) {
    case "saving": return "Saving…";
    case "saved": return "Saved";
    case "error": return "Unable to save";
    default: return "Unsaved";
  }
}

export function VideoStyleWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<VideoStyleSnapshot>(() => videoStyleEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [editingScene, setEditingScene] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    videoStyleEngine.setNotify((tone, title, detail) => notify(tone, title, detail));
    const unsub = videoStyleEngine.subscribe(setSnap);
    void videoStyleEngine.hydrate();
    return () => {
      unsub();
      videoStyleEngine.setNotify(null);
    };
  }, [notify]);

  const onContinue = useCallback(async () => {
    setBusy(true);
    try {
      await videoStyleEngine.continueToStep4();
      notify("success", "Step 3 complete", "Starting video production.", "production-complete");
      switchWorkspace("final-video-review");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Validation failed", "errors");
    } finally {
      setBusy(false);
    }
  }, [notify, switchWorkspace]);

  const s = snap.summary;

  return (
    <div className="vs-page">
      <WorkflowProgress currentStep={3} projectName={snap.projectName || undefined} />

      <div className="vr-intro">
        <span className="kw-workflow-progress__step-label">STEP 3 OF 4 · VIDEO STYLE &amp; REVIEW</span>
        <h1>Video Style &amp; Final Review</h1>
        <p>Choose how your product should be transformed into a marketing video.</p>
      </div>

      {s ? (
        <div className="vs-summary">
          <div className="vs-summary-thumb">
            {s.heroUrl ? <img src={s.heroUrl} alt="" /> : null}
          </div>
          <dl className="vs-summary-grid">
            <div><dt>Product</dt><dd>{s.productName}</dd></div>
            <div><dt>Platform</dt><dd>{s.platformLabel}</dd></div>
            <div><dt>Format</dt><dd>{s.aspectRatio}</dd></div>
            <div><dt>Duration</dt><dd>{s.durationSeconds} seconds</dd></div>
            {s.priceLabel ? <div><dt>Price</dt><dd>{s.priceLabel}{s.discountLabel ? ` · ${s.discountLabel}` : ""}</dd></div> : null}
          </dl>
        </div>
      ) : (
        <section className="vr-section">
          <p>Complete Video Settings (Step 2) to configure your production plan.</p>
        </section>
      )}

      <section className="vr-section">
        <h2>Choose Video Style</h2>
        <div className="vs-mode-grid">
          {snap.modes.map((mode) => (
            <button
              key={mode.mode}
              type="button"
              className={[
                "vs-mode-card",
                snap.selectedMode === mode.mode ? "is-selected" : "",
                !mode.available ? "is-unavailable" : "",
              ].filter(Boolean).join(" ")}
              disabled={!mode.available}
              aria-pressed={snap.selectedMode === mode.mode}
              onClick={() => void videoStyleEngine.selectMode(mode.mode as ProductionModeId)}
            >
              {snap.selectedMode === mode.mode && snap.generating ? (
                <Loader2 size={14} className="vr-spin vs-mode-loading" aria-hidden />
              ) : null}
              {mode.recommended && mode.available ? (
                <span className="vs-badge vs-badge--rec">Recommended</span>
              ) : null}
              {!mode.available ? (
                <span className="vs-badge vs-badge--unavail">Unavailable</span>
              ) : null}
              <b>{mode.label}</b>
              <p>{mode.description}</p>
              {!mode.available ? <p><em>{mode.reason}</em></p> : null}
            </button>
          ))}
        </div>
        {snap.recommendedReason && snap.modes.some((m) => m.recommended) ? (
          <p className="vr-hint">{snap.recommendedReason}</p>
        ) : null}
      </section>

      <section className="vr-section">
        <h2>Creative Tone</h2>
        <div className="vs-tone-row">
          {snap.toneOptions.map((tone) => (
            <button
              key={tone}
              type="button"
              className={`vs-tone-chip${snap.creativeTone === tone ? " is-selected" : ""}`}
              aria-pressed={snap.creativeTone === tone}
              onClick={() => void videoStyleEngine.selectTone(tone as CreativeToneId)}
            >
              {tone}
            </button>
          ))}
        </div>
      </section>

      <section className="vr-section">
        <div className="vs-plan-head">
          <h3>{snap.planPreview?.statusLabel ?? "AI Production Plan"}</h3>
          {snap.generating ? <Loader2 size={18} className="vr-spin" /> : null}
          <button
            type="button"
            className="vr-chip"
            disabled={snap.generating || !snap.selectedMode}
            onClick={() => void videoStyleEngine.generatePlan(true)}
          >
            <RefreshCw size={14} /> Regenerate
          </button>
        </div>
        {snap.planPreview ? (
          <>
            <p><strong>{snap.planPreview.headline}</strong></p>
            <div className="vs-plan-stats">
              <span>{snap.planPreview.sceneCount} scenes</span>
              <span>{snap.planPreview.uniqueViewCount} unique product view{snap.planPreview.uniqueViewCount === 1 ? "" : "s"}</span>
              <span>{snap.summary?.aspectRatio} · {snap.planPreview.formatLabel}</span>
              {snap.planPreview.includesPrice ? <span className="ok">Price included</span> : null}
              {snap.planPreview.includesDiscount ? <span className="ok">Discount included</span> : null}
              {snap.planPreview.includesWebsite ? <span className="ok">Website included</span> : null}
              {snap.planPreview.includesCta ? <span className="ok">CTA included</span> : null}
            </div>
          </>
        ) : (
          <p className="vr-hint">Select an available production mode to generate your plan.</p>
        )}
      </section>

      {snap.scenes.length > 0 ? (
        <section className="vr-section">
          <h2>Scene Preview</h2>
          <div className="vs-scene-list">
            {snap.scenes.map((scene) => (
              <article key={scene.id} className="vs-scene-card">
                <div className="vs-scene-thumb">
                  {scene.thumbnailUrl ? <img src={scene.thumbnailUrl} alt="" /> : null}
                </div>
                <div className="vs-scene-meta">
                  <b>{scene.order}. {scenePurposeLabel(scene.purpose)}</b>
                  <small>
                    {scene.view.replace(/_/g, " ")} · {motionLabel(scene.motion)} · {scene.transition}
                    {scene.userEdited ? " · edited" : ""}
                  </small>
                  <div className="vs-scene-text">
                    {editingScene === scene.id ? (
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => {
                          void videoStyleEngine.updateSceneText(scene.id, editText);
                          setEditingScene(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void videoStyleEngine.updateSceneText(scene.id, editText);
                            setEditingScene(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        className="vr-link-btn"
                        onClick={() => {
                          setEditingScene(scene.id);
                          setEditText(scene.textPreview === "—" ? "" : scene.textPreview);
                        }}
                      >
                        {scene.textPreview}
                      </button>
                    )}
                  </div>
                </div>
                <span className="vs-scene-dur">{scene.durationSeconds.toFixed(1)}s</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {snap.readiness.blockingIssues.length > 0 ? (
        <section className="vr-section vr-readiness vr-readiness--block">
          <ul>{snap.readiness.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </section>
      ) : null}

      <footer className="vs-footer">
        <div className="vs-footer__left">
          <button type="button" onClick={() => switchWorkspace("video-requirements")}>
            ← Back to Step 2
          </button>
        </div>
        <div className="vs-footer__center">{saveLabel(snap.saveState)}</div>
        <div className="vs-footer__right">
          <button
            type="button"
            className="primary"
            disabled={!snap.canContinue || busy}
            onClick={() => void onContinue()}
          >
            {busy ? <Loader2 size={16} className="vr-spin" /> : null}
            Continue to Step 4 <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
