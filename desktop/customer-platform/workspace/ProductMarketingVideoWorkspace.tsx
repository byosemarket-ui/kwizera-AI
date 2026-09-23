import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown, ChevronUp, FolderOpen, ImagePlus, Loader2, Star, Trash2, Upload,
} from "lucide-react";
import { useShell } from "../../shell/ShellContext";
import { productSetupEngine } from "../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../product-setup/types";
import { parsePriceInput } from "../../product-setup/discount";
import { ACCEPT_ATTR, classifyFormat } from "../../product-intake/formats";
import { desktopPicksToFiles } from "../../product-intake/desktop-import";
import { ServiceWorkspace } from "./ServiceWorkspace";
import { VIDEO_SERVICE_STEPS } from "./types";
import "../../product-setup/product-setup.css";
import "./product-marketing-video.css";

const CURRENCIES = ["RWF", "USD", "EUR", "GBP", "KES", "UGX", "TZS"];
const DURATIONS = [15, 30, 45, 60];
const ASPECTS = [
  { value: "9:16" as const, label: "9:16 · Vertical" },
  { value: "1:1" as const, label: "1:1 · Square" },
  { value: "16:9" as const, label: "16:9 · Landscape" },
];

/**
 * Product Marketing Video — Steps 1–2 foundation.
 * Step 1: product assets, info, brand, settings.
 * Step 2: Product Intelligence + Product Identity Lock (reuses PI API).
 * Does not generate video.
 */
export function ProductMarketingVideoWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ProductSetupSnapshot>(() => productSetupEngine.snapshot());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    productSetupEngine.setServiceMode("pmv");
    productSetupEngine.setNotify(notify);
    const unsub = productSetupEngine.subscribe(setSnap);
    void productSetupEngine.hydrateFromServer();
    return () => {
      unsub();
      productSetupEngine.setNotify(null);
      productSetupEngine.setServiceMode("standard");
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
    setBusy(true);
    setUploadError(null);
    try {
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

  const onSaveDraft = async () => {
    setBusy(true);
    try {
      await productSetupEngine.saveDraft();
      notify("success", "Project saved", "Your Product Marketing Video draft is saved.", "production-complete");
    } catch (error) {
      notify("error", "Save failed", error instanceof Error ? error.message : "Try again.", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onMarkReady = async () => {
    setBusy(true);
    try {
      await productSetupEngine.markReadyForIntelligence();
      notify(
        "success",
        "Ready for next step",
        "Product foundation saved. Run Product Intelligence next.",
        "production-complete",
      );
    } catch (error) {
      notify("error", "Not ready", error instanceof Error ? error.message : "Complete required fields.", "errors");
    } finally {
      setBusy(false);
    }
  };

  const onAnalyzeProduct = async () => {
    setBusy(true);
    try {
      await productSetupEngine.runProductIntelligence();
      notify(
        "success",
        "Product analyzed",
        "Review the Product Intelligence result, then confirm the Product Identity Lock.",
        "production-complete",
      );
    } catch (error) {
      notify(
        "error",
        "Analysis failed",
        error instanceof Error ? error.message : "Could not analyze product.",
        "errors",
      );
    } finally {
      setBusy(false);
    }
  };

  const onConfirmLock = async () => {
    setBusy(true);
    try {
      await productSetupEngine.confirmProductIdentityLock();
      notify(
        "success",
        "Product identity locked",
        "Future video generation must keep this product visually unchanged.",
        "production-complete",
      );
    } catch (error) {
      notify(
        "error",
        "Could not lock",
        error instanceof Error ? error.message : "Confirm after a successful analysis.",
        "errors",
      );
    } finally {
      setBusy(false);
    }
  };

  const savedCount = snap.intake.assets.filter((a) => a.processingStatus === "saved").length;
  const uploadingCount = snap.intake.assets.filter((a) => a.processingStatus === "uploading").length;
  const hasImages = savedCount > 0 || uploadingCount > 0 || snap.imageCards.length > 0;
  const currentStepId =
    snap.intelligenceStatus === "LOCKED" || snap.intelligenceStatus === "REVIEW"
      || snap.intelligenceStatus === "STALE" || snap.intelligenceStatus === "ANALYZING"
      || snap.intelligenceStatus === "FAILED" || snap.intelligenceStatus === "UNAVAILABLE"
      || snap.foundationStatus === "READY_FOR_INTELLIGENCE" || snap.foundationStatus === "PROCESSING"
      ? "plan"
      : "upload";

  const statusLabel = (() => {
    if (snap.intelligenceStatus === "LOCKED") return "Product locked";
    if (snap.intelligenceStatus === "REVIEW") return "Review intelligence";
    if (snap.intelligenceStatus === "ANALYZING") return "Analyzing";
    if (snap.intelligenceStatus === "STALE") return "Lock stale";
    if (snap.intelligenceStatus === "FAILED") return "Analysis failed";
    if (snap.intelligenceStatus === "UNAVAILABLE") return "Analysis unavailable";
    if (snap.foundationStatus === "READY_FOR_INTELLIGENCE") return "Ready for intelligence";
    if (snap.foundationStatus === "PROCESSING") return "Processing";
    return "Draft";
  })();

  const review = snap.intelligenceReview;
  const lock = snap.identityLock;
  const canAnalyze = !busy
    && (snap.foundationStatus === "READY_FOR_INTELLIGENCE"
      || snap.intelligenceStatus === "STALE"
      || snap.intelligenceStatus === "FAILED"
      || snap.intelligenceStatus === "UNAVAILABLE"
      || snap.canMarkReady)
    && snap.intelligenceStatus !== "ANALYZING";

  return (
    <ServiceWorkspace
      meta={{
        serviceKey: "product-marketing-video",
        title: "Product Marketing Video",
        description: "Build a product marketing video project — images, information, brand, and settings.",
        helpHint: "Save anytime. Video generation comes in later steps.",
      }}
      steps={VIDEO_SERVICE_STEPS}
      currentStepId={currentStepId}
      phase={snap.intelligenceStatus === "ANALYZING" ? "processing" : "input"}
      onBack={() => switchWorkspace("home")}
      onHelp={() => switchWorkspace("help")}
      onCancel={() => switchWorkspace("home")}
      cancelLabel="Back to Home"
      footerNote={
        snap.intelligenceStatus === "LOCKED"
          ? "Product Identity Lock is active — ready for Creative Plan (Step 3)."
          : "Step 2 locks product identity. Video generation comes in later steps."
      }
    >
      <div className="pmv-foundation product-setup is-customer-mode" data-pmv-foundation="true" data-customer-mode="true">
        <header className="product-setup__header pmv-foundation__header">
          <div>
            <h1>Product Marketing Video</h1>
            <p>Set up your product, analyze it, and lock visual identity before creative generation.</p>
          </div>
          <div className="pmv-foundation__status-row">
            <span
              className="pmv-foundation__status"
              data-status={snap.intelligenceStatus === "LOCKED" ? "LOCKED" : snap.foundationStatus}
              data-intelligence={snap.intelligenceStatus}
            >
              {statusLabel}
            </span>
            <p className="product-setup__save" data-state={snap.saveState}>
              {snap.saveState === "saving" ? "Saving…" : snap.saveState === "error" ? "Unsaved" : snap.saveState === "unsaved" ? "Unsaved" : "Saved"}
            </p>
          </div>
        </header>

        {/* A. PRODUCT */}
        <section className="product-setup__panel" aria-labelledby="pmv-product-heading">
          <div className="product-setup__section-head">
            <h2 id="pmv-product-heading">Product</h2>
            {hasImages && (
              <span className="product-setup__meta">
                {savedCount} uploaded{uploadingCount > 0 ? ` · ${uploadingCount} uploading` : ""}
              </span>
            )}
          </div>

          <label className="product-setup__field pmv-foundation__project-name">
            <span>Project name <em>(required)</em></span>
            <input
              value={snap.projectName}
              onChange={(e) => productSetupEngine.setProjectNameLocal(e.target.value)}
              placeholder="Chestnut Oxford Campaign"
              aria-required="true"
            />
          </label>

          {uploadError && <p className="product-setup__upload-error" role="alert">{uploadError}</p>}

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
                <p className="product-setup__drop-copy">Add clear photos from different angles.</p>
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
            <div className="product-setup__grid pmv-foundation__grid" role="list">
              {snap.imageCards.map((card, index) => {
                const isHero = snap.heroAssetId === card.assetId;
                return (
                  <article
                    key={card.clientKey}
                    role="listitem"
                    className={`product-setup__card${card.uploadStatus === "uploading" ? " is-uploading" : ""}${isHero ? " is-hero" : ""}`}
                  >
                    <div className="product-setup__card-thumb">
                      {card.url ? (
                        <img src={card.url} alt={card.fileName} loading="lazy" />
                      ) : (
                        <span className="product-setup__card-missing"><ImagePlus size={22} /></span>
                      )}
                      {card.uploadStatus === "uploading" && (
                        <span className="product-setup__card-overlay"><Loader2 size={18} className="spin" /></span>
                      )}
                      {isHero && <span className="pmv-foundation__hero-badge">Hero</span>}
                    </div>
                    <div className="product-setup__card-body">
                      <div className="product-setup__card-head">
                        <strong title={card.fileName}>{card.fileName}</strong>
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
                      <div className="pmv-foundation__card-actions">
                        <button
                          type="button"
                          className="product-setup__link-btn"
                          disabled={card.uploadStatus !== "saved" || isHero}
                          onClick={() => void productSetupEngine.setHeroImage(card.assetId).catch((err) => {
                            notify("error", "Hero image", err instanceof Error ? err.message : "Failed", "errors");
                          })}
                        >
                          <Star size={14} /> {isHero ? "Hero selected" : "Set as hero"}
                        </button>
                        <div className="pmv-foundation__reorder">
                          <button
                            type="button"
                            className="product-setup__icon-btn"
                            aria-label={`Move ${card.fileName} earlier`}
                            disabled={index === 0}
                            onClick={() => productSetupEngine.moveImage(card.assetId, "up")}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="product-setup__icon-btn"
                            aria-label={`Move ${card.fileName} later`}
                            disabled={index >= snap.imageCards.length - 1}
                            onClick={() => productSetupEngine.moveImage(card.assetId, "down")}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
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

        {/* B. PRODUCT INFORMATION */}
        <section className="product-setup__panel" aria-labelledby="pmv-info-heading">
          <div className="product-setup__section-head">
            <h2 id="pmv-info-heading">Product information</h2>
            <button type="button" className="product-setup__link-btn" onClick={() => setDetailsOpen((v) => !v)}>
              {detailsOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          <div className="product-setup__form-grid">
            <label className="product-setup__field">
              <span>Product name <em>(required)</em></span>
              <input
                value={snap.essentials.productName}
                onChange={(e) => productSetupEngine.setEssentialField("productName", e.target.value)}
                placeholder="Chestnut Oxford"
                aria-required="true"
              />
            </label>
            <label className="product-setup__field">
              <span>Short description</span>
              <input
                value={snap.essentials.shortDescription}
                onChange={(e) => productSetupEngine.setEssentialField("shortDescription", e.target.value)}
                placeholder="Premium brown oxford shoe"
              />
            </label>
            <label className="product-setup__field">
              <span>Current price</span>
              <input
                inputMode="decimal"
                value={snap.essentials.currentPrice ?? ""}
                onChange={(e) => productSetupEngine.setEssentialField("currentPrice", parsePriceInput(e.target.value))}
                placeholder="20,000"
              />
            </label>
            <label className="product-setup__field">
              <span>Previous price</span>
              <input
                inputMode="decimal"
                value={snap.essentials.previousPrice ?? ""}
                onChange={(e) => productSetupEngine.setEssentialField("previousPrice", parsePriceInput(e.target.value))}
                placeholder="45,000"
              />
            </label>
            <label className="product-setup__field">
              <span>Currency</span>
              <select
                value={snap.essentials.currency}
                onChange={(e) => productSetupEngine.setEssentialField("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="product-setup__field">
              <span>Size</span>
              <input
                value={snap.essentials.size}
                onChange={(e) => productSetupEngine.setEssentialField("size", e.target.value)}
                placeholder="40 / 41 / 42"
              />
            </label>
          </div>
          {detailsOpen && (
            <div className="product-setup__form-grid pmv-foundation__optional-grid">
              <label className="product-setup__field is-wide">
                <span>Long description</span>
                <textarea
                  rows={3}
                  value={snap.optional.longDescription}
                  onChange={(e) => productSetupEngine.setOptionalField("longDescription", e.target.value)}
                  placeholder="Detailed product story for the campaign"
                />
              </label>
              <label className="product-setup__field">
                <span>Category</span>
                <input
                  value={snap.optional.productCategory}
                  onChange={(e) => productSetupEngine.setOptionalField("productCategory", e.target.value)}
                  placeholder="Footwear"
                />
              </label>
              <label className="product-setup__field">
                <span>Offer / discount note</span>
                <input
                  value={snap.optional.offer}
                  onChange={(e) => productSetupEngine.setOptionalField("offer", e.target.value)}
                  placeholder="Limited-time launch offer"
                />
              </label>
              <label className="product-setup__field">
                <span>Color</span>
                <input
                  value={snap.optional.color}
                  onChange={(e) => productSetupEngine.setOptionalField("color", e.target.value)}
                  placeholder="Chestnut brown"
                />
              </label>
              <label className="product-setup__field">
                <span>Material</span>
                <input
                  value={snap.optional.material}
                  onChange={(e) => productSetupEngine.setOptionalField("material", e.target.value)}
                  placeholder="Leather"
                />
              </label>
              <label className="product-setup__field is-wide">
                <span>Features</span>
                <textarea
                  rows={2}
                  value={snap.optional.features}
                  onChange={(e) => productSetupEngine.setOptionalField("features", e.target.value)}
                  placeholder="One feature per line"
                />
              </label>
              <label className="product-setup__field is-wide">
                <span>Benefits</span>
                <textarea
                  rows={2}
                  value={snap.optional.benefits}
                  onChange={(e) => productSetupEngine.setOptionalField("benefits", e.target.value)}
                  placeholder="One benefit per line"
                />
              </label>
              <label className="product-setup__field">
                <span>Product CTA</span>
                <input
                  value={snap.optional.productCta}
                  onChange={(e) => productSetupEngine.setOptionalField("productCta", e.target.value)}
                  placeholder="Shop now"
                />
              </label>
            </div>
          )}
          {snap.discount.valid && snap.discount.label ? (
            <p className="pmv-foundation__discount">{snap.discount.label}</p>
          ) : null}
        </section>

        {/* C. BRAND & CONTACT */}
        <section className="product-setup__panel" aria-labelledby="pmv-brand-heading">
          <h2 id="pmv-brand-heading">Brand &amp; contact</h2>
          <div className="product-setup__form-grid">
            <label className="product-setup__field">
              <span>Brand name</span>
              <input
                value={snap.brandContact.brandName}
                onChange={(e) => productSetupEngine.setBrandContactField("brandName", e.target.value)}
                placeholder="KWIZERA"
              />
            </label>
            <label className="product-setup__field">
              <span>Website</span>
              <input
                value={snap.brandContact.websiteUrl}
                onChange={(e) => productSetupEngine.setBrandContactField("websiteUrl", e.target.value)}
                placeholder="https://example.com"
              />
            </label>
            <label className="product-setup__field">
              <span>Phone</span>
              <input
                value={snap.brandContact.phone}
                onChange={(e) => productSetupEngine.setBrandContactField("phone", e.target.value)}
                placeholder="+250 …"
              />
            </label>
            <label className="product-setup__field">
              <span>WhatsApp</span>
              <input
                value={snap.brandContact.whatsapp}
                onChange={(e) => productSetupEngine.setBrandContactField("whatsapp", e.target.value)}
                placeholder="+250 …"
              />
            </label>
            <label className="product-setup__field">
              <span>Email</span>
              <input
                type="email"
                value={snap.brandContact.email}
                onChange={(e) => productSetupEngine.setBrandContactField("email", e.target.value)}
                placeholder="hello@example.com"
              />
            </label>
            <label className="product-setup__field">
              <span>Brand CTA</span>
              <input
                value={snap.brandContact.cta}
                onChange={(e) => productSetupEngine.setBrandContactField("cta", e.target.value)}
                placeholder="Order on WhatsApp"
              />
            </label>
          </div>
          <div className="pmv-foundation__logo">
            <span className="product-setup__field-label">Brand logo</span>
            {snap.brandContact.logoUrl ? (
              <div className="pmv-foundation__logo-preview">
                <img src={snap.brandContact.logoUrl} alt="" />
                <button
                  type="button"
                  className="product-setup__link-btn"
                  onClick={() => void productSetupEngine.removeBrandLogo().catch((err) => {
                    notify("error", "Logo", err instanceof Error ? err.message : "Failed", "errors");
                  })}
                >
                  Remove logo
                </button>
              </div>
            ) : (
              <button type="button" className="product-setup__link-btn" onClick={() => logoRef.current?.click()}>
                <Upload size={14} /> Upload logo
              </button>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void productSetupEngine.uploadBrandLogo(file).catch((err) => {
                  notify("error", "Logo upload", err instanceof Error ? err.message : "Failed", "errors");
                });
              }}
            />
          </div>
        </section>

        {/* D. VIDEO SETTINGS */}
        <section className="product-setup__panel" aria-labelledby="pmv-settings-heading">
          <h2 id="pmv-settings-heading">Video settings</h2>
          <div className="product-setup__form-grid">
            <label className="product-setup__field">
              <span>Duration</span>
              <select
                value={snap.videoSettings.durationSeconds}
                onChange={(e) => productSetupEngine.setVideoSettingsField("durationSeconds", Number(e.target.value))}
              >
                {DURATIONS.map((d) => <option key={d} value={d}>{d} seconds</option>)}
              </select>
            </label>
            <label className="product-setup__field">
              <span>Aspect ratio</span>
              <select
                value={snap.videoSettings.aspectRatio}
                onChange={(e) => productSetupEngine.setVideoSettingsField("aspectRatio", e.target.value as "9:16" | "1:1" | "16:9")}
              >
                {ASPECTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>
            <label className="product-setup__field">
              <span>Language</span>
              <input
                value={snap.videoSettings.language}
                onChange={(e) => productSetupEngine.setVideoSettingsField("language", e.target.value)}
                placeholder="en"
              />
            </label>
            <label className="product-setup__field">
              <span>Video CTA</span>
              <input
                value={snap.videoSettings.cta}
                onChange={(e) => productSetupEngine.setVideoSettingsField("cta", e.target.value)}
                placeholder="Shop now"
              />
            </label>
          </div>
          <p className="pmv-foundation__hint">
            Creative modes (Exact Product, Cinematic, Advanced) will use these settings in later steps.
          </p>
        </section>

        {/* F. PRODUCT INTELLIGENCE + IDENTITY LOCK */}
        <section
          className="product-setup__panel pmv-intelligence"
          aria-labelledby="pmv-intel-heading"
          data-pmv-intelligence="true"
          data-intelligence-status={snap.intelligenceStatus}
        >
          <div className="product-setup__section-head">
            <h2 id="pmv-intel-heading">Product intelligence</h2>
            <span className="product-setup__meta">{statusLabel}</span>
          </div>
          <p className="pmv-foundation__hint">
            Analyze your product photos, review what the system found, then lock the visual identity
            so future ads keep your real product unchanged.
          </p>

          {snap.intelligenceError ? (
            <p className="pmv-foundation__blocked" role="alert">{snap.intelligenceError}</p>
          ) : null}

          {snap.intelligenceStatus === "STALE" ? (
            <p className="pmv-foundation__blocked" role="status">
              Product images changed. Re-analyze to refresh Product Intelligence and the Product Identity Lock.
            </p>
          ) : null}

          {review ? (
            <div className="pmv-intelligence__review" data-pmv-review="true">
              <div className="pmv-intelligence__grid">
                <div>
                  <p className="pmv-intelligence__label">Product identified</p>
                  <p className="pmv-intelligence__value">{review.productIdentified}</p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Type / category</p>
                  <p className="pmv-intelligence__value">
                    {review.productType}
                    {review.category && review.category !== review.productType ? ` · ${review.category}` : ""}
                  </p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Brand</p>
                  <p className="pmv-intelligence__value">{review.brand || "—"}</p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Confidence</p>
                  <p className="pmv-intelligence__value" data-confidence={review.confidenceLabel}>
                    {review.confidenceLabel}
                  </p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Key colors</p>
                  <p className="pmv-intelligence__value">
                    {review.keyColors.length ? review.keyColors.join(", ") : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Material</p>
                  <p className="pmv-intelligence__value">
                    {review.material.length ? review.material.join(", ") : "Unknown"}
                  </p>
                </div>
                <div className="pmv-intelligence__wide">
                  <p className="pmv-intelligence__label">Visible features</p>
                  <p className="pmv-intelligence__value">
                    {review.visibleFeatures.length ? review.visibleFeatures.join(" · ") : "None listed"}
                  </p>
                </div>
                <div className="pmv-intelligence__wide">
                  <p className="pmv-intelligence__label">Logo / branding</p>
                  <p className="pmv-intelligence__value">
                    {review.logoBranding.length ? review.logoBranding.join(" · ") : "Not clearly visible"}
                  </p>
                </div>
                <div>
                  <p className="pmv-intelligence__label">Reference images</p>
                  <p className="pmv-intelligence__value">{review.imageCount} photos · hero selected</p>
                </div>
              </div>

              {review.visionUnavailableMessage ? (
                <p className="pmv-foundation__hint" role="status">{review.visionUnavailableMessage}</p>
              ) : null}

              {review.warnings.length > 0 ? (
                <ul className="pmv-intelligence__warnings">
                  {review.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              {lock ? (
                <div className="pmv-intelligence__lock" data-lock-status={lock.status}>
                  <p className="pmv-intelligence__label">Product identity lock</p>
                  <p className="pmv-intelligence__value">
                    {lock.status === "LOCKED"
                      ? "Locked — shape, color, material, branding, and distinctive details stay protected."
                      : lock.status === "STALE"
                        ? "Stale — re-analyze after product image changes."
                        : "Pending confirmation — review above, then confirm to lock."}
                  </p>
                  <p className="pmv-foundation__hint">
                    Allowed later: background, lighting, camera, atmosphere, motion, and marketing presentation.
                    Not allowed: changing the real product’s identity.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="pmv-foundation__hint">
              {snap.foundationStatus === "READY_FOR_INTELLIGENCE" || snap.canMarkReady
                ? "Run analysis to build a Product Intelligence profile from your photos and details."
                : "Finish product setup and mark ready before analyzing."}
            </p>
          )}

          <div className="pmv-intelligence__actions">
            <button
              type="button"
              disabled={!canAnalyze}
              onClick={() => void onAnalyzeProduct()}
            >
              {snap.intelligenceStatus === "ANALYZING" ? <Loader2 size={14} className="spin" /> : null}
              {snap.intelligenceStatus === "STALE" || snap.intelligenceStatus === "FAILED"
                ? "Re-analyze product"
                : snap.intelligenceStatus === "REVIEW" || snap.intelligenceStatus === "LOCKED"
                  ? "Re-analyze product"
                  : "Analyze product"}
            </button>
            <button
              type="button"
              disabled={busy || !snap.canConfirmIdentityLock}
              onClick={() => void onConfirmLock()}
            >
              Confirm product identity
            </button>
          </div>
        </section>

        {/* E. PROJECT SAVE / STATE */}
        <footer className="product-setup__footer pmv-foundation__footer">
          <div>
            <p className="pmv-foundation__footer-title">Project state</p>
            <p className="pmv-foundation__footer-copy">
              {snap.intelligenceStatus === "LOCKED"
                ? "Identity is locked. Creative Plan (Step 3) can use this project."
                : snap.foundationStatus === "READY_FOR_INTELLIGENCE"
                  ? "Foundation is ready — analyze and confirm Product Identity Lock."
                  : "Save a draft anytime, or mark ready when product images and name are set."}
            </p>
            {snap.readyBlockedReason && snap.foundationStatus !== "READY_FOR_INTELLIGENCE" ? (
              <p className="pmv-foundation__blocked">{snap.readyBlockedReason}</p>
            ) : null}
            {snap.identityLockBlockedReason && snap.intelligenceStatus !== "LOCKED" && review ? (
              <p className="pmv-foundation__blocked">{snap.identityLockBlockedReason}</p>
            ) : null}
          </div>
          <div className="pmv-foundation__footer-actions">
            <button type="button" className="is-secondary" disabled={busy} onClick={() => void onSaveDraft()}>
              Save draft
            </button>
            <button
              type="button"
              disabled={busy || !snap.canMarkReady || snap.foundationStatus === "READY_FOR_INTELLIGENCE"}
              onClick={() => void onMarkReady()}
            >
              {busy ? <Loader2 size={14} className="spin" /> : null}
              Mark ready for intelligence
            </button>
          </div>
        </footer>
      </div>
    </ServiceWorkspace>
  );
}
