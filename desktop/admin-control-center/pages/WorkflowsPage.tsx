import { useEffect, useState } from "react";
import { adminApi, type AdminWorkflowView } from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import {
  AuthLockedState, DataTable, Drawer, EmptyState, ErrorState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge,
} from "../components/ui";

/** Admin observability for PMV production workflows (orchestration state, capability routing, failures, lineage). */
export function WorkflowsPage({ onGoToApiAccess }: { onGoToApiAccess?: () => void }) {
  const [items, setItems] = useState<AdminWorkflowView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    adminApi.workflows()
      .then((data) => setItems(data.items))
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          setItems(null);
          return;
        }
        setError(err instanceof Error ? err.message : "Workflows failed to load");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const selected = items?.find((w) => w.workflowId === selectedId) ?? null;
  const count = (status: string) => items?.filter((w) => w.status === status).length ?? 0;

  return (
    <div className="acc-page">
      <PageHeader
        title="Workflows"
        description="Automated Product Marketing Video production: plan, capability routing, step state, retries, and delivery lineage."
        breadcrumbs={[{ label: "Admin" }, { label: "System" }, { label: "Workflows" }]}
        actions={<button type="button" className="acc-button" onClick={load}>Refresh</button>}
      />
      {loading && <LoadingState />}
      {authLocked && !loading && <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />}
      {error && !authLocked && <ErrorState title="Workflows failed to load" detail={error} onRetry={load} />}
      {!loading && !error && !authLocked && items && (
        <>
          <div className="acc-stat-grid">
            <StatCard label="Running" value={count("RUNNING") + count("QUEUED")} />
            <StatCard label="Waiting for user" value={count("WAITING_FOR_USER")} />
            <StatCard label="Failed" value={count("FAILED")} />
            <StatCard label="Completed" value={count("COMPLETED")} />
          </div>
          <SectionCard title="Recent workflows" description="Newest first. Select a workflow to inspect its steps.">
            <DataTable
              emptyTitle="No workflows yet"
              columns={[
                { key: "project", label: "Project" },
                { key: "mode", label: "Mode" },
                { key: "status", label: "Status" },
                { key: "step", label: "Current step" },
                { key: "ops", label: "Est. operations", className: "numeric" },
                { key: "updated", label: "Updated" },
                { key: "open", label: "" },
              ]}
              rows={items.map((w) => ({
                id: w.workflowId,
                cells: {
                  project: <code>{w.projectId}</code>,
                  mode: w.mode,
                  status: <StatusBadge status={w.status} />,
                  step: w.currentStep ?? "—",
                  ops: w.estimatedOperations,
                  updated: new Date(w.updatedAt).toLocaleString(),
                  open: <button type="button" className="acc-button ghost" onClick={() => setSelectedId(w.workflowId)}>Inspect</button>,
                },
              }))}
            />
          </SectionCard>
        </>
      )}
      <Drawer open={Boolean(selected)} title="Workflow detail" onClose={() => setSelectedId(null)}>
        {selected ? <WorkflowDetail workflow={selected} /> : <EmptyState title="Workflow not found" />}
      </Drawer>
    </div>
  );
}

function WorkflowDetail({ workflow }: { workflow: AdminWorkflowView }) {
  return (
    <div className="acc-page">
      <p><strong>{workflow.mode}</strong> · <StatusBadge status={workflow.status} /> · v{workflow.workflowVersion}</p>
      <p>Required capabilities: {workflow.requiredCapabilities.length ? workflow.requiredCapabilities.join(", ") : "none"}</p>
      {workflow.lastFailure ? (
        <p>Last failure: {workflow.lastFailure.failureClass} · {workflow.lastFailure.code} · route {workflow.lastFailure.route}</p>
      ) : null}
      <SectionCard title="Capability routing" description="Resolved from Admin feature mappings at request time.">
        <DataTable
          emptyTitle="No external capabilities required"
          columns={[
            { key: "capability", label: "Capability" },
            { key: "status", label: "Status" },
            { key: "source", label: "Source" },
            { key: "provider", label: "Provider" },
            { key: "model", label: "Model" },
          ]}
          rows={workflow.capabilityRouting.map((r) => ({
            id: r.capability,
            cells: {
              capability: r.capability,
              status: <StatusBadge status={r.status} />,
              source: r.source,
              provider: r.providerId ?? "—",
              model: r.modelId ?? "—",
            },
          }))}
        />
      </SectionCard>
      <SectionCard title="Steps">
        <DataTable
          columns={[
            { key: "id", label: "Step" },
            { key: "status", label: "Status" },
            { key: "attempts", label: "Attempts", className: "numeric" },
            { key: "failure", label: "Failure" },
            { key: "reason", label: "Why" },
          ]}
          rows={workflow.steps.map((s) => ({
            id: s.id,
            cells: {
              id: s.id,
              status: <StatusBadge status={s.status} />,
              attempts: `${s.attempts}/${s.maxAttempts}`,
              failure: s.failure ? `${s.failure.failureClass} · ${s.failure.code}` : "—",
              reason: s.reason,
            },
          }))}
        />
      </SectionCard>
      {workflow.qa ? (
        <SectionCard title="Quality gate">
          <p>{workflow.qa.overallStatus} · render {workflow.qa.renderJobId ?? "—"}</p>
        </SectionCard>
      ) : null}
      {workflow.delivery ? (
        <SectionCard title="Delivery lineage">
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, margin: 0 }}>{JSON.stringify(workflow.delivery, null, 2)}</pre>
        </SectionCard>
      ) : null}
    </div>
  );
}
