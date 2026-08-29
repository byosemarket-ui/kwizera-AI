import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, FolderOpen, ImagePlus, Pause, Play, RefreshCw, Trash2,
  Upload, XCircle, Eye, Replace, Info,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { productIntakeEngine } from "./intake-engine";
import type { IntakeAssetMeta, IntakeSnapshot } from "./types";
import { ACCEPT_ATTR } from "./formats";
import { desktopPicksToFiles } from "./desktop-import";
import "./product-intake.css";

const formatBytes = (value: number) =>
  value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

export function ProductIntakeWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<IntakeSnapshot>(() => productIntakeEngine.snapshot());
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<IntakeAssetMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => {
    productIntakeEngine.setNotify(notify);
    const unsub = productIntakeEngine.subscribe(setSnap);
    void productIntakeEngine.hydrateFromServer();
    return () => {
      unsub();
      productIntakeEngine.setNotify(null);
    };
  }, [notify]);

  const ensureNamed = useCallback(async () => {
    if (!snap.projectName.trim()) {
      notify("warning", "Project name required", "Enter a project name.", "warnings");
      return false;
    }
    setBusy(true);
    try {
      await productIntakeEngine.ensureProject(snap.projectName);
      return true;
    } catch (error) {
      notify("error", "Project could not be created", error instanceof Error ? error.message : "Unable to create project", "errors");
      return false;
    } finally {
      setBusy(false);
    }
  }, [notify, snap.projectName]);

  const onFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const ok = snap.projectId || await ensureNamed();
    if (!ok && !snap.projectId) return;
    if (!productIntakeEngine.snapshot().projectId) {
      try {
        await productIntakeEngine.ensureProject(snap.projectName.trim() || "Untitled Product");
      } catch (error) {
        notify("error", "Project error", error instanceof Error ? error.message : "Create a project first", "errors");
        return;
      }
    }
    const list = [...files];
    console.info("[IMAGE_IMPORT_STARTED]", { count: list.length });
    productIntakeEngine.enqueueFiles(list);
  }, [ensureNamed, notify, snap.projectId, snap.projectName]);

  const pickImagesNative = useCallback(async () => {
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
        notify(
          "warning",
          `${rejected.length} file${rejected.length === 1 ? "" : "s"} skipped`,
          rejected.map((r) => `${r.name}: ${r.reason}`).slice(0, 3).join(" · "),
          "warnings",
        );
      }
      if (files.length) await onFiles(files);
      else if (!rejected.length) notify("info", "No images selected", "Choose one or more product images.", "information");
    } catch (error) {
      notify("error", "File picker failed", error instanceof Error ? error.message : "Unable to open Windows file dialog", "errors");
      fileRef.current?.click();
    } finally {
      setBusy(false);
    }
  }, [notify, onFiles]);

  const pickFolderNative = useCallback(async () => {
    const bridge = window.kwizeraDesktop;
    if (!bridge?.openProductImageFolder) {
      folderRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      console.info("[FOLDER_IMPORT_STARTED]");
      const result = await bridge.openProductImageFolder();
      if (result.canceled) return;
      const { files, rejected } = desktopPicksToFiles(result.files);
      if (rejected.length) {
        notify(
          "warning",
          `${rejected.length} file${rejected.length === 1 ? "" : "s"} skipped`,
          rejected.map((r) => `${r.name}: ${r.reason}`).slice(0, 3).join(" · "),
          "warnings",
        );
      }
      if (files.length) {
        await onFiles(files);
        console.info("[FOLDER_IMPORT_SUCCESS]", { count: files.length, folder: result.folder });
      } else {
        notify("warning", "No supported images", "The selected folder had no JPG/PNG/WEBP/TIFF/BMP files.", "warnings");
      }
    } catch (error) {
      notify("error", "Folder picker failed", error instanceof Error ? error.message : "Unable to open Windows folder dialog", "errors");
      folderRef.current?.click();
    } finally {
      setBusy(false);
    }
  }, [notify, onFiles]);

  const onContinue = async () => {
    setBusy(true);
    try {
      await productIntakeEngine.continueToStep2();
      notify(
        "success",
        "Step 1 complete",
        "Product assets are saved. Opening Intelligent Image Organization.",
        "production-complete",
      );
      switchWorkspace("image-organization");
    } catch (error) {
      notify("error", "Cannot continue", error instanceof Error ? error.message : "Intake incomplete", "errors");
    } finally {
      setBusy(false);
    }
  };

  const speedLabel = snap.progress.bytesPerSecond > 0
    ? `${(snap.progress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
    : "—";

  return (
    <div className="product-intake">
      <header className="intake-hero">
        <div>
          <span className="intake-kicker">Product Creation · Step 1</span>
          <h1>Product Intake & Image Import</h1>
          <p>Create a product project, import source images, validate them locally, and keep every Windows original untouched.</p>
        </div>
        <div className="intake-hero-stats">
          <div><b>{snap.assets.filter((a) => a.processingStatus === "saved").length}</b><span>Assets</span></div>
          <div><b>{snap.progress.percent}%</b><span>Import</span></div>
          <div><b>{snap.assets.filter((a) => a.warnings.length).length}</b><span>Warnings</span></div>
        </div>
      </header>

      <section className="intake-project-row">
        <label>
          <span>Project Name</span>
          <input
            value={snap.projectName}
            onChange={(e) => productIntakeEngine.setProjectNameLocal(e.target.value)}
            onBlur={() => {
              if (snap.projectId && snap.projectName.trim()) {
                void productIntakeEngine.ensureProject(snap.projectName).catch(() => undefined);
              }
            }}
            placeholder="e.g. Ceramic Pour-Over Set"
          />
        </label>
        <button
          type="button"
          className="intake-primary"
          disabled={busy || !snap.projectName.trim()}
          onClick={() => void ensureNamed()}
        >
          {busy && !snap.projectId ? "Creating…" : snap.projectId ? "Update Project" : "Create Project"}
        </button>
        {snap.projectId && (
          <div className="intake-status-chip" data-ok="1" title={snap.projectId}>
            Project ID {snap.projectId.slice(0, 8)}
          </div>
        )}
        <div className="intake-status-chip" data-ok={snap.canContinue ? "1" : "0"}>
          {snap.canContinue ? "Ready to continue" : snap.continueBlockedReason ?? "Not ready"}
        </div>
      </section>

      <section
        className={`intake-dropzone ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus size={36} />
        <h2>Drag & drop product images</h2>
        <p>JPG, JPEG, PNG, WEBP, TIFF, BMP · Multiple files · Folder import supported</p>
        <div className="intake-drop-actions">
          <button type="button" disabled={busy} onClick={() => void pickImagesNative()}><Upload size={16} /> {busy ? "Working…" : "Add Images"}</button>
          <button type="button" disabled={busy} onClick={() => void pickFolderNative()}><FolderOpen size={16} /> Import Folder</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          hidden
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={folderRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          webkitdirectory="true"
          // directory attribute for Chromium folder pickers
          {...({ directory: "" } as object)}
          hidden
          onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }}
        />
      </section>

      {(snap.progress.total > 0 || snap.progress.running) && (
        <section className="intake-progress">
          <div className="intake-progress-head">
            <div>
              <h3>Importing Product Assets</h3>
              <p>{snap.progress.completed} / {snap.progress.total} files · {snap.progress.statusLabel}</p>
            </div>
            <div className="intake-progress-controls">
              {snap.progress.paused
                ? <button type="button" onClick={() => productIntakeEngine.resume()}><Play size={15} /> Resume</button>
                : <button type="button" onClick={() => productIntakeEngine.pause()} disabled={!snap.progress.running}><Pause size={15} /> Pause</button>}
              <button type="button" onClick={() => void productIntakeEngine.retryFailed()}><RefreshCw size={15} /> Retry Failed</button>
              <button type="button" onClick={() => productIntakeEngine.cancel()}><XCircle size={15} /> Cancel</button>
            </div>
          </div>
          <div className="intake-progress-bar" role="progressbar" aria-valuenow={snap.progress.percent} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${snap.progress.percent}%` }} />
          </div>
          <div className="intake-progress-meta">
            <span>Current: {snap.progress.currentFile ?? "—"}</span>
            <span>Speed: {speedLabel}</span>
            <span>Remaining: {snap.progress.remaining} files</span>
            <span>{snap.progress.percent}%</span>
          </div>
        </section>
      )}

      <section className="intake-gallery-wrap">
        <div className="intake-gallery-head">
          <h3>Product Asset Area</h3>
          <p>{snap.assets.length} item{snap.assets.length === 1 ? "" : "s"} · thumbnails update live · originals never modified</p>
        </div>
        {!snap.assets.length ? (
          <div className="intake-empty">
            <FolderOpen size={28} />
            <p>No assets yet. Drop files or import a folder to begin.</p>
          </div>
        ) : (
          <div className="intake-gallery">
            {snap.assets.map((asset) => (
              <article key={asset.assetId} className={`intake-card status-${asset.validationStatus}`}>
                <div className="intake-thumb">
                  {(asset.thumbnailUrl || asset.localPreviewUrl || asset.remoteUrl)
                    ? <img src={asset.thumbnailUrl || asset.localPreviewUrl || asset.remoteUrl} alt="" loading="lazy" />
                    : <ImagePlus size={28} />}
                  <span className={`intake-badge ${asset.validationStatus}`}>{badgeLabel(asset)}</span>
                </div>
                <div className="intake-card-body">
                  <b title={asset.originalFilename}>{asset.originalFilename}</b>
                  <small>
                    {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"} · {formatBytes(asset.fileSize)}
                  </small>
                  <small>{asset.processingStatus} · {asset.validationStatus}</small>
                  {asset.error && <em className="intake-error">{asset.error}</em>}
                  {asset.validationStatus === "duplicate" && !asset.keepDespiteDuplicate && (
                    <div className="intake-dup">
                      <AlertTriangle size={14} />
                      <span>Similar to {asset.duplicateOfName ?? "another asset"}</span>
                      <button type="button" onClick={() => productIntakeEngine.keepDuplicate(asset.assetId)}>Keep Both</button>
                      <button type="button" onClick={() => void productIntakeEngine.removeAsset(asset.assetId)}>Remove</button>
                    </div>
                  )}
                </div>
                <div className="intake-card-actions">
                  <button type="button" title="Preview" onClick={() => setPreview(asset)}><Eye size={14} /></button>
                  <button
                    type="button"
                    title="Replace"
                    onClick={() => { replaceTarget.current = asset.assetId; replaceRef.current?.click(); }}
                  >
                    <Replace size={14} />
                  </button>
                  <button type="button" title="Details" onClick={() => setPreview(asset)}><Info size={14} /></button>
                  <button type="button" title="Remove" onClick={() => void productIntakeEngine.removeAsset(asset.assetId)}><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
        <input
          ref={replaceRef}
          type="file"
          accept={ACCEPT_ATTR}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            const id = replaceTarget.current;
            if (file && id) void productIntakeEngine.replaceAsset(id, file);
            e.target.value = "";
            replaceTarget.current = null;
          }}
        />
      </section>

      <footer className="intake-footer">
        <p>{snap.recommendation}</p>
        <button
          type="button"
          className="intake-continue"
          disabled={!snap.canContinue || busy}
          onClick={() => void onContinue()}
        >
          <CheckCircle2 size={16} /> Continue to Step 2
        </button>
      </footer>

      {preview && (
        <div className="intake-modal" role="dialog" onClick={() => setPreview(null)}>
          <div className="intake-modal-card" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{preview.originalFilename}</h3>
              <button type="button" onClick={() => setPreview(null)}>Close</button>
            </header>
            {(preview.remoteUrl || preview.localPreviewUrl) && (
              <img src={preview.remoteUrl || preview.localPreviewUrl} alt="" />
            )}
            <dl>
              <div><dt>Type</dt><dd>{preview.fileType}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(preview.fileSize)}</dd></div>
              <div><dt>Resolution</dt><dd>{preview.width && preview.height ? `${preview.width}×${preview.height}` : "—"}</dd></div>
              <div><dt>Validation</dt><dd>{preview.validationStatus}</dd></div>
              <div><dt>Processing</dt><dd>{preview.processingStatus}</dd></div>
              <div><dt>Checksum</dt><dd>{preview.checksum || "—"}</dd></div>
              <div><dt>Source</dt><dd>{preview.sourceReference}</dd></div>
            </dl>
            {preview.warnings.map((w) => <p key={w.message} className="intake-warn-line">{w.message}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}

function badgeLabel(asset: IntakeAssetMeta): string {
  if (asset.processingStatus === "failed" || asset.validationStatus === "invalid") return "Error";
  if (asset.validationStatus === "duplicate") return "Duplicate?";
  if (asset.validationStatus === "warning") return "Warning";
  if (asset.processingStatus === "uploading" || asset.processingStatus === "validating") return "Processing";
  if (asset.processingStatus === "saved") return "OK";
  return asset.processingStatus;
}
