import type { VideoLearningObservation } from "../../../ai/training-center/video-observations";
import type { MediaCapabilityEntry, MediaIngestionSummary, SessionOnlineResearch } from "../../../ai/training-center/training-types";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? Array<DeepPartial<U>> | null : T[K] extends object | null ? DeepPartial<NonNullable<T[K]>> | null : T[K] };
/** Stored artifacts may predate the current observation contract, so every field is read defensively. */
type Observation = DeepPartial<VideoLearningObservation>;

const num = (v: unknown, digits: number): string => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "?");

export function ObservationsView({ artifact }: { artifact: Record<string, unknown> & { title?: string } }) {
  const observations = Array.isArray(artifact.observations) ? artifact.observations as Observation[] : [];
  if (artifact.missing) return <p className="acc-muted" style={{ fontSize: 12 }}>{artifact.title}: observation artifact is no longer stored.</p>;
  return (
    <details style={{ fontSize: 12, marginBottom: 6 }}>
      <summary>{artifact.title}: {observations.length} per-scene observation(s)</summary>
      <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
        <thead><tr>{["Scene", "Time", "Role", "Camera", "Transition in", "Product", "Text", "Audio"].map((h) => <th key={h} style={{ textAlign: "left", paddingRight: 10 }}>{h}</th>)}</tr></thead>
        <tbody>
          {observations.map((o, i) => (
            <tr key={o?.sceneId ?? i}>
              <td>{o?.sceneIndex ?? i + 1}</td>
              <td>{num(o?.timestamps?.startSec, 2)}–{num(o?.timestamps?.endSec, 2)}s</td>
              <td>{o?.storytelling?.role ?? "—"}</td>
              <td>{o?.camera?.movement ?? "—"}{typeof o?.camera?.confidence === "number" ? ` (${num(o.camera.confidence, 2)})` : ""}</td>
              <td>{o?.transition ? `${o.transition.type ?? "?"}${typeof o.transition.durationSec === "number" && o.transition.durationSec > 0 ? ` ${num(o.transition.durationSec, 2)}s` : ""}` : "—"}</td>
              <td>{o?.product?.detected ? `${o.product.prominence ?? ""} · ${o.product.location ?? ""} · crop ${o.product.cropRisk ?? "?"}` : "not isolated"}</td>
              <td>{o?.text?.presence ?? "—"}{o?.text?.regions?.length ? ` (${o.text.regions.length})` : ""}</td>
              <td>{o?.audio?.music ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Online pre-flight and research outcome for a session (Admin only); absent for sessions created before Phase 20. */
export function LearningStateView({ learning }: { learning: unknown }) {
  if (!learning || typeof learning !== "object") return null;
  const l = learning as { state?: unknown; note?: unknown };
  return (
    <p className="acc-muted" style={{ fontSize: 12 }}>
      Learning state: <strong>{typeof l.state === "string" ? l.state : "unknown"}</strong>{typeof l.note === "string" ? ` — ${l.note}` : ""}
    </p>
  );
}

export function OnlineResearchView({ online }: { online: unknown }) {
  if (!online || typeof online !== "object") return null;
  const o = online as DeepPartial<SessionOnlineResearch>;
  const checks = Array.isArray(o.preflight?.checks) ? o.preflight!.checks! : [];
  const planned = Array.isArray(o.planned) ? o.planned : [];
  const failed = Array.isArray(o.failed) ? o.failed : [];
  return (
    <details style={{ fontSize: 12, marginBottom: 6 }}>
      <summary>Online research: {o.preflight?.state ?? "unknown"}{o.requested ? "" : " (not requested)"} — {o.note ?? ""}</summary>
      <ul>
        {checks.map((c, i) => <li key={c?.check ?? i}>{c?.check ?? "?"}: {c?.ok === true ? "ok" : c?.ok === false ? "failed" : "not tested"} — {c?.detail ?? ""}</li>)}
        {planned.map((p, i) => <li key={p?.registryId ?? i}>Researched {p?.publisher ?? "?"}: {p?.url ?? "?"} — {p?.reason ?? ""}</li>)}
        {failed.map((f, i) => <li key={`${f?.registryId ?? i}-f`}>Not retrieved ({f?.code ?? "?"}): {f?.message ?? ""}</li>)}
      </ul>
    </details>
  );
}

/** Per-source ingestion outcome and capability matrix; absent for sessions analysed before Phase 20. */
export function MediaCapabilitiesView({ summary }: { summary: Record<string, unknown> }) {
  const ing = summary.ingestion && typeof summary.ingestion === "object" ? summary.ingestion as DeepPartial<MediaIngestionSummary> : null;
  const caps = Array.isArray(summary.capabilities) ? summary.capabilities as Array<DeepPartial<MediaCapabilityEntry>> : [];
  if (!ing && !caps.length) return null;
  const v = ing?.video;
  const a = ing?.audio;
  return (
    <>
      {ing ? (
        <li>
          Ingestion: {ing.tier === "SUPPORTED_AFTER_NORMALIZATION" ? "supported after normalisation" : "supported directly"} · detected {ing.sniffed ?? "?"} ({ing.container ?? "?"})
          {typeof ing.durationSec === "number" ? ` · ${num(ing.durationSec, 1)} s` : " · no duration header"}
          {v ? ` · video ${v.codec ?? "?"} ${v.width ?? "?"}×${v.height ?? "?"}${typeof v.fps === "number" ? ` @ ${num(v.fps, 2)} fps` : ""}${v.variableFrameRate ? " (variable)" : ""}${v.rotation ? `, rotated ${v.rotation}°` : ""}` : ""}
          {a ? ` · audio ${a.codec ?? "?"} ${a.sampleRate ?? "?"} Hz ${a.channels ?? "?"} ch` : ""}
          {ing.normalization ? ` · normalised to ${ing.normalization.target === "FLAC" ? "FLAC" : "H.264/AAC MP4"} because of ${ing.normalization.description ?? "?"}; original kept, derivative not retained` : ""}
        </li>
      ) : null}
      {caps.length ? (
        <li>
          Capabilities:
          <table style={{ fontSize: 12, borderCollapse: "collapse", marginTop: 4 }}>
            <tbody>
              {caps.map((c, i) => (
                <tr key={c?.capability ?? i}>
                  <td style={{ paddingRight: 10 }}>{c?.capability ?? "?"}</td>
                  <td style={{ paddingRight: 10 }}>{c?.status ?? "?"}</td>
                  <td className="acc-muted">{c?.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      ) : null}
    </>
  );
}
