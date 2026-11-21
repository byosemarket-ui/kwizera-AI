import { useMemo, useState } from "react";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function HfmEvidenceExplorer(props: {
  intelligence: Record<string, unknown> | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const items = useMemo(() => {
    const evidence = asRecord(props.intelligence?.evidence);
    const raw = Array.isArray(evidence?.items) ? evidence!.items : [];
    return raw.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];
  }, [props.intelligence]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      const blob = [
        e.evidenceId,
        e.sourceEngine,
        e.evidenceType,
        e.timeframe,
        e.direction,
      ].map((x) => String(x ?? "").toLowerCase()).join(" ");
      return blob.includes(q);
    });
  }, [items, filter]);

  if (!props.intelligence) {
    return (
      <article className="hap-card" data-card="evidence">
        <h3>Evidence Explorer</h3>
        <p className="hap-empty">No Phase 2 evidence package loaded for this snapshot.</p>
      </article>
    );
  }

  const evidence = asRecord(props.intelligence.evidence);

  return (
    <article className="hap-card" data-card="evidence" data-evidence-explorer="true">
      <h3>Evidence Explorer</h3>
      <p className="hap-empty">
        Deterministic market evidence · package {String(evidence?.packageId ?? "—")} ·
        {" "}{filtered.length}/{Number(evidence?.totalAvailable ?? items.length)} items
        {evidence?.truncated ? " · truncated" : ""}
      </p>
      <input
        className="hap-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by id, engine, type, TF…"
        aria-label="Filter evidence"
      />
      {!filtered.length ? (
        <p className="hap-empty">No evidence matches.</p>
      ) : (
        <ul className="hap-evidence-list">
          {filtered.slice(0, 80).map((e) => {
            const id = String(e.evidenceId ?? "");
            const open = expandedId === id;
            const prov = asRecord(e.provenance);
            return (
              <li key={id}>
                <button
                  type="button"
                  className="hap-evidence-row"
                  onClick={() => setExpandedId(open ? null : id)}
                >
                  <strong>{id}</strong>
                  <span>{String(e.evidenceType ?? "—")}</span>
                  <span>{String(e.timeframe ?? "—")}</span>
                  <span>{String(e.sourceEngine ?? "—")}</span>
                </button>
                {open ? (
                  <div className="hap-evidence-detail">
                    <p>Direction: {String(e.direction ?? "—")} · Candle: {String(e.candleStatus ?? "—")}</p>
                    <p>Observed: {String(e.observedAt ?? "—")}</p>
                    <p>
                      Provenance snapshot: {String(prov?.snapshotId ?? "—")}
                      {" · verified="}
                      {String(prov?.snapshotIdSourceVerified ?? false)}
                    </p>
                    <p>Assessment: {String(prov?.sourceAssessmentId ?? "—")}</p>
                    {Array.isArray(e.warnings) && e.warnings.length ? (
                      <p>Warnings: {(e.warnings as unknown[]).map(String).join("; ")}</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
