import { loadStep5Handoff } from "../marketing-input/marketing-engine";
import type { Step5HandoffPayload } from "../marketing-input/types";
import { ensureProjectOpen, markProjectSettings, startPipeline } from "./api";
import {
  buildProductionRequirements,
  computeReadinessScores,
  deriveReadiness,
  runAllValidations,
} from "./validation-runner";
import type {
  CompletenessScores,
  ProductionInputPackage,
  ReadinessState,
  ValidationArea,
  ValidationAreaProgress,
  ValidationIssue,
  ValidationSnapshot,
} from "./types";
import { AREA_LABELS, PRODUCTION_PACKAGE_KEY, VALIDATION_STORE_KEY } from "./types";

type NotifyFn = (
  tone: "success" | "warning" | "error" | "info",
  title: string,
  detail: string,
  category?: "information" | "warnings" | "errors" | "production-complete" | "updates" | "ai-suggestions",
) => void;

type Listener = (snap: ValidationSnapshot) => void;

const AREA_ORDER: ValidationArea[] = [
  "assets",
  "image-set",
  "product-information",
  "marketing",
  "consistency",
  "pricing",
  "cta",
  "language",
  "production-requirements",
];

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStore(): Record<string, ProductionInputPackage> {
  try {
    return JSON.parse(localStorage.getItem(VALIDATION_STORE_KEY) ?? "{}") as Record<string, ProductionInputPackage>;
  } catch {
    return {};
  }
}

function savePackage(pkg: ProductionInputPackage): void {
  const map = loadStore();
  map[pkg.projectId] = pkg;
  localStorage.setItem(VALIDATION_STORE_KEY, JSON.stringify(map));
  localStorage.setItem(PRODUCTION_PACKAGE_KEY, JSON.stringify(pkg));
}

function defaultProgress(): ValidationAreaProgress[] {
  return AREA_ORDER.map((area) => ({
    area,
    label: AREA_LABELS[area],
    percent: 0,
    status: "pending",
    ok: false,
  }));
}

export class ProductValidationEngine {
  private handoff: Step5HandoffPayload | null = null;
  private pkg: ProductionInputPackage | null = null;
  private issues: ValidationIssue[] = [];
  private scores: CompletenessScores | null = null;
  private readiness: ReadinessState | null = null;
  private readinessReason = "";
  private progress = defaultProgress();
  private overallProgress = 0;
  private currentLabel = "Idle";
  private running = false;
  private reviewOpen = false;
  private confirmPending = false;
  private handoffReady = false;
  private productInputCenterComplete = false;
  private recommendation = "Complete Step 4 Marketing Input, then run Live Validation.";
  private listeners = new Set<Listener>();
  private notify: NotifyFn | null = null;
  private emitEvents: ((type: string, payload: Record<string, unknown>) => void) | null = null;

  setNotify(fn: NotifyFn | null): void {
    this.notify = fn;
  }

  setEventEmitter(fn: ((type: string, payload: Record<string, unknown>) => void) | null): void {
    this.emitEvents = fn;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): ValidationSnapshot {
    return {
      version: 1,
      running: this.running,
      progress: this.progress.map((p) => ({ ...p })),
      currentLabel: this.currentLabel,
      overallProgress: this.overallProgress,
      package: this.pkg,
      issues: this.issues,
      scores: this.scores,
      readiness: this.readiness,
      readinessReason: this.readinessReason,
      reviewOpen: this.reviewOpen,
      confirmPending: this.confirmPending,
      handoffReady: this.handoffReady,
      productInputCenterComplete: this.productInputCenterComplete,
      recommendation: this.recommendation,
      updatedAt: new Date().toISOString(),
    };
  }

  buildAiMeContext() {
    const snap = this.snapshot();
    if (!this.handoff && !this.pkg) {
      return {
        explanation: "Live Product Validation has no active package yet.",
        readiness: null,
        canContinue: false,
        recommendation: this.recommendation,
      };
    }
    const critical = this.issues.filter((i) => i.severity === "critical" && !i.acknowledged).length;
    const warnings = this.issues.filter((i) => i.severity === "warning" && !i.acknowledged).length;
    const explanation = [
      this.pkg
        ? `Validation for “${this.pkg.projectName}” — overall readiness ${this.scores?.overall ?? 0}%.`
        : "Validation package not built yet.",
      `State: ${this.readiness ?? "pending"}. ${this.readinessReason}`,
      critical ? `${critical} critical issue(s) block production.` : "No critical blockers.",
      warnings
        ? `${warnings} warning(s) — recommended but may be non-blocking.`
        : "No unacknowledged warnings.",
      "AI Me reports only computed validation results and never invents findings.",
      this.recommendation,
    ].join(" ");

    return {
      projectId: this.pkg?.projectId ?? this.handoff?.projectId ?? null,
      readiness: this.readiness,
      overall: this.scores?.overall ?? 0,
      critical,
      warnings,
      canContinue: this.readiness === "READY" || this.readiness === "READY_WITH_WARNINGS",
      productInputCenterComplete: this.productInputCenterComplete,
      recommendation: this.recommendation,
      explanation,
    };
  }

  async hydrateFromHandoff(payload?: Step5HandoffPayload | null): Promise<boolean> {
    const handoff = payload ?? loadStep5Handoff();
    if (!handoff || handoff.step !== "step-5-live-product-validation") {
      const stored = Object.values(loadStore())[0];
      if (stored) {
        this.pkg = stored;
        this.issues = stored.issues;
        this.scores = stored.scores;
        this.readiness = stored.readiness;
        this.readinessReason = stored.readinessReason;
        this.handoff = {
          version: 1,
          step: "step-5-live-product-validation",
          projectId: stored.projectId,
          projectName: stored.projectName,
          productProfile: stored.productProfile,
          marketingBrief: stored.marketingBrief,
          preparedAt: stored.createdAt,
        };
        this.productInputCenterComplete = stored.status === "confirmed" || stored.status === "handed-off";
        this.recommendation = "Restored local validation / production package.";
        this.emitAction("ProductReviewOpened", { restored: true });
        this.emit();
        return true;
      }
      this.recommendation = "No Step 4 handoff found. Complete Marketing Input first.";
      this.emit();
      return false;
    }

    if (handoff.productProfile.projectId !== handoff.projectId
      || handoff.marketingBrief.projectId !== handoff.projectId) {
      throw new Error("Cross-project data blocked: validation handoff mismatch.");
    }

    try {
      const project = await ensureProjectOpen(handoff.projectId);
      if (project.id !== handoff.projectId) throw new Error("Cross-project data blocked.");
    } catch (error) {
      this.notify?.("error", "Project unavailable", error instanceof Error ? error.message : "Open failed", "errors");
      return false;
    }

    this.handoff = handoff;
    const stored = loadStore()[handoff.projectId];
    if (stored && stored.status !== "draft") {
      this.pkg = stored;
      this.issues = stored.issues;
      this.scores = stored.scores;
      this.readiness = stored.readiness;
      this.readinessReason = stored.readinessReason;
      this.productInputCenterComplete = stored.status === "confirmed" || stored.status === "handed-off";
    }

    this.recommendation = "Ready to run Live Validation.";
    this.emitAction("ProductValidationStarted", { projectId: handoff.projectId, phase: "hydrated" });
    this.emitBus("product-analysis.started", { projectId: handoff.projectId, step: 5 });
    this.emit();
    return true;
  }

  async runValidation(): Promise<void> {
    if (!this.handoff) {
      if (!(await this.hydrateFromHandoff())) throw new Error("No Step 4 handoff");
    }
    if (!this.handoff || this.running) return;

    this.running = true;
    this.progress = defaultProgress();
    this.overallProgress = 0;
    this.currentLabel = "Starting validation…";
    this.emitAction("ProductValidationStarted", { projectId: this.handoff.projectId });
    this.emit();

    const profile = this.handoff.productProfile;
    const brief = this.handoff.marketingBrief;
    const collected: ValidationIssue[] = [];
    const allIssues = runAllValidations(profile, brief);

    const steps: Array<{ area: ValidationArea; run: () => ValidationIssue[] }> = [
      { area: "assets", run: () => allIssues.filter((i) => i.area === "assets") },
      { area: "image-set", run: () => allIssues.filter((i) => i.area === "image-set") },
      { area: "product-information", run: () => allIssues.filter((i) => i.area === "product-information") },
      { area: "marketing", run: () => allIssues.filter((i) => i.area === "marketing") },
      { area: "consistency", run: () => allIssues.filter((i) => i.area === "consistency") },
      { area: "pricing", run: () => allIssues.filter((i) => i.area === "pricing") },
      { area: "cta", run: () => allIssues.filter((i) => i.area === "cta") },
      { area: "language", run: () => allIssues.filter((i) => i.area === "language") },
      {
        area: "production-requirements",
        run: () => {
          const req = buildProductionRequirements(profile, brief);
          const issues: ValidationIssue[] = [];
          if (!req.productImages) {
            issues.push({
              id: "prod-req-images",
              area: "production-requirements",
              severity: "critical",
              code: "REQ_IMAGES",
              title: "Production requires product images",
              checked: "Production requirements",
              found: "No images",
              why: "Pipeline needs product imagery.",
              howToFix: "Import and organize images.",
              quickFix: "edit-images",
              acknowledged: false,
            });
          }
          return issues;
        },
      },
    ];

    // Preserve acknowledgements from prior run
    const prevAck = new Set(this.issues.filter((i) => i.acknowledged).map((i) => i.id));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.progress = this.progress.map((p) =>
        p.area === step.area ? { ...p, status: "running", percent: 40 } : p,
      );
      this.currentLabel = `Checking ${AREA_LABELS[step.area]}…`;
      this.overallProgress = Math.round(((i + 0.4) / steps.length) * 100);
      this.emitAction("ProductValidationProgress", {
        area: step.area,
        percent: this.overallProgress,
        label: this.currentLabel,
      });
      this.emitBus("production.progress", { percent: this.overallProgress, label: this.currentLabel });
      this.emit();

      await delay(40);
      const found = step.run().map((iss) => ({
        ...iss,
        acknowledged: prevAck.has(iss.id) || iss.acknowledged,
      }));
      collected.push(...found);

      const hasCritical = found.some((f) => f.severity === "critical" && !f.acknowledged);
      this.progress = this.progress.map((p) =>
        p.area === step.area
          ? { ...p, status: "done", percent: 100, ok: !hasCritical }
          : p,
      );
      this.overallProgress = Math.round(((i + 1) / steps.length) * 100);
      this.emit();
    }

    // Deduplicate by id (runAllValidations called multiple times per area filter)
    const byId = new Map<string, ValidationIssue>();
    for (const iss of collected) byId.set(iss.id, iss);
    this.issues = [...byId.values()];

    for (const iss of this.issues) {
      if (iss.severity === "critical" && !iss.acknowledged) {
        this.emitAction("ValidationCriticalIssueDetected", { id: iss.id, title: iss.title });
      } else if (iss.severity === "warning" && !iss.acknowledged) {
        this.emitAction("ValidationWarningDetected", { id: iss.id, title: iss.title });
      }
    }

    this.scores = computeReadinessScores(profile, brief, this.issues);
    const derived = deriveReadiness(this.issues, this.scores);
    this.readiness = derived.readiness;
    this.readinessReason = derived.reason;

    const versionBump = this.pkg?.status === "confirmed" || this.pkg?.status === "handed-off"
      ? bumpVersion(this.pkg.version)
      : (this.pkg?.version ?? "1.0");

    this.pkg = {
      version: versionBump,
      packageId: this.pkg?.packageId && this.pkg.status === "draft" ? this.pkg.packageId : uid("pip"),
      status: "draft",
      projectId: this.handoff.projectId,
      productId: this.handoff.productProfile.productId,
      projectName: this.handoff.projectName,
      productImageSet: profile.productImageSet,
      productProfile: profile,
      marketingBrief: brief,
      issues: this.issues,
      scores: this.scores,
      readiness: this.readiness,
      readinessReason: this.readinessReason,
      productionRequirements: buildProductionRequirements(profile, brief),
      userConfirmations: {
        confirmedAt: null,
        confirmedBy: "user",
        acknowledgedIssueIds: this.issues.filter((i) => i.acknowledged).map((i) => i.id),
      },
      aiRecommendations: brief.recommendations
        .filter((r) => r.status === "pending" || r.status === "accepted")
        .map((r) => ({
          field: r.field,
          value: Array.isArray(r.value) ? r.value.join(", ") : String(r.value),
          note: r.reason,
        })),
      pipelineJobId: null,
      handoffError: null,
      createdAt: this.pkg?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmedAt: null,
    };

    savePackage(this.pkg);
    this.running = false;
    this.currentLabel = "Validation complete";
    this.overallProgress = 100;
    this.reviewOpen = true;
    this.recommendation = this.readiness === "NOT_READY"
      ? "Fix critical issues before production."
      : this.readiness === "READY_WITH_WARNINGS"
        ? "Ready with warnings — review final summary, then confirm."
        : "Ready — review and confirm to start production.";

    this.emitAction("ProductValidationCompleted", {
      readiness: this.readiness,
      overall: this.scores.overall,
    });
    this.emitAction("ProductReadinessChanged", { readiness: this.readiness });
    this.emitBus("product-analysis.completed", {
      projectId: this.pkg.projectId,
      readiness: this.readiness,
      overall: this.scores.overall,
    });
    this.markDirty();
    this.emit();
  }

  acknowledgeIssue(id: string): void {
    this.issues = this.issues.map((i) => (i.id === id ? { ...i, acknowledged: true } : i));
    if (this.pkg && this.handoff) {
      this.scores = computeReadinessScores(this.handoff.productProfile, this.handoff.marketingBrief, this.issues);
      const derived = deriveReadiness(this.issues, this.scores);
      this.readiness = derived.readiness;
      this.readinessReason = derived.reason;
      this.pkg = {
        ...this.pkg,
        issues: this.issues,
        scores: this.scores,
        readiness: this.readiness,
        readinessReason: this.readinessReason,
        userConfirmations: {
          ...this.pkg.userConfirmations,
          acknowledgedIssueIds: this.issues.filter((i) => i.acknowledged).map((i) => i.id),
        },
        updatedAt: new Date().toISOString(),
      };
      savePackage(this.pkg);
      this.emitAction("ProductReadinessChanged", { readiness: this.readiness });
      this.markDirty();
    }
    this.emit();
  }

  openConfirm(): void {
    if (!this.pkg || !this.readiness) return;
    if (this.readiness === "NOT_READY") {
      this.notify?.("error", "Not ready", this.readinessReason, "errors");
      return;
    }
    this.confirmPending = true;
    this.emitAction("ProductReviewOpened", { readiness: this.readiness });
    this.emit();
  }

  cancelConfirm(): void {
    this.confirmPending = false;
    this.emit();
  }

  async confirmAndStartProduction(): Promise<ProductionInputPackage> {
    if (!this.pkg || !this.handoff) throw new Error("No validation package");
    if (this.readiness === "NOT_READY") throw new Error(this.readinessReason || "Not ready");

    this.confirmPending = false;
    this.emitAction("ProductReviewConfirmed", { projectId: this.pkg.projectId });
    this.emitAction("ProductionHandoffStarted", { projectId: this.pkg.projectId });
    this.emitBus("workflow.started", { projectId: this.pkg.projectId, from: "product-validation" });

    const confirmed: ProductionInputPackage = {
      ...this.pkg,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      userConfirmations: {
        confirmedAt: new Date().toISOString(),
        confirmedBy: "user",
        acknowledgedIssueIds: this.issues.filter((i) => i.acknowledged).map((i) => i.id),
      },
      updatedAt: new Date().toISOString(),
    };
    this.pkg = confirmed;
    savePackage(confirmed);
    this.emitAction("ProductionInputPackageCreated", {
      packageId: confirmed.packageId,
      version: confirmed.version,
    });

    try {
      await markProjectSettings(confirmed.projectId, {
        productInputCenter: {
          complete: true,
          completedAt: new Date().toISOString(),
          productionPackageId: confirmed.packageId,
          productionPackageVersion: confirmed.version,
          readiness: confirmed.readiness,
        },
        productionInputPackage: {
          packageId: confirmed.packageId,
          version: confirmed.version,
          status: confirmed.status,
          readiness: confirmed.readiness,
          scores: confirmed.scores,
        },
      });
    } catch {
      /* local package already saved — continue handoff */
    }

    const pipeline = await startPipeline(confirmed.projectId);
    if (pipeline.error && !pipeline.jobId) {
      this.pkg = {
        ...confirmed,
        status: "handoff-failed",
        handoffError: pipeline.error,
        updatedAt: new Date().toISOString(),
      };
      savePackage(this.pkg);
      this.notify?.("warning", "Handoff saved locally", `${pipeline.error} — retry without redoing Steps 1–4.`, "warnings");
      this.emitAction("ProductionHandoffCompleted", { ok: false, error: pipeline.error });
      this.markDirty();
      this.emit();
      throw new Error(pipeline.error);
    }

    this.pkg = {
      ...confirmed,
      status: "handed-off",
      pipelineJobId: pipeline.jobId,
      handoffError: null,
      updatedAt: new Date().toISOString(),
    };
    savePackage(this.pkg);
    this.handoffReady = true;
    this.productInputCenterComplete = true;
    this.recommendation = "Product Input Center complete. Production Input Package handed to pipeline.";
    this.emitAction("ProductionHandoffCompleted", {
      ok: true,
      packageId: this.pkg.packageId,
      pipelineJobId: pipeline.jobId,
    });
    this.emitBus("workflow.synced", {
      projectId: this.pkg.projectId,
      productInputCenterComplete: true,
    });
    this.emitBus("notify.success", {
      title: "Production handoff complete",
      detail: `Package ${this.pkg.version} ready for pipeline.`,
    });
    this.markDirty();
    this.emit();
    return this.pkg;
  }

  async retryHandoff(): Promise<ProductionInputPackage> {
    if (!this.pkg) throw new Error("No package to retry");
    this.pkg = { ...this.pkg, status: "confirmed", handoffError: null };
    savePackage(this.pkg);
    return this.confirmAndStartProduction();
  }

  private emitAction(action: string, payload: Record<string, unknown>): void {
    this.emitEvents?.("state.shared", { action, module: "product-validation", ...payload });
    this.emitEvents?.("product.updated", { action, module: "product-validation", ...payload });
  }

  private emitBus(type: string, payload: Record<string, unknown>): void {
    this.emitEvents?.(type, payload);
  }

  private markDirty(): void {
    void import("../shell/workspace-state/workspace-state-engine").then(({ workspaceStateEngine }) => {
      workspaceStateEngine.autoSave.markDirty();
    });
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) listener(snap);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bumpVersion(version: string): string {
  const m = version.match(/^(\d+)\.(\d+)$/);
  if (!m) return "1.1";
  return `${m[1]}.${Number(m[2]) + 1}`;
}

export const productValidationEngine = new ProductValidationEngine();

export function loadProductionPackage(): ProductionInputPackage | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PRODUCTION_PACKAGE_KEY) ?? "null") as ProductionInputPackage | null;
    return raw?.packageId ? raw : null;
  } catch {
    return null;
  }
}
