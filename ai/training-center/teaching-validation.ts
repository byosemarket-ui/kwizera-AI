/**
 * Phase 18 — validation of teaching records and dataset versions.
 * Content is untrusted input: secrets are rejected, instruction-like text needs review and is neutralised
 * before indexing, and uploaded code is only inspected as text (never executed).
 */
import { createHash } from "node:crypto";
import { detectInstructionLikeText } from "../knowledge-validation-engine/knowledge-evidence.js";
import { capabilityById, clampGuidance, type CapabilityDefinition } from "./training-catalog.js";
import type { TeachingRecord, ValidationIssue, ValidationState } from "./training-types.js";

const SECRET_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "openai-key", re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}/ },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: "aws-access-key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "github-token", re: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/ },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "stripe-key", re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/ },
  { id: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/i },
  { id: "credential-assignment", re: /\b(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["']?[A-Za-z0-9_\-+/=.]{12,}/i },
  { id: "url-credentials", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i },
];

const SERVER_PATH = /(?:^|[\s"'(=])(\/(?:opt|var|etc|root|home|srv|usr\/local)\/[^\s"')]+|[A-Za-z]:\\(?:Users|Windows|ProgramData)\\[^\s"')]+)/;

const DANGEROUS_CODE: Array<{ id: string; re: RegExp }> = [
  { id: "shell-exec", re: /\b(child_process|execSync|spawnSync|os\.system|subprocess\.(run|Popen|call)|Runtime\.getRuntime\(\)\.exec)\b/ },
  { id: "eval", re: /\beval\s*\(|\bnew Function\s*\(/ },
  { id: "destructive-shell", re: /\brm\s+-rf\s+\/|\bmkfs\b|\bdd\s+if=|:\(\)\s*\{\s*:\|:&\s*\};:/ },
  { id: "remote-pipe", re: /\b(curl|wget)\b[^\n|]*\|\s*(sh|bash|zsh|python)/ },
];

export function detectSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
}

/** Replaces credential-looking values so the raw secret is never persisted or echoed back. */
export function redactSecrets(text: string): { text: string; found: string[] } {
  const found: string[] = [];
  let out = text;
  for (const p of SECRET_PATTERNS) {
    const global = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
    if (global.test(out)) {
      found.push(p.id);
      out = out.replace(global, `[REDACTED:${p.id}]`);
    }
  }
  return { text: out, found };
}

/** Redacts every free-text field of a record in place; returns the credential types that were removed. */
export function redactRecordSecrets(record: TeachingRecord): string[] {
  const found = new Set<string>();
  const clean = (value: string): string => {
    if (!value) return value;
    const result = redactSecrets(value);
    result.found.forEach((id) => found.add(id));
    return result.text;
  };
  record.title = clean(record.title);
  record.text = clean(record.text);
  record.instruction = clean(record.instruction);
  record.input = clean(record.input);
  record.expectedOutput = clean(record.expectedOutput);
  record.explanation = clean(record.explanation);
  record.rules = record.rules.map(clean);
  if (record.code) {
    record.code.code = clean(record.code.code);
    if (record.code.expectedBehavior) record.code.expectedBehavior = clean(record.code.expectedBehavior);
  }
  if (record.document) record.document.markdown = clean(record.document.markdown);
  if (found.size) record.secretsRedacted = [...new Set([...(record.secretsRedacted ?? []), ...found])];
  return [...found];
}

export function detectServerPaths(text: string): boolean {
  return SERVER_PATH.test(text);
}

export function detectDangerousCode(code: string): string[] {
  return DANGEROUS_CODE.filter((p) => p.re.test(code)).map((p) => p.id);
}

export function recordTextBlob(record: Pick<TeachingRecord, "title" | "text" | "instruction" | "input" | "expectedOutput" | "explanation" | "rules" | "code" | "document">): string {
  return [
    record.title, record.text, record.instruction, record.input, record.expectedOutput, record.explanation,
    ...record.rules, record.code?.code ?? "", record.code?.expectedBehavior ?? "", record.document?.markdown ?? "",
  ].filter(Boolean).join("\n");
}

export function computeRecordHash(record: Pick<TeachingRecord, "kind" | "title" | "text" | "instruction" | "input" | "expectedOutput" | "explanation" | "rules" | "code" | "document" | "guidance" | "media" | "evalCase">): string {
  const normalized = JSON.stringify({
    kind: record.kind,
    body: recordTextBlob(record).toLowerCase().replace(/\s+/g, " ").trim(),
    guidance: [...record.guidance].sort((a, b) => a.key.localeCompare(b.key)).map((g) => [g.key, g.value]),
    media: record.media.map((m) => `${m.role}:${m.contentHash}`).sort(),
    evalCase: record.evalCase,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Validates one record in the context of its dataset capability. */
export function validateRecord(record: TeachingRecord, capability: CapabilityDefinition | null): { state: ValidationState; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (code: string, severity: ValidationIssue["severity"], message: string) => issues.push({ code, severity, message });
  const blob = recordTextBlob(record);

  if (!capability) add("UNKNOWN_CAPABILITY", "ERROR", "The dataset capability is not recognised.");
  else if (!capability.kinds.includes(record.kind)) add("KIND_NOT_SUPPORTED", "ERROR", `${record.kind} material is not supported for ${capability.label}.`);
  if (record.title.trim().length < 3) add("MISSING_TITLE", "ERROR", "A title is required.");

  switch (record.kind) {
    case "TEXT":
      if (words(record.text) < 5 && !record.rules.length) add("MISSING_CONTENT", "ERROR", "Text teaching needs at least one sentence or rule.");
      break;
    case "INSTRUCTION":
      if (words(record.instruction) < 3) add("MISSING_INSTRUCTION", "ERROR", "An instruction is required.");
      if (!record.expectedOutput.trim() && !record.rules.length && !record.guidance.length && words(record.instruction) < 8) {
        add("MISSING_EXPECTED_OUTPUT", "REVIEW", "Add an expected output, rules or a guidance value so the instruction can be evaluated.");
      }
      break;
    case "EXAMPLE":
      if (!record.input.trim() && !record.media.some((m) => m.role === "SOURCE" || m.role === "BEFORE")) add("MISSING_INPUT", "ERROR", "An example needs an input (text or source media).");
      if (!record.expectedOutput.trim() && !record.media.some((m) => m.role === "REFERENCE_RESULT" || m.role === "AFTER")) {
        add("MISSING_EXPECTED_OUTPUT", "ERROR", "An example needs an expected output (text or reference result media).");
      }
      break;
    case "DOCUMENT":
      if (!record.document) add("MISSING_DOCUMENT", "ERROR", "No document text was extracted.");
      else if (record.document.chars < 40) add("EMPTY_DOCUMENT", "ERROR", "The document contains no usable text.");
      break;
    case "CODE": {
      if (!record.code?.code.trim()) add("MISSING_CODE", "ERROR", "Code content is required.");
      if (!record.code?.language.trim()) add("MISSING_LANGUAGE", "ERROR", "The programming language is required.");
      if (!record.code?.expectedBehavior?.trim() && !record.explanation.trim()) add("MISSING_EXPECTED_BEHAVIOR", "REVIEW", "Describe the expected behaviour of the code.");
      const dangerous = detectDangerousCode(record.code?.code ?? "");
      if (dangerous.length) add("CODE_DANGEROUS_CALLS", "REVIEW", `Code contains process/eval/destructive calls (${dangerous.join(", ")}). It is stored as text only and never executed.`);
      add("CODE_NOT_EXECUTED", "INFO", "Uploaded code is inspected as text only; it is never executed.");
      break;
    }
    case "IMAGE": case "VIDEO": case "AUDIO": {
      const want = record.kind;
      if (!record.media.some((m) => m.kind === want)) add("MISSING_MEDIA", "ERROR", `A ${want.toLowerCase()} file is required.`);
      if (!record.explanation.trim() && !record.text.trim()) add("MISSING_EXPLANATION", "REVIEW", "Explain what the AI should learn from this media.");
      break;
    }
    case "AUDIO_VIDEO_PAIR":
      if (!record.media.some((m) => m.kind === "AUDIO") || !record.media.some((m) => m.kind === "VIDEO")) {
        add("MISSING_PAIR_MEDIA", "ERROR", "An audio + video pair needs one audio file and one video file.");
      }
      break;
    case "BEFORE_AFTER":
      if (!record.media.some((m) => m.role === "BEFORE") || !record.media.some((m) => m.role === "AFTER")) {
        add("MISSING_PAIR_MEDIA", "ERROR", "A before/after pair needs a BEFORE and an AFTER file.");
      }
      break;
    case "EVALUATION_CASE":
      if (!record.evalCase) add("MISSING_EVAL_CASE", "ERROR", "An evaluation case needs a check definition.");
      break;
  }

  for (const media of record.media) {
    if (media.status === "FAILED") add("BROKEN_MEDIA", "ERROR", `${media.fileName}: ${media.error?.message ?? "media could not be processed"}.`);
    else if (media.status !== "READY") add("MEDIA_PROCESSING", "ERROR", `${media.fileName} is still being processed.`);
  }

  const keys = new Set<string>();
  for (const g of record.guidance) {
    if (!capability?.guidanceKeys.includes(g.key)) {
      add("GUIDANCE_NOT_ALLOWED", "ERROR", `Guidance ${g.key} does not belong to ${capability?.label ?? "this capability"}; teaching cannot change unrelated capabilities.`);
      continue;
    }
    if (keys.has(g.key)) add("CONTRADICTORY_GUIDANCE", "ERROR", `Guidance ${g.key} is set more than once in this record.`);
    keys.add(g.key);
    const bounded = clampGuidance(g.key, g.value);
    if (!bounded) add("INVALID_GUIDANCE", "ERROR", `Guidance ${g.key} must be a number.`);
    else if (bounded.clamped) add("GUIDANCE_OUT_OF_RANGE", "ERROR", `Guidance ${g.key}=${g.value} is outside the planner's safe range.`);
  }

  if (record.knowledge) {
    const k = record.knowledge;
    if (!k.sourceLocations.length) add("KNOWLEDGE_NO_PROVENANCE", "ERROR", "Learned knowledge must keep at least one source location.");
    if (k.conflictAccepted) add("KNOWLEDGE_CONFLICT", "REVIEW", `Accepted although: ${k.novelty.reason} Approve the record to publish it; the other knowledge is not overwritten.`);
    if (k.confidence < 0.45) add("KNOWLEDGE_LOW_CONFIDENCE", "REVIEW", `Extraction confidence ${k.confidence.toFixed(2)} is low; approve the record to publish it.`);
  }

  const secrets = [...new Set([...(record.secretsRedacted ?? []), ...detectSecrets(blob)])];
  if (secrets.length) add("SECRET_DETECTED", "ERROR", `Content contained what looks like a credential (${secrets.join(", ")}). The value was redacted and never stored; remove this record and add it again without the secret.`);
  const injection = detectInstructionLikeText(blob);
  if (injection.length) add("INSTRUCTION_LIKE_TEXT", "REVIEW", `Instruction-like text found (${injection.join(", ")}). It will be treated as data and neutralised before indexing.`);
  if (detectServerPaths(blob)) add("SERVER_PATH", "REVIEW", "Content contains a server filesystem path.");

  const state: ValidationState = issues.some((i) => i.severity === "ERROR")
    ? "INVALID"
    : issues.some((i) => i.severity === "REVIEW") && record.review?.decision !== "APPROVED" ? "NEEDS_REVIEW" : "VALID";
  if (record.review?.decision === "REJECTED") {
    return { state: "INVALID", issues: [...issues, { code: "REJECTED_BY_REVIEWER", severity: "ERROR", message: `Rejected by ${record.review.by}${record.review.note ? `: ${record.review.note}` : ""}.` }] };
  }
  return { state, issues };
}

/** Dataset-level checks: duplicates, contradictory guidance across records, emptiness. */
export function validateDatasetRecords(records: TeachingRecord[], capabilityId: string): {
  records: Map<string, { state: ValidationState; issues: ValidationIssue[] }>;
  issues: ValidationIssue[];
  guidance: Array<{ key: string; value: number; note?: string }>;
} {
  const capability = capabilityById(capabilityId);
  const results = new Map<string, { state: ValidationState; issues: ValidationIssue[] }>();
  const issues: ValidationIssue[] = [];
  if (!records.length) issues.push({ code: "EMPTY_DATASET", severity: "ERROR", message: "The dataset has no records." });

  const byHash = new Map<string, string>();
  for (const record of records) {
    const result = validateRecord(record, capability);
    const first = byHash.get(record.contentHash);
    if (first) {
      result.issues.push({ code: "DUPLICATE_RECORD", severity: "ERROR", message: `Duplicate of record ${first.slice(0, 8)}.` });
      result.state = "INVALID";
    } else byHash.set(record.contentHash, record.recordId);
    results.set(record.recordId, result);
  }

  const guidanceByKey = new Map<string, Array<{ value: number; recordId: string; note?: string }>>();
  for (const record of records) {
    for (const g of record.guidance) {
      const list = guidanceByKey.get(g.key) ?? [];
      list.push({ value: g.value, recordId: record.recordId, note: g.note });
      guidanceByKey.set(g.key, list);
    }
  }
  const guidance: Array<{ key: string; value: number; note?: string }> = [];
  for (const [key, list] of guidanceByKey) {
    const distinct = new Set(list.map((l) => l.value));
    if (distinct.size > 1) {
      const message = `Records give different values for ${key} (${[...distinct].join(", ")}). Keep one value per dataset.`;
      issues.push({ code: "CONTRADICTORY_GUIDANCE", severity: "ERROR", message });
      for (const entry of list) {
        const result = results.get(entry.recordId)!;
        result.issues.push({ code: "CONTRADICTORY_GUIDANCE", severity: "ERROR", message });
        result.state = "INVALID";
      }
    } else {
      guidance.push({ key, value: list[0]!.value, note: list.find((l) => l.note)?.note });
    }
  }
  return { records: results, issues, guidance };
}
