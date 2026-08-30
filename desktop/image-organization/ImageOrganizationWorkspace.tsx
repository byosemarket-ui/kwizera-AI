import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Eye, Play, RefreshCw, Star, Tag,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { imageOrganizationEngine } from "./organization-engine";
import type { OrganizationSnapshot, OrganizationViewType, OrganizedImage } from "./types";
import { ALL_VIEW_TYPES } from "./types";
import "./image-organization.css";

const formatBytes = (value: number) =>
  value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

export function ImageOrganizationWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<OrganizationSnapshot>(() => imageOrganizationEngine.snapshot());
  const [preview, setPreview] = useState<OrganizedImage | null>(null);
  const [details, setDetails] = useState<{
    derivedCount: number;
    original: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    imageOrganizationEngine.setNotify(notify);
    imageOrganizationEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started",
        "product-analysis.completed",
        "product.updated",
        "production.progress",
        "state.shared",
        "notify.info",
      ]);
      const eventType = allowed.has(type) ? type : "production.progress";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product-analysis.started",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = imageOrganizationEngine.subscribe(setSnap);
    void imageOrganizationEngine.hydrateFromHandoff();
    return () => {
      unsub();
      imageOrganizationEngine.setNotify(null);
      imageOrganizationEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async () => {
    setBusy(true);
    try {
      await imageOrganizationEngine.runAnalysis();
      workspaceStateEngine.autoSave.markDirty();
    } catch (error) {
      notify("error", "Analysis failed", error instanceof Error ? error.message : "Unable to analyze", "errors");
    } finally {
      setBusy(false);
    }
  };

  const openDetails = async (img: OrganizedImage) => {
    setPreview(img);
    setDetails(null);
    if (!img.projectId) return;
    try {
      const response = await fetch(`/api/workspace/projects/${img.projectId}/assets`);
      const body = await response.json() as { assets?: Array<{ assetId: string; parentAssetId?: string; metadata?: { original?: boolean } }> };
      const derivedCount = (body.assets ?? []).filter((asset) => asset.parentAssetId === img.assetId).length;
      const self = (body.assets ?? []).find((asset) => asset.assetId === img.assetId);
      setDetails({
        derivedCount,
        original: Boolean(self?.metadata?.original ?? true),
      });
    } catch {
      setDetails(null);
    }
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      await imageOrganizationEngine.continueToStep3();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Step 2 complete",
        "Product Image Set saved. Continue with Product Information.",
        "production-complete",
      );
      switchWorkspace("product-information");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const set = snap.productImageSet;

  return (
    <div className="image-org">
      <header className="org-hero">
        <div>
          <span className="org-kicker">Product Creation · Step 2</span>
          <h1>Intelligent Image Organization</h1>
          <p>
            Analyze Step 1 assets into a Product Image Set. Originals stay untouched — classification is metadata only.
          </p>
        </div>
        <div className="org-hero-stats">
          <div><b>{set?.images.length ?? 0}</b><span>Images</span></div>
          <div><b>{set?.coverageScore ?? 0}%</b><span>Coverage</span></div>
          <div><b>{set?.missingViews.length ?? 0}</b><span>Missing</span></div>
        </div>
      </header>

      <section className="org-toolbar">
        <div>
          <strong>{snap.projectName || "No project"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="org-toolbar-actions">
          <button type="button" onClick={() => void run()} disabled={busy || snap.progress.running}>
            <Play size={15} /> {set ? "Re-run Analysis" : "Start Analysis"}
          </button>
          <button type="button" onClick={() => switchWorkspace("new-project")}>Back to Intake</button>
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="org-progress">
          <div className="org-progress-head">
            <h3>Analyzing Product Images</h3>
            <p>{snap.progress.completed} / {snap.progress.total} · {snap.progress.statusLabel}</p>
          </div>
          <div className="org-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
          <div className="org-progress-meta">
            <span>Current: {snap.progress.currentFile ?? "—"}</span>
            <span>Classification: {snap.progress.currentClassification ?? "—"}</span>
            <span>
              Confidence:{" "}
              {snap.progress.currentConfidence != null ? `${Math.round(snap.progress.currentConfidence * 100)}%` : "—"}
            </span>
          </div>
        </section>
      )}

      {set && (
        <>
          <section className="org-coverage">
            <h3>Image Coverage · {set.coverageScore}%</h3>
            <p>
              Category estimate: <b>{set.categoryEstimate}</b> · Recommended {set.recommendedViews.length} views ·
              Available {set.recommendedViews.length - set.missingViews.length}
            </p>
            <div className="org-coverage-chips">
              {set.recommendedViews.map((view) => (
                <span key={view} className={set.missingViews.includes(view) ? "missing" : "ok"}>
                  {set.missingViews.includes(view) ? "○" : "✓"} {view}
                </span>
              ))}
            </div>
            {!set.consistencyOk && (
              <p className="org-warn"><AlertTriangle size={14} /> Possible different product — review classifications.</p>
            )}
          </section>

          <section className="org-asset-map">
            <h3>Product Asset Map</h3>
            <p>Later production stages use these stable asset IDs. Correct a view if the AI is wrong.</p>
            <div className="org-asset-map-grid">
              {set.groups.filter((g) => g.images.length > 0).map((group) => (
                <div key={`map-${group.groupId}`} className="org-asset-map-row">
                  <strong>{group.viewType}</strong>
                  <span>
                    {group.images.map((img) => (
                      <em key={img.assetId} title={img.fileName}>
                        {img.assetId.slice(0, 8)}… · {Math.round(img.confidence * 100)}%
                        {img.userCorrected ? " · user" : ""}
                      </em>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {set.warnings.length > 0 && (
            <section className="org-warnings">
              <h3>Warnings</h3>
              <ul>
                {set.warnings.slice(0, 12).map((w) => (
                  <li key={`${w.code}-${w.message}`}><AlertTriangle size={13} /> {w.message}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="org-set">
            <h3>Product Image Set</h3>
            <div className="org-groups">
              {set.groups.map((group) => (
                <div key={group.groupId} className={`org-group ${group.missing ? "is-missing" : ""}`}>
                  <header>
                    <h4>{group.viewType}</h4>
                    {group.missing
                      ? <span className="missing-label">Missing</span>
                      : <span>{group.images.length} image{group.images.length === 1 ? "" : "s"}</span>}
                  </header>
                    {group.missing ? (
                    <p className="org-missing-copy">{group.viewType} view was not detected.</p>
                  ) : (
                    <div className="org-cards">
                      {group.images.map((img) => (
                        <article key={img.assetId} className={`org-card ${img.needsReview ? "needs-review" : ""}`}>
                          <div className="org-thumb">
                            {img.url ? <img src={img.url} alt="" loading="lazy" /> : <Tag size={22} />}
                            {img.roleInGroup === "primary" && <span className="primary-badge"><Star size={11} /> Primary</span>}
                            {img.needsReview && <span className="review-badge">Needs Review</span>}
                          </div>
                          <div className="org-card-body">
                            <b title={img.fileName}>{img.fileName}</b>
                            <small>{img.viewType} · {Math.round(img.confidence * 100)}%</small>
                            <small>
                              {img.width && img.height ? `${img.width}×${img.height}` : "—"} · {formatBytes(img.fileSize)}
                            </small>
                            <small>{img.backgroundType} · {img.visibilityStatus}</small>
                            <small>
                              {img.analysisState ?? "pending"} · {img.aiVisionStatus === "completed" ? "AI analyzed" : "AI vision unavailable"}
                            </small>
                            {(img.duplicateOfAssetId) && (
                              <div className="org-dup">
                                <span>Possible duplicate</span>
                                <button type="button" onClick={() => imageOrganizationEngine.keepDuplicate(img.assetId)}>Keep Both</button>
                              </div>
                            )}
                            <label className="org-reclass">
                              Reclassify
                              <select
                                value={img.viewType}
                                onChange={(e) => void imageOrganizationEngine.reclassify(img.assetId, e.target.value as OrganizationViewType)}
                              >
                                {ALL_VIEW_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </label>
                          </div>
                          <div className="org-card-actions">
                            <button type="button" title="Preview" onClick={() => void openDetails(img)}><Eye size={14} /></button>
                            <button type="button" title="Set Primary" onClick={() => void imageOrganizationEngine.setPrimary(img.assetId)}><Star size={14} /></button>
                            <button type="button" title="Remove from group" onClick={() => imageOrganizationEngine.removeFromGroup(img.assetId)}><RefreshCw size={14} /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {!set && !snap.progress.running && (
        <div className="org-empty">
          <p>Load assets from Step 1, then start analysis to build the Product Image Set.</p>
          <button type="button" onClick={() => void run()} disabled={busy}><Play size={15} /> Start Analysis</button>
        </div>
      )}

      <footer className="org-footer">
        <p>{snap.recommendation}</p>
        <button type="button" className="org-continue" disabled={!snap.canContinue || busy} onClick={() => void onContinue()}>
          <CheckCircle2 size={16} /> Continue to Step 3
        </button>
      </footer>

      {preview && (
        <div className="org-modal" onClick={() => { setPreview(null); setDetails(null); }}>
          <div className="org-modal-card" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{preview.fileName}</h3>
              <button type="button" onClick={() => { setPreview(null); setDetails(null); }}>Close</button>
            </header>
            {preview.url && <img src={preview.url} alt="" />}
            <dl>
              <div><dt>Asset ID</dt><dd>{preview.assetId}</dd></div>
              <div><dt>Project</dt><dd>{preview.projectId}</dd></div>
              <div><dt>Original / derived</dt><dd>{details?.original === false ? "Derived" : "Original source"}</dd></div>
              <div><dt>Type</dt><dd>{preview.mimeType}</dd></div>
              <div><dt>Dimensions</dt><dd>{preview.width && preview.height ? `${preview.width}×${preview.height}` : "—"}</dd></div>
              <div><dt>File size</dt><dd>{formatBytes(preview.fileSize)}</dd></div>
              <div><dt>Processing</dt><dd>{preview.processingState ?? "ready"}</dd></div>
              <div><dt>Analysis</dt><dd>{preview.analysisState ?? "pending"}</dd></div>
              <div><dt>AI vision</dt><dd>{preview.aiVisionStatus === "completed" ? "completed" : "IMAGE ANALYSIS UNAVAILABLE"}</dd></div>
              <div><dt>View</dt><dd>{preview.viewType} ({Math.round(preview.confidence * 100)}%)</dd></div>
              <div><dt>Role in set</dt><dd>{preview.roleInGroup}</dd></div>
              <div><dt>Background</dt><dd>{preview.backgroundType}</dd></div>
              <div><dt>Visibility</dt><dd>{preview.visibilityStatus}</dd></div>
              <div><dt>Quality</dt><dd>{preview.qualityScore}/100</dd></div>
              <div><dt>Visual method</dt><dd>{preview.visualMethod ?? "—"}</dd></div>
              <div><dt>Provenance</dt><dd>{preview.provenanceProvider ?? "—"} {preview.analysisVersion ? `· ${preview.analysisVersion}` : ""}</dd></div>
              <div><dt>Derived assets</dt><dd>{details ? `${details.derivedCount} linked` : preview.derivedThumbnailId ? "thumbnail registered" : "—"}</dd></div>
            </dl>
            {preview.observations && preview.observations.length > 0 && (
              <div className="org-observations">
                <h4>Visual observations</h4>
                <ul>
                  {preview.observations.slice(0, 12).map((item) => (
                    <li key={`${item.field}-${item.value}`}>
                      <b>{item.field}</b> {item.value}
                      <small> {item.kind} · {Math.round(item.confidence * 100)}%</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
