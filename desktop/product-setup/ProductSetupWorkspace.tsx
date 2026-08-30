import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, FolderOpen, ImagePlus, Loader2, RefreshCw, Trash2, Upload,
} from "lucide-react";
import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import { productSetupEngine } from "./product-setup-engine";
import type { ProductSetupSnapshot } from "./types";
import { formatPrice, parsePriceInput } from "./discount";
import { suggestProductName } from "./readiness";
import { VIEW_PICKER_OPTIONS, confidenceLabel } from "./view-labels";
import { ACCEPT_ATTR } from "../product-intake/formats";
import { desktopPicksToFiles } from "../product-intake/desktop-import";
import "./product-setup.css";

const CURRENCIES = ["RWF", "USD", "EUR", "GBP", "KES", "UGX", "TZS"];

export function ProductSetupWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProductSetupSnapshot>(() => productSetupEngine.snapshot());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
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
    const name = snap.projectName.trim();
    if (!name) {
      notify("warning", "Project name required", "Enter a project name before uploading images.", "warnings");
      return;
    }
    setBusy(true);
    try {
      await productSetupEngine.ensureProject(name);
      productSetupEngine.enqueueFiles([...files]);
    } catch (error) {
      notify("error", "Upload failed", error instanceof Error ? error.message : "Could not save project", "errors");
    } finally {
      setBusy(false);
    }
  }, [notify, snap.projectName]);

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
    setBusy(true);
    try {
      await productSetupEngine.continueToStep2();
      notify("success", "Product setup complete", "Opening Video Settings.", "production-complete");
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
    }
  };

  const savedCount = snap.intake.assets.filter((a) => a.processingStatus === "saved").length;
  const hasImages = savedCount > 0;
  const suggestedName = suggestProductName(snap.projectName);

  const analysisSteps = buildAnalysisSteps(snap);

  return (
    <div className="product-setup">
      <WorkflowProgress currentStep={1} projectName={snap.projectName || undefined} />

      <div className="product-setup__intro">
        <span className="kw-workflow-progress__step-label">STEP 1 OF 5 · PRODUCT SETUP</span>
        <h1>Create Your Product Video Project</h1>
        <p>Add your product images and a few important details. KWIZERA AI will analyze and organize the product automatically.</p>
      </div>

      {/* Project name */}
      <section className="product-setup__section">
        <h2>Project Details</h2>
        <div className="product-setup__field">
          <label htmlFor="ps-project-name">
            Project Name
            <input
              id="ps-project-name"
              value={snap.projectName}
              onChange={(e) => productSetupEngine.setProjectNameLocal(e.target.value)}
              onBlur={() => {
                if (snap.projectName.trim()) void productSetupEngine.ensureProject(snap.projectName).catch(() => undefined);
              }}
              placeholder="e.g. Chestnut Oxford Campaign"
            />
          </label>
        </div>
        <p className="product-setup__save" data-state={snap.saveState}>
          {snap.saveState === "saving" ? "Saving…" : snap.saveState === "error" ? "Unsaved changes" : snap.saveState === "unsaved" ? "Unsaved changes" : "Saved"}
        </p>
      </section>

      {/* Upload */}
      <section className="product-setup__section">
        <h2>Product Images</h2>
        <div
          className={`product-setup__dropzone ${hasImages ? "is-compact" : ""} ${dragging ? "is-dragging" : ""}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void onFiles(e.dataTransfer.files); }}
        >
          {!hasImages ? <ImagePlus size={32} strokeWidth={1.5} /> : null}
          <h3>{hasImages ? `${savedCount} image${savedCount === 1 ? "" : "s"} imported` : "Drop images here"}</h3>
          <p>{hasImages ? "Add more angles to improve AI coverage." : "Add clear photos of your product from different angles."}</p>
          <div className="product-setup__drop-actions">
            <button type="button" disabled={busy} onClick={() => void pickImages()}>
              <Upload size={15} /> Select Images
            </button>
            <button type="button" disabled={busy} onClick={() => folderRef.current?.click()}>
              <FolderOpen size={15} /> Import Folder
            </button>
          </div>
        </div>
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

      {/* Analysis status */}
      {(snap.analysisStatus !== "NOT_STARTED" || snap.intake.progress.running) && (
        <section className="product-setup__section product-setup__analysis">
          <h3>
            {snap.analysisStatus === "ANALYZING" || snap.analysisStatus === "UPLOADING"
              ? "AI is analyzing your product"
              : snap.analysisStatus === "FAILED"
                ? "Analysis needs attention"
                : "AI analysis complete"}
          </h3>
          <ul className="product-setup__analysis-steps">
            {analysisSteps.map((step) => (
              <li key={step.label} className={step.done ? "is-done" : step.active ? "is-active" : ""}>
                {step.done ? <CheckCircle2 size={14} /> : step.active ? <Loader2 size={14} className="spin" /> : <span>○</span>}
                {step.label}
              </li>
            ))}
          </ul>
          {snap.analysisStatus === "FAILED" && (
            <button type="button" className="product-setup__suggest" onClick={() => void productSetupEngine.retryAnalysis()}>
              <RefreshCw size={14} /> Retry analysis
            </button>
          )}
        </section>
      )}

      {/* Image grid */}
      {snap.imageCards.length > 0 && (
        <section className="product-setup__section">
          <h2>Product Images</h2>
          <div className="product-setup__grid">
            {snap.imageCards.map((card) => (
              <article key={card.assetId} className="product-setup__card">
                <div className="product-setup__card-thumb">
                  {card.url ? <img src={card.url} alt={card.fileName} loading="lazy" /> : <ImagePlus size={24} />}
                  {card.issueMessage && (
                    <span className="product-setup__card-badge" data-severity={card.severity} title={card.issueMessage}>
                      !
                    </span>
                  )}
                </div>
                <div className="product-setup__card-body">
                  <strong>{card.displayLabel.toUpperCase()}</strong>
                  <span className="product-setup__card-meta">
                    {card.needsReview ? "Needs review" : confidenceLabel(card.confidence)}
                  </span>
                  <select
                    aria-label={`View type for ${card.fileName}`}
                    value={card.finalViewType}
                    onChange={(e) => void productSetupEngine.reclassifyImage(card.assetId, e.target.value as never)}
                  >
                    {VIEW_PICKER_OPTIONS.map((opt, idx) => (
                      <option key={`${opt.value}-${idx}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="product-setup__card-actions">
                    {card.isDuplicate && (
                      <button type="button" onClick={() => productSetupEngine.keepDuplicate(card.assetId)}>Keep</button>
                    )}
                    <button type="button" onClick={() => void productSetupEngine.removeImage(card.assetId)}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* AI summary */}
      {snap.aiSummary && (
        <section className="product-setup__section product-setup__summary">
          <h2>AI Product Summary</h2>
          <dl>
            <dt>Product</dt><dd>{snap.aiSummary.productLabel ?? "—"}</dd>
            <dt>Category</dt><dd>{snap.aiSummary.category ?? "Estimating…"}</dd>
            <dt>Images</dt><dd>{snap.aiSummary.imageCount} analyzed</dd>
            <dt>Useful Views</dt><dd>{snap.aiSummary.usefulViews.join(" · ") || "—"}</dd>
            <dt>Hero Image</dt><dd>{snap.aiSummary.heroAssetId ? "Selected automatically" : "—"}</dd>
          </dl>
          <div className="product-setup__coverage">
            <strong>{snap.aiSummary.coverageLabel.replace(/_/g, " ")}</strong>
            <p>{snap.aiSummary.coverageMessage}</p>
            {snap.organization.productImageSet?.missingViews.length ? (
              <ul>
                {snap.organization.productImageSet.recommendedViews.map((view) => {
                  const found = !snap.organization.productImageSet!.missingViews.includes(view);
                  return (
                    <li key={view} className={found ? "is-found" : ""}>
                      {view.replace(/_/g, " ")} {found ? "found" : "not found"}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </section>
      )}

      {/* Product essentials */}
      <section className="product-setup__section">
        <h2>Product Essentials</h2>
        <div className="product-setup__essentials-grid">
          <div className="product-setup__field">
            <label htmlFor="ps-product-name">
              Product Name
              <input
                id="ps-product-name"
                value={snap.essentials.productName}
                onChange={(e) => productSetupEngine.setEssentialField("productName", e.target.value)}
                placeholder="Chestnut Oxford"
              />
            </label>
            {suggestedName && !snap.essentials.productName && (
              <button type="button" className="product-setup__suggest" onClick={() => productSetupEngine.applySuggestedProductName()}>
                Use “{suggestedName}” from project name
              </button>
            )}
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-size">
              Size (optional)
              <input
                id="ps-size"
                value={snap.essentials.size}
                onChange={(e) => productSetupEngine.setEssentialField("size", e.target.value)}
                placeholder="40 / 41 / 42"
              />
            </label>
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-current-price">
              Current Price
              <input
                id="ps-current-price"
                inputMode="decimal"
                value={snap.essentials.currentPrice ?? ""}
                onChange={(e) => productSetupEngine.setEssentialField("currentPrice", parsePriceInput(e.target.value))}
                placeholder="20,000"
              />
            </label>
          </div>
          <div className="product-setup__field">
            <label htmlFor="ps-currency">
              Currency
              <select
                id="ps-currency"
                value={snap.essentials.currency}
                onChange={(e) => productSetupEngine.setEssentialField("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="product-setup__field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="ps-previous-price">
              Previous Price (optional)
              <input
                id="ps-previous-price"
                inputMode="decimal"
                value={snap.essentials.previousPrice ?? ""}
                onChange={(e) => productSetupEngine.setEssentialField("previousPrice", parsePriceInput(e.target.value))}
                placeholder="25,000"
              />
            </label>
            {snap.discount.valid && (
              <span className="product-setup__discount">{snap.discount.label}</span>
            )}
            {snap.essentials.previousPrice != null && snap.essentials.currentPrice != null
              && snap.essentials.previousPrice <= snap.essentials.currentPrice && (
              <p className="product-setup__price-hint">Previous price must be higher than current price to create a discount.</p>
            )}
            {snap.essentials.currentPrice != null && snap.discount.valid && (
              <p className="product-setup__card-meta">
                WAS {formatPrice(snap.essentials.previousPrice, snap.essentials.currency)} · NOW {formatPrice(snap.essentials.currentPrice, snap.essentials.currency)}
              </p>
            )}
          </div>
          <div className="product-setup__field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="ps-description">
              Short Description (optional)
              <textarea
                id="ps-description"
                rows={2}
                value={snap.essentials.shortDescription}
                onChange={(e) => productSetupEngine.setEssentialField("shortDescription", e.target.value)}
                placeholder="Premium brown oxford shoe for everyday wear"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Optional details */}
      <section className="product-setup__section">
        <button
          type="button"
          className="product-setup__details-toggle"
          onClick={() => setOptionalOpen((v) => !v)}
          aria-expanded={optionalOpen}
        >
          {optionalOpen ? "−" : "+"} Add More Product Details <ChevronDown size={14} style={{ verticalAlign: "middle" }} />
        </button>
        {optionalOpen && (
          <div className="product-setup__essentials-grid" style={{ marginTop: 16 }}>
            {(["brand", "color", "material", "features", "website", "notes"] as const).map((field) => (
              <div key={field} className="product-setup__field">
                <label htmlFor={`ps-opt-${field}`}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                  <input
                    id={`ps-opt-${field}`}
                    value={snap.optional[field]}
                    onChange={(e) => productSetupEngine.setOptionalField(field, e.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Readiness */}
      <section className="product-setup__section product-setup__readiness">
        <h2>Project Readiness</h2>
        <ul>
          <li>{snap.readiness.summary.projectName ? "✓" : "○"} Project name</li>
          <li>{snap.readiness.summary.validImages > 0 ? "✓" : "○"} Product images ({snap.readiness.summary.validImages})</li>
          <li>{snap.analysisStatus === "COMPLETE" || snap.analysisStatus === "REVIEW_REQUIRED" ? "✓" : "○"} AI analysis</li>
          <li>{snap.readiness.summary.productName ? "✓" : "○"} Product name</li>
          {snap.essentials.currentPrice != null && <li>✓ Price available</li>}
          {snap.discount.valid && <li>✓ Discount calculated</li>}
          {!snap.essentials.size && <li>○ Size not provided (optional)</li>}
        </ul>
        {snap.readiness.warnings.length > 0 && (
          <ul>{snap.readiness.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}
        <p className="product-setup__readiness-status">{snap.readiness.statusLabel.replace(/_/g, " ")}</p>
      </section>

      <footer className="product-setup__footer">
        <p>{snap.readiness.recommendations[0] ?? snap.readiness.blockingIssues[0] ?? "Complete the essentials above to continue."}</p>
        <button
          type="button"
          className="product-setup__continue"
          disabled={!snap.canContinue || busy}
          onClick={() => void onContinue()}
        >
          {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
          {snap.continueLabel}
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
