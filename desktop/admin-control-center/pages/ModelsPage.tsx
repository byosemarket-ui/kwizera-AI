import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../admin-api";
import type { AdminModelRecord, AdminProviderPublicView } from "../types";
import {
  DataTable, ErrorState, FilterBar, FormField, LoadingState, Modal, PageHeader,
  Pagination, SearchInput, Select, StatusBadge, Toast, Toggle,
} from "../components/ui";

const CATEGORIES = [
  "", "VISION", "IMAGE", "IMAGE_EDITING", "SEGMENTATION", "UPSCALE",
  "VIDEO", "AUDIO", "MUSIC", "TTS", "STT", "LLM", "EMBEDDING", "OTHER",
];

export function ModelsPage() {
  const [items, setItems] = useState<AdminModelRecord[]>([]);
  const [providers, setProviders] = useState<AdminProviderPublicView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [providerId, setProviderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<AdminModelRecord> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.models({ search: debounced, category, providerId, page, pageSize: 25 }),
      adminApi.providers(),
    ])
      .then(([models, providerResult]) => {
        setItems(models.items);
        setTotal(models.total);
        setProviders(providerResult.items);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [debounced, category, providerId, page]);

  const providerName = useMemo(() => {
    const map = new Map(providers.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? id;
  }, [providers]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.saveModel({
        ...editing,
        name: editing.name ?? "",
        providerId: editing.providerId ?? "",
        category: editing.category ?? "OTHER",
        capability: editing.capability ?? "other",
        modelId: editing.modelId ?? "",
      });
      setEditing(null);
      setToast("Model saved");
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
        title="Model Registry"
        description="Central registry for AI models. Engines should resolve models through this control plane."
        breadcrumbs={[{ label: "Admin" }, { label: "AI Control" }, { label: "Models" }]}
        actions={
          <button
            type="button"
            className="acc-button"
            onClick={() => setEditing({
              name: "",
              providerId: providers[0]?.id ?? "",
              category: "OTHER",
              capability: "other",
              modelId: "",
              priority: 50,
              inputType: "any",
              outputType: "any",
              currency: "USD",
              timeoutMs: 60000,
              enabled: false,
              status: "inactive",
              metadata: {},
            })}
          >
            Add model
          </button>
        }
      />

      <FilterBar>
        <SearchInput value={search} onChange={(value) => { setPage(1); setSearch(value); }} placeholder="Search models…" />
        <Select
          label="Category"
          value={category}
          onChange={(value) => { setPage(1); setCategory(value); }}
          options={CATEGORIES.map((value) => ({ value, label: value || "All categories" }))}
        />
        <Select
          label="Provider"
          value={providerId}
          onChange={(value) => { setPage(1); setProviderId(value); }}
          options={[
            { value: "", label: "All providers" },
            ...providers.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </FilterBar>

      {loading && <LoadingState />}
      {error && <ErrorState title="Models failed to load" detail={error} onRetry={load} />}
      {!loading && !error && (
        <>
          <DataTable
            emptyTitle="No models in registry"
            columns={[
              { key: "name", label: "Name" },
              { key: "provider", label: "Provider" },
              { key: "category", label: "Category" },
              { key: "capability", label: "Capability" },
              { key: "status", label: "Status" },
              { key: "priority", label: "Priority", className: "numeric" },
              { key: "enabled", label: "Enabled" },
              { key: "actions", label: "" },
            ]}
            rows={items.map((model) => ({
              id: model.id,
              cells: {
                name: (
                  <div>
                    <strong>{model.name}</strong>
                    <div className="acc-muted mono">{model.modelId}</div>
                  </div>
                ),
                provider: providerName(model.providerId),
                category: model.category,
                capability: model.capability,
                status: <StatusBadge status={model.status} />,
                priority: model.priority,
                enabled: (
                  <Toggle
                    label={model.enabled ? "On" : "Off"}
                    checked={model.enabled}
                    onChange={async (enabled) => {
                      try {
                        await adminApi.setModelEnabled(model.id, enabled);
                        load();
                      } catch (err) {
                        setToast(err instanceof Error ? err.message : "Update failed");
                      }
                    }}
                  />
                ),
                actions: (
                  <button type="button" className="acc-button ghost" onClick={() => setEditing(model)}>Edit</button>
                ),
              },
            }))}
          />
          <Pagination page={page} pageSize={25} total={total} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? "Edit model" : "Add model"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="acc-button ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="acc-button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {editing && (
          <div className="acc-form-grid">
            <FormField label="Model name">
              <input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </FormField>
            <FormField label="Provider">
              <select
                value={editing.providerId ?? ""}
                onChange={(e) => setEditing({ ...editing, providerId: e.target.value })}
              >
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Model ID">
              <input value={editing.modelId ?? ""} onChange={(e) => setEditing({ ...editing, modelId: e.target.value })} />
            </FormField>
            <FormField label="Category">
              <select
                value={editing.category ?? "OTHER"}
                onChange={(e) => setEditing({ ...editing, category: e.target.value as AdminModelRecord["category"] })}
              >
                {CATEGORIES.filter(Boolean).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </FormField>
            <FormField label="Capability">
              <input value={editing.capability ?? ""} onChange={(e) => setEditing({ ...editing, capability: e.target.value })} />
            </FormField>
            <FormField label="Endpoint">
              <input value={editing.endpoint ?? ""} onChange={(e) => setEditing({ ...editing, endpoint: e.target.value })} />
            </FormField>
            <FormField label="Version">
              <input value={editing.version ?? ""} onChange={(e) => setEditing({ ...editing, version: e.target.value })} />
            </FormField>
            <FormField label="Input type">
              <input value={editing.inputType ?? "any"} onChange={(e) => setEditing({ ...editing, inputType: e.target.value })} />
            </FormField>
            <FormField label="Output type">
              <input value={editing.outputType ?? "any"} onChange={(e) => setEditing({ ...editing, outputType: e.target.value })} />
            </FormField>
            <FormField label="Estimated cost">
              <input
                type="number"
                value={editing.estimatedCost ?? ""}
                onChange={(e) => setEditing({
                  ...editing,
                  estimatedCost: e.target.value === "" ? undefined : Number(e.target.value),
                })}
              />
            </FormField>
            <FormField label="Timeout (ms)">
              <input
                type="number"
                value={editing.timeoutMs ?? 60000}
                onChange={(e) => setEditing({ ...editing, timeoutMs: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Priority">
              <input
                type="number"
                value={editing.priority ?? 50}
                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
              />
            </FormField>
            <Toggle
              label="Enabled"
              checked={Boolean(editing.enabled)}
              onChange={(enabled) => setEditing({ ...editing, enabled })}
            />
          </div>
        )}
      </Modal>
      <Toast message={toast} />
    </div>
  );
}
