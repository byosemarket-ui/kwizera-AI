/**
 * Phase 6 — build source-backed chart overlays only.
 * Never invents prices. Toggle defaults OFF at call site.
 */
import type { ParsedLevel } from "./parse-hfm-analysis-result";

export const HFM_ANALYTICAL_OVERLAY_MAX = 24;

export type HfmAnalyticalOverlayKind =
  | "ENTRY"
  | "STOP"
  | "TARGET"
  | "INVALIDATION"
  | "SUPPORT"
  | "RESISTANCE"
  | "STRUCTURE";

export interface HfmAnalyticalOverlay {
  id: string;
  kind: HfmAnalyticalOverlayKind;
  price: number;
  title: string;
  color: string;
  lineStyle: "solid" | "dashed" | "dotted";
  snapshotId: string;
  scenarioId: string | null;
  provenance: string | null;
}

const COLORS: Record<HfmAnalyticalOverlayKind, string> = {
  ENTRY: "#60a5fa",
  STOP: "#f87171",
  TARGET: "#34d399",
  INVALIDATION: "#fb923c",
  SUPPORT: "#94a3b8",
  RESISTANCE: "#a78bfa",
  STRUCTURE: "#fbbf24",
};

function kindFromLabel(label: string): HfmAnalyticalOverlayKind {
  const u = label.toUpperCase();
  if (u.includes("STOP")) return "STOP";
  if (u.includes("TARGET") || u.includes("TAKE-PROFIT") || u.includes("TP")) return "TARGET";
  if (u.includes("INVALID")) return "INVALIDATION";
  if (u.includes("SUPPORT")) return "SUPPORT";
  if (u.includes("RESIST")) return "RESISTANCE";
  if (u.includes("BOS") || u.includes("CHOCH") || u.includes("STRUCTURE")) return "STRUCTURE";
  return "ENTRY";
}

export function buildAnalyticalOverlays(input: {
  enabled: boolean;
  snapshotId: string | null;
  expectedSnapshotId?: string | null;
  scenarioId?: string | null;
  levels: ParsedLevel[];
  evidenceLevels?: Array<{
    id: string;
    kind: string;
    price: number | null;
    note?: string | null;
  }>;
}): { overlays: HfmAnalyticalOverlay[]; rejected: string[] } {
  const rejected: string[] = [];
  if (!input.enabled) return { overlays: [], rejected };
  const snap = String(input.snapshotId ?? "").trim();
  if (!snap) {
    rejected.push("missing_snapshot_id");
    return { overlays: [], rejected };
  }
  if (
    input.expectedSnapshotId
    && String(input.expectedSnapshotId).trim()
    && String(input.expectedSnapshotId).trim() !== snap
  ) {
    rejected.push("snapshot_mismatch");
    return { overlays: [], rejected };
  }

  const out: HfmAnalyticalOverlay[] = [];
  const seen = new Set<string>();

  for (const lv of input.levels) {
    if (!lv.sourceBacked) {
      rejected.push(`not_source_backed:${lv.label}`);
      continue;
    }
    const prices = [lv.low, lv.high, lv.price].filter(
      (p): p is number => typeof p === "number" && Number.isFinite(p),
    );
    for (const price of prices) {
      if (out.length >= HFM_ANALYTICAL_OVERLAY_MAX) break;
      const kind = kindFromLabel(lv.label);
      const key = `${kind}:${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `lvl-${key}`,
        kind,
        price,
        title: lv.label,
        color: COLORS[kind],
        lineStyle: kind === "ENTRY" ? "solid" : kind === "TARGET" ? "dashed" : "dotted",
        snapshotId: snap,
        scenarioId: input.scenarioId ?? null,
        provenance: lv.provenance,
      });
    }
  }

  for (const ev of input.evidenceLevels ?? []) {
    if (out.length >= HFM_ANALYTICAL_OVERLAY_MAX) break;
    if (ev.price == null || !Number.isFinite(ev.price)) {
      rejected.push(`invalid_evidence_price:${ev.id}`);
      continue;
    }
    const kindRaw = String(ev.kind ?? "").toUpperCase();
    let kind: HfmAnalyticalOverlayKind = "STRUCTURE";
    if (/SUPPORT|LOW/.test(kindRaw)) kind = "SUPPORT";
    else if (/RESIST|HIGH/.test(kindRaw)) kind = "RESISTANCE";
    else if (/BOS|CHOCH|STRUCTURE/.test(kindRaw)) kind = "STRUCTURE";
    else continue; // skip unrelated evidence kinds for overlays
    const key = `${kind}:${ev.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `ev-${ev.id}-${kind}`,
      kind,
      price: ev.price,
      title: ev.note ? String(ev.note).slice(0, 24) : kind,
      color: COLORS[kind],
      lineStyle: "dashed",
      snapshotId: snap,
      scenarioId: null,
      provenance: ev.id,
    });
  }

  return { overlays: out, rejected };
}
