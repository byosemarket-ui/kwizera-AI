/** Collapse duplicated provenance markers without hiding a single truthful label. */

const MARKERS = [
  "inferred",
  "observed-from-image",
  "user-provided",
  "recommended",
  "marketing-recommendation",
] as const;

const MARKER_RUN = new RegExp(
  String.raw`(?:\s*\((?:${MARKERS.join("|")})\))+`,
  "gi",
);

export function collapseRepeatedProvenanceMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(MARKER_RUN, (run) => {
      const found = MARKERS.find((marker) => new RegExp(`\\(${marker}\\)`, "i").test(run));
      return found ? ` (${found})` : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function appendProvenanceOnce(text: string, marker: (typeof MARKERS)[number]): string {
  const cleaned = collapseRepeatedProvenanceMarkers(text);
  if (new RegExp(`\\(${marker}\\)`, "i").test(cleaned)) return cleaned;
  return `${cleaned} (${marker})`.trim();
}

export function stripEmbeddedProvenanceMarker(text: string, marker: (typeof MARKERS)[number] = "inferred"): string {
  return collapseRepeatedProvenanceMarkers(text).replace(new RegExp(`\\s*\\(${marker}\\)`, "gi"), "").trim();
}
