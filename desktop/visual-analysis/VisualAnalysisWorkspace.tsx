import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Eye, Play, RefreshCw, Sparkles,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { visualAnalysisEngine } from "./visual-analysis-engine";
import type { ImageVisualResult, ReviewStatus, VisualAnalysisSnapshot } from "./types";
import { ANALYSIS_STAGES, STAGE_LABELS } from "./types";
import "./visual-analysis.css";

export function VisualAnalysisWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<VisualAnalysisSnapshot>(() => visualAnalysisEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true,
    images: true,
    facts: true,
    coverage: true,
    warnings: true,
  });
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    visualAnalysisEngine.setNotify(notify);
    visualAnalysisEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started",
        "product-analysis.completed",
        "production.progress",
        "product.updated",
        "state.shared",
        "notify.info",
        "notify.warning",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product-analysis.started",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = visualAnalysisEngine.subscribe(setSnap);
    visualAnalysisEngine.hydrateFromPackage();
    return () => {
      unsub();
      visualAnalysisEngine.setNotify(null);
      visualAnalysisEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await visualAnalysisEngine.runAnalysis({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Visual analysis complete", "Review AI observations — verified product facts were not changed.", "ai-suggestions");
    } catch (error) {
      notify("error", "Analysis failed", error instanceof Error ? error.message : "Unable to analyze", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      visualAnalysisEngine.continueToStep2();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 3 Step 1 complete",
        "Visual Product Analysis Package saved. Opening Deep Product Intelligence.",
        "production-complete",
      );
      switchWorkspace("deep-intelligence");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  if (!pkg && !snap.progress.running && snap.recommendation.includes("No Phase 2")) {
    return (
      <div className="visual-analysis">
        <header className="va-hero">
          <div>
            <span className="va-kicker">Phase 3 · Step 1</span>
            <h1>AI Product Analysis Center</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="va-panel">
          <button type="button" onClick={() => switchWorkspace("product-validation")}>Open Live Validation</button>
        </section>
      </div>
    );
  }

  return (
    <div className="visual-analysis">
      <header className="va-hero">
        <div>
          <span className="va-kicker">Phase 3 · Step 1 · AI Product Analysis Center</span>
          <h1>AI Visual Product Analysis</h1>
          <p>
            Deep visual analysis of the validated Product Image Set. Originals are never modified.
            Verified Product Profile facts stay authoritative — AI results are observations and inferences.
          </p>
        </div>
        <div className="va-hero-stats">
          <div><b>{pkg?.aggregate.imagesAnalyzed ?? 0}/{pkg?.aggregate.imagesTotal ?? snap.progress.total}</b><span>Images</span></div>
          <div><b>{pkg ? `${Math.round(pkg.aggregate.productDetectionAvg * 100)}%` : "—"}</b><span>Detection</span></div>
          <div><b>{pkg?.coveragePercent ?? "—"}%</b><span>Coverage</span></div>
          <div><b>{pkg?.aggregate.warningCount ?? 0}</b><span>Warnings</span></div>
        </div>
      </header>

      <section className="va-toolbar">
        <div>
          <strong>{pkg?.productName || "Product analysis"}</strong>
          <span>{snap.recommendation}</span>
          {!snap.serviceAvailable && <span className="va-warn-inline"> · Local heuristics mode</span>}
        </div>
        <div className="va-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {pkg ? "Re-run Analysis" : "Start Analysis"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> Force Refresh
          </button>
          <button type="button" onClick={() => switchWorkspace("product-validation")}>Back to Validation</button>
          <button
            type="button"
            className="va-primary"
            disabled={busy || !pkg || (pkg.status !== "complete" && pkg.status !== "partial")}
            onClick={() => void onContinue()}
          >
            Save & Open Product Intelligence
          </button>
        </div>
      </section>

      {!snap.serviceAvailable && (
        <section className="va-panel va-service-banner">
          <p className="va-warn"><AlertTriangle size={14} /> ANALYSIS SERVICE UNAVAILABLE — using Product Image Set + local evidence heuristics. Analysis was not pretended complete from a remote model.</p>
          <div className="va-review-actions">
            <button type="button" onClick={() => void run(true)} disabled={busy}>Retry</button>
            <button type="button" disabled={!pkg} onClick={() => notify("info", "Using available analysis", "Existing local results remain. Review and flag as needed.", "information")}>Use Available Analysis</button>
            <button type="button" onClick={() => setExpandedImage(pkg?.images[0]?.assetId ?? null)}>Manual Review</button>
          </div>
        </section>
      )}

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="va-progress">
          <div className="va-progress-head">
            <h3><Eye size={16} /> AI Product Analysis</h3>
            <p>
              Images: {snap.progress.total} · Completed: {snap.progress.completed} / {snap.progress.total} · {snap.progress.percent}%
            </p>
          </div>
          <div className="va-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          {snap.progress.currentFile && (
            <p className="va-muted">Analyzing: {snap.progress.currentFile}{snap.progress.currentStage ? ` · Current task: ${STAGE_LABELS[snap.progress.currentStage]}` : ""}</p>
          )}
          <div className="va-stages">
            {ANALYSIS_STAGES.map((stage) => (
              <span key={stage} className={(snap.progress.stagePercents[stage] ?? 0) >= 100 ? "done" : snap.progress.currentStage === stage ? "active" : ""}>
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </div>
        </section>
      )}

      {pkg && (
        <>
          <Section title="Analysis Overview" open={open.overview} onToggle={() => toggle("overview")}>
            <div className="va-summary">
              <div><span>Product</span><b>{pkg.productName}</b></div>
              <div><span>Images Analyzed</span><b>{pkg.aggregate.imagesAnalyzed} / {pkg.aggregate.imagesTotal}</b></div>
              <div><span>Product Detection</span><b>✓ {Math.round(pkg.aggregate.productDetectionAvg * 100)}%</b></div>
              <div><span>Background</span><b>✓ {majorityBg(pkg.images)}</b></div>
              <div><span>Primary Color</span><b>✓ {pkg.aggregate.primaryColor ?? "—"}</b></div>
              <div><span>Secondary Color</span><b>✓ {pkg.aggregate.secondaryColor ?? "—"}</b></div>
              <div><span>Logo</span><b>{pkg.aggregate.logoDetected ? "✓ Detected" : "○ Not detected"}</b></div>
              <div><span>Text</span><b>{pkg.aggregate.textDetected ? "✓ Detected" : "○ Not detected"}</b></div>
              <div><span>Image Quality</span><b>✓ {pkg.aggregate.qualityGoodCount} good/acceptable</b></div>
              <div><span>Consistency</span><b>{pkg.consistency.consistent ? "✓ Consistent" : "⚠ Review"}</b></div>
              <div><span>Image Coverage</span><b>{pkg.coveragePercent}%</b></div>
              <div><span>Warnings</span><b>{pkg.aggregate.warningCount}</b></div>
              <div><span>Needs Review</span><b>{pkg.aggregate.needsReviewCount}</b></div>
              <div><span>Overall Analysis</span><b>{pkg.status.toUpperCase()}</b></div>
            </div>
            {pkg.categoryCheck.conflict && (
              <p className="va-warn">
                <AlertTriangle size={14} /> POSSIBLE CATEGORY CONFLICT — User: {pkg.categoryCheck.profileCategory} · Visual: {pkg.categoryCheck.visualEstimate}
                {" "}(Product Profile not changed)
              </p>
            )}
          </Section>

          <Section title="1. Product Detection" open={Boolean(open.detection)} onToggle={() => toggle("detection")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`${img.productDetection.detected ? "Detected ✓" : "Not detected"} · ${Math.round(img.productDetection.confidence * 100)}% · Visibility ${img.productDetection.visibilityPercent}% · ${img.productDetection.needsReview ? "NEEDS REVIEW" : "OK"}`} />
            ))}
          </Section>
          <Section title="2. Background" open={Boolean(open.background)} onToggle={() => toggle("background")}>
            <p className="va-muted">Background is analyzed only — originals are not cut out in this step.</p>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`${img.background.type} · Complexity ${img.background.complexity} · Separation ${img.background.separation} · Removal suitability ${img.background.removalSuitability} · ${Math.round(img.background.confidence * 100)}%`} />
            ))}
          </Section>
          <Section title="3. Colors" open={Boolean(open.colors)} onToggle={() => toggle("colors")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={img.colors.map((c) => `${c.name} (${c.role}, ${Math.round(c.confidence * 100)}%)`).join(" · ") || "Not detected"} />
            ))}
          </Section>
          <Section title="4. Logo" open={Boolean(open.logo)} onToggle={() => toggle("logo")}>
            <p className="va-muted">Not detected means no visible logo cue in analyzed images — not that the product has no logo.</p>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={img.logo.present ? `Detected ✓ · ${img.logo.possibleBrand ?? "—"} · ${img.logo.location ?? ""} · ${Math.round(img.logo.confidence * 100)}%` : "Not detected"} />
            ))}
          </Section>
          <Section title="5. Text" open={Boolean(open.text)} onToggle={() => toggle("text")}>
            <p className="va-muted">Detected text is stored separately from verified Product Profile information.</p>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={img.detectedText.length ? img.detectedText.map((t) => `${t.text} (${t.kind}, ${Math.round(t.confidence * 100)}%)`).join("; ") : "None observed"} />
            ))}
          </Section>
          <Section title="6. Product Views" open={Boolean(open.views)} onToggle={() => toggle("views")}>
            <p className="va-muted">Uses Phase 2 Step 2 classifications. This step only verifies or updates confidence.</p>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`${img.viewType} · ${Math.round(img.viewConfidence * 100)}%`} />
            ))}
          </Section>
          <Section title="7. Image Quality" open={Boolean(open.quality)} onToggle={() => toggle("quality")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`${img.quality.classification} · Sharpness ${img.quality.sharpness} · Lighting ${img.quality.lighting} · Blur ${img.quality.blur} · ${img.quality.resolutionNote}`} />
            ))}
          </Section>
          <Section title="8. Lighting" open={Boolean(open.lighting)} onToggle={() => toggle("lighting")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`Exposure ${img.lighting.exposure} · Shadows ${img.lighting.shadows} · Highlights ${img.lighting.highlights} · Product visibility ${img.lighting.productVisibility}`} />
            ))}
          </Section>
          <Section title="9. Visibility" open={Boolean(open.visibility)} onToggle={() => toggle("visibility")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={`${img.visibility.percent}% · ${img.visibility.framing} · Cut-off ${img.visibility.cutoff ? "Yes" : "No"} · Obstruction ${img.visibility.obstruction}`} />
            ))}
          </Section>
          <Section title="10. Visual Features" open={Boolean(open.features)} onToggle={() => toggle("features")}>
            {pkg.images.map((img) => (
              <Fact key={img.assetId} label={img.fileName} value={img.visualFeatures.join(", ") || "No visually supported features recorded"} />
            ))}
          </Section>
          <Section title="11. Product Consistency" open={Boolean(open.consistency)} onToggle={() => toggle("consistency")}>
            <Fact label="Result" value={pkg.consistency.consistent ? "Consistent ✓" : "POSSIBLE PRODUCT MISMATCH"} />
            <Fact label="Confidence" value={`${Math.round(pkg.consistency.confidence * 100)}%`} />
            <p className="va-muted">{pkg.consistency.note} Images are not deleted automatically.</p>
          </Section>
          <Section title="12. Missing Photos" open={open.coverage} onToggle={() => toggle("coverage")}>
            <div className="va-coverage">
              {pkg.coverage.map((row) => (
                <span key={row.view} className={row.status === "available" ? "ok" : row.need === "required" ? "critical" : "miss"}>
                  {row.status === "available" ? "✓" : row.need === "optional" ? "○" : "⚠"} {row.view}
                  <small>{row.need}</small>
                </span>
              ))}
            </div>
          </Section>
          <Section title="13. Confidence" open={Boolean(open.confidence)} onToggle={() => toggle("confidence")}>
            <Fact label="Product Detection (avg)" value={`${Math.round(pkg.aggregate.productDetectionAvg * 100)}%`} />
            <Fact label="Coverage" value={`${pkg.coveragePercent}%`} />
            <Fact label="Consistency" value={`${Math.round(pkg.consistency.confidence * 100)}%`} />
            <p className="va-muted">Low-confidence results are marked NEEDS REVIEW. Uncertain inference is not presented as verified fact.</p>
          </Section>
          <Section title="14. Warnings" open={open.warnings} onToggle={() => toggle("warnings")}>
            {!pkg.warnings.length && <p className="va-ok"><CheckCircle2 size={14} /> No warnings.</p>}
            {pkg.warnings.map((w) => (
              <p key={w.id} className={w.severity === "critical" ? "va-err" : w.severity === "warning" ? "va-warn" : "va-muted"}>
                {w.severity === "critical" ? "✕" : w.severity === "warning" ? "⚠" : "ℹ"} {w.title}: {w.detail}
              </p>
            ))}
            {pkg.images.some((i) => i.failed) && (
              <button type="button" onClick={() => void run(true)} disabled={busy}>Retry Failed Analysis</button>
            )}
          </Section>

          <Section title="Verified vs AI Observation" open={open.facts} onToggle={() => toggle("facts")}>
            <div className="va-fact-grid">
              <div>
                <h4>Verified Product Information</h4>
                <ul>{pkg.verifiedFacts.map((f) => <li key={f.field}><b>{f.field}:</b> {f.value}</li>)}</ul>
              </div>
              <div>
                <h4><Sparkles size={14} /> AI Visual Observation</h4>
                <ul>
                  {pkg.aiObservations.map((f) => (
                    <li key={f.field}><b>{f.field}:</b> {f.value} <small>({Math.round(f.confidence * 100)}%)</small></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>AI Inference</h4>
                <ul>
                  {pkg.aiInferences.length
                    ? pkg.aiInferences.map((f) => (
                      <li key={`${f.field}-${f.value}`}><b>{f.field}:</b> {f.value} <small>({Math.round(f.confidence * 100)}%) — not verified</small></li>
                    ))
                    : <li className="va-muted">No unverified inferences recorded.</li>}
                </ul>
              </div>
            </div>
          </Section>

          <Section title="Image Analysis Results" open={open.images} onToggle={() => toggle("images")}>
            <div className="va-image-list">
              {pkg.images.map((img) => (
                <ImageCard
                  key={img.assetId}
                  img={img}
                  expanded={expandedImage === img.assetId}
                  onToggle={() => setExpandedImage(expandedImage === img.assetId ? null : img.assetId)}
                  onReview={(status) => visualAnalysisEngine.setImageReview(img.assetId, status)}
                  onReanalyze={() => void run(true)}
                />
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function ImageCard({
  img,
  expanded,
  onToggle,
  onReview,
  onReanalyze,
}: {
  img: ImageVisualResult;
  expanded: boolean;
  onToggle: () => void;
  onReview: (s: ReviewStatus) => void;
  onReanalyze: () => void;
}) {
  return (
    <article className={`va-image-card ${img.failed ? "failed" : ""} ${img.productDetection.needsReview ? "review" : ""}`}>
      <button type="button" className="va-image-head" onClick={onToggle}>
        {img.url ? <img src={img.url} alt={img.fileName} /> : <div className="va-thumb-empty" />}
        <div>
          <strong>{img.fileName}</strong>
          <span>{img.viewType} · Detection {Math.round(img.productDetection.confidence * 100)}% · {img.quality.classification}</span>
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && (
        <div className="va-image-body">
          <Fact label="Product Detection" value={`${img.productDetection.detected ? "Detected ✓" : "Not detected"} · ${Math.round(img.productDetection.confidence * 100)}% · Visibility ${img.productDetection.visibilityPercent}%`} />
          <Fact label="Background" value={`${img.background.type} · Complexity ${img.background.complexity} · Separation ${img.background.separation} · Removal ${img.background.removalSuitability}`} />
          <Fact label="Colors" value={img.colors.map((c) => `${c.name} (${c.role}, ${Math.round(c.confidence * 100)}%)`).join(" · ") || "Not detected"} />
          <Fact label="Logo" value={img.logo.present ? `Detected ✓ · ${img.logo.possibleBrand ?? "—"} · ${Math.round(img.logo.confidence * 100)}%` : "Not detected"} />
          <Fact label="Text" value={img.detectedText.length ? img.detectedText.map((t) => `${t.text} (${t.kind})`).join(", ") : "None observed"} />
          <Fact label="Quality" value={`${img.quality.classification} · Sharpness ${img.quality.sharpness} · ${img.quality.resolutionNote}`} />
          <Fact label="Lighting" value={`Exposure ${img.lighting.exposure} · Shadows ${img.lighting.shadows}`} />
          <Fact label="Visibility" value={`${img.visibility.percent}% · ${img.visibility.framing} · Cut-off: ${img.visibility.cutoff ? "Yes" : "No"}`} />
          <Fact label="Composition" value={img.composition} />
          <Fact label="Visual Features" value={img.visualFeatures.join(", ") || "—"} />
          {img.productDetection.needsReview && <p className="va-warn">NEEDS REVIEW — low confidence or flagged visibility.</p>}
          <div className="va-review-actions">
            <button type="button" onClick={() => onReview("accepted")}>Accept</button>
            <button type="button" onClick={() => onReview("rejected")}>Reject</button>
            <button type="button" onClick={() => onReview("flagged")}>Flag</button>
            <button type="button" onClick={() => onReview("reviewed")}>Mark Reviewed</button>
            <button type="button" onClick={onReanalyze}>Request Re-analysis</button>
            <span className="va-muted">Status: {img.reviewStatus}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <p><strong>{label}:</strong> {value}</p>;
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="va-panel">
      <button type="button" className="va-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <h3>{title}</h3>
      </button>
      {open && <div className="va-section-body">{children}</div>}
    </section>
  );
}

function majorityBg(images: ImageVisualResult[]): string {
  const counts = new Map<string, number>();
  for (const i of images) counts.set(i.background.type, (counts.get(i.background.type) ?? 0) + 1);
  let best = "—";
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}
