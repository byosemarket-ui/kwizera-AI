import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import type { AdminProviderPublicView } from "../types";
import {
  DataTable, Drawer, ErrorState, FormField, LoadingState, PageHeader,
  StatusBadge, Toast, Toggle,
} from "../components/ui";

export function ProvidersPage() {
  const [items, setItems] = useState<AdminProviderPublicView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminProviderPublicView | null>(null);
  const [draft, setDraft] = useState<Partial<AdminProviderPublicView> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi.providers()
      .then((result) => setItems(result.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = (provider: AdminProviderPublicView) => {
    setSelected(provider);
    setDraft({ ...provider });
  };

  const save = async () => {
    if (!draft || !selected) return;
    setSaving(true);
    try {
      const saved = await adminApi.saveProvider({
        id: selected.id,
        name: draft.name,
        type: draft.type,
        baseEndpoint: draft.baseEndpoint,
        enabled: draft.enabled,
        status: draft.enabled ? "active" : "inactive",
        healthStatus: draft.healthStatus,
        metadata: draft.metadata ?? {},
      });
      setSelected(saved);
      setDraft(saved);
      setToast("Provider updated");
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
        title="Providers"
        description="AI provider registry. Credentials stay on the server and are shown masked only."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Providers" }]}
      />

      {loading && <LoadingState />}
      {error && <ErrorState title="Providers failed to load" detail={error} onRetry={load} />}
      {!loading && !error && (
        <DataTable
          emptyTitle="No providers configured"
          columns={[
            { key: "name", label: "Provider" },
            { key: "type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "health", label: "Health" },
            { key: "enabled", label: "Enabled" },
            { key: "models", label: "Models", className: "numeric" },
            { key: "credential", label: "Credential" },
            { key: "actions", label: "" },
          ]}
          rows={items.map((provider) => ({
            id: provider.id,
            cells: {
              name: <strong>{provider.name}</strong>,
              type: provider.type,
              status: <StatusBadge status={provider.status} />,
              health: <StatusBadge status={provider.healthStatus} />,
              enabled: provider.enabled ? "Yes" : "No",
              models: provider.configuredModelCount,
              credential: provider.hasCredential
                ? <span className="mono">{provider.credentialMasked}</span>
                : <span className="acc-muted">Not set</span>,
              actions: (
                <button type="button" className="acc-button ghost" onClick={() => open(provider)}>Details</button>
              ),
            },
          }))}
        />
      )}

      <Drawer
        open={Boolean(selected && draft)}
        title={selected?.name ?? "Provider"}
        onClose={() => { setSelected(null); setDraft(null); }}
      >
        {draft && selected && (
          <div className="acc-form-stack">
            <FormField label="Name">
              <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </FormField>
            <FormField label="Type">
              <input value={draft.type ?? ""} onChange={(e) => setDraft({ ...draft, type: e.target.value })} />
            </FormField>
            <FormField label="Base endpoint">
              <input
                value={draft.baseEndpoint ?? ""}
                onChange={(e) => setDraft({ ...draft, baseEndpoint: e.target.value })}
              />
            </FormField>
            <FormField label="Credential" hint="Full secrets are never returned to the browser.">
              <input
                value={selected.hasCredential ? (selected.credentialMasked ?? "••••••••") : "Not configured"}
                readOnly
                disabled
              />
            </FormField>
            <Toggle
              label="Enabled"
              checked={Boolean(draft.enabled)}
              onChange={(enabled) => setDraft({ ...draft, enabled })}
            />
            <p className="acc-muted">
              Health checks and encrypted credential storage will plug into this drawer in a later stage.
              Use `credentialReference` on the backend only.
            </p>
            <button type="button" className="acc-button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save provider"}
            </button>
          </div>
        )}
      </Drawer>
      <Toast message={toast} />
    </div>
  );
}
