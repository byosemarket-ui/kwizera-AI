import type {
  HfmMwCatalogSummary,
  HfmMwLoadState,
  HfmMwMovementSummary,
  HfmMwTradingSessionSummary,
} from "../types";
import { HfmOverviewCard } from "./HfmOverviewCard";

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function HfmMarketOverview({
  load,
  catalog,
  movement,
  session,
}: {
  load: HfmMwLoadState;
  catalog: HfmMwCatalogSummary | null;
  movement: HfmMwMovementSummary;
  session: HfmMwTradingSessionSummary;
}) {
  const catalogLoading = load.catalog === "loading" || load.catalog === "idle";
  const catalogError = load.catalog === "error" || load.catalog === "auth_required";

  const totalAvailability =
    catalogLoading ? "loading" : catalogError || !catalog?.available ? "unavailable" : "available";
  const totalValue =
    catalogLoading
      ? "Loading…"
      : catalogError
        ? "Unavailable"
        : catalog?.available && catalog.totalInstruments != null
          ? formatCount(catalog.totalInstruments)
          : "Unavailable";

  const moveValue = (n: number | null) => {
    if (movement.availability === "loading") return "Loading…";
    if (movement.availability !== "available" || n == null) return "Unavailable";
    return formatCount(n);
  };

  const sessionValue =
    session.availability === "loading"
      ? "Loading…"
      : session.availability === "available" && session.name
        ? `${session.name}${session.status ? ` (${session.status})` : ""}`
        : "Unavailable";

  return (
    <section className="hfm-mw-overview" aria-label="Market overview">
      <HfmOverviewCard
        label="Total Instruments"
        value={totalValue}
        availability={totalAvailability}
        tone="purple"
        icon="▣"
        hint={catalog?.catalogVersion ? `Catalog ${catalog.catalogVersion}` : null}
      />
      <HfmOverviewCard
        label="Rising"
        value={moveValue(movement.rising)}
        availability={movement.availability}
        tone="green"
        icon="▲"
        hint={movement.availability === "unavailable" ? "No daily baseline" : null}
      />
      <HfmOverviewCard
        label="Falling"
        value={moveValue(movement.falling)}
        availability={movement.availability}
        tone="red"
        icon="▼"
        hint={movement.availability === "unavailable" ? "No daily baseline" : null}
      />
      <HfmOverviewCard
        label="Unchanged"
        value={moveValue(movement.unchanged)}
        availability={movement.availability}
        tone="blue"
        icon="▬"
        hint={movement.availability === "unavailable" ? "No daily baseline" : null}
      />
      <HfmOverviewCard
        label="Trading Session"
        value={sessionValue}
        availability={session.availability}
        tone="amber"
        icon="◷"
        hint={session.availability === "unavailable" ? "Session API unavailable" : session.timeZone}
      />
    </section>
  );
}
