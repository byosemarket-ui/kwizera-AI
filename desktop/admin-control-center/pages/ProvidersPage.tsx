import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import type { AdminProviderPublicView } from "../types";
import {
  AuthLockedState, DataTable, Drawer, ErrorState, FormField, LoadingState, PageHeader,
  StatusBadge, Toast, Toggle,
} from "../components/ui";

function connectionLabel(provider: AdminProviderPublicView): string {
  if (!provider.enabled) return "Disabled";
  if (provider.healthStatus === "healthy") return "Connected";
  if (provider.healthStatus === "unhealthy") return "Failed";
  if (provider.healthStatus === "degraded") return "Degraded";
  return provider.healthStatus === "unchecked" ? "Not tested" : provider.healthStatus;
}

export function ProvidersPage({ onGoToApiAccess }: { onGoToApiAccess?: () => void }) {
  const [items, setItems] = useState<AdminProviderPublicView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminProviderPublicView | null>(null);
  const [draft, setDraft] = useState<Partial<AdminProviderPublicView> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [credentialDraft, setCredentialDraft] = useState("");
  const [healthDetail, setHealthDetail] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    adminApi.providers()
      .then((result) => setItems(result.items))
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          setItems([]);
          return;
        }
        setError(err instanceof Error ? err.message : "Providers failed");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = (provider: AdminProviderPublicView) => {
    setSelected(provider);
    setDraft({ ...provider });
    setCredentialDraft("");
    setHealthDetail(null);
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

  const saveCredential = async () => {
    if (!selected || !credentialDraft.trim()) return;
    setSaving(true);
    try {
      const saved = await adminApi.setProviderCredential(selected.id, credentialDraft.trim());
      setSelected(saved);
      setDraft(saved);
      setCredentialDraft("");
      setToast("Provider credential stored (encrypted)");
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Credential save failed");
    } finally {
      setSaving(false);
    }
  };

  const runHealth = async () => {
    if (!selected) return;
    setSaving(true);
    setHealthDetail(null);
    try {
      const result = await adminApi.testProviderHealth(selected.id);
      setHealthDetail(
        `${result.code}${result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}${result.endpointHost ? ` · ${result.endpointHost}` : ""}${result.detail ? ` — ${result.detail}` : ""}`,
      );
      setToast(`Connection: ${result.code}`);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-page">
      <PageHeader
        title="Providers"
        description="AI provider registry. Provider API keys are encrypted on the server — never confuse them with the Admin API Token."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Providers" }]}
      />

      {loading && <LoadingState />}
      {authLocked && !loading && (
        <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />
      )}
      {error && !authLocked && <ErrorState title="Providers failed to load" detail={error} onRetry={load} />}
      {!loading && !error && !authLocked && (
        <DataTable
          emptyTitle="No providers configured"
          columns={[
            { key: "name", label: "Provider" },
            { key: "type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "connection", label: "Connection" },
            { key: "enabled", label: "Enabled" },
            { key: "models", label: "Models", className: "numeric" },
            { key: "credential", label: "Provider credential" },
            { key: "actions", label: "" },
          ]}
          rows={items.map((provider) => ({
            id: provider.id,
            cells: {
              name: (
                <div>
                  <strong>{provider.name}</strong>
                  {provider.baseEndpoint ? <div className="acc-muted mono">{provider.baseEndpoint}</div> : null}
                </div>
              ),
              type: provider.type,
              status: <StatusBadge status={provider.status} />,
              connection: <StatusBadge status={connectionLabel(provider)} />,
              enabled: provider.enabled ? "Yes" : "No",
              models: provider.configuredModelCount,
              credential: provider.hasCredential
                ? <StatusBadge status="Configured" />
                : <StatusBadge status="Not configured" />,
              actions: (
                <button type="button" className="acc-button ghost" onClick={() => open(provider)}>Manage</button>
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
            <p className="acc-callout-inline">
              Provider API credentials are encrypted server-side. This is not the Admin API Token (see Security → API Access).
            </p>
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
            <FormField label="Provider credential status" hint="Full secrets are never returned to the browser.">
              <input
                value={selected.hasCredential ? "Credential configured" : "Not configured"}
                readOnly
                disabled
              />
            </FormField>
            <FormField label="Set / replace provider API key" hint="Value is sent once and encrypted. It is never echoed back.">
              <input
                type="password"
                autoComplete="off"
                placeholder={selected.hasCredential ? "Enter new secret to replace" : "Paste provider API key"}
                value={credentialDraft}
                onChange={(e) => setCredentialDraft(e.target.value)}
              />
            </FormField>
            <Toggle
              label="Enabled"
              checked={Boolean(draft.enabled)}
              onChange={(enabled) => setDraft({ ...draft, enabled })}
            />
            {healthDetail && <p className="acc-muted" role="status">{healthDetail}</p>}
            <div className="acc-form-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="acc-button" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save provider"}
              </button>
              <button
                type="button"
                className="acc-button ghost"
                disabled={saving || !credentialDraft.trim()}
                onClick={() => void saveCredential()}
              >
                Save credential
              </button>
              <button type="button" className="acc-button ghost" disabled={saving} onClick={() => void runHealth()}>
                Test connection
              </button>
            </div>
          </div>
        )}
      </Drawer>
      <Toast message={toast} />
    </div>
  );
}
