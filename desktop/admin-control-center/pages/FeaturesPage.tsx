import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import type { AdminModelRecord, AdminProviderPublicView, FeatureMappingView } from "../types";
import {
  DataTable, ErrorState, FormField, LoadingState, Modal, PageHeader, StatusBadge, Toast, Toggle,
} from "../components/ui";

export function FeaturesPage() {
  const [items, setItems] = useState<FeatureMappingView[]>([]);
  const [models, setModels] = useState<AdminModelRecord[]>([]);
  const [providers, setProviders] = useState<AdminProviderPublicView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      .catch((err: Error) => setError(err.message))
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
        description="Feature → Model → Provider resolution. Change mappings here without editing engine source."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Feature Mapping" }]}
      />

      {loading && <LoadingState />}
      {error && <ErrorState title="Feature mappings failed to load" detail={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          emptyTitle="No feature mappings"
          columns={[
            { key: "feature", label: "Feature" },
            { key: "primary", label: "Primary model" },
            { key: "secondary", label: "Secondary" },
            { key: "fallback", label: "Fallback" },
            { key: "provider", label: "Provider" },
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
              primary: item.primaryModelName ?? "—",
              secondary: item.secondaryModelName ?? "—",
              fallback: item.fallbackModelName ?? "—",
              provider: item.providerName ?? "—",
              status: <StatusBadge status={item.enabled ? "Enabled" : "Disabled"} />,
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

      {probe && (
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
