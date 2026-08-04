import { DEFAULT_RELIABILITY } from "../knowledge-acquisition-engine/knowledge-acquisition-engine.js";
import type { KnowledgeSourceDefinition, KnowledgeSourceVerification } from "./types.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9.-]{2,100}$/i;

/** Performs static, network-free verification of a candidate knowledge source before it can be trusted. */
export function verifyKnowledgeSource(definition: KnowledgeSourceDefinition): KnowledgeSourceVerification {
  const issues: string[] = [];

  if (!ID_PATTERN.test(definition.id)) issues.push("Source id must be 3-101 lowercase alphanumeric characters, dots, or hyphens.");
  if (!definition.name.trim()) issues.push("Source name is required.");
  if (!definition.description.trim()) issues.push("Source description is required.");
  if (!(definition.type in DEFAULT_RELIABILITY)) issues.push(`Unknown source type: ${definition.type}`);

  if (definition.location.kind === "url") {
    issues.push(...verifyUrlLocation(definition.location.value));
  } else {
    issues.push(...verifyLocalPathLocation(definition.location.value));
  }

  const baseTrust = DEFAULT_RELIABILITY[definition.type] ?? 50;
  const trustScore = Math.max(0, Math.min(100, baseTrust - issues.length * 20));

  return {
    verified: issues.length === 0,
    trustScore,
    issues,
    verifiedAt: new Date().toISOString(),
  };
}

function verifyUrlLocation(value: string): string[] {
  const issues: string[] = [];
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return ["Source URL is not a valid absolute URL."];
  }
  if (url.protocol !== "https:") issues.push("Source URL must use HTTPS.");
  if (url.username || url.password) issues.push("Source URL must not contain embedded credentials.");
  if (url.search) issues.push("Source URL must not contain query parameters.");
  if (url.hash) issues.push("Source URL must not contain a fragment.");
  if (!url.hostname) issues.push("Source URL must include a hostname.");
  return issues;
}

function verifyLocalPathLocation(value: string): string[] {
  const issues: string[] = [];
  const trimmed = value.trim();
  if (!trimmed) {
    issues.push("Source local path is required.");
    return issues;
  }
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) issues.push("Source local path must not contain parent directory traversal segments.");
  if (/^[a-z]+:\/\//i.test(normalized)) issues.push("Source local path must not be a remote URL.");
  return issues;
}
