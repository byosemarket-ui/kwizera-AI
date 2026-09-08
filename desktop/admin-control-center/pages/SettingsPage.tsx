import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../admin-api";
import type { TypedSetting } from "../types";
import {
  ErrorState, FormField, LoadingState, PageHeader, SectionCard, Tabs, Toast, Toggle,
} from "../components/ui";

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI" },
  { id: "security", label: "Security" },
  { id: "storage", label: "Storage" },
  { id: "rendering", label: "Rendering" },
  { id: "audio", label: "Audio" },
  { id: "video", label: "Video" },
  { id: "performance", label: "Performance" },
  { id: "limits", label: "Limits" },
  { id: "notifications", label: "Notifications" },
];

export function SettingsPage() {
  const [items, setItems] = useState<TypedSetting[]>([]);
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi.settings()
      .then((result) => setItems(result.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category],
  );

  const save = async (key: string, value: TypedSetting["value"]) => {
    try {
      const saved = await adminApi.saveSetting(key, value);
      setItems((current) => current.map((item) => (item.key === key ? saved : item)));
      setToast("Setting saved");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="acc-page">
      <PageHeader
        title="Settings"
        description="Typed application settings for the Admin control plane. Billing logic is not implemented yet."
        breadcrumbs={[{ label: "Admin" }, { label: "System" }, { label: "Settings" }]}
      />
      <Tabs tabs={CATEGORIES} active={category} onChange={setCategory} />
      {loading && <LoadingState />}
      {error && <ErrorState title="Settings failed to load" detail={error} onRetry={load} />}
      {!loading && !error && (
        <SectionCard title={CATEGORIES.find((item) => item.id === category)?.label ?? category}>
          {visible.length === 0 ? (
            <p className="acc-muted">No settings in this category.</p>
          ) : (
            <div className="acc-form-stack">
              {visible.map((setting) => (
                <div key={setting.key} className="acc-setting-row">
                  <div>
                    <strong>{setting.label}</strong>
                    <p className="acc-muted">{setting.description}</p>
                    <code className="acc-muted">{setting.key}</code>
                  </div>
                  <div className="acc-setting-control">
                    {setting.valueType === "boolean" ? (
                      <Toggle
                        label={setting.value ? "Enabled" : "Disabled"}
                        checked={Boolean(setting.value)}
                        onChange={(checked) => void save(setting.key, checked)}
                      />
                    ) : setting.valueType === "number" ? (
                      <FormField label={setting.unit ? `Value (${setting.unit})` : "Value"}>
                        <input
                          type="number"
                          defaultValue={setting.value === null || setting.value === undefined ? "" : String(setting.value)}
                          min={setting.min}
                          max={setting.max}
                          onBlur={(event) => {
                            const raw = event.target.value;
                            void save(setting.key, raw === "" ? null : Number(raw));
                          }}
                        />
                      </FormField>
                    ) : (
                      <FormField label="Value">
                        <input
                          defaultValue={setting.value === null || setting.value === undefined ? "" : String(setting.value)}
                          onBlur={(event) => void save(setting.key, event.target.value)}
                        />
                      </FormField>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
      <Toast message={toast} />
    </div>
  );
}
