import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import type { AdminDashboardSnapshot } from "../types";
import { ErrorState, LoadingState, PageHeader, SectionCard, StatCard, StatusBadge } from "../components/ui";

function display(value: string | number | undefined): string {
  if (value === undefined || value === null || value === "") return "Not available yet";
  return String(value);
}

export function DashboardPage() {
  const [data, setData] = useState<AdminDashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    adminApi.dashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="acc-page">
      <PageHeader
        title="Admin Dashboard"
        description="Control-plane overview. Metrics show real values only — otherwise “Not available yet”."
        breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]}
      />
      {loading && <LoadingState />}
      {error && <ErrorState title="Dashboard failed to load" detail={error} onRetry={load} />}
      {data && !loading && !error && (
        <>
          <SectionCard title="System Overview" description="Live operational signals">
            <div className="acc-stat-grid">
              <StatCard label="System" value={display(data.system.systemStatus)} />
              <StatCard label="AI Core" value={display(data.system.aiStatus)} />
              <StatCard label="Providers" value={display(data.system.providerStatus)} />
              <StatCard label="Database" value={display(data.system.databaseStatus)} />
              <StatCard label="Storage" value={display(data.system.storageStatus)} />
              <StatCard label="Queue" value={display(data.system.queueStatus)} />
            </div>
          </SectionCard>

          <SectionCard title="Business Overview" description="Customer and generation totals">
            <div className="acc-stat-grid">
              <StatCard label="Customers" value={display(data.business.totalCustomers)} />
              <StatCard label="Projects" value={display(data.business.totalProjects)} />
              <StatCard label="Videos" value={display(data.business.generatedVideos)} />
              <StatCard label="Images" value={display(data.business.generatedImages)} />
              <StatCard label="Audio" value={display(data.business.generatedAudio)} />
              <StatCard label="Usage events" value={display(data.business.usage)} />
            </div>
          </SectionCard>

          <SectionCard title="AI Overview" description="Registry-backed model and provider state">
            <div className="acc-stat-grid">
              <StatCard label="Active models" value={data.ai.activeModels} />
              <StatCard label="Active providers" value={data.ai.activeProviders} />
              <StatCard label="Recent operations" value={display(data.ai.recentOperations)} />
              <StatCard label="Failures" value={display(data.ai.failures)} />
              <StatCard label="Latency" value={display(data.ai.latency)} />
            </div>
            <div className="acc-default-models">
              {data.ai.defaultModels.length === 0 ? (
                <p className="acc-muted">No enabled feature defaults configured.</p>
              ) : (
                data.ai.defaultModels.map((item) => (
                  <div key={item.feature} className="acc-default-model-row">
                    <code>{item.feature}</code>
                    <StatusBadge status={item.modelName ?? "Not mapped"} />
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Cost Overview" description="Billing metrics reserved for a later stage">
            <div className="acc-stat-grid">
              <StatCard label="Today" value={display(data.cost.today)} />
              <StatCard label="Period" value={display(data.cost.period)} />
              <StatCard label="Estimated" value={display(data.cost.estimated)} />
              <StatCard label="Provider usage" value={display(data.cost.providerUsage)} />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
