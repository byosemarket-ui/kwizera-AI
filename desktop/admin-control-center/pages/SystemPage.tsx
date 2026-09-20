import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import { ErrorState, LoadingState, PageHeader, SectionCard, StatCard, ComingSoon } from "../components/ui";

export function SystemPage({ onOpenStudioHealth }: { onOpenStudioHealth?: () => void }) {
  const [health, setHealth] = useState<{
    ok?: boolean;
    initialized?: boolean;
    providers?: number;
    models?: number;
    features?: number;
    settings?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi.health()
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="acc-page">
      <PageHeader
        title="System"
        description="Admin system entry point. Deep operational diagnostics remain in Studio System Health."
        breadcrumbs={[{ label: "Admin" }, { label: "System" }]}
      />
      {loading && <LoadingState />}
      {error && <ErrorState title="Control plane health failed to load" detail={error} onRetry={load} />}
      {!loading && !error && health && (
        <SectionCard
          title="Control plane"
          description="Live Admin Control Plane registry counts. Studio System Health remains the diagnostics workspace."
          actions={
            onOpenStudioHealth ? (
              <button type="button" className="acc-button" onClick={onOpenStudioHealth}>
                Open System Health
              </button>
            ) : null
          }
        >
          <div className="acc-stat-grid">
            <StatCard label="Initialized" value={health.initialized ? "Yes" : "No"} />
            <StatCard label="Providers" value={health.providers ?? "Not available yet"} />
            <StatCard label="Models" value={health.models ?? "Not available yet"} />
            <StatCard label="Features" value={health.features ?? "Not available yet"} />
            <StatCard label="Settings" value={health.settings ?? "Not available yet"} />
          </div>
        </SectionCard>
      )}
      <ComingSoon title="Extended system panels" />
    </div>
  );
}
