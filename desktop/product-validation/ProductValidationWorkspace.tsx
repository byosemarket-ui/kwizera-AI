import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Play, RefreshCw, ShieldCheck, XCircle,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { productValidationEngine } from "./validation-engine";
import type { QuickFixAction, ValidationIssue, ValidationSnapshot } from "./types";
import { resolvedCta, resolvedLanguage, resolvedPlatforms } from "../marketing-input/types";
import "./product-validation.css";

export function ProductValidationWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<ValidationSnapshot>(() => productValidationEngine.snapshot());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    productValidationEngine.setNotify(notify);
    productValidationEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started",
        "product-analysis.completed",
        "production.progress",
        "product.updated",
        "state.shared",
        "workflow.started",
        "workflow.synced",
        "notify.success",
        "notify.warning",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product-analysis.started",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace", "creative"],
        payload,
        priority: type.includes("Critical") || type.includes("Handoff") ? "high" : "normal",
      });
    });
    const unsub = productValidationEngine.subscribe(setSnap);
    void productValidationEngine.hydrateFromHandoff().then((ok) => {
      if (ok && !productValidationEngine.snapshot().scores) {
        void productValidationEngine.runValidation().catch(() => null);
      }
    });
    return () => {
      unsub();
      productValidationEngine.setNotify(null);
      productValidationEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async () => {
    setBusy(true);
    try {
      await productValidationEngine.runValidation();
      workspaceStateEngine.autoSave.markDirty();
    } catch (error) {
      notify("error", "Validation failed", error instanceof Error ? error.message : "Unable to validate", "errors");
    } finally {
      setBusy(false);
    }
  };

  const quickFix = (action: QuickFixAction | undefined, issue?: ValidationIssue) => {
    if (!action) return;
    if (action === "edit-product") switchWorkspace("product-information");
    else if (action === "edit-images") switchWorkspace("image-organization");
    else if (action === "edit-marketing") switchWorkspace("marketing");
    else if (action === "rerun-validation") void run();
    else if (action === "keep-current" && issue) {
      productValidationEngine.acknowledgeIssue(issue.id);
      notify("info", "Kept current value", "User-provided value remains authoritative.", "information");
    } else if (action === "use-ai-recommendation") {
      switchWorkspace("marketing");
      notify("info", "Review CTA", "Open Marketing to change CTA — AI does not overwrite automatically.", "ai-suggestions");
    } else if (action === "review-conflict" && issue) {
      setExpanded((e) => ({ ...e, [issue.id]: true }));
    } else if (action === "add-missing") switchWorkspace("product-information");
  };

  const onConfirm = async () => {
    setBusy(true);
    try {
      const pkg = await productValidationEngine.confirmAndStartProduction();
      await workspaceStateEngine.autoSave.flush("manual").catch(() => null);
      notify(
        "success",
        "Phase 2 complete",
        `Production Input Package ${pkg.version} confirmed. Opening AI Visual Product Analysis.`,
        "production-complete",
      );
      switchWorkspace("visual-analysis");
    } catch (error) {
      notify("error", "Handoff issue", error instanceof Error ? error.message : "Failed", "errors");
    } finally {
      setBusy(false);
    }
  };

  const pkg = snap.package;
  const profile = pkg?.productProfile ?? null;
  const brief = pkg?.marketingBrief ?? null;

  if (!snap.package && !snap.running && snap.recommendation.includes("No Step 4")) {
    return (
      <div className="product-validation">
        <header className="pv-hero">
          <div>
            <span className="pv-kicker">Product Creation · Step 5</span>
            <h1>Live Product Validation</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="pv-panel">
          <button type="button" onClick={() => switchWorkspace("marketing")}>Open Marketing Input</button>
        </section>
      </div>
    );
  }

  const critical = snap.issues.filter((i) => i.severity === "critical" && !i.acknowledged);
  const warnings = snap.issues.filter((i) => i.severity === "warning" && !i.acknowledged);
  const infos = snap.issues.filter((i) => i.severity === "info");

  return (
    <div className="product-validation">
      <header className="pv-hero">
        <div>
          <span className="pv-kicker">Product Creation · Step 5</span>
          <h1>Live Validation & Production Readiness</h1>
          <p>
            Validate Product Assets, Image Set, Product Profile, and Marketing Brief before production.
            User data stays authoritative — AI never silently overwrites facts.
          </p>
        </div>
        <div className="pv-hero-stats">
          <div><b>{snap.scores?.overall ?? "—"}%</b><span>Overall</span></div>
          <div><b>{snap.readiness?.replace(/_/g, " ") ?? "—"}</b><span>Status</span></div>
          <div><b>{critical.length}</b><span>Critical</span></div>
          <div><b>{warnings.length}</b><span>Warnings</span></div>
        </div>
      </header>

      <section className="pv-toolbar">
        <div>
          <strong>{profile?.fields.name || pkg?.projectName || "Project"}</strong>
          <span>{snap.recommendation}</span>
        </div>
        <div className="pv-toolbar-actions">
          <button type="button" onClick={() => void run()} disabled={busy || snap.running}>
            <Play size={15} /> {snap.scores ? "Run Validation Again" : "Run Validation"}
          </button>
          <button type="button" onClick={() => switchWorkspace("product-information")}>Edit Product</button>
          <button type="button" onClick={() => switchWorkspace("image-organization")}>Edit Images</button>
          <button type="button" onClick={() => switchWorkspace("marketing")}>Edit Marketing</button>
          {(snap.readiness === "READY" || snap.readiness === "READY_WITH_WARNINGS" || snap.readiness === "MANUAL_REVIEW_REQUIRED") && (
            <button
              type="button"
              className="pv-primary"
              disabled={busy || critical.length > 0}
              onClick={() => productValidationEngine.openConfirm()}
            >
              Continue to Visual Analysis
            </button>
          )}
          {pkg?.status === "handoff-failed" && (
            <button type="button" className="pv-primary" disabled={busy} onClick={() => void productValidationEngine.retryHandoff().then(() => switchWorkspace("visual-analysis")).catch((e) => notify("error", "Retry failed", e instanceof Error ? e.message : "Error", "errors"))}>
              <RefreshCw size={14} /> Retry Handoff
            </button>
          )}
        </div>
      </section>

      {(snap.running || snap.overallProgress > 0) && (
        <section className="pv-progress">
          <div className="pv-progress-head">
            <h3><ShieldCheck size={16} /> Validating Product</h3>
            <p>{snap.currentLabel} · {snap.overallProgress}%</p>
          </div>
          <div className="pv-progress-bar"><i style={{ width: `${snap.overallProgress}%` }} /></div>
          <div className="pv-progress-areas">
            {snap.progress.map((p) => (
              <div key={p.area} className={`pv-area ${p.status} ${p.ok ? "ok" : ""}`}>
                <span>{p.label}</span>
                <div className="pv-mini"><i style={{ width: `${p.percent}%` }} /></div>
                <b>{p.percent}%</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {snap.scores && (
        <section className="pv-scores">
          <Score label="Product Assets" value={snap.scores.productAssets} />
          <Score label="Image Set" value={snap.scores.imageSet} />
          <Score label="Product Information" value={snap.scores.productInformation} />
          <Score label="Marketing" value={snap.scores.marketing} />
          <Score label="Validation" value={snap.scores.validation} />
          <Score label="Overall" value={snap.scores.overall} highlight />
        </section>
      )}

      {snap.scores && snap.scores.blockersTo100.length > 0 && (
        <p className="pv-warn">Prevents 100%: {snap.scores.blockersTo100.join(" · ")}</p>
      )}

      <div className="pv-layout">
        <section className="pv-panel">
          <h3>Validation Results</h3>
          {!snap.issues.length && <p className="pv-muted">Run validation to see results.</p>}
          {[...critical, ...warnings, ...infos].map((iss) => (
            <ResultRow
              key={iss.id}
              issue={iss}
              open={Boolean(expanded[iss.id])}
              onToggle={() => setExpanded((e) => ({ ...e, [iss.id]: !e[iss.id] }))}
              onFix={(a) => quickFix(a, iss)}
              onAck={() => productValidationEngine.acknowledgeIssue(iss.id)}
            />
          ))}
          {snap.scores && !critical.length && !warnings.length && (
            <p className="pv-ok"><CheckCircle2 size={14} /> All checked areas passed without open warnings.</p>
          )}
        </section>

        <section className="pv-panel pv-review">
          <h3>Final Product Production Review</h3>
          {profile && brief && snap.scores ? (
            <>
              <div className="pv-summary">
                <div><span>Product</span><b>{profile.fields.name}</b></div>
                <div><span>Category</span><b>{profile.fields.category}</b></div>
                <div><span>Price</span><b>{profile.fields.price != null ? `${profile.fields.price.toLocaleString()} ${profile.fields.currency}` : "—"}</b></div>
                <div><span>Images</span><b>{profile.productImageSet?.images.length ?? 0}</b></div>
                <div><span>Image Coverage</span><b>{profile.productImageSet?.coverageScore ?? 0}%</b></div>
                <div><span>Product Information</span><b>{snap.scores.productInformation}%</b></div>
                <div><span>Marketing</span><b>{snap.scores.marketing}%</b></div>
                <div><span>Overall Readiness</span><b>{snap.scores.overall}%</b></div>
                <div className="span-2"><span>Status</span><b>{snap.readiness?.replace(/_/g, " ")}</b></div>
              </div>
              <p className="pv-muted">{snap.readinessReason}</p>
              {warnings.length > 0 && (
                <div className="pv-warn-list">
                  <strong>Warnings</strong>
                  <ol>{warnings.map((w, idx) => <li key={w.id}>{idx + 1}. {w.title}</li>)}</ol>
                </div>
              )}
              <div className="pv-summary">
                <div><span>Objective</span><b>{brief.fields.objective || "—"}</b></div>
                <div><span>Platform</span><b>{resolvedPlatforms(brief.fields).join(", ") || "—"}</b></div>
                <div><span>Language</span><b>{resolvedLanguage(brief.fields)}</b></div>
                <div><span>Voice</span><b>{brief.fields.narrationEnabled ? (brief.fields.voiceLanguage || resolvedLanguage(brief.fields)) : "Off"}</b></div>
                <div><span>CTA</span><b>{resolvedCta(brief.fields) || "—"}</b></div>
                <div><span>Package</span><b>v{pkg?.version} · {pkg?.status}</b></div>
              </div>
            </>
          ) : (
            <p className="pv-muted">Run validation to build the final review.</p>
          )}
        </section>
      </div>

      {snap.confirmPending && (
        <div className="pv-modal-backdrop">
          <div className="pv-modal">
            <h2>Ready for AI Visual Analysis?</h2>
            <p>The following information will be used:</p>
            <ul>
              <li>Product Images</li>
              <li>Product Profile</li>
              <li>Marketing Brief</li>
              <li>Production Input Package</li>
            </ul>
            <p className="pv-muted">Explicit confirmation required. Visual analysis will use the existing Product Image Set — no re-upload.</p>
            <div className="pv-modal-actions">
              <button type="button" onClick={() => productValidationEngine.cancelConfirm()}>Back</button>
              <button type="button" className="pv-primary" disabled={busy} onClick={() => void onConfirm()}>
                Confirm & Open Visual Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Score({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`pv-score ${highlight ? "highlight" : ""}`}>
      <b>{value}%</b>
      <span>{label}</span>
    </div>
  );
}

function ResultRow({
  issue,
  open,
  onToggle,
  onFix,
  onAck,
}: {
  issue: ValidationIssue;
  open: boolean;
  onToggle: () => void;
  onFix: (a: QuickFixAction | undefined) => void;
  onAck: () => void;
}) {
  const icon = issue.severity === "critical"
    ? <XCircle size={16} className="crit" />
    : issue.severity === "warning"
      ? <AlertTriangle size={16} className="warn" />
      : <CheckCircle2 size={16} className="ok" />;

  return (
    <div className={`pv-result ${issue.severity} ${issue.acknowledged ? "acked" : ""}`}>
      <button type="button" className="pv-result-head" onClick={onToggle}>
        {icon}
        <span>{issue.severity === "critical" ? "✕" : issue.severity === "warning" ? "⚠" : "✓"} {issue.title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="pv-result-body">
          <p><strong>Checked:</strong> {issue.checked}</p>
          <p><strong>Found:</strong> {issue.found}</p>
          <p><strong>Why:</strong> {issue.why}</p>
          <p><strong>Fix:</strong> {issue.howToFix}</p>
          {issue.userValue && <p><strong>User value:</strong> {issue.userValue}</p>}
          {issue.aiValue && <p><strong>AI estimate:</strong> {issue.aiValue}</p>}
          <div className="pv-fix-actions">
            {issue.quickFix && (
              <button type="button" onClick={() => onFix(issue.quickFix)}>
                {labelForFix(issue.quickFix)}
              </button>
            )}
            {!issue.acknowledged && issue.severity !== "critical" && (
              <button type="button" onClick={onAck}>Keep Current / Acknowledge</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function labelForFix(action: QuickFixAction): string {
  switch (action) {
    case "edit-product": return "Edit Product";
    case "edit-images": return "Review Product Images";
    case "edit-marketing": return "Edit Marketing";
    case "review-conflict": return "Review Conflict";
    case "keep-current": return "Keep Current Value";
    case "use-ai-recommendation": return "Use AI Recommendation";
    case "add-missing": return "Add Missing Information";
    case "rerun-validation": return "Run Validation Again";
    default: return "Fix";
  }
}
