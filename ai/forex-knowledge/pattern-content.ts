/**
 * Structured Forex pattern knowledge → searchable text content.
 * Educational definitions only — not live chart detection rules.
 */

export interface ForexPatternKnowledgeFields {
  patternName: string;
  aliases: string[];
  category: string;
  description: string;
  interpretation: "BULLISH" | "BEARISH" | "NEUTRAL" | "";
  preconditions: string;
  marketContext: string;
  recognitionRules: string;
  confirmationRequirements: string;
  invalidationConditions: string;
  falsePositives: string;
  timeframeNotes: string;
  tags: string[];
  sourceReferences: string;
  /** Explicit disclaimer stored with every pattern record. */
  detectionDisclaimer: string;
}

export const DEFAULT_PATTERN_DETECTION_DISCLAIMER =
  "Educational description only. This record does not enable or imply live chart pattern detection.";

export function emptyPatternFields(): ForexPatternKnowledgeFields {
  return {
    patternName: "",
    aliases: [],
    category: "",
    description: "",
    interpretation: "",
    preconditions: "",
    marketContext: "",
    recognitionRules: "",
    confirmationRequirements: "",
    invalidationConditions: "",
    falsePositives: "",
    timeframeNotes: "",
    tags: [],
    sourceReferences: "",
    detectionDisclaimer: DEFAULT_PATTERN_DETECTION_DISCLAIMER,
  };
}

export function patternFieldsFromUnknown(raw: unknown): ForexPatternKnowledgeFields {
  const base = emptyPatternFields();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? String(o[k]).trim() : "");
  const list = (k: string) =>
    Array.isArray(o[k])
      ? o[k].map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 40)
      : str(k)
        ? str(k).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 40)
        : [];
  const interp = str("interpretation").toUpperCase();
  return {
    patternName: str("patternName") || str("name"),
    aliases: list("aliases"),
    category: str("category"),
    description: str("description"),
    interpretation: interp === "BULLISH" || interp === "BEARISH" || interp === "NEUTRAL"
      ? interp
      : "",
    preconditions: str("preconditions"),
    marketContext: str("marketContext"),
    recognitionRules: str("recognitionRules"),
    confirmationRequirements: str("confirmationRequirements"),
    invalidationConditions: str("invalidationConditions"),
    falsePositives: str("falsePositives"),
    timeframeNotes: str("timeframeNotes"),
    tags: list("tags"),
    sourceReferences: str("sourceReferences"),
    detectionDisclaimer: str("detectionDisclaimer") || DEFAULT_PATTERN_DETECTION_DISCLAIMER,
  };
}

/** Build markdown content used for indexing from structured pattern fields. */
export function serializePatternContent(fields: ForexPatternKnowledgeFields): string {
  const lines: string[] = [
    `# ${fields.patternName || "Unnamed pattern"}`,
    "",
    `> ${fields.detectionDisclaimer}`,
    "",
  ];
  if (fields.aliases.length) lines.push(`**Aliases:** ${fields.aliases.join(", ")}`, "");
  if (fields.category) lines.push(`**Category:** ${fields.category}`, "");
  if (fields.interpretation) lines.push(`**Interpretation:** ${fields.interpretation}`, "");
  if (fields.description) lines.push("## Description", fields.description, "");
  if (fields.preconditions) lines.push("## Preconditions", fields.preconditions, "");
  if (fields.marketContext) lines.push("## Market context", fields.marketContext, "");
  if (fields.recognitionRules) {
    lines.push("## Recognition criteria (educational)", fields.recognitionRules, "");
  }
  if (fields.confirmationRequirements) {
    lines.push("## Confirmation requirements", fields.confirmationRequirements, "");
  }
  if (fields.invalidationConditions) {
    lines.push("## Invalidation", fields.invalidationConditions, "");
  }
  if (fields.falsePositives) lines.push("## Common false positives", fields.falsePositives, "");
  if (fields.timeframeNotes) lines.push("## Timeframe considerations", fields.timeframeNotes, "");
  if (fields.sourceReferences) lines.push("## Source references", fields.sourceReferences, "");
  return lines.join("\n").trim();
}
