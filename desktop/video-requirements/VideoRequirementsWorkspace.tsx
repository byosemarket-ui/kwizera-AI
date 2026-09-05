import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { WorkflowProgress } from "../product-creation/WorkflowProgress";
import { useShell } from "../shell/ShellContext";
import type { VideoPlatformId } from "../../ai/video-production/platform-profiles";
import { PLATFORM_OPTIONS, platformPreview } from "./platform-map";
import {
  CTA_OPTIONS,
  OBJECTIVES,
  videoRequirementsEngine,
} from "./video-requirements-engine";
import type { CampaignObjectiveOption, DurationOption, VideoRequirementsSnapshot } from "./types";
import { parsePriceInput } from "./readiness";
import { formatPrice } from "../product-setup/discount";
import "./video-requirements.css";

const LANGUAGES = ["English", "Kinyarwanda", "French"];

export function VideoRequirementsWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<VideoRequirementsSnapshot>(() => videoRequirementsEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [newPoint, setNewPoint] = useState("");

  useEffect(() => {
    videoRequirementsEngine.setNotify((tone, title, detail) => notify(tone, title, detail));
    const unsub = videoRequirementsEngine.subscribe(setSnap);
    void videoRequirementsEngine.hydrate();
    return () => {
      unsub();
      videoRequirementsEngine.setNotify(null);
    };
  }, [notify]);

  const onContinue = useCallback(async () => {
    setBusy(true);
    try {
      await videoRequirementsEngine.continueToStep3();
      notify("success", "Step 2 complete", "Opening Video Style & Production Review.", "production-complete");
      switchWorkspace("video-style");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Save failed", "errors");
    } finally {
      setBusy(false);
    }
  }, [notify, switchWorkspace]);

  return (
    <div className="vr-page">
      <WorkflowProgress currentStep={2} projectName={snap.projectName || undefined} />

      <div className="vr-intro">
        <span className="kw-workflow-progress__step-label">STEP 2 OF 4 · VIDEO PLAN</span>
        <h1>Video Plan</h1>
        <p>Set your video goal, audience, platform, duration, and language for this product video.</p>
      </div>

      {/* Media preparation status */}
      {snap.mediaPreparation ? (
        <section className="vr-section vr-section--media">
          <h2>Image Preparation</h2>
          <p className="vr-media-status">{snap.mediaPreparation.statusLabel}</p>
          {snap.mediaPreparation.needsReview > 0 ? (
            <p className="vr-hint">Some images may need review, but you can continue when the video plan is complete.</p>
          ) : null}
        </section>
      ) : null}

      {/* Section A — Product */}
      <section className="vr-section">
        <h2>Product</h2>
        {snap.product ? (
          <div className="vr-product-row">
            <div className="vr-product-thumb">
              {snap.product.heroUrl ? <img src={snap.product.heroUrl} alt="" /> : null}
            </div>
            <div className="vr-product-meta">
              <b>{snap.commercial.productName || snap.product.name}</b>
              <span>{snap.product.category}</span>
              <span>{snap.product.statusLabel}</span>
            </div>
          </div>
        ) : (
          <p>Complete Product Setup (Step 1) first.</p>
        )}
      </section>

      {/* Section B — Commercial */}
      <section className="vr-section">
        <h2>Commercial Information</h2>
        <div className="vr-grid-2">
          <div className="vr-field">
            <label htmlFor="vr-product-name">
              Product Name
              <input
                id="vr-product-name"
                value={snap.commercial.productName}
                onChange={(e) => videoRequirementsEngine.setCommercialField("productName", e.target.value)}
              />
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-currency">
              Currency
              <select
                id="vr-currency"
                value={snap.commercial.currency}
                onChange={(e) => videoRequirementsEngine.setCommercialField("currency", e.target.value)}
              >
                {["RWF", "USD", "EUR", "GBP", "KES"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-current-price">
              Current Price
              <input
                id="vr-current-price"
                inputMode="decimal"
                placeholder="Optional"
                value={snap.commercial.currentPrice ?? ""}
                onChange={(e) => videoRequirementsEngine.setCommercialField("currentPrice", parsePriceInput(e.target.value))}
              />
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-previous-price">
              Previous Price (optional)
              <input
                id="vr-previous-price"
                inputMode="decimal"
                placeholder="Optional"
                value={snap.commercial.previousPrice ?? ""}
                onChange={(e) => videoRequirementsEngine.setCommercialField("previousPrice", parsePriceInput(e.target.value))}
              />
            </label>
          </div>
        </div>
        {snap.discount.valid && (
          <div className="vr-discount">
            Was: {formatPrice(snap.commercial.previousPrice, snap.commercial.currency)} ·{" "}
            Now: {formatPrice(snap.commercial.currentPrice, snap.commercial.currency)} ·{" "}
            <strong>{snap.discount.label}</strong>
          </div>
        )}
        {snap.commercial.previousPrice != null && snap.commercial.currentPrice != null
          && snap.commercial.previousPrice <= snap.commercial.currentPrice && (
          <p className="vr-hint">Previous price must be higher than current price to create a discount.</p>
        )}
      </section>

      {/* STEP 2A — Brand & Contact */}
      <section className="vr-section">
        <h2>Brand &amp; Contact</h2>
        <div className="vr-grid-2">
          <div className="vr-field">
            <label htmlFor="vr-brand-name">
              Brand / Website Name
              <input
                id="vr-brand-name"
                value={snap.commercial.brandName}
                onChange={(e) => videoRequirementsEngine.setCommercialField("brandName", e.target.value)}
                placeholder="BYOSE MARKET"
              />
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-website">
              Website URL
              <input
                id="vr-website"
                value={snap.commercial.website}
                onChange={(e) => videoRequirementsEngine.setCommercialField("website", e.target.value)}
                placeholder="https://example.com"
              />
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-contact">
              Contact / Phone
              <input
                id="vr-contact"
                value={snap.commercial.contact}
                onChange={(e) => videoRequirementsEngine.setCommercialField("contact", e.target.value)}
                placeholder="+250 780 000 000"
              />
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-cta">
              Call to Action
              <select
                id="vr-cta"
                value={snap.cta}
                onChange={(e) => videoRequirementsEngine.setCta(e.target.value)}
              >
                <option value="">None</option>
                {CTA_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="vr-field">
            <label htmlFor="vr-language">
              Video Language
              <select
                id="vr-language"
                value={snap.language}
                onChange={(e) => videoRequirementsEngine.setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="vr-logo-block">
          <h3>Brand Logo</h3>
          <div className="vr-logo-row">
            <div className={`vr-logo-preview ${snap.brandLogo.url ? "has-image" : ""}`}>
              {snap.brandLogo.url ? (
                <img src={snap.brandLogo.url} alt="Brand logo preview" />
              ) : (
                <span>No logo</span>
              )}
            </div>
            <div className="vr-logo-actions">
              <label className="vr-logo-upload">
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void videoRequirementsEngine.uploadBrandLogo(file).catch((err) => {
                      notify("error", "Logo upload failed", err instanceof Error ? err.message : "Upload failed");
                    });
                  }}
                />
                {snap.brandLogo.assetId ? "Replace Logo" : "Upload Logo"}
              </label>
              {snap.brandLogo.assetId || snap.brandLogo.url ? (
                <button
                  type="button"
                  onClick={() => {
                    void videoRequirementsEngine.removeBrandLogo().catch((err) => {
                      notify("error", "Remove logo failed", err instanceof Error ? err.message : "Remove failed");
                    });
                  }}
                >
                  Remove Logo
                </button>
              ) : null}
              {snap.brandLogo.status === "uploading" && <span className="vr-hint">Uploading…</span>}
              {snap.brandLogo.status === "ready" && <span className="vr-hint">Logo ready</span>}
              {snap.brandLogo.status === "error" && (
                <span className="vr-hint" style={{ color: "#c45" }}>{snap.brandLogo.error ?? "Logo upload failed"}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section C — Platform */}
      <section className="vr-section">
        <h2>Video Destination</h2>
        <div className="vr-platform-grid">
          {PLATFORM_OPTIONS.map((id) => {
            const p = platformPreview(id);
            return (
              <button
                key={id}
                type="button"
                className={`vr-platform-card ${snap.platformId === id ? "is-selected" : ""}`}
                onClick={() => videoRequirementsEngine.setPlatform(id)}
              >
                <b>{p.label}</b>
                <small>
                  {p.orientation}<br />
                  {p.aspectRatio}<br />
                  {p.width} × {p.height}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section D — Duration */}
      <section className="vr-section">
        <h2>Video Length</h2>
        <div className="vr-duration-row">
          {(["15s", "30s", "45s", "60s", "custom"] as DurationOption[]).map((d) => (
            <button
              key={d}
              type="button"
              className={`vr-chip ${snap.duration === d ? "is-selected" : ""}`}
              onClick={() => videoRequirementsEngine.setDuration(d, snap.customDurationSeconds)}
            >
              {d === "custom" ? "Custom" : d.replace("s", " sec")}
            </button>
          ))}
        </div>
        {snap.duration === "custom" && (
          <div className="vr-field" style={{ marginTop: 12, maxWidth: 160 }}>
            <label htmlFor="vr-custom-duration">
              Seconds (5–120)
              <input
                id="vr-custom-duration"
                type="number"
                min={5}
                max={120}
                value={snap.customDurationSeconds ?? ""}
                onChange={(e) => videoRequirementsEngine.setDuration(
                  "custom",
                  Number.parseInt(e.target.value, 10) || null,
                )}
              />
            </label>
          </div>
        )}
      </section>

      {/* Section E — Objective */}
      <section className="vr-section">
        <h2>Campaign Objective</h2>
        <div className="vr-duration-row">
          {OBJECTIVES.map((o) => (
            <button
              key={o}
              type="button"
              className={`vr-chip ${snap.objective === o ? "is-selected" : ""}`}
              onClick={() => videoRequirementsEngine.setObjective(o as CampaignObjectiveOption)}
            >
              {o}
            </button>
          ))}
        </div>
      </section>

      {/* Intelligence summary */}
      {snap.intelligence && (
        <section className="vr-section vr-intel">
          <h2>Product Intelligence</h2>
          <ul>
            {(snap.intelligence.lines ?? []).map((line) => (
              <li key={line} className="is-ok">✓ {line}</li>
            ))}
            {(snap.intelligence.viewsMissing ?? []).map((v) => (
              <li key={v}>○ {v} not detected</li>
            ))}
          </ul>
        </section>
      )}

      {/* Selling points */}
      <section className="vr-section">
        <h2>Selling Points (optional)</h2>
        <div className="vr-selling-list">
          {snap.sellingPoints.map((sp) => (
            <div key={sp.id} className="vr-selling-item">
              <div>
                {sp.text}
                <small>
                  {sp.source === "USER_CONFIRMED" ? "Confirmed" : `AI inference · ${Math.round(sp.confidence * 100)}% confidence`}
                </small>
              </div>
              <div>
                {sp.status !== "confirmed" && (
                  <button type="button" onClick={() => videoRequirementsEngine.confirmSellingPoint(sp.id)}>Confirm</button>
                )}
                <button type="button" onClick={() => videoRequirementsEngine.removeSellingPoint(sp.id)} aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="vr-grid-2" style={{ marginTop: 12 }}>
          <input
            value={newPoint}
            onChange={(e) => setNewPoint(e.target.value)}
            placeholder="Add a selling point"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                videoRequirementsEngine.addSellingPoint(newPoint);
                setNewPoint("");
              }
            }}
          />
          <button
            type="button"
            className="vr-chip"
            onClick={() => { videoRequirementsEngine.addSellingPoint(newPoint); setNewPoint(""); }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </section>

      {/* Readiness */}
      <section className="vr-section vr-readiness">
        <h2>Readiness</h2>
        <ul>
          <li>{snap.product?.imageCount ? "✓" : "○"} Product images ({snap.product?.imageCount ?? 0})</li>
          <li>{snap.commercial.productName.trim() ? "✓" : "○"} Product name</li>
          <li>{snap.platformId ? "✓" : "○"} Platform selected</li>
          <li>{snap.objective ? "✓" : "○"} Campaign objective</li>
          <li>{snap.language ? "✓" : "○"} Language</li>
        </ul>
        <strong>{(snap.readiness?.statusLabel ?? "NOT READY").replace(/_/g, " ")}</strong>
      </section>

      <footer className="vr-footer">
        <button type="button" className="vr-back" onClick={() => switchWorkspace("new-project")}>
          ← Back to Step 1
        </button>
        <span className="vr-save" data-state={snap.saveState}>
          {snap.saveState === "saving" ? "Saving…" : snap.saveState === "error" ? "Unable to save" : "Saved"}
        </span>
        <button
          type="button"
          className="vr-continue"
          disabled={!snap.canContinue || busy}
          onClick={() => void onContinue()}
        >
          {busy ? <Loader2 size={16} className="vr-spin" /> : <ChevronRight size={16} />}
          Continue to Step 3 →
        </button>
      </footer>
    </div>
  );
}
