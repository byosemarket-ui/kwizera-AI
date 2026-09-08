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
              actions: (
                <button type="button" className="acc-button ghost" onClick={() => setEditing(item)}>Edit</button>
              ),
            },
          }))}
        />
      )}

      <Modal
        open={Boolean(editing)}
        title={editing ? `Map ${editing.feature}` : "Feature"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="acc-button ghost" onClick={() => setEditing(null)}>Cancel</button>
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
