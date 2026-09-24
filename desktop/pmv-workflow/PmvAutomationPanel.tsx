import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { productSetupEngine } from "../product-setup/product-setup-engine";
import { getPmvWorkflow, sendPmvWorkflowAction, type CustomerWorkflowSummary, type PmvWorkflowAction } from "./api";

const POLL_MS = 4_000;

/** Automated production for the current PMV project, shown inside the existing PMV workspace. */
export function PmvAutomationPanel({ projectId }: { projectId: string | null }) {
  const [workflow, setWorkflow] = useState<CustomerWorkflowSummary | null>(null);
  const [pending, setPending] = useState<PmvWorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSeen = useRef<string | null>(null);

  const apply = useCallback((next: CustomerWorkflowSummary | null) => {
    setWorkflow(next);
    const marker = next ? `${next.workflowId}:${next.status}:${next.progress.completed}` : null;
    if (lastSeen.current !== null && marker !== lastSeen.current) {
      void productSetupEngine.hydrateFromServer();
    }
    lastSeen.current = marker;
  }, []);

  useEffect(() => {
    lastSeen.current = null;
    setWorkflow(null);
    if (!projectId) return;
    let alive = true;
    const load = () => getPmvWorkflow(projectId).then((w) => { if (alive) apply(w); }).catch(() => undefined);
    void load();
    return () => { alive = false; };
  }, [projectId, apply]);

  const active = workflow?.status === "QUEUED" || workflow?.status === "RUNNING";
  useEffect(() => {
    if (!projectId || !active) return;
    const timer = window.setInterval(() => {
      void getPmvWorkflow(projectId).then(apply).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [projectId, active, apply]);

  const act = async (action: PmvWorkflowAction) => {
    if (!projectId) return;
    setPending(action);
    setError(null);
    try {
      if (action !== "cancel") await productSetupEngine.flushPersist().catch(() => undefined);
      apply(await sendPmvWorkflowAction(projectId, action));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Automated production is not available right now");
    } finally {
      setPending(null);
    }
  };

  if (!projectId) return null;

  const status = workflow?.status ?? null;
  const startLabel = status === "COMPLETED" ? "Run production again" : "Automate production";

  return (
    <section className="pmv-automation" data-pmv-automation="true" data-status={status ?? "NONE"} aria-label="Automated production">
      <div className="pmv-automation__head">
        <div>
          <h2>Automated production</h2>
          <p>
            {workflow
              ? workflow.label
              : "Let Kwizera run every remaining step for you. Finished steps are kept and never repeated."}
          </p>
        </div>
        <div className="pmv-automation__actions">
          {(!workflow || status === "COMPLETED") && (
            <button type="button" disabled={pending !== null} onClick={() => void act("start")}>
              {pending === "start" ? <Loader2 size={14} className="spin" aria-hidden /> : null}
              {startLabel}
            </button>
          )}
          {workflow?.canResume && (
            <button type="button" disabled={pending !== null} onClick={() => void act(workflow.canRetry ? "retry" : "resume")}>
              {pending === "resume" || pending === "retry" ? <Loader2 size={14} className="spin" aria-hidden /> : null}
              {workflow.canRetry ? "Try again" : "Continue"}
            </button>
          )}
          {workflow?.canCancel && (
            <button type="button" disabled={pending !== null} onClick={() => void act("cancel")}>
              Cancel
            </button>
          )}
        </div>
      </div>
      {workflow?.message ? <p className="pmv-automation__message" role="status">{workflow.message}</p> : null}
      {error ? <p className="pmv-automation__message" data-tone="error" role="alert">{error}</p> : null}
      {workflow ? (
        <ol className="pmv-automation__stages">
          {workflow.stages.map((stage) => (
            <li key={stage.label} data-state={stage.state}>
              {stage.state === "active" ? <Loader2 size={12} className="spin" aria-hidden /> : null}
              <span>{stage.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
