import { useCallback, useEffect, useRef, useState } from "react";
import { productSetupEngine } from "../product-setup/product-setup-engine";
import { getPmvWorkflow, sendPmvWorkflowAction, type CustomerWorkflowSummary, type PmvWorkflowAction } from "./api";

const POLL_MS = 4_000;

export interface PmvWorkflowState {
  workflow: CustomerWorkflowSummary | null;
  loaded: boolean;
  pending: PmvWorkflowAction | null;
  error: string | null;
  act: (action: PmvWorkflowAction) => Promise<CustomerWorkflowSummary | null>;
}

/** Customer workflow status for a PMV project: loads, polls while active, and re-hydrates project state on progress. */
export function usePmvWorkflow(projectId: string | null): PmvWorkflowState {
  const [workflow, setWorkflow] = useState<CustomerWorkflowSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
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
    const timer = window.setInterval(() => {
      void getPmvWorkflow(projectId).then(apply).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
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

  return { workflow, loaded, pending, error, act };
}
