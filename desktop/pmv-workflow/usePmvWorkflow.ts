import { useCallback, useEffect, useRef, useState } from "react";
import { productSetupEngine } from "../product-setup/product-setup-engine";
import { displayPercent } from "../customer-platform/workspace/pmv/progress-model";
import { getPmvWorkflow, sendPmvWorkflowAction, type CustomerWorkflowSummary, type PmvWorkflowAction } from "./api";

const POLL_MS = 4_000;

export interface PmvWorkflowState {
  workflow: CustomerWorkflowSummary | null;
  loaded: boolean;
  pending: PmvWorkflowAction | null;
  error: string | null;
  /** Client clock when `workflow` was received (for elapsed time between polls). */
  receivedAt: number;
  /** Percentage to show for the current run (never rewinds within a run). */
  percent: number;
  act: (action: PmvWorkflowAction) => Promise<CustomerWorkflowSummary | null>;
}

/** Customer workflow status for a PMV project: loads, polls while active, and re-hydrates project state on progress. */
export function usePmvWorkflow(projectId: string | null): PmvWorkflowState {
  const [workflow, setWorkflow] = useState<CustomerWorkflowSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PmvWorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [percent, setPercent] = useState(0);
  const lastSeen = useRef<string | null>(null);
  const shown = useRef<{ key: string; percent: number } | null>(null);

  const apply = useCallback((next: CustomerWorkflowSummary | null) => {
    setWorkflow(next);
    setReceivedAt(Date.now());
    shown.current = next ? displayPercent(shown.current, next) : null;
    setPercent(shown.current?.percent ?? 0);
    const marker = next ? `${next.workflowId}:${next.status}:${next.progress.completed}` : null;
    if (lastSeen.current !== null && marker !== lastSeen.current) {
      void productSetupEngine.hydrateFromServer();
    }
    lastSeen.current = marker;
  }, []);

  useEffect(() => {
    lastSeen.current = null;
    shown.current = null;
    setWorkflow(null);
    setPercent(0);
    setLoaded(false);
    setError(null);
    if (!projectId) return;
    let alive = true;
    void getPmvWorkflow(projectId)
      .then((w) => { if (alive) apply(w); })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [projectId, apply]);

  const active = workflow?.status === "QUEUED" || workflow?.status === "RUNNING";
  useEffect(() => {
    if (!projectId || !active) return;
    const refresh = () => { void getPmvWorkflow(projectId).then(apply).catch(() => undefined); };
    // Background tabs throttle timers; catch up as soon as the customer looks again.
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [projectId, active, apply]);

  const act = useCallback(async (action: PmvWorkflowAction) => {
    if (!projectId) return null;
    setPending(action);
    setError(null);
    try {
      if (action !== "cancel") await productSetupEngine.flushPersist().catch(() => undefined);
      const next = await sendPmvWorkflowAction(projectId, action);
      apply(next);
      return next;
    } catch {
      setError("Video generation is temporarily unavailable. Please try again.");
      return null;
    } finally {
      setPending(null);
    }
  }, [projectId, apply]);

  return { workflow, loaded, pending, error, receivedAt, percent, act };
}
