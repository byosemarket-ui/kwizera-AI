import { extractScenarioLevels } from "./parse-hfm-analysis-result";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "—";
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "")).filter(Boolean);
}

function ScenarioCard(props: {
  title: string;
  scenario: Record<string, unknown> | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const s = props.scenario;
  const levels = extractScenarioLevels(s);
  const rr = s && typeof s.levels === "object" && s.levels
    ? (s.levels as { riskReward?: number | null }).riskReward
    : null;

  return (
    <article
      className="hap-card hap-scenario-card"
      data-side={props.title.toLowerCase()}
      data-selected={props.selected ? "true" : "false"}
    >
      <header className="hap-scenario-head">
        <h3>{props.title}</h3>
        <button type="button" className="hap-btn" onClick={props.onSelect} disabled={!s}>
          {props.selected ? "Highlighted" : "Highlight levels"}
        </button>
      </header>
      {!s ? (
        <p className="hap-empty">Scenario package not available</p>
      ) : (
        <>
          <dl className="hap-kv">
            <div><dt>Status</dt><dd>{str(s.status)}</dd></div>
            <div><dt>Lifecycle</dt><dd>{str(s.lifecycleState)}</dd></div>
            <div><dt>Scenario ID</dt><dd className="hap-mono">{str(s.scenarioId)}</dd></div>
            <div><dt>Fingerprint</dt><dd className="hap-mono">{str(s.setupFingerprint).slice(0, 16)}…</dd></div>
          </dl>
          <p className="hap-insight">{str(s.thesis)}</p>
          <p className="hap-empty">Supporting: {strArr(s.supportingEvidenceIds).join(", ") || "—"}</p>
          <p className="hap-empty">Conflicting: {strArr(s.conflictingEvidenceIds).join(", ") || "—"}</p>
          <p className="hap-empty">Missing: {strArr(s.missingConfirmations).join(", ") || "—"}</p>
          <p className="hap-empty">Invalidation: {strArr(s.invalidationConditions).join(", ") || "—"}</p>
          {levels.length ? (
            <ul className="hap-checklist">
              {levels.map((lv) => (
                <li key={`${lv.label}-${lv.price}`}>
                  <span>{lv.label}: {lv.price}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hap-empty">No source-backed analytical levels are available.</p>
          )}
          <p className="hap-empty">
            Risk/reward: {typeof rr === "number" && Number.isFinite(rr) ? rr.toFixed(2) : "Not calculable"}
          </p>
        </>
      )}
    </article>
  );
}

export function HfmScenarioCompare(props: {
  scenarioPackage: Record<string, unknown> | null;
  outcome: string | null;
  selectedScenarioId: string | null;
  onSelectScenario: (scenarioId: string | null) => void;
}) {
  const bullish = asRecord(props.scenarioPackage?.bullishScenario);
  const bearish = asRecord(props.scenarioPackage?.bearishScenario);
  const outcome = props.outcome ?? str(props.scenarioPackage?.outcome);

  return (
    <section className="hap-scenario-compare" data-scenario-compare="true">
      <div className="hap-scenario-outcome">
        <strong>Deterministic comparison</strong>
        <span>{outcome || "—"}</span>
        {outcome === "NO_QUALIFIED_OPPORTUNITY" ? (
          <span className="hap-empty">Neither scenario qualifies as a confirmed opportunity.</span>
        ) : null}
      </div>
      <div className="hap-scenario-grid">
        <ScenarioCard
          title="Bullish"
          scenario={bullish}
          selected={Boolean(bullish && str(bullish.scenarioId) === props.selectedScenarioId)}
          onSelect={() => props.onSelectScenario(bullish ? str(bullish.scenarioId) : null)}
        />
        <ScenarioCard
          title="Bearish"
          scenario={bearish}
          selected={Boolean(bearish && str(bearish.scenarioId) === props.selectedScenarioId)}
          onSelect={() => props.onSelectScenario(bearish ? str(bearish.scenarioId) : null)}
        />
      </div>
    </section>
  );
}
