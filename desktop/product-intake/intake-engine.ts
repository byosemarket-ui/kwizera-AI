import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import {
  createProjectApi, fetchWorkspaceApi, loadProjectMeta, openProjectApi, removeImageApi,
  saveHandoff, saveProjectMeta, updateProjectProductName, uploadImageApi, verifyProjectExists,
} from "./api";
import { fileToBase64, isSha256Hex } from "./hash";
import { INTAKE_UPLOAD_CONCURRENCY, IntakeImportQueue } from "./queue";
import type { IntakeAssetMeta, IntakeHandoffPayload, IntakeSnapshot } from "./types";
import { validateLocalFile } from "./validation";

type Listener = (snap: IntakeSnapshot) => void;
type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

export class ProductIntakeEngine {
  private projectId: string | null = null;
  private projectName = "";
  private assets: IntakeAssetMeta[] = [];
  private queue = new IntakeImportQueue();
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private pumping = false;
  private fileMap = new Map<string, File>();
  private bytesWindow: Array<{ at: number; bytes: number }> = [];
  private handoffReady = false;
  private currentFile: string | null = null;
  private _transitioning = false;

  setNotify(notify: NotifyFn | null): void {
    this.notify = notify;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): IntakeSnapshot {
    const progress = this.queue.progress(this.speed(), this.currentFile);
    const savedOk = this.assets.filter((a) => {
      if (a.processingStatus !== "saved") return false;
      if (a.validationStatus === "invalid") return false;
      if (a.validationStatus === "duplicate" && !a.keepDespiteDuplicate) return false;
      return true;
    }).length;
    const canContinue = Boolean(this.projectId && this.projectName.trim() && savedOk >= 1 && !progress.running);
    let continueBlockedReason: string | null = null;
    if (!this.projectId || !this.projectName.trim()) continueBlockedReason = "Create or name a project first.";
    else if (progress.running) continueBlockedReason = "Wait for the import queue to finish.";
    else if (savedOk < 1) continueBlockedReason = "Import at least one valid product image.";

    const warnCount = this.assets.filter((a) => a.warnings.length).length;
    const recommendation = !this.projectId
      ? "Create a product project, then import images."
      : progress.running
        ? `Importing ${progress.completed}/${progress.total}…`
        : canContinue
          ? `${savedOk} image${savedOk === 1 ? "" : "s"} ready. Continue to Step 2 when you are satisfied.`
          : continueBlockedReason ?? "Add product images to continue.";

    return {
      version: 1,
      projectId: this.projectId,
      projectName: this.projectName,
      assets: [...this.assets],
      queue: this.queue.list(),
      progress,
      canContinue,
      continueBlockedReason,
      handoffReady: this.handoffReady,
      recommendation: warnCount && canContinue
        ? `${recommendation} ${warnCount} warning${warnCount === 1 ? "" : "s"} remain (not blocking).`
        : recommendation,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    const saved = snap.assets.filter((a) => a.processingStatus === "saved");
    const warnings = snap.assets.filter((a) => a.warnings.length);
    const errors = snap.assets.filter((a) => a.validationStatus === "invalid" || a.processingStatus === "failed");
    const duplicates = snap.assets.filter((a) => a.validationStatus === "duplicate");
    const explanation = [
      snap.projectId
        ? `Product intake project “${snap.projectName}” has ${saved.length} saved asset${saved.length === 1 ? "" : "s"}.`
        : "No product intake project is active yet.",
      snap.progress.running
        ? `Import in progress: ${snap.progress.completed}/${snap.progress.total} (${snap.progress.percent}%). Current: ${snap.progress.currentFile ?? "—"}.`
        : "Import queue is idle.",
      warnings.length ? `${warnings.length} asset(s) have warnings (duplicates or quality). Nothing was deleted.` : "No quality warnings.",
      errors.length ? `${errors.length} asset(s) failed validation or upload.` : "No critical import errors in the gallery.",
      duplicates.length ? `${duplicates.length} possible duplicate(s) — user chooses Keep Both or Remove.` : "",
      snap.recommendation,
    ].filter(Boolean).join(" ");

    return {
      projectId: snap.projectId,
      projectName: snap.projectName,
      assetCount: saved.length,
      importPercent: snap.progress.percent,
      warningCount: warnings.length,
      errorCount: errors.length,
      canContinue: snap.canContinue,
      recommendation: snap.recommendation,
      explanation,
    };
  }

  async hydrateFromServer(): Promise<void> {
    const payload = await fetchWorkspaceApi();
    const active = payload?.activeProject ?? null;
    if (!active) {
      this.emit();
      return;
    }
    const inFlight = this.assets.filter((a) =>
      a.processingStatus === "queued"
      || a.processingStatus === "uploading"
      || a.processingStatus === "failed"
      || a.assetId.startsWith("temp-")
      || a.assetId.startsWith("local-fail-"),
    );
    const queueBusy = this.pumping || this.queue.list().some((i) =>
      i.status === "pending" || i.status === "validating" || i.status === "importing",
    );

    this.projectId = active.id;
    this.projectName = active.name;
    const stored = loadProjectMeta(active.id);
    const byId = new Map(stored.map((a) => [a.assetId, a]));
    const fromServer = active.productImages.map((image) => {
      const prev = byId.get(image.id);
      return {
        assetId: image.id,
        projectId: active.id,
        originalFilename: image.sourceFileName ?? image.fileName,
        fileType: image.mimeType,
        width: image.width ?? prev?.width ?? null,
        height: image.height ?? prev?.height ?? null,
        fileSize: image.sizeBytes,
        importDate: image.uploadedAt,
        sourceReference: `creative-workspace/projects/${active.id}/images`,
        validationStatus: prev?.validationStatus ?? "valid",
        duplicateStatus: prev?.duplicateStatus ?? "none",
        duplicateOf: prev?.duplicateOf,
        duplicateOfName: prev?.duplicateOfName,
        processingStatus: "saved" as const,
        checksum: image.checksumSha256 ?? prev?.checksum ?? "",
        remoteUrl: image.url,
        thumbnailUrl: image.url,
        warnings: prev?.warnings ?? [],
        keepDespiteDuplicate: prev?.keepDespiteDuplicate ?? true,
      } satisfies IntakeAssetMeta;
    });

    const serverIds = new Set(fromServer.map((a) => a.assetId));
    const preservedInFlight = inFlight.filter((a) => !serverIds.has(a.assetId));
    this.assets = queueBusy ? [...preservedInFlight, ...fromServer] : fromServer;
    if (queueBusy && preservedInFlight.length) {
      // Keep local previews while imports finish; server list may lag behind.
      const mergedIds = new Set(this.assets.map((a) => a.assetId));
      for (const local of inFlight) {
        if (!mergedIds.has(local.assetId)) this.assets.unshift(local);
      }
    }
    this.persistMeta();
    this.emit();
  }

  async ensureProject(name: string): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Enter a project name.");
    if (trimmed.length > 120) throw new Error("Project name is too long (max 120 characters).");
    if (/[<>:"/\\|?*\u0000]/.test(trimmed)) {
      throw new Error("Project name contains invalid characters.");
    }
    if (this.projectId && this.projectName === trimmed) return this.projectId;
    if (this.projectId) {
      this.projectName = trimmed;
      await updateProjectProductName(this.projectId, trimmed);
      this.emit();
      return this.projectId;
    }
    console.info("[PRODUCT_CREATE_STARTED]", { name: trimmed });
    const project = await createProjectApi(trimmed);
    const verified = await verifyProjectExists(project.id);
    if (!verified) {
      console.error("[PRODUCT_CREATE_FAILED]", { id: project.id, reason: "read-back verification failed" });
      throw new Error("Project was created but could not be read back from storage. Check local storage and try again.");
    }
    this.projectId = verified.id;
    this.projectName = verified.name;
    await updateProjectProductName(verified.id, trimmed).catch(() => verified);
    console.info("[PRODUCT_CREATE_SUCCESS]", { id: verified.id, name: verified.name });
    void workspaceIntegrationEngine.emit({
      type: "project.created",
      source: "workspace",
      payload: { name: verified.name, id: verified.id },
      priority: "normal",
    });
    this.notify?.("success", "Project created", `“${verified.name}” is ready for product images.`, "production-complete");
    this.persistMeta();
    this.markDirty();
    this.emit();
    return verified.id;
  }

  async openExisting(projectId: string): Promise<void> {
    const project = await openProjectApi(projectId);
    this.projectId = project.id;
    this.projectName = project.name;
    await this.hydrateFromServer();
    void workspaceIntegrationEngine.emit({
      type: "project.loaded",
      source: "workspace",
      payload: { name: project.name, id: project.id },
      priority: "normal",
    });
  }

  setProjectNameLocal(name: string): void {
    this.projectName = name;
    this.emit();
  }

  /**
   * Stage files immediately (local preview cards) then upload in the background.
   * Does not wait for server confirmation before showing previews.
   */
  enqueueFiles(files: FileList | File[]): void {
    void this.stageAndEnqueue(files);
  }

  async stageAndEnqueue(files: FileList | File[]): Promise<void> {
    const list = [...files];
    if (!list.length) return;
    for (const file of list) {
      const validation = await validateLocalFile(file, this.assets);
      if (!validation.ok || validation.critical) {
        const failedMeta: IntakeAssetMeta = {
          assetId: `local-fail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          projectId: this.projectId ?? "pending",
          originalFilename: file.name,
          fileType: validation.mimeType || file.type,
          width: validation.width,
          height: validation.height,
          fileSize: file.size,
          importDate: new Date().toISOString(),
          sourceReference: "local-rejected",
          validationStatus: "invalid",
          duplicateStatus: "none",
          processingStatus: "failed",
          checksum: validation.checksum,
          warnings: validation.warnings,
          error: validation.error,
          localPreviewUrl: validation.localPreviewUrl,
        };
        this.assets = [failedMeta, ...this.assets];
        this.notify?.("error", "Validation failed", validation.error ?? file.name, "errors");
        continue;
      }

      if (validation.status === "duplicate" && validation.duplicateOf) {
        if (validation.localPreviewUrl) URL.revokeObjectURL(validation.localPreviewUrl);
        this.notify?.(
          "warning",
          "Duplicate skipped",
          `${file.name} is already in this project as ${validation.duplicateOf.originalFilename}.`,
          "warnings",
        );
        continue;
      }

      const item = this.queue.enqueue(file.name, file.size, validation.mimeType || file.type || "application/octet-stream");
      this.fileMap.set(item.id, file);
      const tempId = `temp-${item.id}`;
      const pendingMeta: IntakeAssetMeta = {
        assetId: tempId,
        projectId: this.projectId ?? "pending",
        originalFilename: file.name,
        fileType: validation.mimeType,
        width: validation.width,
        height: validation.height,
        fileSize: file.size,
        importDate: new Date().toISOString(),
        sourceReference: "local-import",
        validationStatus: validation.status,
        duplicateStatus: "none",
        processingStatus: "queued",
        checksum: validation.checksum,
        warnings: validation.warnings,
        localPreviewUrl: validation.localPreviewUrl,
        thumbnailUrl: validation.localPreviewUrl,
        keepDespiteDuplicate: false,
      };
      this.assets = [pendingMeta, ...this.assets];
    }
    this.emit();
    void this.pump();
  }

  /** Resolve a display name and ensure project exists before importing. */
  async prepareImport(projectNameHint?: string): Promise<string> {
    const hint = (projectNameHint ?? this.projectName).trim();
    const name = hint || `Product ${new Date().toLocaleDateString()}`;
    const { waitForWorkspaceReady } = await import("./api");
    await waitForWorkspaceReady();
    return this.ensureProject(name);
  }

  pause(): void {
    this.queue.pause();
    this.emit();
  }

  resume(): void {
    this.queue.resume();
    this.queue.clearFlags();
    this.emit();
    void this.pump();
  }

  cancel(): void {
    this.queue.cancelAll();
    this.currentFile = null;
    this.emit();
  }

  async retryFailed(): Promise<void> {
    for (const item of this.queue.list()) {
      if (item.status === "failed" && this.fileMap.has(item.id)) {
        this.queue.update(item.id, { status: "pending", error: undefined, progress: 0 });
      }
    }
    this.queue.clearFlags();
    this.emit();
    void this.pump();
  }

  keepDuplicate(assetId: string): void {
    this.assets = this.assets.map((a) =>
      a.assetId === assetId
        ? { ...a, keepDespiteDuplicate: true, duplicateStatus: "possible" as const, validationStatus: a.warnings.some((w) => w.code !== "duplicate") ? "warning" as const : "valid" as const }
        : a,
    );
    this.persistMeta();
    this.markDirty();
    this.emit();
  }

  async removeAsset(assetId: string): Promise<void> {
    const asset = this.assets.find((a) => a.assetId === assetId);
    if (!asset || !this.projectId) return;
    if (asset.localPreviewUrl) URL.revokeObjectURL(asset.localPreviewUrl);
    if (asset.processingStatus === "saved") {
      await removeImageApi(this.projectId, assetId);
    }
    this.assets = this.assets.filter((a) => a.assetId !== assetId);
    this.persistMeta();
    this.markDirty();
    this.notify?.("info", "Asset removed", `${asset.originalFilename} removed from the project copy. Your Windows original was not modified.`, "updates");
    this.emit();
  }

  async replaceAsset(assetId: string, file: File): Promise<void> {
    await this.removeAsset(assetId);
    this.enqueueFiles([file]);
  }

  async continueToStep2(): Promise<IntakeHandoffPayload> {
    const snap = this.snapshot();
    if (!snap.canContinue || !snap.projectId) {
      throw new Error(snap.continueBlockedReason ?? "Intake is not ready");
    }
    if (this.handoffReady && this._transitioning) {
      throw new Error("Step transition already in progress.");
    }
    this._transitioning = true;
    try {
      const assets = snap.assets.filter((a) => a.processingStatus === "saved" && a.validationStatus !== "invalid");
      const handoff: IntakeHandoffPayload = {
        version: 1,
        step: "step-2-image-organization",
        projectId: snap.projectId,
        projectName: snap.projectName,
        assets,
        preparedAt: new Date().toISOString(),
      };
      saveHandoff(handoff);
      const { persistWorkflowStep } = await import("../product-creation/workflow");
      await persistWorkflowStep(snap.projectId, 2, 1);
      this.handoffReady = true;
      this.persistMeta();
      this.markDirty();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      console.info("[STEP_1_COMPLETED]", { projectId: snap.projectId, assetCount: assets.length });
      void workspaceIntegrationEngine.emit({
        type: "product.updated",
        source: "workspace",
        targets: ["ai-me", "notifications"],
        payload: {
          action: "intake.ready-for-step-2",
          projectId: handoff.projectId,
          assetCount: assets.length,
        },
        priority: "normal",
        notify: {
          tone: "success",
          title: "Ready for Step 2",
          detail: `${assets.length} product asset(s) prepared for Intelligent Image Organization.`,
          category: "production-complete",
        },
      });
      this.emit();
      return handoff;
    } finally {
      this._transitioning = false;
    }
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const workers = Array.from({ length: INTAKE_UPLOAD_CONCURRENCY }, async () => {
        while (!this.queue.isPaused()) {
          const next = this.queue.claimNext();
          if (!next) break;
          const file = this.fileMap.get(next.id);
          if (!file) {
            this.queue.update(next.id, { status: "failed", error: "File handle lost", finishedAt: new Date().toISOString() });
            continue;
          }
          this.currentFile = file.name;
          await this.processOne(next.id, file);
        }
      });
      await Promise.all(workers);
    } finally {
      this.pumping = false;
      this.currentFile = null;
      this.emit();
    }
  }

  private async processOne(queueId: string, file: File): Promise<void> {
    this.currentFile = file.name;
    this.queue.update(queueId, { status: "importing", progress: 20 });
    const tempId = `temp-${queueId}`;
    this.assets = this.assets.map((a) =>
      a.assetId === tempId ? { ...a, processingStatus: "uploading", projectId: this.projectId ?? a.projectId } : a,
    );
    this.emit();

    if (!this.projectId) {
      try {
        await this.ensureProject(this.projectName.trim() || "Untitled Product");
        this.assets = this.assets.map((a) =>
          a.projectId === "pending" || a.assetId === tempId ? { ...a, projectId: this.projectId! } : a,
        );
      } catch (error) {
        this.queue.update(queueId, {
          status: "failed",
          error: error instanceof Error ? error.message : "No project",
          finishedAt: new Date().toISOString(),
        });
        this.assets = this.assets.map((a) =>
          a.assetId === tempId
            ? { ...a, processingStatus: "failed", error: error instanceof Error ? error.message : "No project" }
            : a,
        );
        this.notify?.("error", "Import failed", String(error), "errors");
        this.emit();
        return;
      }
    }

    const staged = this.assets.find((a) => a.assetId === tempId);
    const mimeType = staged?.fileType || file.type || "application/octet-stream";
    const checksum = staged?.checksum ?? "";

    // Re-check duplicates against assets that finished while this was queued.
    const dup = this.assets.find((a) =>
      a.assetId !== tempId
      && a.processingStatus === "saved"
      && a.checksum
      && checksum
      && a.checksum === checksum,
    );
    if (dup) {
      const localUrl = staged?.localPreviewUrl;
      if (localUrl) URL.revokeObjectURL(localUrl);
      this.assets = this.assets.filter((a) => a.assetId !== tempId);
      this.queue.update(queueId, {
        status: "completed",
        progress: 100,
        assetId: dup.assetId,
        finishedAt: new Date().toISOString(),
      });
      this.fileMap.delete(queueId);
      this.notify?.("warning", "Duplicate skipped", `${file.name} already saved as ${dup.originalFilename}.`, "warnings");
      this.emit();
      return;
    }

    try {
      const dataBase64 = await fileToBase64(file);
      this.noteBytes(file.size);
      this.queue.update(queueId, { progress: 70 });
      this.emit();

      const { image, reused } = await uploadImageApi(this.projectId!, {
        fileName: file.name,
        mimeType,
        dataBase64,
        width: staged?.width ?? undefined,
        height: staged?.height ?? undefined,
        checksumSha256: isSha256Hex(checksum) ? checksum : undefined,
      });

      const prior = this.assets.find((a) => a.assetId === tempId);
      if (prior?.localPreviewUrl) URL.revokeObjectURL(prior.localPreviewUrl);

      this.assets = this.assets.map((a) =>
        a.assetId === tempId
          ? {
            ...a,
            assetId: image.id,
            projectId: this.projectId!,
            processingStatus: "saved",
            remoteUrl: image.url,
            thumbnailUrl: image.url,
            localPreviewUrl: undefined,
            checksum: image.checksumSha256 ?? a.checksum,
            sourceReference: `creative-workspace/projects/${this.projectId}/images`,
            keepDespiteDuplicate: true,
            validationStatus: a.validationStatus === "warning" ? "warning" : "valid",
          }
          : a,
      );
      // If server reused an existing id already in the gallery, drop the duplicate card.
      const sameIdCount = this.assets.filter((a) => a.assetId === image.id).length;
      if (sameIdCount > 1) {
        let seen = false;
        this.assets = this.assets.filter((a) => {
          if (a.assetId !== image.id) return true;
          if (seen) return false;
          seen = true;
          return true;
        });
      }

      this.queue.update(queueId, {
        status: "completed",
        progress: 100,
        assetId: image.id,
        finishedAt: new Date().toISOString(),
      });
      this.fileMap.delete(queueId);
      this.persistMeta();
      this.markDirty();

      void workspaceIntegrationEngine.emit({
        type: "images.imported",
        source: "workspace",
        targets: ["ai-me", "notifications", "product-analysis"],
        payload: {
          images: [{ id: image.id, name: image.fileName }],
          projectId: this.projectId,
          count: 1,
          reused: Boolean(reused),
        },
        priority: "normal",
      });

      this.notify?.(
        "success",
        reused ? "Image already saved" : "Import successful",
        reused
          ? `${file.name} matched an existing project asset (no duplicate created).`
          : `${file.name} saved to the project (original Windows file untouched).`,
        "production-complete",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      this.assets = this.assets.map((a) =>
        a.assetId === tempId
          ? { ...a, processingStatus: "failed", error: message }
          : a,
      );
      this.queue.update(queueId, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
        progress: 100,
      });
      this.notify?.("error", "Import failure", message, "errors");
      this.persistMeta();
    }
    this.emit();
  }

  private persistMeta(): void {
    if (!this.projectId) return;
    saveProjectMeta(this.projectId, this.assets.filter((a) => a.processingStatus === "saved" || a.validationStatus === "duplicate"));
  }

  private markDirty(): void {
    workspaceStateEngine.autoSave.markDirty();
  }

  private noteBytes(bytes: number): void {
    const at = Date.now();
    this.bytesWindow.push({ at, bytes });
    this.bytesWindow = this.bytesWindow.filter((row) => at - row.at < 3000);
  }

  private speed(): number {
    if (this.bytesWindow.length < 2) return 0;
    const first = this.bytesWindow[0]!;
    const last = this.bytesWindow[this.bytesWindow.length - 1]!;
    const ms = Math.max(1, last.at - first.at);
    const total = this.bytesWindow.reduce((sum, row) => sum + row.bytes, 0);
    return total / (ms / 1000);
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const productIntakeEngine = new ProductIntakeEngine();
