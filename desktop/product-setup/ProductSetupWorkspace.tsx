import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, FolderOpen, ImagePlus, Loader2, RefreshCw, Trash2, Upload,
} from "lucide-react";
import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import { productSetupEngine } from "./product-setup-engine";
import type { ProductSetupSnapshot } from "./types";
import { formatPrice, parsePriceInput } from "./discount";
import { suggestProductName } from "./readiness";
import { VIEW_PICKER_OPTIONS, confidenceLabel } from "./view-labels";
import { ACCEPT_ATTR, classifyFormat } from "../product-intake/formats";
import { desktopPicksToFiles } from "../product-intake/desktop-import";
import "./product-setup.css";

const CURRENCIES = ["RWF", "USD", "EUR", "GBP", "KES", "UGX", "TZS"];

export function ProductSetupWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProductSetupSnapshot>(() => productSetupEngine.snapshot());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [continuePhase, setContinuePhase] = useState<"idle" | "saving" | "opening">("idle");
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    productSetupEngine.setNotify(notify);
    const unsub = productSetupEngine.subscribe(setSnap);
    void productSetupEngine.hydrateFromServer();
    return () => {
      unsub();
      productSetupEngine.setNotify(null);
    };
  }, [notify]);

  const onFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const supported = [...files].filter((f) => classifyFormat(f) === "supported");
    if (!supported.length) {
      const msg = "No supported images found. Use JPG, PNG, WEBP, TIFF, or BMP.";
      setUploadError(msg);
      notify("error", "Unsupported files", msg, "errors");
      return;
    }
    if (supported.length < files.length) {
      notify(
        "warning",
        "Some files skipped",
        `${files.length - supported.length} unsupported file(s) were not imported.`,
        "warnings",
      );
    }
    setBusy(true);
    setUploadError(null);
    try {
      // Fire-and-forget staging — previews appear immediately; uploads continue in background.
      await productSetupEngine.enqueueFiles(supported);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not import images";
      setUploadError(msg);
      notify("error", "Upload failed", msg, "errors");
    } finally {
      setBusy(false);
    }
  }, [notify]);

  const pickImages = useCallback(async () => {
    const bridge = window.kwizeraDesktop;
    if (!bridge?.openProductImages) {
      fileRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const result = await bridge.openProductImages();
      if (result.canceled) return;
      const { files, rejected } = desktopPicksToFiles(result.files);
      if (rejected.length) {
        notify("warning", "Some files skipped", rejected.slice(0, 2).map((r) => r.reason).join(" · "), "warnings");
      }
      if (files.length) await onFiles(files);
    } finally {
      setBusy(false);
    }
  }, [notify, onFiles]);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    setContinuePhase("saving");
    try {
      await productSetupEngine.continueToStep2();
      setContinuePhase("opening");
      notify("success", "Product setup complete", "Opening Video Plan.", "production-complete");
      switchWorkspace("video-requirements");
    } catch (error) {
      notify(
        "error",
        "Cannot continue",
        error instanceof Error ? error.message : "Save your project and try again.",
        "errors",
      );
    } finally {
      setBusy(false);
      setContinuePhase("idle");
    }
  };

  const savedCount = snap.intake.assets.filter((a) => a.processingStatus === "saved").length;
  const uploadingCount = snap.intake.assets.filter((a) => a.processingStatus === "uploading").length;
  const importRunning = snap.intake.progress.running;
  const hasImages = savedCount > 0 || uploadingCount > 0 || snap.imageCards.length > 0;
  const suggestedName = suggestProductName(snap.projectName);
  const analysisComplete = snap.analysisStatus === "COMPLETE" || snap.analysisStatus === "REVIEW_REQUIRED";
  const analysisActive = snap.analysisStatus === "ANALYZING" || snap.analysisStatus === "UPLOADING";
  const analysisFailed = snap.analysisStatus === "FAILED";
  const showAnalysis = snap.analysisStatus !== "NOT_STARTED" || snap.intake.progress.running;

  const readyItems = [
    { ok: snap.readiness.summary.projectName, label: "Project name" },
    { ok: snap.readiness.summary.validImages > 0, label: `Product images (${snap.readiness.summary.validImages})` },
    { ok: analysisComplete, label: "AI analysis" },
    { ok: snap.readiness.summary.productName, label: "Product name" },
    { ok: snap.essentials.currentPrice != null, label: "Price" },
    { ok: snap.discount.valid, label: "Discount calculated", optional: !snap.discount.valid },
  ].filter((item) => item.ok || !item.optional);

  const optionalItems = [
    { ok: Boolean(snap.essentials.size), label: "Size" },
    { ok: false, label: "Review image classifications", show: snap.readiness.warnings.some((w) => /classification|review/i.test(w)) },
  ].filter((item) => item.show !== false);

  const heroLabel = snap.aiSummary?.usefulViews[0] ?? "Not selected";

  return (
    <div className="product-setup">
      <WorkflowProgress currentStep={1} projectName={snap.projectName || undefined} />

      <header className="product-setup__header">
        <div>
          <h1>Product Setup</h1>
          <p>Add your product and the information needed to create the video.</p>
        </div>
        <p className="product-setup__save" data-state={snap.saveState}>
          {snap.saveState === "saving" ? "Saving…" : snap.saveState === "error" ? "Unsaved" : snap.saveState === "unsaved" ? "Unsaved" : "Saved automatically"}
        </p>
      </header>

      {showAnalysis && (
        <section className="product-setup__panel product-setup__analysis" data-status={snap.analysisStatus.toLowerCase()}>
          <div className="product-setup__analysis-head">
            <h2>AI Analysis</h2>
            <span className="product-setup__badge" data-tone={analysisFailed ? "warn" : analysisComplete ? "ok" : "active"}>
              {analysisFailed ? "Needs attention" : analysisComplete ? "Complete" : analysisActive ? "Running" : "In progress"}
            </span>
          </div>
          {analysisComplete ? (
            <ul className="product-setup__analysis-summary">
              <li><CheckCircle2 size={14} /> {savedCount} image{savedCount === 1 ? "" : "s"} analyzed</li>
              <li><CheckCircle2 size={14} /> Product detected</li>
              <li><CheckCircle2 size={14} /> Image quality checked</li>
              <li><CheckCircle2 size={14} /> Best product angles selected</li>
              {snap.mediaPreparation ? (
                <li><CheckCircle2 size={14} /> {snap.mediaPreparation.statusLabel}</li>
              ) : null}
            </ul>
          ) : (
            <ul className="product-setup__analysis-steps">
              {buildAnalysisSteps(snap).map((step) => (
                <li key={step.label} className={step.done ? "is-done" : step.active ? "is-active" : ""}>
                  {step.done ? <CheckCircle2 size={14} /> : step.active ? <Loader2 size={14} className="spin" /> : <span className="product-setup__step-dot" />}
                  {step.label}
                </li>
              ))}
            </ul>
          )}
          {snap.readiness.warnings.some((w) => /classification|review/i.test(w)) && (
            <p className="product-setup__analysis-warn"><AlertTriangle size={14} /> Some image classifications need review</p>
          )}
          {analysisFailed && (
            <button type="button" className="product-setup__link-btn" onClick={() => void productSetupEngine.retryAnalysis()}>
              <RefreshCw size={14} /> Retry analysis
            </button>
          )}
        </section>
      )}

      <section className="product-setup__panel">
        <div className="product-setup__section-head">
          <h2>Product Images</h2>
          {hasImages && (
            <span className="product-setup__meta">
              {savedCount} uploaded{uploadingCount > 0 ? ` · ${uploadingCount} uploading` : ""}
            </span>
          )}
        </div>

        {uploadError && (
          <p className="product-setup__upload-error" role="alert">{uploadError}</p>
        )}

        {importRunning && (
          <p className="product-setup__upload-progress" role="status">
            <Loader2 size={14} className="spin" />
            Importing {snap.intake.progress.completed}/{snap.intake.progress.total}
            {snap.intake.progress.currentFile ? ` — ${snap.intake.progress.currentFile}` : ""}
          </p>
        )}

        <div
          className={`product-setup__dropzone ${hasImages ? "is-compact" : ""} ${dragging ? "is-dragging" : ""}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void onFiles(e.dataTransfer.files); }}
        >
          {!hasImages && <ImagePlus size={28} strokeWidth={1.5} />}
          {!hasImages && (
            <>
              <p className="product-setup__drop-title">Drop product images here</p>
              <p className="product-setup__drop-copy">Add clear photos from different angles for better AI coverage.</p>
            </>
          )}
          <div className="product-setup__drop-actions">
            <button type="button" disabled={busy} onClick={() => void pickImages()}>
              <Upload size={14} /> Select Images
            </button>
            <button type="button" className="is-secondary" disabled={busy} onClick={() => folderRef.current?.click()}>
              <FolderOpen size={14} /> Import Folder
            </button>
          </div>
        </div>

        {snap.imageCards.length > 0 && (
          <div className="product-setup__grid">
            {snap.imageCards.map((card) => (
              <article key={card.assetId} className={`product-setup__card${card.uploadStatus === "uploading" ? " is-uploading" : ""}${card.uploadStatus === "failed" ? " is-failed" : ""}`}>
                <div className="product-setup__card-thumb">
                  {card.url ? <img src={card.url} alt={card.fileName} loading="lazy" /> : <ImagePlus size={22} />}
                  {card.uploadStatus === "uploading" && (
                    <span className="product-setup__card-overlay"><Loader2 size={18} className="spin" /></span>
                  )}
                  {card.issueMessage && card.uploadStatus !== "uploading" && (
                    <span className="product-setup__card-badge" data-severity={card.severity} title={card.issueMessage}>!</span>
                  )}
                </div>
                <div className="product-setup__card-body">
                  <div className="product-setup__card-head">
                    <strong>{card.fileName}</strong>
                    <button
                      type="button"
                      className="product-setup__icon-btn"
                      aria-label={`Remove ${card.fileName}`}
                      disabled={card.uploadStatus === "uploading"}
                      onClick={() => void productSetupEngine.removeImage(card.assetId)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <span className="product-setup__card-meta">
                    {card.uploadStatus === "uploading"
                      ? "Uploading…"
                      : card.uploadStatus === "failed"
                        ? (card.issueMessage ?? "Upload failed")
                        : card.needsReview ? "Needs review" : confidenceLabel(card.confidence)}
                  </span>
                  {card.uploadStatus === "saved" && (
                  <label className="product-setup__card-select">
                    <span>Change view</span>
                    <select
                      aria-label={`View type for ${card.fileName}`}
                      value={card.finalViewType}
                      onChange={(e) => void productSetupEngine.reclassifyImage(card.assetId, e.target.value as never)}
                    >
                      {VIEW_PICKER_OPTIONS.map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  )}
                  {card.uploadStatus === "failed" && (
                    <button type="button" className="product-setup__link-btn" onClick={() => void productSetupEngine.retryFailedUploads()}>
                      <RefreshCw size={14} /> Retry
                    </button>
                  )}
                  {card.isDuplicate && card.uploadStatus === "saved" && (
                    <button type="button" className="product-setup__link-btn" onClick={() => productSetupEngine.keepDuplicate(card.assetId)}>
                      Keep duplicate
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
        <input
          ref={folderRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          webkitdirectory="true"
          {...({ directory: "" } as object)}
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
        />
      </section>

      {snap.aiSummary && (
        <section className="product-setup__panel product-setup__summary">
          <h2>AI Product Summary</h2>
          <dl className="product-setup__summary-grid">
            <div><dt>Product</dt><dd>{snap.aiSummary.productLabel ?? "Not provided"}</dd></div>
            <div><dt>Category</dt><dd>{snap.aiSummary.category ?? "Not provided"}</dd></div>
            <div><dt>Images</dt><dd>{snap.aiSummary.imageCount} analyzed</dd></div>
            <div><dt>Useful Views</dt><dd>{snap.aiSummary.usefulViews.join(" · ") || "Not provided"}</dd></div>
            <div><dt>Hero Image</dt><dd>{snap.aiSummary.heroAssetId ? heroLabel : "Not provided"}</dd></div>
            <div><dt>Quality</dt><dd>{snap.aiSummary.coverageLabel.replace(/_/g, " ")}</dd></div>
          </dl>
          {snap.aiSummary.coverageMessage && (
            <p className="product-setup__summary-note">{snap.aiSummary.coverageMessage}</p>
          )}
        </section>
      )}

      <section className="product-setup__panel">
        <h2>Product Details</h2>
        <div className="product-setup__essentials-grid">
          <div className="product-setup__field product-setup__field--wide">
            <label htmlFor="ps-project-name">Project Name</label>
            <input
              id="ps-project-name"
              value={snap.projectName}
              onChange={(e) => productSetupEngine.setProjectNameLocal(e.target.value)}
              onBlur={() => {
                if (snap.projectName.trim()) void productSetupEngine.ensureProject(snap.projectName).catch(() => undefined);
              }}
              placeholder="Chestnut Oxford Campaign"
            />
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-product-name">Product Name</label>
            <input
              id="ps-product-name"
              value={snap.essentials.productName}
              onChange={(e) => productSetupEngine.setEssentialField("productName", e.target.value)}
              placeholder="Chestnut Oxford"
            />
            {suggestedName && !snap.essentials.productName && (
              <button type="button" className="product-setup__link-btn" onClick={() => productSetupEngine.applySuggestedProductName()}>
                Use “{suggestedName}” from project name
              </button>
            )}
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-size">Size <span className="product-setup__optional">(optional)</span></label>
            <input
              id="ps-size"
              value={snap.essentials.size}
              onChange={(e) => productSetupEngine.setEssentialField("size", e.target.value)}
              placeholder="40 / 41 / 42"
            />
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-current-price">Current Price</label>
            <input
              id="ps-current-price"
              inputMode="decimal"
              value={snap.essentials.currentPrice ?? ""}
              onChange={(e) => productSetupEngine.setEssentialField("currentPrice", parsePriceInput(e.target.value))}
              placeholder="20,000"
            />
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-currency">Currency</label>
            <select
              id="ps-currency"
              value={snap.essentials.currency}
              onChange={(e) => productSetupEngine.setEssentialField("currency", e.target.value)}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="product-setup__field product-setup__field--wide">
            <label htmlFor="ps-previous-price">Previous Price <span className="product-setup__optional">(optional)</span></label>
            <input
              id="ps-previous-price"
              inputMode="decimal"
              value={snap.essentials.previousPrice ?? ""}
              onChange={(e) => productSetupEngine.setEssentialField("previousPrice", parsePriceInput(e.target.value))}
              placeholder="45,000"
            />
            {snap.discount.valid && (
              <p className="product-setup__discount">
                <strong>{snap.discount.label}</strong>
                <span>Was {formatPrice(snap.essentials.previousPrice, snap.essentials.currency)} → Now {formatPrice(snap.essentials.currentPrice, snap.essentials.currency)}</span>
              </p>
            )}
            {snap.essentials.previousPrice != null && snap.essentials.currentPrice != null
              && snap.essentials.previousPrice <= snap.essentials.currentPrice && (
              <p className="product-setup__hint-warn">Previous price must be higher than current price to create a discount.</p>
            )}
          </div>
          <div className="product-setup__field product-setup__field--wide">
            <label htmlFor="ps-description">Short Description <span className="product-setup__optional">(optional)</span></label>
            <textarea
              id="ps-description"
              rows={2}
              value={snap.essentials.shortDescription}
              onChange={(e) => productSetupEngine.setEssentialField("shortDescription", e.target.value)}
              placeholder="Premium brown oxford shoe for everyday wear"
            />
          </div>
        </div>

        <button
          type="button"
          className="product-setup__details-toggle"
          onClick={() => setOptionalOpen((v) => !v)}
          aria-expanded={optionalOpen}
        >
          <ChevronDown size={14} className={optionalOpen ? "is-open" : ""} />
          Add more product details
        </button>
        {optionalOpen && (
          <div className="product-setup__essentials-grid product-setup__optional-grid">
            {(["brand", "color", "material", "features", "website", "notes"] as const).map((field) => (
              <div key={field} className="product-setup__field">
                <label htmlFor={`ps-opt-${field}`}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <input
                  id={`ps-opt-${field}`}
                  value={snap.optional[field]}
                  onChange={(e) => productSetupEngine.setOptionalField(field, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="product-setup__panel product-setup__readiness">
        <h2>Project Readiness</h2>
        <div className="product-setup__readiness-cols">
          <div>
            <h3>Ready to continue</h3>
            <ul>
              {readyItems.filter((i) => i.ok).map((item) => (
                <li key={item.label} className="is-ok"><CheckCircle2 size={13} /> {item.label}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Optional information</h3>
            <ul>
              {optionalItems.map((item) => (
                <li key={item.label} className={item.ok ? "is-ok" : "is-muted"}>
                  {item.ok ? <CheckCircle2 size={13} /> : <span className="product-setup__step-dot" />}
                  {item.label}{!item.ok ? " not provided" : ""}
                </li>
              ))}
              {!snap.essentials.size && (
                <li className="is-muted"><span className="product-setup__step-dot" /> Size not provided</li>
              )}
            </ul>
          </div>
        </div>
        {snap.readiness.warnings.length > 0 && (
          <ul className="product-setup__readiness-warn">
            {snap.readiness.warnings.map((w) => <li key={w}><AlertTriangle size={13} /> {w}</li>)}
          </ul>
        )}
        <p className="product-setup__readiness-status">{snap.readiness.statusLabel.replace(/_/g, " ")}</p>
      </section>

      <footer className="product-setup__footer">
        <span className="product-setup__footer-meta">
          {snap.saveState === "saved" ? "Saved automatically" : snap.saveState === "saving" ? "Saving…" : "Unsaved changes"}
          <em>Step 1 of 3</em>
        </span>
        <button
          type="button"
          className="product-setup__continue"
          disabled={!snap.canContinue || busy || importRunning}
          onClick={() => void onContinue()}
        >
          {busy ? <Loader2 size={15} className="spin" /> : null}
          {continuePhase === "saving"
            ? "Saving…"
            : continuePhase === "opening"
              ? "Opening Video Plan…"
              : "Continue to Video Plan →"}
        </button>
      </footer>
    </div>
  );
}

function buildAnalysisSteps(snap: ProductSetupSnapshot): Array<{ label: string; done: boolean; active: boolean }> {
  const status = snap.analysisStatus;
  const uploaded = snap.intake.assets.some((a) => a.processingStatus === "saved");
  const detected = Boolean(snap.organization.productImageSet?.images.length);
  const views = detected && snap.organization.productImageSet!.images.some((i) => i.viewType !== "UNKNOWN");
  const quality = status === "COMPLETE" || status === "REVIEW_REQUIRED";
  const hero = Boolean(snap.aiSummary?.heroAssetId);

  return [
    { label: "Images received", done: uploaded, active: status === "UPLOADING" },
    { label: "Product detected", done: detected, active: status === "ANALYZING" && !detected },
    { label: "Identifying product views", done: views, active: status === "ANALYZING" && detected && !views },
    { label: "Checking image quality", done: quality, active: status === "ANALYZING" && views && !quality },
    { label: "Selecting best images", done: hero, active: status === "ANALYZING" && quality && !hero },
  ];
}
