import { useEffect, useState, type ReactNode } from "react";
import {
  Brain, ChevronDown, ChevronRight, Play, RefreshCw, Save,
} from "lucide-react";
import { useShell } from "../shell/ShellContext";
import { workspaceIntegrationEngine } from "../shell/integration/integration-engine";
import { workspaceStateEngine } from "../shell/workspace-state/workspace-state-engine";
import { deepIntelligenceEngine } from "./deep-intelligence-engine";
import type { DeepIntelligenceSnapshot } from "./types";
import type { CreativePlanSceneDto, ProvenanceStatementDto } from "./live-api";
import { collapseRepeatedProvenance, stripInferredMarker } from "./live-api";
import "./deep-intelligence.css";

const KIND_LABEL: Record<string, string> = {
  "user-provided": "USER FACT",
  "observed-from-image": "IMAGE OBSERVATION",
  inferred: "AI INFERENCE",
  "marketing-recommendation": "MARKETING RECOMMENDATION",
};

export function DeepIntelligenceWorkspace() {
  const { notify, switchWorkspace } = useShell();
  const [snap, setSnap] = useState<DeepIntelligenceSnapshot>(() => deepIntelligenceEngine.snapshot());
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    overview: true,
    visual: true,
    attributes: true,
    customer: true,
    value: true,
    marketing: true,
    angles: true,
    plan: true,
    scenes: true,
  });

  useEffect(() => {
    deepIntelligenceEngine.setNotify(notify);
    deepIntelligenceEngine.setEventEmitter((type, payload) => {
      const allowed = new Set([
        "product-analysis.started",
        "product-analysis.completed",
        "production.progress",
        "product.updated",
        "state.shared",
        "notify.info",
        "notify.warning",
      ]);
      const eventType = allowed.has(type) ? type : "state.shared";
      void workspaceIntegrationEngine.emit({
        type: eventType as "product-analysis.started",
        source: "product-analysis",
        targets: ["ai-me", "notifications", "workspace"],
        payload,
        priority: "normal",
      });
    });
    const unsub = deepIntelligenceEngine.subscribe(setSnap);
    void deepIntelligenceEngine.hydrate();
    return () => {
      unsub();
      deepIntelligenceEngine.setNotify(null);
      deepIntelligenceEngine.setEventEmitter(null);
    };
  }, [notify]);

  const run = async (force = false) => {
    setBusy(true);
    try {
      await deepIntelligenceEngine.run({ force });
      workspaceStateEngine.autoSave.markDirty();
      notify("success", "Product Intelligence complete", "User facts, image observations, inferences, and recommendations remain labeled.", "ai-suggestions");
    } catch (error) {
      notify("error", "Intelligence failed", error instanceof Error ? error.message : "Unable to run", "errors");
    } finally {
      setBusy(false);
    }
  };

  const saveScenes = async (scenes: CreativePlanSceneDto[]) => {
    setBusy(true);
    try {
      await deepIntelligenceEngine.savePlanEdits({ scenes });
      notify("success", "Creative Plan saved", "Scene edits were persisted. The plan was not regenerated.", "updates");
    } catch (error) {
      notify("error", "Save failed", error instanceof Error ? error.message : "Unable to save", "errors");
    } finally {
      setBusy(false);
    }
  };

  const product = snap.product;
  const marketing = snap.marketing;
  const plan = snap.plan;
  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const stateLabel = (snap.analysisState ?? "not-analyzed").replace(/-/g, " ").toUpperCase();

  if (!snap.projectId && !snap.progress.running) {
    return (
      <div className="deep-intelligence">
        <header className="di-hero">
          <div>
            <span className="di-kicker">STEP 7 · Product Intelligence</span>
            <h1>Product Intelligence & Creative Planning</h1>
            <p>{snap.recommendation}</p>
          </div>
        </header>
        <section className="di-panel">
          <button type="button" onClick={() => switchWorkspace("new-project")}>Open Product Intake</button>
        </section>
      </div>
    );
  }

  return (
    <div className="deep-intelligence">
      <header className="di-hero">
        <div>
          <span className="di-kicker">STEP 7 · Product → Marketing → Creative Plan</span>
          <h1>Product Intelligence & Creative Planning</h1>
          <p>
            Real product understanding from the project, product assets, image intelligence, user-provided
            information, Memory, and Knowledge. Inferences are never shown as confirmed facts.
          </p>
        </div>
        <div className="di-hero-stats">
          <div><b>{stateLabel}</b><span>Status</span></div>
          <div><b>{product?.quality.score ?? "—"}</b><span>Score</span></div>
          <div><b>{plan ? `v${plan.version}` : "—"}</b><span>Plan</span></div>
          <div><b>{plan?.scenes.length ?? 0}</b><span>Scenes</span></div>
        </div>
      </header>

      <section className="di-toolbar">
        <div>
          <strong>{product?.productName || snap.projectName || "Product intelligence"}</strong>
          <span>{snap.recommendation}</span>
          {snap.limitation && <span className="di-warn-inline"> · {snap.limitation}</span>}
          {!snap.serviceAvailable && <span className="di-warn-inline"> · Product Intelligence API unavailable</span>}
        </div>
        <div className="di-toolbar-actions">
          <button type="button" onClick={() => void run(false)} disabled={busy || snap.progress.running}>
            <Play size={15} /> {product ? "Refresh Intelligence" : "Run Product Intelligence"}
          </button>
          <button type="button" onClick={() => void run(true)} disabled={busy || snap.progress.running}>
            <RefreshCw size={15} /> New Creative Plan
          </button>
          <button type="button" onClick={() => switchWorkspace("image-organization")}>Image Organization</button>
          <button type="button" onClick={() => switchWorkspace("storyboard")}>Open Creative Planner</button>
        </div>
      </section>

      {(snap.progress.running || snap.progress.percent > 0) && (
        <section className="di-progress">
          <div className="di-progress-head">
            <h3><Brain size={16} /> Product Intelligence</h3>
            <p>{snap.progress.percent}% · {snap.progress.currentLabel}</p>
          </div>
          <div className="di-progress-bar"><i style={{ width: `${snap.progress.percent}%` }} /></div>
        </section>
      )}

      <Section title="Product overview" open={open.overview} onToggle={() => toggle("overview")}>
        {product ? (
          <div className="di-summary">
            <div><span>Product</span><b>{product.productName}</b></div>
            <div><span>Identity</span><b>{product.identifiedAs}</b></div>
            <div><span>Category</span><b>{product.category}</b></div>
            <div><span>Type</span><b>{product.productType}</b></div>
            <div><span>Brand</span><b>{product.brand}</b></div>
            <div><span>Views</span><b>{product.viewCount}</b></div>
            <div><span>Product ID</span><b>{product.productId || product.projectId}</b></div>
            <div><span>Memory</span><b>{product.memoryStatus ?? "n/a"}</b></div>
            <div><span>Knowledge</span><b>{product.knowledgeStatus ?? "n/a"}</b></div>
            {product.knowledgeStatus === "error" && product.knowledgeMessage ? (
              <div><span>Knowledge detail</span><b>{product.knowledgeMessage}</b></div>
            ) : null}
          </div>
        ) : <p className="di-muted">Not analyzed.</p>}
      </Section>

      <Section title="Visual understanding" open={open.visual} onToggle={() => toggle("visual")}>
        <StatementList items={product?.imageObservations ?? []} empty="No image observations yet. Run Image Intelligence from product originals." />
      </Section>

      <Section title="Product attributes" open={open.attributes} onToggle={() => toggle("attributes")}>
        <StatementList items={product?.userFacts ?? []} empty="No user-provided product facts yet." />
        <h4>Inferred attributes</h4>
        <StatementList items={product?.inferences ?? []} empty="No inferences recorded." />
      </Section>

      <Section title="Customer" open={open.customer} onToggle={() => toggle("customer")}>
        {product?.customerIntelligence ? (
          <>
            <p><span className={`di-kind ${product.customerIntelligence.label}`}>{product.customerIntelligence.label.toUpperCase()}</span> {stripInferredMarker(product.customerIntelligence.customerType)}</p>
            <p>Use case: {product.customerIntelligence.useCase}</p>
            <p>Needs: {product.customerIntelligence.needs.join("; ") || "—"}</p>
            <p>Motivations: {product.customerIntelligence.buyingMotivations.join("; ") || "—"}</p>
            <p>Possible objections: {product.customerIntelligence.possibleObjections.join("; ") || "—"}</p>
          </>
        ) : <p className="di-muted">Customer intelligence is not available until analysis runs.</p>}
      </Section>

      <Section title="Value proposition" open={open.value} onToggle={() => toggle("value")}>
        {product?.valueProposition ? (
          <div className="di-summary">
            <div><span>Summary</span><b>{product.valueProposition.productSummary}</b></div>
            <div><span>Problem</span><b>{product.valueProposition.customerProblem}</b></div>
            <div><span>Benefit</span><b>{product.valueProposition.customerBenefit}</b></div>
            <div><span>Positioning</span><b>{product.valueProposition.positioning}</b></div>
            <div><span>Provenance</span><b>{product.valueProposition.provenance}</b></div>
          </div>
        ) : <p className="di-muted">Value proposition is not available until analysis runs.</p>}
        {product?.valueProposition?.differentiators?.length ? (
          <ul className="di-item-list">{product.valueProposition.differentiators.map((item) => <li key={item}>{item}</li>)}</ul>
        ) : null}
      </Section>

      <Section title="Marketing position" open={open.marketing} onToggle={() => toggle("marketing")}>
        {marketing ? (
          <>
            <p>{marketing.productOverview}</p>
            <p>{marketing.strategy}</p>
            <ul className="di-item-list">
              {(marketing.directions ?? []).map((item) => (
                <li key={item.id}>
                  <strong>{item.id} {item.recommended ? "RECOMMENDED" : ""}</strong>
                  <small>{item.evidence.join("; ")} · {item.confidence}%</small>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="di-muted">Marketing Intelligence has not been built for this product yet.</p>}
      </Section>

      <Section title="Creative angles" open={open.angles} onToggle={() => toggle("angles")}>
        <ul className="di-item-list">
          {(product?.creativeAngles ?? []).map((item) => (
            <li key={item.id}>
              <strong>{item.rank}. {item.name}</strong>
              <small>{item.rationale} · {item.evidence.join("; ")}</small>
            </li>
          ))}
        </ul>
        {!product?.creativeAngles?.length && <p className="di-muted">Creative angles appear after Product Intelligence runs.</p>}
      </Section>

      <Section title="Creative plan" open={open.plan} onToggle={() => toggle("plan")}>
        {plan ? (
          <div className="di-summary">
            <div><span>Objective</span><b>{plan.objective || "—"}</b></div>
            <div><span>Audience</span><b>{collapseRepeatedProvenance(plan.audience || "—")}</b></div>
            <div><span>Message</span><b>{plan.message || "—"}</b></div>
            <div><span>Angle</span><b>{plan.angle || "—"}</b></div>
            <div><span>Visual</span><b>{plan.visualDirection || "—"}</b></div>
            <div><span>CTA</span><b>{plan.callToAction || "—"}</b></div>
          </div>
        ) : <p className="di-muted">Creative Plan has not been generated.</p>}
        {plan?.creativeStrategy && <p>{plan.creativeStrategy}</p>}
      </Section>

      <Section title="Scenes" open={open.scenes} onToggle={() => toggle("scenes")}>
        {plan?.scenes?.length ? (
          <SceneEditor scenes={plan.scenes} disabled={busy} onSave={(scenes) => void saveScenes(scenes)} />
        ) : <p className="di-muted">Scene plan appears after Creative Planning runs. Scenes reference real asset IDs.</p>}
      </Section>
    </div>
  );
}

function StatementList({ items, empty }: { items: ProvenanceStatementDto[]; empty: string }) {
  if (!items.length) return <p className="di-muted">{empty}</p>;
  return (
    <ul className="di-item-list">
      {items.map((item, index) => (
        <li key={`${item.kind}-${item.field}-${index}`}>
          <span className={`di-kind ${item.kind}`}>{KIND_LABEL[item.kind] ?? item.kind}</span>
          <strong>{item.field}: {item.value}</strong>
          <small>{item.source ?? ""}{item.assetId ? ` · asset ${item.assetId}` : ""} · {item.confidence}%</small>
        </li>
      ))}
    </ul>
  );
}

function SceneEditor({
  scenes,
  disabled,
  onSave,
}: {
  scenes: CreativePlanSceneDto[];
  disabled: boolean;
  onSave: (scenes: CreativePlanSceneDto[]) => void;
}) {
  const [draft, setDraft] = useState(scenes);
  useEffect(() => { setDraft(scenes); }, [scenes]);
  const move = (index: number, dir: -1 | 1) => {
    const next = [...draft];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    setDraft(next.map((scene, order) => ({ ...scene, order: order + 1 })));
  };
  const patch = (index: number, changes: Partial<CreativePlanSceneDto>) => {
    setDraft((current) => current.map((scene, i) => (i === index ? { ...scene, ...changes } : scene)));
  };
  return (
    <>
      {draft.map((scene, index) => (
        <article key={scene.id} className="di-item-list" style={{ marginBottom: 10 }}>
          <li>
            <strong>Scene {scene.order} · {scene.purpose}</strong>
            <small>asset {scene.assetId || "unassigned"} · {scene.imageRole || "role n/a"} · {scene.cameraDirection || scene.camera}</small>
            <label>Purpose <input value={scene.purpose} disabled={disabled} onChange={(e) => patch(index, { purpose: e.target.value })} /></label>
            <label>Text <input value={scene.text ?? ""} disabled={disabled} onChange={(e) => patch(index, { text: e.target.value })} /></label>
            <label>Duration <input type="number" min={1} value={scene.durationSeconds} disabled={disabled} onChange={(e) => patch(index, { durationSeconds: Number(e.target.value) || scene.durationSeconds })} /></label>
            <label>Visual direction <input value={scene.visual} disabled={disabled} onChange={(e) => patch(index, { visual: e.target.value })} /></label>
            <label>CTA <input value={scene.copy?.callToAction ?? ""} disabled={disabled} onChange={(e) => patch(index, { copy: { ...scene.copy, callToAction: e.target.value } })} /></label>
            <div className="di-review-actions">
              <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)}>Up</button>
              <button type="button" disabled={disabled || index === draft.length - 1} onClick={() => move(index, 1)}>Down</button>
            </div>
          </li>
        </article>
      ))}
      <button type="button" className="di-primary" disabled={disabled} onClick={() => onSave(draft)}>
        <Save size={15} /> Save scene edits
      </button>
    </>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="di-panel">
      <button type="button" className="di-section-toggle" onClick={onToggle}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {title}
      </button>
      {open && <div className="di-section-body">{children}</div>}
    </section>
  );
}
