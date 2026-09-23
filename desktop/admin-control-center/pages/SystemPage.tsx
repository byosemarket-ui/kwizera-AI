import { useEffect, useState } from "react";
import { adminApi } from "../admin-api";
import { adminAuthErrorMessage, isAdminAuthError } from "../admin-auth";
import {
  AuthLockedState, ComingSoon, ErrorState, LoadingState, PageHeader, SectionCard, StatCard,
} from "../components/ui";

export function SystemPage({
  onOpenStudioHealth,
  onGoToApiAccess,
}: {
  onOpenStudioHealth?: () => void;
  onGoToApiAccess?: () => void;
}) {
  const [health, setHealth] = useState<{
    ok?: boolean;
    initialized?: boolean;
    providers?: number;
    models?: number;
    features?: number;
    settings?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authLocked, setAuthLocked] = useState(false);
  const [authDetail, setAuthDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    setAuthLocked(false);
    adminApi.health()
      .then(setHealth)
      .catch((err: unknown) => {
        if (isAdminAuthError(err)) {
          setAuthLocked(true);
          setAuthDetail(adminAuthErrorMessage(err));
          setHealth(null);
          return;
        }
        setError(err instanceof Error ? err.message : "System health failed");
      })
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
      {authLocked && !loading && (
        <AuthLockedState detail={authDetail ?? undefined} onGoToApiAccess={onGoToApiAccess} />
      )}
      {error && !authLocked && <ErrorState title="Control plane health failed to load" detail={error} onRetry={load} />}
      {!loading && !error && !authLocked && health && (
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
      {!authLocked && <ComingSoon title="Extended system panels" />}
    </div>
  );
}
