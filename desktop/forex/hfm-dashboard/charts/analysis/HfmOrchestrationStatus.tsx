function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function HfmOrchestrationStatus(props: {
  intelligence: Record<string, unknown> | null;
  status: string | null;
  loadError: string | null;
  chartTimeframe: string;
}) {
  const intel = props.intelligence;
  const completeness = asRecord(intel?.completeness);
  const tips = asRecord(intel?.candleTipStates);
  const warnings = Array.isArray(intel?.warnings) ? intel!.warnings.map(String) : [];

  return (
    <article className="hap-card hap-orch-status" data-card="orchestration" data-orch-status="true">
      <h3>Intelligence Orchestration</h3>
      <p className="hap-empty">
        Analysis TF pack: H4 / H1 / M30 / M15 / M5 · Chart context TF: {props.chartTimeframe}
      </p>
      {props.loadError ? <p className="hap-error">{props.loadError}</p> : null}
      {!intel ? (
        <p className="hap-empty">
          {props.status === "NOT_FOUND"
            ? "No orchestration artifact for this snapshot."
            : "Orchestration summary not loaded yet."}
        </p>
      ) : (
        <dl className="hap-kv">
          <div>
            <dt>Status</dt>
            <dd>{String(intel.orchestrationStatus ?? props.status ?? "—")}</dd>
          </div>
          <div>
            <dt>Evidence trusted</dt>
            <dd>{String(completeness?.evidenceTrustedComplete ?? "—")}</dd>
          </div>
          <div>
            <dt>Evidence count</dt>
            <dd>{String(completeness?.evidenceItemCount ?? "—")}</dd>
          </div>
          <div>
            <dt>Missing TFs</dt>
            <dd>
              {Array.isArray(completeness?.missingTimeframes)
                ? (completeness!.missingTimeframes as unknown[]).map(String).join(", ") || "None"
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Tip states</dt>
            <dd>
              {tips
                ? Object.entries(tips).map(([tf, st]) => `${tf}:${st}`).join(" · ")
                : "—"}
            </dd>
          </div>
        </dl>
      )}
      {warnings.length ? (
        <p className="hap-empty" data-partial-warnings="true">Warnings: {warnings.join("; ")}</p>
      ) : null}
    </article>
  );
}
