/**
 * Phase 05 — compact HFM MT5 buyer/seller pressure panel.
 * Scores are candle-structure proxies — not probability, not aggressor volume.
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchHfmBuyerSellerPressure,
  fetchHfmBuyerSellerPressureCapability,
} from "../api";

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v * 10) / 10);
  return String(v);
}

export function HfmBuyerSellerPressurePanel(props: {
  symbol: string;
}): JSX.Element {
  const symbol = String(props.symbol || "").trim().toUpperCase() || "XAUUSD";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Record<string, unknown> | null>(null);
  const [mtf, setMtf] = useState<Record<string, unknown> | null>(null);
  const [capability, setCapability] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cap, body] = await Promise.all([
        fetchHfmBuyerSellerPressureCapability(),
        fetchHfmBuyerSellerPressure({ symbol, timeframes: ["H1", "H4", "M15"] }),
      ]);
      setCapability(cap);
      if (body.ok === false && body.httpStatus && Number(body.httpStatus) >= 400) {
        setError(String((body.error as { message?: string } | undefined)?.message || "pressure_unavailable"));
      }
      setAssessment((body.assessment as Record<string, unknown>) ?? null);
      setMtf((body.multiTimeframe as Record<string, unknown>) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = assessment?.buyingPressureScore;
  const sell = assessment?.sellingPressureScore;

  return (
    <section
      className="hap-pressure"
      data-hfm-pressure-panel="true"
      data-not-probability="true"
      data-not-aggressor-volume="true"
      aria-label="HFM buyer seller pressure"
    >
      <header className="hap-pressure-head">
        <h3>Buyer / seller pressure</h3>
        <p className="hap-pressure-note">
          Candle-structure proxy — not win probability, not true aggressor volume.
        </p>
        <button type="button" disabled={loading} onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {error ? <p className="hap-pressure-error" data-error="true">{error}</p> : null}

      <dl className="hap-pressure-grid">
        <div>
          <dt>Classification</dt>
          <dd data-classification={String(assessment?.dataClassification || "n/a")}>
            {fmt(assessment?.dataClassification)}
          </dd>
        </div>
        <div>
          <dt>Buyer pressure (0–100)</dt>
          <dd>{fmt(buy)}</dd>
        </div>
        <div>
          <dt>Seller pressure (0–100)</dt>
          <dd>{fmt(sell)}</dd>
        </div>
        <div>
          <dt>Imbalance</dt>
          <dd>{fmt(assessment?.pressureImbalance)}</dd>
        </div>
        <div>
          <dt>Dominant side</dt>
          <dd>{fmt(assessment?.dominantSide)}</dd>
        </div>
        <div>
          <dt>Dominance strength</dt>
          <dd>{fmt(assessment?.dominanceStrength)}</dd>
        </div>
        <div>
          <dt>Trend</dt>
          <dd>{fmt(assessment?.pressureTrend)}</dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd>{fmt(assessment?.pressureChange)}</dd>
        </div>
        <div>
          <dt>Persistence</dt>
          <dd>{fmt(assessment?.persistence)}</dd>
        </div>
        <div>
          <dt>Absorption</dt>
          <dd>{fmt(assessment?.absorptionAssessment)}</dd>
        </div>
        <div>
          <dt>Exhaustion</dt>
          <dd>{fmt(assessment?.exhaustionAssessment)}</dd>
        </div>
        <div>
          <dt>Price vs pressure</dt>
          <dd>{fmt(assessment?.pricePressureRelationship)}</dd>
        </div>
        <div>
          <dt>Evidence quality</dt>
          <dd>{fmt(assessment?.evidenceQuality)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{fmt(assessment?.assessmentTimestamp)}</dd>
        </div>
      </dl>

      {mtf ? (
        <div className="hap-pressure-mtf" data-mtf="true">
          <strong>Timeframes</strong>
          <span> alignment={fmt(mtf.alignment)}</span>
          <ul>
            {Array.isArray(mtf.frames)
              ? (mtf.frames as Array<Record<string, unknown>>).map((f) => (
                  <li key={String(f.timeframe)}>
                    {fmt(f.timeframe)} · {fmt(f.dominantSide)} · imb={fmt(f.pressureImbalance)}
                    {f.stale ? " · STALE" : ""}
                    {!f.available ? " · UNAVAILABLE" : ""}
                  </li>
                ))
              : null}
          </ul>
          <p className="hap-pressure-note">Conflicting frames are not averaged.</p>
        </div>
      ) : null}

      <details className="hap-pressure-limits">
        <summary>Data limitations</summary>
        <ul>
          <li>Aggressor side: {fmt(capability?.aggressorSideAvailable ?? false)}</li>
          <li>Order book: {fmt(capability?.orderBookAvailable ?? false)}</li>
          {(Array.isArray(assessment?.limitations) ? assessment!.limitations as string[] : []).map((l) => (
            <li key={l}>{l}</li>
          ))}
          {(Array.isArray(assessment?.missingInputs) ? assessment!.missingInputs as string[] : []).map((m) => (
            <li key={m}>missing: {m}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
