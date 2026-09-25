import { useState } from "react";
import { Download, Loader2, Pencil, RefreshCw, Save } from "lucide-react";
import { productSetupEngine } from "../../../product-setup/product-setup-engine";
import type { ProductSetupSnapshot } from "../../../product-setup/types";
import type { PmvWorkflowState } from "../../../pmv-workflow/usePmvWorkflow";
import { durationLabel, formatLabel, isVideoDelivered, workflowErrorMessage, type PmvViewInput } from "./view-model";

function downloadName(productName: string): string {
  const slug = productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "product-video"}.mp4`;
}

export function PmvResultStep({
  mode,
  snap,
  view,
  flow,
  onEdit,
  onRegenerated,
  onSaved,
}: {
  mode: "preview" | "final";
  snap: ProductSetupSnapshot;
  view: PmvViewInput;
  flow: PmvWorkflowState;
  onEdit: () => void;
  onRegenerated: () => void;
  onSaved: (ok: boolean) => void;
}) {
  const [working, setWorking] = useState<"regenerate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { workflow } = flow;
  const delivered = isVideoDelivered(view);
  const active = workflow?.status === "QUEUED" || workflow?.status === "RUNNING";
  const outdated = snap.produceStatus === "STALE" || snap.deliveryStatus === "STALE";
  const canDownload = Boolean(snap.finalOutputUrl)
    && (delivered || snap.produceStatus === "QA_PASSED")
    && !outdated;
  const format = formatLabel(snap.finalWidth, snap.finalHeight, snap.videoSettings.aspectRatio);
  const aspect = format === "1:1" ? "1 / 1" : format === "4:5" ? "4 / 5" : format === "16:9" ? "16 / 9" : "9 / 16";
  const ratio = format === "1:1" ? 1 : format === "4:5" ? 4 / 5 : format === "16:9" ? 16 / 9 : 9 / 16;

  const regenerate = async () => {
    setWorking("regenerate");
    setError(null);
    try {
      if (snap.canGenerateCreativePlan) await productSetupEngine.generateCreativePlan(true);
      const next = await flow.act("start");
      if (next) onRegenerated();
      else setError("Video generation is temporarily unavailable.");
    } catch {
      setError("Your video could not be regenerated. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const save = async () => {
    setWorking("save");
    try {
      await productSetupEngine.saveDraft();
      onSaved(true);
    } catch {
      onSaved(false);
    } finally {
      setWorking(null);
    }
  };

  const note = outdated
    ? "Your latest changes are not in this video yet. Create it again to update it."
    : active
      ? "We are still finishing this video."
      : !delivered
        ? workflowErrorMessage(workflow) ?? "Quality checks are not finished for this video yet."
        : null;

  return (
    <section className="pmv-step" aria-labelledby="pmv-result-title" data-pmv-result={mode}>
      <div className="pmv-step__head">
        <h2 id="pmv-result-title">{mode === "final" ? "Your video is ready" : "Preview"}</h2>
      </div>

      {snap.finalOutputUrl ? (
        <div className="pmv-player" style={{ ["--pmv-aspect" as string]: aspect, ["--pmv-ratio" as string]: ratio }}>
          <video
            key={snap.finalOutputUrl}
            controls
            playsInline
            preload="metadata"
            src={snap.finalOutputUrl}
            aria-label={`${snap.essentials.productName || "Product"} video`}
            data-pmv-video="true"
          />
        </div>
      ) : (
        <p className="pmv-note">Your video will appear here once it has been created.</p>
      )}

      <div className="pmv-result-meta">
        <strong>{snap.essentials.productName || snap.projectName || "Product video"}</strong>
        <span className="pmv-muted">
          {durationLabel(snap.finalDurationMs, snap.videoSettings.durationSeconds)} · {format}
        </span>
      </div>

      {note ? <p className="pmv-note" role="status">{note}</p> : null}
      {error ? <p className="pmv-alert" role="alert">{error}</p> : null}

      <div className="pmv-actions pmv-actions--start">
        <button type="button" className="cp-button-secondary" onClick={onEdit}>
          <Pencil size={14} aria-hidden /> Edit
        </button>
        <button type="button" className="cp-button-secondary" disabled={active || working !== null} onClick={() => void regenerate()}>
          {working === "regenerate" ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
          Regenerate
        </button>
        {canDownload ? (
          <a className="cp-button pmv-primary" href={snap.finalOutputUrl ?? undefined} download={downloadName(snap.essentials.productName)} data-pmv-download="true">
            <Download size={14} aria-hidden /> Download
          </a>
        ) : null}
        <button type="button" className="cp-button-secondary" disabled={working !== null} onClick={() => void save()}>
          {working === "save" ? <Loader2 size={14} className="pmv-spin" aria-hidden /> : <Save size={14} aria-hidden />}
          Save project
        </button>
      </div>
    </section>
  );
}
