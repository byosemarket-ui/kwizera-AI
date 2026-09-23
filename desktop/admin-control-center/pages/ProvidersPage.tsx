import { useEffect, useMemo, useState } from "react";
import { Cable, Search } from "lucide-react";
import { adminApi } from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import type { AdminModelRecord, AdminProviderPublicView, FeatureMappingView } from "../types";
import {
  AuthLockedState, Drawer, ErrorState, FormField, LoadingState, PageHeader,
  StatusBadge, Toast, Toggle,
} from "../components/ui";

type ProviderFilter = "all" | "configured" | "not_configured" | "connected" | "disabled";

function connectionStatus(provider: AdminProviderPublicView): string {
  if (!provider.enabled) return "DISABLED";
  if (provider.healthStatus === "healthy") return "CONNECTED";
  if (provider.healthStatus === "unhealthy") return "AUTHENTICATION_FAILED";
  if (provider.healthStatus === "degraded") return "PROVIDER_ERROR";
  if (provider.healthStatus === "unchecked") return "NOT_TESTED";
  return provider.healthStatus.toUpperCase();
}

function credentialStatus(provider: AdminProviderPublicView): string {
  if (provider.type === "ollama" || provider.type === "local") {
    return provider.hasCredential ? "CONFIGURED" : "LOCAL_RUNTIME";
  }
  return provider.hasCredential ? "CONFIGURED" : "NOT_CONFIGURED";
}

function credentialFieldLabel(provider: AdminProviderPublicView): string {
  switch (provider.type) {
    case "openai": return "OpenAI API Key";
    case "google": return "Google API Key";
    case "anthropic": return "Anthropic API Key";
    case "alibaba": return "Alibaba / Qwen API Credential";
    case "fal": return "fal.ai API Key";
    case "replicate": return "Replicate API Token";
    case "ollama":
    case "local":
      return "Optional provider credential";
    default:
      return "Provider API Credential";
  }
}

function supportsExternalCredential(provider: AdminProviderPublicView): boolean {
  return provider.type !== "ollama" && provider.type !== "local";
}

export function ProvidersPage({ onGoToApiAccess }: { onGoToApiAccess?: () => void }) {
  const [items, setItems] = useState<AdminProviderPublicView[]>([]);
  const [models, setModels] = useState<AdminModelRecord[]>([]);
  const [features, setFeatures] = useState<FeatureMappingView[]>([]);
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProviderFilter>("all");

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    Promise.all([
      adminApi.providers(),
      adminApi.models({ pageSize: 200 }),
      adminApi.features(),
    ])
      .then(([providerResult, modelResult, featureResult]) => {
        setItems(providerResult.items);
        setModels(modelResult.items);
        setFeatures(featureResult.items);
        setSelected((current) => {
          if (!current) return null;
          return providerResult.items.find((item) => item.id === current.id) ?? null;
        });
      })
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          setItems([]);
          setModels([]);
          setFeatures([]);
          return;
        }
        setError(err instanceof Error ? err.message : "Providers failed");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, AdminModelRecord[]>();
    for (const model of models) {
      const list = map.get(model.providerId) ?? [];
      list.push(model);
      map.set(model.providerId, list);
    }
    return map;
  }, [models]);

  const capabilityCountByProvider = useMemo(() => {
    const map = new Map<string, number>();
    for (const feature of features) {
      if (!feature.providerId) continue;
      map.set(feature.providerId, (map.get(feature.providerId) ?? 0) + 1);
    }
    return map;
  }, [features]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((provider) => {
      if (q) {
        const hay = `${provider.name} ${provider.type} ${provider.id} ${provider.baseEndpoint ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const connection = connectionStatus(provider);
      const credential = credentialStatus(provider);
      if (filter === "configured") return credential === "CONFIGURED" || credential === "LOCAL_RUNTIME";
      if (filter === "not_configured") return credential === "NOT_CONFIGURED";
      if (filter === "connected") return connection === "CONNECTED";
      if (filter === "disabled") return !provider.enabled;
      return true;
    });
  }, [items, search, filter]);

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
      setToast("Provider API credential stored (encrypted)");
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
      const label = result.code === "HEALTHY"
        ? "CONNECTED"
        : result.code === "AUTHENTICATION_ERROR"
          ? "AUTHENTICATION_FAILED"
          : result.code;
      setHealthDetail(
        `${label}${result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}${result.endpointHost ? ` · ${result.endpointHost}` : ""}${result.detail ? ` — ${result.detail}` : ""}`,
      );
      setToast(`Connection: ${label}`);
      load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setSaving(false);
    }
  };

  const selectedModels = selected ? (modelsByProvider.get(selected.id) ?? []) : [];
  const selectedFeatures = selected
    ? features.filter((feature) => feature.providerId === selected.id)
    : [];

  return (
    <div className="acc-page">
      <PageHeader
        title="AI Providers"
        description="Central registry for AI providers and their encrypted API credentials. This is separate from the Admin API Token (Security → API Access)."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Providers" }]}
      />

      {loading && <LoadingState />}
      {authLocked && !loading && (
        <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />
      )}
      {error && !authLocked && <ErrorState title="Providers failed to load" detail={error} onRetry={load} />}

      {!loading && !error && !authLocked && (
        <>
          <div className="acc-provider-toolbar">
            <label className="acc-provider-search">
              <Search size={14} aria-hidden />
              <span className="acc-sr-only">Search providers</span>
              <input
                type="search"
                value={search}
                placeholder="Search providers…"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="acc-provider-filters" role="tablist" aria-label="Provider filters">
              {([
                ["all", "All"],
                ["configured", "Configured"],
                ["not_configured", "Not configured"],
                ["connected", "Connected"],
                ["disabled", "Disabled"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  className={`acc-tab ${filter === id ? "active" : ""}`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="acc-empty-state" role="status">
              <strong>No providers match</strong>
              <p>Try another search or filter. Provider records come from the Admin registry.</p>
            </div>
          ) : (
            <div className="acc-provider-grid">
              {visible.map((provider) => {
                const modelCount = modelsByProvider.get(provider.id)?.length
                  ?? provider.configuredModelCount
                  ?? 0;
                const capabilityCount = capabilityCountByProvider.get(provider.id) ?? 0;
                return (
                  <article key={provider.id} className="acc-provider-card">
                    <header className="acc-provider-card-head">
                      <div className="acc-provider-card-icon" aria-hidden>
                        <Cable size={18} />
                      </div>
                      <div className="acc-provider-card-titles">
                        <h2>{provider.name}</h2>
                        <p className="acc-muted mono">{provider.type} · {provider.id}</p>
                      </div>
                      <StatusBadge status={provider.enabled ? "ENABLED" : "DISABLED"} />
                    </header>

                    <dl className="acc-provider-meta">
                      <div>
                        <dt>Credential</dt>
                        <dd><StatusBadge status={credentialStatus(provider)} /></dd>
                      </div>
                      <div>
                        <dt>Connection</dt>
                        <dd><StatusBadge status={connectionStatus(provider)} /></dd>
                      </div>
                      <div>
                        <dt>Models</dt>
                        <dd>{modelCount}</dd>
                      </div>
                      <div>
                        <dt>Capabilities</dt>
                        <dd>{capabilityCount}</dd>
                      </div>
                    </dl>

                    {provider.baseEndpoint ? (
                      <p className="acc-muted mono acc-provider-endpoint">{provider.baseEndpoint}</p>
                    ) : null}

                    <div className="acc-provider-card-actions">
                      <button type="button" className="acc-button" onClick={() => open(provider)}>
                        {provider.hasCredential || !supportsExternalCredential(provider) ? "Manage" : "Configure"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <Drawer
        open={Boolean(selected && draft)}
        title={selected?.name ?? "Provider"}
        onClose={() => { setSelected(null); setDraft(null); }}
      >
        {draft && selected && (
          <div className="acc-form-stack">
            <p className="acc-callout-inline">
              Provider API credentials are encrypted on the server. This is not the Admin API Token
              (Security → API Access).
            </p>

            <section className="acc-provider-section">
              <h3>General</h3>
              <FormField label="Provider name">
                <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </FormField>
              <FormField label="Provider ID">
                <input value={selected.id} readOnly disabled />
              </FormField>
              <FormField label="Provider type">
                <input value={draft.type ?? ""} onChange={(e) => setDraft({ ...draft, type: e.target.value })} />
              </FormField>
              <FormField label="Base endpoint">
                <input
                  value={draft.baseEndpoint ?? ""}
                  onChange={(e) => setDraft({ ...draft, baseEndpoint: e.target.value })}
                />
              </FormField>
              <Toggle
                label="Enabled"
                checked={Boolean(draft.enabled)}
                onChange={(enabled) => setDraft({ ...draft, enabled })}
              />
            </section>

            <section className="acc-provider-section">
              <h3>Credential</h3>
              <FormField label="Credential status" hint="Raw secrets are never returned to the browser.">
                <input
                  value={
                    selected.hasCredential
                      ? "Credential configured"
                      : supportsExternalCredential(selected)
                        ? "Not configured"
                        : "Local runtime — external API key not required"
                  }
                  readOnly
                  disabled
                />
              </FormField>
              {supportsExternalCredential(selected) ? (
                <FormField
                  label={credentialFieldLabel(selected)}
                  hint="Sent once and encrypted. Never echoed back. Not the Admin API Token."
                >
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={selected.hasCredential ? "Enter new credential to replace" : `Paste ${credentialFieldLabel(selected)}`}
                    value={credentialDraft}
                    onChange={(e) => setCredentialDraft(e.target.value)}
                  />
                </FormField>
              ) : (
                <p className="acc-muted">
                  Local providers use the studio/VPS runtime. They do not store an external cloud API key here.
                </p>
              )}
            </section>

            <section className="acc-provider-section">
              <h3>Connection</h3>
              <p className="acc-muted">
                Status: <StatusBadge status={connectionStatus(selected)} />
              </p>
              {healthDetail ? <p className="acc-muted" role="status">{healthDetail}</p> : null}
            </section>

            <section className="acc-provider-section">
              <h3>Models</h3>
              {selectedModels.length === 0 ? (
                <p className="acc-muted">No models linked to this provider yet.</p>
              ) : (
                <ul className="acc-provider-list">
                  {selectedModels.map((model) => (
                    <li key={model.id}>
                      <strong>{model.name}</strong>
                      <span className="acc-muted mono">{model.modelId} · {model.capability}</span>
                      <StatusBadge status={model.enabled ? "Enabled" : "Disabled"} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="acc-provider-section">
              <h3>Capabilities</h3>
              {selectedFeatures.length === 0 ? (
                <p className="acc-muted">No feature mappings currently assign this provider.</p>
              ) : (
                <ul className="acc-provider-list">
                  {selectedFeatures.map((feature) => (
                    <li key={feature.id}>
                      <strong>{feature.label}</strong>
                      <span className="acc-muted mono">{feature.feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="acc-form-actions">
              <button type="button" className="acc-button" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save provider"}
              </button>
              {supportsExternalCredential(selected) ? (
                <>
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
                </>
              ) : null}
            </div>
          </div>
        )}
      </Drawer>
      <Toast message={toast} />
    </div>
  );
}
