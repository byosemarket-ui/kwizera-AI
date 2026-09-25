import { useState, type DragEvent } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ImageCardModel } from "../../../product-setup/types";

export function PmvPhotoGrid({
  cards,
  heroAssetId,
  productName,
  busy,
  onAdd,
  onAddFolder,
  onDropFiles,
  onError,
}: {
  cards: ImageCardModel[];
  heroAssetId: string | null;
  productName: string;
  busy: boolean;
  onAdd: () => void;
  onAddFolder: () => void;
  onDropFiles: (files: FileList) => void;
  onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const name = productName.trim() || "Product";

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => { e.preventDefault(); setDragging(false); onDropFiles(e.dataTransfer.files); },
  };

  if (!cards.length) {
    return (
      <div className={`pmv-photos__empty${dragging ? " is-dragging" : ""}`} {...dropHandlers}>
        <ImagePlus size={22} strokeWidth={1.6} aria-hidden />
        <div>
          <p className="pmv-photos__empty-title">Add product photos</p>
          <p className="pmv-muted">Clear photos from different angles. JPG, PNG or WEBP.</p>
        </div>
        <div className="pmv-photos__empty-actions">
          <button type="button" className="cp-button" disabled={busy} onClick={onAdd}>
            <Plus size={14} aria-hidden /> Add photos
          </button>
          <button type="button" className="pmv-link" disabled={busy} onClick={onAddFolder}>
            Import folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <ul className={`pmv-photos${dragging ? " is-dragging" : ""}`} aria-label="Product photos" {...dropHandlers}>
      {cards.map((card, index) => {
        const isHero = heroAssetId === card.assetId;
        const label = `${name} photo ${index + 1}`;
        const uploading = card.uploadStatus === "uploading";
        return (
          <li
            key={card.clientKey}
            className={`pmv-photo${isHero ? " is-hero" : ""}${uploading ? " is-uploading" : ""}${card.uploadStatus === "failed" ? " is-failed" : ""}`}
          >
            <div className="pmv-photo__thumb">
              {card.url ? (
                <img
                  src={card.url}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => {
                    if (card.usingLocalPreview && card.remoteUrl) return;
                    if (card.remoteUrl && card.url === card.remoteUrl) productSetupEngine.confirmRemotePreview(card.assetId);
                  }}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (card.remoteUrl && img.src !== card.remoteUrl && !card.usingLocalPreview) {
                      img.src = card.remoteUrl;
                      return;
                    }
                    img.style.visibility = "hidden";
                  }}
                />
              ) : (
                <span className="pmv-photo__missing" aria-label={`${label} unavailable`}><ImagePlus size={18} aria-hidden /></span>
              )}
              {uploading ? <span className="pmv-photo__overlay"><Loader2 size={16} className="pmv-spin" aria-label="Uploading" /></span> : null}
              {isHero ? <span className="pmv-photo__hero">Hero</span> : null}
            </div>
            <div className="pmv-photo__bar">
              <button
                type="button"
                aria-label={`Move ${label} earlier`}
                disabled={index === 0}
                onClick={() => productSetupEngine.moveImage(card.assetId, "up")}
              >
                <ChevronLeft size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={isHero ? `${label} is the hero photo` : `Use ${label} as hero`}
                aria-pressed={isHero}
                className={isHero ? "is-on" : undefined}
                disabled={card.uploadStatus !== "saved" || isHero}
                onClick={() => void productSetupEngine.setHeroImage(card.assetId).catch(() => onError("Could not set the hero photo. Please try again."))}
              >
                <Star size={13} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Move ${label} later`}
                disabled={index >= cards.length - 1}
                onClick={() => productSetupEngine.moveImage(card.assetId, "down")}
              >
                <ChevronRight size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                className="is-danger"
                disabled={uploading}
                onClick={() => void productSetupEngine.removeImage(card.assetId).catch(() => onError("Could not remove the photo. Please try again."))}
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
      <li className="pmv-photo pmv-photo--add">
        <button type="button" disabled={busy} onClick={onAdd} aria-label="Add product photos">
          <Plus size={18} aria-hidden />
          <span>Add</span>
        </button>
      </li>
    </ul>
  );
}
