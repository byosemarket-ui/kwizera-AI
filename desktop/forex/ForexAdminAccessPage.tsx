/**
 * Phase 60.0.15 — Dedicated Forex Admin Access destination.
 * Hosts the shared token card; does not enable trading or mutations.
 */
import { useMemo } from "react";
import { ForexAdminAccessCard } from "./admin-access/ForexAdminAccessCard";
import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { isForexUrl } from "./forex-routes";

function safeReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw || !raw.startsWith("/forex") || raw.startsWith("//")) return null;
  if (!isForexUrl(raw.split("?")[0] ?? raw)) return null;
  if (raw.startsWith("/forex/admin-access")) return null;
  return raw;
}

export function ForexAdminAccessPage() {
  const returnTo = useMemo(() => safeReturnTo(), []);

  return (
    <section
      className="fx-admin-access-page"
      data-forex-page="admin-access"
      data-places-orders="false"
      data-accepts-for-execution="false"
      aria-labelledby="fx-admin-access-page-title"
    >
      <ForexSectionHeader
        eyebrow="Security"
        title="Admin Access"
        description="Manage access to protected Forex tools from one place."
      />
      <h2 id="fx-admin-access-page-title" className="fx-sr-only">
        Admin Access
      </h2>
      {returnTo ? (
        <p className="fx-admin-access-return">
          <a className="fx-text-button" href={returnTo}>
            Return to previous module
          </a>
        </p>
      ) : null}
      <ForexAdminAccessCard />
    </section>
  );
}
