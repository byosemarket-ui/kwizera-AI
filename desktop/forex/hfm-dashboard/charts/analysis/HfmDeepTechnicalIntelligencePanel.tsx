/**
 * Phase 06 — compact HFM MT5 deep technical intelligence panel.
 * Confluence / alignment are analytical — not win probability.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchHfmDeepTechnicalIntelligence,
  fetchHfmDeepTechnicalIntelligenceCapability,
} from "../api";

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v * 1000) / 1000);
  return String(v);
}

export function HfmDeepTechnicalIntelligencePanel(props: {
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
      const [cap, body] = await Promise.all([
        fetchHfmDeepTechnicalIntelligenceCapability(),
        fetchHfmDeepTechnicalIntelligence({
          symbol,
          timeframes: ["H4", "H1", "M15"],
          primaryTimeframe: "H1",
        }),
      ]);
      setCapability(cap);
      if (body.ok === false && body.httpStatus && Number(body.httpStatus) >= 400) {
        setError(
          String((body.error as { message?: string } | undefined)?.message || "deep_technical_unavailable"),
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

  const mtf = (assessment?.mtf as Record<string, unknown> | undefined) ?? null;
  const confluence = (assessment?.confluence as Record<string, unknown> | undefined) ?? null;
  const primary = (assessment?.primarySnapshot as Record<string, unknown> | undefined) ?? null;
  const frames = (assessment?.timeframeSnapshots as Record<string, unknown>[] | undefined) ?? [];

  return (
    <section
      className="hap-dti"
      data-hfm-deep-technical-panel="true"
      data-not-probability="true"
      aria-label="HFM deep technical intelligence"
    >
      <header className="hap-dti-head">
        <h3>Deep technical intelligence</h3>
        <p className="hap-dti-note">
          Orchestrated structure / regime / MTF / patterns / pressure — not win probability.
        </p>
        <button type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {error ? <p className="hap-dti-error" data-error="true">{error}</p> : null}

      <dl className="hap-dti-grid">
        <div>
          <dt>Trend / regime</dt>
          <dd>{fmt(assessment?.overallRegimeLabel)}</dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>{fmt(assessment?.overallTrendDirection)}</dd>
        </div>
        <div>
          <dt>Strength</dt>
          <dd>{fmt(assessment?.overallTrendStrength)}</dd>
        </div>
        <div>
          <dt>Structure bias</dt>
          <dd>{fmt(primary?.structureBias)}</dd>
        </div>
        <div>
          <dt>MTF alignment</dt>
          <dd>{fmt(mtf?.alignment)}</dd>
        </div>
        <div>
          <dt>HTF bias</dt>
          <dd>{fmt(mtf?.higherTimeframeBias)}</dd>
        </div>
        <div>
          <dt>LTF bias</dt>
          <dd>{fmt(mtf?.lowerTimeframeBias)}</dd>
        </div>
        <div>
          <dt>Confluence</dt>
          <dd data-not-probability="true">{fmt(confluence?.grade)}</dd>
        </div>
        <div>
          <dt>Confluence score</dt>
          <dd data-not-probability="true">{fmt(confluence?.directionalScore)}</dd>
        </div>
        <div>
          <dt>Evidence quality</dt>
          <dd>{fmt(assessment?.evidenceQuality)}</dd>
        </div>
        <div>
          <dt>Candle status</dt>
          <dd>{fmt(primary?.candleStatus)}</dd>
        </div>
        <div>
          <dt>Pressure (Phase 05)</dt>
          <dd>
            {fmt(primary?.pressureDominantSide)} ({fmt(primary?.pressureDataClassification)})
          </dd>
        </div>
        <div>
          <dt>Elliott Wave</dt>
          <dd>{fmt(assessment?.elliottWaveStatus)}</dd>
        </div>
        <div>
          <dt>MACD/ADX/BB</dt>
          <dd>{fmt(assessment?.macdAdxBollingerStatus)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{fmt(assessment?.assessmentTimestamp)}</dd>
        </div>
      </dl>

      {frames.length ? (
        <div className="hap-dti-frames" data-mtf-frames="true">
          <h4>Timeframes</h4>
          <ul>
            {frames.map((f) => (
              <li key={String(f.timeframe)}>
                <strong>{fmt(f.timeframe)}</strong>
                {" — "}
                {fmt(f.regimeLabel)} / {fmt(f.trendDirection)} / candle={fmt(f.candleStatus)}
                {f.available === false ? " (unavailable)" : ""}
                {f.stale === true ? " (stale)" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(assessment?.supportingEvidence) && (assessment!.supportingEvidence as string[]).length ? (
        <details className="hap-dti-evidence">
          <summary>Supporting evidence</summary>
          <ul>
            {(assessment!.supportingEvidence as string[]).slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {Array.isArray(assessment?.contradictingEvidence) && (assessment!.contradictingEvidence as string[]).length ? (
        <details className="hap-dti-evidence">
          <summary>Conflicting / skipped</summary>
          <ul>
            {(assessment!.contradictingEvidence as string[]).slice(0, 12).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {Array.isArray(assessment?.limitations) ? (
        <details className="hap-dti-limits">
          <summary>Limitations</summary>
          <ul>
            {(assessment!.limitations as string[]).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {capability ? (
        <p className="hap-dti-cap" data-capability="true">
          Capability: Elliott={fmt(capability.elliottWave)}; MACD/ADX/BB={fmt(capability.macdAdxBollinger)};
          S/D zones={fmt(capability.supplyDemandZones)}
        </p>
      ) : null}
    </section>
  );
}
