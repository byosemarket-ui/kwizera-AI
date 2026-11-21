import type { ParsedLevel } from "./parse-hfm-analysis-result";

export function HfmAnalyticalLevels(props: {
  levels: ParsedLevel[];
  riskReward: number | null;
  showOverlays: boolean;
  onToggleOverlays: (next: boolean) => void;
}) {
  return (
    <article className="hap-card" data-card="levels" data-analytical-levels="true">
      <header className="hap-scenario-head">
        <h3>Analytical Levels</h3>
        <label className="hap-toggle">
          <input
            type="checkbox"
            checked={props.showOverlays}
            onChange={(e) => props.onToggleOverlays(e.target.checked)}
            data-analytical-levels-toggle="true"
          />
          Show analytical levels
        </label>
      </header>
      <p className="hap-empty">
        Source-backed only · overlays default OFF · never invents prices
      </p>
      {props.levels.length ? (
        <dl className="hap-kv">
          {props.levels.map((lvl) => (
            <div key={`${lvl.label}-${lvl.price}`}>
              <dt>{lvl.label}</dt>
              <dd>
                {lvl.low != null && lvl.high != null && lvl.low !== lvl.high
                  ? `${lvl.low} – ${lvl.high}`
                  : String(lvl.price ?? "—")}
              </dd>
            </div>
          ))}
          <div>
            <dt>Risk/reward</dt>
            <dd>
              {props.riskReward != null && Number.isFinite(props.riskReward)
                ? props.riskReward.toFixed(2)
                : "Not calculable"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="hap-empty">No source-backed analytical levels are available.</p>
      )}
    </article>
  );
}
