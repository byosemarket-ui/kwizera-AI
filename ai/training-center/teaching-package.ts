/**
 * Phase 18 — builds the knowledge package for a frozen dataset version.
 * The package is an INTERNAL_DOCUMENT for the Phase 17 pipeline: one section per record, guidance attached
 * per section, version-stamped text so chunks never collide with other versions. Instruction-like text is
 * neutralised so uploaded material stays data and cannot address the model.
 */
import { detectInstructionLikeText } from "../knowledge-validation-engine/knowledge-evidence.js";
import type { KnowledgeGuidance } from "../knowledge-validation-engine/knowledge-evidence.js";
import { capabilityById, TARGET_LABELS } from "./training-catalog.js";
import { describeAnalysis } from "./teaching-media.js";
import type { DatasetVersion, TeachingDataset, TeachingRecord } from "./training-types.js";

const REMOVED = "[instruction-like text removed]";

/** Line/sentence-level neutralisation that keeps structure (headings, lists, code lines). */
export function neutralizeTeachingText(text: string): string {
  return String(text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/<\|?(im_start|im_end|system|assistant|user)\|?>/gi, "")
    .replace(/```+/g, "'''")
    .split("\n")
    .map((line) => {
      if (!detectInstructionLikeText(line).length) return line;
      const parts = line.split(/(?<=[.!?])\s+/).map((s) => (detectInstructionLikeText(s).length ? REMOVED : s));
      const joined = parts.join(" ");
      return detectInstructionLikeText(joined).length ? REMOVED : joined;
    })
    .join("\n");
}

function stripHeadings(text: string): string {
  return text.replace(/^(\s*)#{1,6}\s+/gm, "$1");
}

/** Document headings stay below the record's own section heading so a document cannot escape its section. */
function demoteHeadings(text: string): string {
  return text.replace(/^\s*(#{1,6})\s+(.+)$/gm, (_m, hashes: string, title: string) => `${hashes.length <= 2 ? "###" : "####"} ${title.trim()}`);
}

const KIND_LABEL: Record<TeachingRecord["kind"], string> = {
  TEXT: "Knowledge", INSTRUCTION: "Instruction", EXAMPLE: "Example", DOCUMENT: "Document", CODE: "Code example",
  IMAGE: "Image reference", VIDEO: "Video reference", AUDIO: "Audio reference", AUDIO_VIDEO_PAIR: "Audio and video pair",
  BEFORE_AFTER: "Before and after", EVALUATION_CASE: "Evaluation case",
};

const ROLE_LABEL: Record<string, string> = {
  SOURCE: "Source material", REFERENCE_RESULT: "Desired result", BEFORE: "Before", AFTER: "After",
  AUDIO: "Audio", VIDEO: "Video", IMAGE: "Image", DOCUMENT: "Document",
};

function sectionHeading(record: TeachingRecord): string {
  const title = record.title.replace(/[#\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  return `${KIND_LABEL[record.kind]}: ${title} (${record.recordId.slice(0, 8)})`;
}

function recordBody(record: TeachingRecord, stamp: string): string[] {
  const lines: string[] = [stamp];
  const n = (s: string) => stripHeadings(neutralizeTeachingText(s)).trim();
  if (record.text) lines.push(n(record.text));
  if (record.instruction) lines.push(`Instruction: ${n(record.instruction)}`);
  if (record.rules.length) lines.push(["Rules:", ...record.rules.map((r) => `- ${n(r)}`)].join("\n"));
  if (record.input) lines.push(`Input: ${n(record.input)}`);
  if (record.expectedOutput) lines.push(`Expected output: ${n(record.expectedOutput)}`);
  if (record.explanation) lines.push(`Why: ${n(record.explanation)}`);
  if (record.code) {
    const meta = [
      `Language: ${record.code.language}`,
      record.code.framework ? `framework: ${record.code.framework}` : "",
      record.code.version ? `version: ${record.code.version}` : "",
      record.code.topic ? `topic: ${record.code.topic}` : "",
      record.code.source ? `source: ${record.code.source}` : "",
    ].filter(Boolean).join(", ");
    lines.push(`${n(meta)}. This code is reference material; it was never executed.`);
    if (record.code.expectedBehavior) lines.push(`Expected behaviour: ${n(record.code.expectedBehavior)}`);
    lines.push(n(record.code.code).split("\n").map((l) => `    ${l}`).join("\n"));
  }
  if (record.document) {
    lines.push(`Document ${record.document.fileName.replace(/[\\/]/g, "_")} (${record.document.pages ? `${record.document.pages} pages` : record.document.format}).`);
    lines.push(demoteHeadings(neutralizeTeachingText(record.document.markdown)).trim());
  }
  for (const media of record.media) lines.push(describeAnalysis(media.analysis, ROLE_LABEL[media.role] ?? media.role));
  if (record.declared) {
    const d = record.declared;
    const parts = [d.aspectRatio ? `aspect ${d.aspectRatio}` : "", d.durationSec ? `${d.durationSec} s` : "", d.bpm ? `${d.bpm} BPM` : ""].filter(Boolean);
    if (parts.length) lines.push(`Declared target: ${parts.join(", ")}. Measured values above take precedence.`);
  }
  for (const g of record.guidance) lines.push(`Planner guidance: ${g.key} = ${g.value}${g.note ? ` (${n(g.note)})` : ""}.`);
  return lines.filter((l) => l.trim());
}

export interface TeachingPackage {
  title: string;
  markdown: string;
  guidanceBySection: Record<string, KnowledgeGuidance[]>;
  sections: Array<{ heading: string; recordId: string }>;
  topics: string[];
  domain: string;
}

export function packageTitle(dataset: Pick<TeachingDataset, "name" | "key">, version: number): string {
  return `Teaching: ${dataset.name} [${dataset.key}] v${version}`.slice(0, 200);
}

export function buildTeachingPackage(dataset: TeachingDataset, version: Pick<DatasetVersion, "version" | "records">): TeachingPackage {
  const capability = capabilityById(dataset.capability);
  const title = packageTitle(dataset, version.version);
  const stamp = `Teaching dataset ${dataset.key}, version ${version.version}, for ${capability?.label ?? dataset.capability} (${TARGET_LABELS[dataset.target]}).`;
  const out: string[] = [`# ${title}`];
  const guidanceBySection: Record<string, KnowledgeGuidance[]> = {};
  const sections: TeachingPackage["sections"] = [];
  for (const record of version.records) {
    if (record.kind === "EVALUATION_CASE") continue;
    const heading = sectionHeading(record);
    out.push(`## ${heading}`, ...recordBody(record, stamp));
    sections.push({ heading, recordId: record.recordId });
    if (record.guidance.length) {
      guidanceBySection[heading] = record.guidance.map((g) => ({ key: g.key, value: g.value, note: g.note ? neutralizeTeachingText(g.note).slice(0, 160) : `Teaching ${dataset.key} v${version.version}` }));
    }
  }
  const markdown = out.join("\n\n");
  const topics = [...new Set([dataset.key.toLowerCase(), dataset.capability.toLowerCase(), ...version.records.flatMap((r) => r.tags)])].slice(0, 12);
  return { title, markdown, guidanceBySection, sections, topics, domain: capability?.domain ?? "GENERAL" };
}

/** Final guard before indexing: the package must not contain instruction-like text after neutralisation. */
export function packageSafetyFlags(pkg: TeachingPackage): string[] {
  return detectInstructionLikeText(pkg.markdown);
}
