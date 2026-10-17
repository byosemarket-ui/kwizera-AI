/**
 * Phase 50A.1 — Compact BUY price-projection panel + SVG scenario chart.
 */

export type BuyPriceProjectionUi = {
  available: boolean;
  unavailableReason: string | null;
  method: string;
  title: string;
  instrument: string;
  provider: string;
  timeframe: string;
  reference: {
    price: number | null;
    source: string | null;
    timestampUtc: string | null;
  };
  directionalConfidencePercent: number | null;
  directionalConfidenceLabel: string;
  target: {
    kind: "price" | "zone";
    price: number | null;
    zoneLow: number | null;
    zoneHigh: number | null;
    provenance: string;
  } | null;
  projectedMovement: { absolute: number; percent: number } | null;
  forecastHorizon: string | null;
  supportingEvidence: string[];
  invalidation: { price: number | null; condition: string | null } | null;
  dataStatus: string;
  dataQuality: string;
  limitations: string[];
  disclaimer: string;
  targetProbabilityNote: string;
  chart: {
    timeframe: string;
    historical: Array<{ t: number; o: number; h: number; l: number; c: number }>;
    projected: Array<{ t: number; price: number }> | null;
    targetLine: number | null;
    targetZone: { low: number; high: number } | null;
    invalidationLine: number | null;
    boundaryIndex: number;
    legend: {
      historical: string;
      projected: string;
      target: string;
      invalidation: string;
    };
    disclaimer: string;
  } | null;
};

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function ProjectionChart({ chart }: { chart: NonNullable<BuyPriceProjectionUi["chart"]> }) {
  const W = 640;
  const H = 220;
  const padL = 48;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const hist = chart.historical;
  const proj = chart.projected ?? [];
  if (!hist.length) return null;

  const allPrices: number[] = [];
  for (const c of hist) {
    allPrices.push(c.l, c.h);
  }
  for (const p of proj) allPrices.push(p.price);
  if (chart.targetLine != null) allPrices.push(chart.targetLine);
  if (chart.targetZone) {
    allPrices.push(chart.targetZone.low, chart.targetZone.high);
  }
  if (chart.invalidationLine != null) allPrices.push(chart.invalidationLine);

  const minP = Math.min(...allPrices);
  const maxP = Math.max(...allPrices);
  const span = Math.max(maxP - minP, minP * 0.001, 1e-6);
  const minY = minP - span * 0.06;
  const maxY = maxP + span * 0.06;

  const times = [
    ...hist.map((c) => c.t),
    ...proj.map((p) => p.t),
  ];
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const tSpan = Math.max(maxT - minT, 1);

  const xAt = (t: number) => padL + ((t - minT) / tSpan) * (W - padL - padR);
  const yAt = (p: number) => padT + (1 - (p - minY) / (maxY - minY)) * (H - padT - padB);

  const boundaryT = hist[chart.boundaryIndex]?.t ?? hist[hist.length - 1]!.t;
  const boundaryX = xAt(boundaryT);
  const candleW = Math.max(2, Math.min(8, ((W - padL - padR) / Math.max(hist.length + proj.length, 1)) * 0.55));

  const projPath = proj.length
    ? proj.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.t).toFixed(1)} ${yAt(p.price).toFixed(1)}`).join(" ")
    : "";

  return (
    <div className="fx-buy-proj-chart-wrap" data-fx-buy-projection-chart="true">
      <svg
        className="fx-buy-proj-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Price projection chart ${chart.timeframe}`}
      >
        <line
          x1={boundaryX}
          y1={padT}
          x2={boundaryX}
          y2={H - padB}
          className="fx-buy-proj-boundary"
        />
        <text x={boundaryX + 4} y={padT + 10} className="fx-buy-proj-boundary-label">
          scenario →
        </text>

        {chart.targetZone ? (
          <rect
            x={padL}
            y={yAt(chart.targetZone.high)}
            width={W - padL - padR}
            height={Math.max(1, yAt(chart.targetZone.low) - yAt(chart.targetZone.high))}
            className="fx-buy-proj-zone"
          />
        ) : null}

        {chart.targetLine != null ? (
          <line
            x1={padL}
            y1={yAt(chart.targetLine)}
            x2={W - padR}
            y2={yAt(chart.targetLine)}
            className="fx-buy-proj-target"
          />
        ) : null}

        {chart.invalidationLine != null ? (
          <line
            x1={padL}
            y1={yAt(chart.invalidationLine)}
            x2={W - padR}
            y2={yAt(chart.invalidationLine)}
            className="fx-buy-proj-invalidation"
          />
        ) : null}

        {hist.map((c) => {
          const x = xAt(c.t);
          const up = c.c >= c.o;
          return (
            <g key={`h-${c.t}`} data-fx-hist-candle={c.t}>
              <line
                x1={x}
                y1={yAt(c.h)}
                x2={x}
                y2={yAt(c.l)}
                className={up ? "fx-buy-proj-wick up" : "fx-buy-proj-wick down"}
              />
              <rect
                x={x - candleW / 2}
                y={yAt(Math.max(c.o, c.c))}
                width={candleW}
                height={Math.max(1, Math.abs(yAt(c.o) - yAt(c.c)))}
                className={up ? "fx-buy-proj-body up" : "fx-buy-proj-body down"}
              />
            </g>
          );
        })}

        {projPath ? (
          <path d={projPath} className="fx-buy-proj-path" fill="none" data-fx-projected-path="true" />
        ) : null}

        <text x={padL} y={H - 8} className="fx-buy-proj-axis">
          {chart.timeframe} · actual left of boundary · scenario right
        </text>
        <text x={4} y={yAt(maxY) + 4} className="fx-buy-proj-axis">{fmtPrice(maxY)}</text>
        <text x={4} y={yAt(minY)} className="fx-buy-proj-axis">{fmtPrice(minY)}</text>
      </svg>
      <ul className="fx-buy-proj-legend" aria-label="Chart legend">
        <li><span className="fx-buy-proj-swatch hist" /> {chart.legend.historical}</li>
        <li><span className="fx-buy-proj-swatch proj" /> {chart.legend.projected}</li>
        <li><span className="fx-buy-proj-swatch tgt" /> {chart.legend.target}</li>
        <li><span className="fx-buy-proj-swatch inv" /> {chart.legend.invalidation}</li>
      </ul>
      <p className="fx-ai-muted fx-buy-proj-disclaimer">{chart.disclaimer}</p>
    </div>
  );
}

export function BuyPriceProjectionPanel({
  projection,
}: {
  projection: BuyPriceProjectionUi;
}) {
  return (
    <section
      className="fx-buy-projection"
      data-fx-buy-projection="true"
      data-available={projection.available ? "true" : "false"}
      aria-label={projection.title}
    >
      <h3 className="fx-ai-guided-title">{projection.title}</h3>
      <p className="fx-ai-muted">
        {projection.instrument} · {projection.provider} · TF {projection.timeframe}
        {" · "}method {projection.method}
        {" · "}data {projection.dataStatus}
      </p>

      <dl className="fx-capture-meta-grid fx-buy-proj-meta">
        <div>
          <dt>Directional confidence</dt>
          <dd>
            {projection.directionalConfidencePercent != null
              ? `${projection.directionalConfidencePercent}%`
              : "—"}
            <span className="fx-ai-muted"> ({projection.directionalConfidenceLabel})</span>
          </dd>
        </div>
        <div>
          <dt>Reference price</dt>
          <dd>
            {fmtPrice(projection.reference.price)}
            {projection.reference.source ? (
              <span className="fx-ai-muted"> · {projection.reference.source}</span>
            ) : null}
            {projection.reference.timestampUtc ? (
              <span className="fx-ai-muted"> · {projection.reference.timestampUtc}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Potential target</dt>
          <dd>
            {projection.available && projection.target
              ? projection.target.kind === "zone"
                && projection.target.zoneLow != null
                && projection.target.zoneHigh != null
                ? `${fmtPrice(projection.target.zoneLow)} – ${fmtPrice(projection.target.zoneHigh)}`
                : fmtPrice(projection.target.price)
              : "unavailable"}
          </dd>
        </div>
        <div>
          <dt>Projected movement</dt>
          <dd>
            {projection.projectedMovement
              ? `+${fmtPrice(projection.projectedMovement.absolute)} (${projection.projectedMovement.percent.toFixed(2)}%)`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Forecast horizon</dt>
          <dd>{projection.forecastHorizon ?? "—"}</dd>
        </div>
        <div>
          <dt>Invalidation</dt>
          <dd>
            {projection.invalidation?.price != null
              ? fmtPrice(projection.invalidation.price)
              : "—"}
            {projection.invalidation?.condition ? (
              <span className="fx-ai-muted"> · {projection.invalidation.condition}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {!projection.available ? (
        <p className="fx-ai-snapshot-warn" data-fx-buy-projection-unavailable="true">
          {projection.unavailableReason ?? "Projection unavailable."}
        </p>
      ) : null}

      {projection.supportingEvidence.length > 0 ? (
        <ul className="fx-ai-local-list">
          {projection.supportingEvidence.map((e, i) => (
            <li key={`pe-${i}`}>{e}</li>
          ))}
        </ul>
      ) : null}

      <p className="fx-ai-muted">{projection.targetProbabilityNote}</p>

      {projection.limitations.length > 0 ? (
        <p className="fx-ai-muted">
          Limitations: {projection.limitations.join(" · ")}
        </p>
      ) : null}

      {projection.chart ? <ProjectionChart chart={projection.chart} /> : (
        <p className="fx-ai-muted">No structured candle series available for a projection chart.</p>
      )}
    </section>
  );
}
