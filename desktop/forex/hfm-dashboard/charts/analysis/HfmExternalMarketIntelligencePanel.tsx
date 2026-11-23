/**
 * Phase 07 — compact HFM external market & fundamental intelligence panel.
 * Event risk / alignment are analytical — not win probability.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchHfmExternalMarketIntelligence,
  fetchHfmExternalMarketIntelligenceCapability,
} from "../api";

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v * 1000) / 1000);
  return String(v);
}

/** Deterministic fixture for UI when live calendar gates are off. */
function defaultFixtureEvents() {
  const ts = Math.floor(Date.now() / 1000) + 3600;
  return [
    {
      ts,
      time: new Date(ts * 1000).toISOString(),
      currency: "USD",
      impact: "high",
      title: "Fixture CPI MoM (not live)",
      forecast: "0.3%",
      previous: "0.2%",
      actual: "",
      id: `fixture-usd-cpi.${ts}`,
      status: "scheduled",
      moved_from: "",
      period: "fixture",
      confidence: "single_source",
    },
  ];
}

export function HfmExternalMarketIntelligencePanel(props: {
  symbol: string;
}): JSX.Element {
  const symbol = String(props.symbol || "").trim().toUpperCase() || "XAUUSD";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Record<string, unknown> | null>(null);
  const [capability, setCapability] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cap = await fetchHfmExternalMarketIntelligenceCapability();
      setCapability(cap);
      const live = cap.liveCalendarAllowed === true;
      const body = await fetchHfmExternalMarketIntelligence({
        symbol,
        ...(live ? {} : { fixtureEvents: defaultFixtureEvents() }),
      });
      if (body.ok === false && body.httpStatus && Number(body.httpStatus) >= 400) {
        setError(
          String((body.error as { message?: string } | undefined)?.message || "external_market_unavailable"),
        );
      }
      setAssessment((body.assessment as Record<string, unknown>) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const risk = (assessment?.eventRisk as Record<string, unknown> | undefined) ?? null;
  const events = (assessment?.relevantEvents as Record<string, unknown>[] | undefined) ?? [];

  return (
    <section
      className="hap-emi"
      data-hfm-external-market-panel="true"
      data-not-probability="true"
      aria-label="HFM external market intelligence"
    >
      <header className="hap-emi-head">
        <h3>External market &amp; fundamentals</h3>
        <p className="hap-emi-note">
          Calendar event risk + technical/fundamental context — not win probability; news/CB feeds not implemented.
        </p>
        <button type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {error ? <p className="hap-emi-error" data-error="true">{error}</p> : null}

      <dl className="hap-emi-grid">
        <div>
          <dt>Data mode</dt>
          <dd>{fmt(assessment?.dataSourceMode)}</dd>
        </div>
        <div>
          <dt>Calendar gate</dt>
          <dd>{fmt(capability?.calendarGate)}</dd>
        </div>
        <div>
          <dt>Event risk</dt>
          <dd data-not-volatility-guarantee="true">{fmt(risk?.riskClass)}</dd>
        </div>
        <div>
          <dt>Nearest event</dt>
          <dd>{fmt(risk?.nearestEventTitle)}</dd>
        </div>
        <div>
          <dt>Scheduled</dt>
          <dd>{fmt(risk?.nearestScheduledAtUtc)}</dd>
        </div>
        <div>
          <dt>Tech/fund alignment</dt>
          <dd>{fmt(assessment?.technicalFundamentalAlignment)}</dd>
        </div>
        <div>
          <dt>Technical bias</dt>
          <dd>{fmt(assessment?.technicalBias)}</dd>
        </div>
        <div>
          <dt>Fundamental bias</dt>
          <dd>{fmt(assessment?.fundamentalBias)}</dd>
        </div>
        <div>
          <dt>News feed</dt>
          <dd>{fmt(assessment?.financialNewsStatus ?? capability?.financialNews)}</dd>
        </div>
        <div>
          <dt>Central bank feed</dt>
          <dd>{fmt(assessment?.centralBankLiveFeedStatus ?? capability?.centralBankLiveFeed)}</dd>
        </div>
        <div>
          <dt>Ingestion worker</dt>
          <dd>{fmt(capability?.continuousIngestionWorker)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{fmt(assessment?.assessmentTimestamp)}</dd>
        </div>
      </dl>

      {events.length ? (
        <div className="hap-emi-events">
          <h4>Relevant events</h4>
          <ul>
            {events.slice(0, 8).map((e) => (
              <li key={String(e.eventId)}>
                <strong>{fmt(e.currency)}</strong> {fmt(e.title)} — {fmt(e.status)} @ {fmt(e.scheduledAtUtc)}
                {" · "}F={fmt(e.forecast)} A={fmt(e.actual)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(assessment?.limitations) ? (
        <details className="hap-emi-limits">
          <summary>Limitations</summary>
          <ul>
            {(assessment!.limitations as string[]).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
