import { ForexSectionHeader } from "./components/ForexSectionHeader";
import { ForexStatusBadge } from "./components/ForexStatusBadge";

export function ForexNotFound({ onBackToDashboard }: { onBackToDashboard: () => void }) {
  return (
    <section className="fx-placeholder fx-not-found" data-forex-page="not-found" aria-labelledby="fx-not-found-title">
      <ForexSectionHeader
        eyebrow="Forex"
        title="Page not found"
        description="This Forex page does not exist. Return to the dashboard to continue."
      />
      <h2 id="fx-not-found-title" className="fx-sr-only">Page not found</h2>
      <div className="fx-placeholder-panel">
        <ForexStatusBadge tone="offline">Unknown route</ForexStatusBadge>
        <p>The Forex shell loaded, but this path is not a known module.</p>
        <button type="button" className="fx-studio-link" onClick={onBackToDashboard}>
          Back to Forex Dashboard
        </button>
      </div>
    </section>
  );
}
