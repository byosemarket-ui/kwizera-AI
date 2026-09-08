import { PageHeader, SectionCard, ComingSoon } from "../components/ui";

export function SystemPage({ onOpenStudioHealth }: { onOpenStudioHealth?: () => void }) {
  return (
    <div className="acc-page">
      <PageHeader
        title="System"
        description="Admin system entry point. Deep operational diagnostics remain in Studio System Health."
        breadcrumbs={[{ label: "Admin" }, { label: "System" }]}
      />
      <SectionCard
        title="Operational diagnostics"
        description="Preserve the existing System Health workspace — do not duplicate it."
        actions={
          onOpenStudioHealth ? (
            <button type="button" className="acc-button" onClick={onOpenStudioHealth}>
              Open System Health
            </button>
          ) : null
        }
      >
        <p className="acc-muted">
          Use System Health for services, repair, updates, diagnostics, and certification.
          Future Admin system panels (logs, storage, database) will attach here without replacing that surface.
        </p>
      </SectionCard>
      <ComingSoon title="Extended system panels" />
    </div>
  );
}
