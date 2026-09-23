import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import type { AdminModelRecord, AdminProviderPublicView, FeatureMappingView } from "../types";
import {
  AuthLockedState, DataTable, ErrorState, FormField, LoadingState, Modal, PageHeader, StatusBadge, Toast, Toggle,
} from "../components/ui";

/** Truthful capability readiness for Admin display — never invents AVAILABILITY. */
function capabilityCatalogStatus(item: FeatureMappingView): string {
  const meta = item.metadata ?? {};
  if (meta.comingSoon === true) return "COMING_SOON";
  if (!item.enabled) {
    if (meta.pendingProvider === true || meta.pendingCredential === true) return "DISABLED";
    if (item.feature === "ONLINE_API_PROBE") return "DISABLED";
    return "DISABLED";
  }
  if (meta.pendingProvider === true || (!item.providerId && !item.primaryModelId)) {
    return "PENDING_PROVIDER";
  }
  if (meta.pendingModel === true || (item.providerId && !item.primaryModelId)) {
    return "PENDING_MODEL";
  }
  if (item.resolutionStatus === "READY" || item.resolutionStatus === "FALLBACK") {
    return "CONFIGURED";
  }
  if (item.resolutionStatus === "UNAVAILABLE") return "UNAVAILABLE";
  return item.resolutionStatus ?? "UNAVAILABLE";
}

function displayProvider(item: FeatureMappingView): string {
  return item.providerName ?? (item.providerId ? item.providerId : "Not configured");
}

function displayModel(item: FeatureMappingView): string {
  return item.primaryModelName ?? (item.primaryModelId ? item.primaryModelId : "Not configured");
}

export function FeaturesPage({ onGoToApiAccess }: { onGoToApiAccess?: () => void }) {
  const [items, setItems] = useState<FeatureMappingView[]>([]);
  const [models, setModels] = useState<AdminModelRecord[]>([]);
  const [providers, setProviders] = useState<AdminProviderPublicView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [editing, setEditing] = useState<FeatureMappingView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<{
    feature: string;
    status: string;
    selectedModelId: string | null;
    providerId: string | null;
    source: string;
    reason?: string;
    live?: boolean;
    outputText?: string | null;
    errorCode?: string;
    httpStatus?: number;
    requestId?: string;
  } | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    Promise.all([
      adminApi.features(),
      adminApi.models({ pageSize: 100 }),
      adminApi.providers(),
    ])
      .then(([features, modelResult, providerResult]) => {
        setItems(features.items);
        setModels(modelResult.items);
        setProviders(providerResult.items);
      })
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          setItems([]);
          setModels([]);
          setProviders([]);
          return;
        }
        setError(err instanceof Error ? err.message : "Feature mappings failed");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.saveFeature({
        id: editing.id,
        feature: editing.feature,
        label: editing.label,
        description: editing.description,
        primaryModelId: editing.primaryModelId || undefined,
        secondaryModelId: editing.secondaryModelId || undefined,
        fallbackModelId: editing.fallbackModelId || undefined,
        providerId: editing.providerId || undefined,
        enabled: editing.enabled,
        priority: editing.priority,
      });
      setEditing(null);
      setToast("Feature mapping saved");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const testResolve = async (feature: string) => {
    setProbing(true);
    try {
      const result = await adminApi.resolveFeature(feature);
      setProbe({
        feature: result.feature,
        status: result.status,
        selectedModelId: result.selectedModelId,
        providerId: result.providerId,
        source: result.source,
        reason: result.reason,
        live: false,
      });
      setToast(`Resolution ${result.status} · ${result.source}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Resolution test failed");
    } finally {
      setProbing(false);
    }
  };

  const runLiveOnlineProbe = async () => {
    setProbing(true);
    try {
      const result = await adminApi.executeRuntimeProbe({ prompt: "Reply with exactly: OK" }) as {
        ok?: boolean;
        feature?: string;
        source?: string;
        modelId?: string | null;
        providerId?: string | null;
        outputText?: string | null;
        errorCode?: string;
        errorMessage?: string;
        httpStatus?: number;
        requestId?: string;
        resolutionStatus?: string;
      };
      setProbe({
        feature: result.feature ?? "ONLINE_API_PROBE",
        status: result.ok ? "LIVE_OK" : (result.errorCode ?? "LIVE_FAILED"),
        selectedModelId: result.modelId ?? null,
        providerId: result.providerId ?? null,
        source: result.source ?? "ONLINE",
        reason: result.errorMessage,
        live: true,
        outputText: result.outputText ?? null,
        errorCode: result.errorCode,
        httpStatus: result.httpStatus,
        requestId: result.requestId,
      });
      setToast(result.ok ? "Online probe succeeded" : `Online probe: ${result.errorCode ?? "failed"}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Online probe failed");
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="acc-page">
      <PageHeader
        title="Feature Mapping"
        description="Capability → Provider → Model resolution. Statuses are truthful — pending capabilities are not shown as available."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Feature Mapping" }]}
      />

      {loading && <LoadingState />}
      {authLocked && !loading && (
        <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />
      )}
      {error && !authLocked && <ErrorState title="Feature mappings failed to load" detail={error} onRetry={load} />}
      {!loading && !error && !authLocked && (
        <DataTable
          emptyTitle="No feature mappings"
          columns={[
            { key: "feature", label: "Capability" },
            { key: "provider", label: "Provider" },
            { key: "primary", label: "Model" },
            { key: "fallback", label: "Fallback" },
            { key: "priority", label: "Priority", className: "numeric" },
            { key: "status", label: "Status" },
            { key: "resolution", label: "Resolution" },
            { key: "actions", label: "" },
          ]}
          rows={items.map((item) => ({
            id: item.id,
            cells: {
              feature: (
                <div>
                  <strong>{item.label}</strong>
                  <div className="acc-muted mono">{item.feature}</div>
                </div>
              ),
              provider: displayProvider(item),
              primary: displayModel(item),
              fallback: item.fallbackModelName ?? "—",
              priority: item.priority,
              status: <StatusBadge status={capabilityCatalogStatus(item)} />,
              resolution: item.resolutionStatus
                ? <StatusBadge status={`${item.resolutionStatus}${item.resolutionSource && item.resolutionSource !== "NONE" ? ` · ${item.resolutionSource}` : ""}`} />
                : "—",
              actions: (
                <div className="acc-row-actions">
                  <button type="button" className="acc-button ghost" onClick={() => void testResolve(item.feature)} disabled={probing}>
                    Test
                  </button>
                  {item.feature === "ONLINE_API_PROBE" ? (
                    <button type="button" className="acc-button ghost" onClick={() => void runLiveOnlineProbe()} disabled={probing}>
                      Live API
                    </button>
                  ) : null}
                  <button type="button" className="acc-button ghost" onClick={() => { setEditing(item); setProbe(null); }}>Edit</button>
                </div>
              ),
            },
          }))}
        />
      )}

      {probe && !authLocked && (
        <section className="acc-section-card" aria-live="polite">
          <div className="acc-section-card-head">
            <div>
              <h2 className="acc-section-title">{probe.live ? "Live online probe" : "Dry-run resolution"}</h2>
              <p className="acc-section-desc">
                {probe.live
                  ? "Real HTTPS call through Admin credential → provider adapter. Secrets are never shown."
                  : "Configuration only — no external AI generation."}
              </p>
            </div>
          </div>
          <div className="acc-section-card-body">
            <div className="acc-stat-grid">
              <div className="acc-stat-card"><span className="acc-stat-label">Feature</span><strong className="acc-stat-value">{probe.feature}</strong></div>
              <div className="acc-stat-card"><span className="acc-stat-label">Status</span><strong className="acc-stat-value">{probe.status}</strong></div>
              <div className="acc-stat-card"><span className="acc-stat-label">Source</span><strong className="acc-stat-value">{probe.source}</strong></div>
              <div className="acc-stat-card"><span className="acc-stat-label">Model</span><strong className="acc-stat-value">{probe.selectedModelId ?? "None"}</strong></div>
            </div>
            {probe.httpStatus != null ? <p className="acc-muted">HTTP {probe.httpStatus}</p> : null}
            {probe.requestId ? <p className="acc-muted mono">requestId={probe.requestId}</p> : null}
            {probe.outputText ? <p className="acc-muted">Output: {probe.outputText}</p> : null}
            {probe.reason ? <p className="acc-muted">{probe.reason}</p> : null}
          </div>
        </section>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing ? `Map ${editing.feature}` : "Feature"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="acc-button ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button
              type="button"
              className="acc-button ghost"
              disabled={probing || !editing}
              onClick={() => editing && void testResolve(editing.feature)}
            >
              {probing ? "Testing…" : "Test resolution"}
            </button>
            <button type="button" className="acc-button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save mapping"}
            </button>
          </>
        }
      >
        {editing && (
          <div className="acc-form-grid">
            <FormField label="Label">
              <input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            </FormField>
            <FormField label="Primary model">
              <select
                value={editing.primaryModelId ?? ""}
                onChange={(e) => setEditing({ ...editing, primaryModelId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </FormField>
            <FormField label="Secondary model">
              <select
                value={editing.secondaryModelId ?? ""}
                onChange={(e) => setEditing({ ...editing, secondaryModelId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </FormField>
            <FormField label="Fallback model">
              <select
                value={editing.fallbackModelId ?? ""}
                onChange={(e) => setEditing({ ...editing, fallbackModelId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </FormField>
            <FormField label="Provider">
              <select
                value={editing.providerId ?? ""}
                onChange={(e) => setEditing({ ...editing, providerId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
            </FormField>
            <Toggle
              label="Enabled"
              checked={editing.enabled}
              onChange={(enabled) => setEditing({ ...editing, enabled })}
            />
          </div>
        )}
      </Modal>
      <Toast message={toast} />
    </div>
  );
}
