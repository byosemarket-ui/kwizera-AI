import { useRef, useState } from "react";
import { ArrowRight, ChevronDown, Upload } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import { parsePriceInput } from "../../../product-setup/discount";
import { PmvPhotoGrid } from "./PmvPhotoGrid";
import { CTA_SUGGESTIONS, CURRENCY_OPTIONS, validateProduct } from "./view-model";

export function PmvProductStep({
  snap,
  busy,
  savedCount,
  uploadingCount,
  onAdd,
  onAddFolder,
  onFiles,
  onContinue,
  onError,
}: {
  snap: ProductSetupSnapshot;
  busy: boolean;
  savedCount: number;
  uploadingCount: number;
  onAdd: () => void;
  onAddFolder: () => void;
  onFiles: (files: FileList | File[]) => void;
  onContinue: () => void;
  onError: (message: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const e = snap.essentials;
  const o = snap.optional;
  const b = snap.brandContact;
  const validation = validateProduct({ productName: e.productName, savedPhotoCount: savedCount, uploadingPhotoCount: uploadingCount });

  const setProductName = (value: string) => {
    const previous = e.productName;
    productSetupEngine.setEssentialField("productName", value);
    if (value.trim() && (!snap.projectName.trim() || snap.projectName === previous)) {
      productSetupEngine.setProjectNameLocal(value);
    }
  };

  return (
    <section className="pmv-step" aria-labelledby="pmv-product-title">
      <div className="pmv-step__head">
        <h2 id="pmv-product-title">Product</h2>
        {savedCount + uploadingCount > 0 ? (
          <span className="pmv-muted">
            {savedCount} photo{savedCount === 1 ? "" : "s"}{uploadingCount > 0 ? ` · ${uploadingCount} uploading` : ""}
          </span>
        ) : null}
      </div>

      <div className="pmv-form">
        <label className="pmv-field is-wide">
          <span>Product name</span>
          <input
            value={e.productName}
            onChange={(ev) => setProductName(ev.target.value)}
            placeholder="Red Leather Sneakers"
            aria-required="true"
            aria-invalid={attempted && !e.productName.trim()}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="pmv-field-group" role="group" aria-labelledby="pmv-photos-label">
        <span id="pmv-photos-label" className="pmv-field-label">Product photos</span>
        <PmvPhotoGrid
          cards={snap.imageCards}
          heroAssetId={snap.heroAssetId}
          productName={e.productName}
          busy={busy}
          onAdd={onAdd}
          onAddFolder={onAddFolder}
          onDropFiles={onFiles}
          onError={onError}
        />
      </div>

      <div className="pmv-form">
        <label className="pmv-field">
          <span>Price <em>optional</em></span>
          <div className="pmv-price">
            <input
              inputMode="decimal"
              value={e.currentPrice ?? ""}
              onChange={(ev) => productSetupEngine.setEssentialField("currentPrice", parsePriceInput(ev.target.value))}
              placeholder="40,000"
              aria-label="Price"
            />
            <select
              value={e.currency}
              onChange={(ev) => productSetupEngine.setEssentialField("currency", ev.target.value)}
              aria-label="Currency"
            >
              {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </label>
        <label className="pmv-field">
          <span>Offer <em>optional</em></span>
          <input
            value={o.offer}
            onChange={(ev) => productSetupEngine.setOptionalField("offer", ev.target.value)}
            placeholder="20% off this week"
          />
        </label>
        <label className="pmv-field is-wide">
          <span>Short description <em>optional</em></span>
          <input
            value={e.shortDescription}
            onChange={(ev) => productSetupEngine.setEssentialField("shortDescription", ev.target.value)}
            placeholder="Handmade red leather sneakers"
          />
        </label>
        <label className="pmv-field">
          <span>Call to action <em>optional</em></span>
          <input
            list="pmv-cta-suggestions"
            value={snap.videoSettings.cta}
            onChange={(ev) => productSetupEngine.setVideoSettingsField("cta", ev.target.value)}
            placeholder="Buy Now"
          />
          <datalist id="pmv-cta-suggestions">
            {CTA_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
      </div>

      <button
        type="button"
        className="pmv-disclosure"
        aria-expanded={moreOpen}
        aria-controls="pmv-more-details"
        onClick={() => setMoreOpen((v) => !v)}
      >
        <ChevronDown size={14} className={moreOpen ? "is-open" : undefined} aria-hidden />
        More details
      </button>

      {moreOpen ? (
        <div id="pmv-more-details" className="pmv-form pmv-form--more">
          <label className="pmv-field">
            <span>Brand name</span>
            <input value={b.brandName} onChange={(ev) => productSetupEngine.setBrandContactField("brandName", ev.target.value)} placeholder="Your brand" />
          </label>
          <label className="pmv-field">
            <span>Previous price</span>
            <input
              inputMode="decimal"
              value={e.previousPrice ?? ""}
              onChange={(ev) => productSetupEngine.setEssentialField("previousPrice", parsePriceInput(ev.target.value))}
              placeholder="50,000"
            />
          </label>
          <label className="pmv-field">
            <span>Category</span>
            <input value={o.productCategory} onChange={(ev) => productSetupEngine.setOptionalField("productCategory", ev.target.value)} placeholder="Footwear" />
          </label>
          <label className="pmv-field">
            <span>Size</span>
            <input value={e.size} onChange={(ev) => productSetupEngine.setEssentialField("size", ev.target.value)} placeholder="40 / 41 / 42" />
          </label>
          <label className="pmv-field">
            <span>Color</span>
            <input value={o.color} onChange={(ev) => productSetupEngine.setOptionalField("color", ev.target.value)} placeholder="Red" />
          </label>
          <label className="pmv-field">
            <span>Material</span>
            <input value={o.material} onChange={(ev) => productSetupEngine.setOptionalField("material", ev.target.value)} placeholder="Leather" />
          </label>
          <label className="pmv-field">
            <span>Website</span>
            <input value={b.websiteUrl} onChange={(ev) => productSetupEngine.setBrandContactField("websiteUrl", ev.target.value)} placeholder="https://example.com" inputMode="url" />
          </label>
          <label className="pmv-field">
            <span>Phone</span>
            <input value={b.phone} onChange={(ev) => productSetupEngine.setBrandContactField("phone", ev.target.value)} placeholder="+250 …" inputMode="tel" />
          </label>
          <label className="pmv-field">
            <span>WhatsApp</span>
            <input value={b.whatsapp} onChange={(ev) => productSetupEngine.setBrandContactField("whatsapp", ev.target.value)} placeholder="+250 …" inputMode="tel" />
          </label>
          <label className="pmv-field is-wide">
            <span>Key features</span>
            <textarea rows={2} value={o.features} onChange={(ev) => productSetupEngine.setOptionalField("features", ev.target.value)} placeholder="One feature per line" />
          </label>
          <div className="pmv-field is-wide">
            <span>Brand logo</span>
            {b.logoUrl ? (
              <div className="pmv-logo">
                <img src={b.logoUrl} alt="Brand logo" />
                <button
                  type="button"
                  className="pmv-link"
                  onClick={() => void productSetupEngine.removeBrandLogo().catch(() => onError("Could not remove the logo. Please try again."))}
                >
                  Remove logo
                </button>
              </div>
            ) : (
              <button type="button" className="pmv-link" onClick={() => logoRef.current?.click()}>
                <Upload size={13} aria-hidden /> Upload logo
              </button>
            )}
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                ev.target.value = "";
                if (!file) return;
                void productSetupEngine.uploadBrandLogo(file).catch(() => onError("Could not upload the logo. Please try again."));
              }}
            />
          </div>
        </div>
      ) : null}

      {attempted && validation ? <p className="pmv-alert" role="alert">{validation}</p> : null}

      <div className="pmv-actions">
        <button
          type="button"
          className="cp-button pmv-primary"
          onClick={() => {
            setAttempted(true);
            if (!validation) onContinue();
          }}
        >
          Continue <ArrowRight size={14} aria-hidden />
        </button>
      </div>
    </section>
  );
}
