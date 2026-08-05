import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import type { RegisteredKnowledgeSource } from "../knowledge-source-manager/types.js";
import type { DownloadableResourceType, DownloadRequest, DownloadSafetyCheck } from "./types.js";

export const MAX_DOWNLOAD_SIZE_BYTES = 200 * 1024 * 1024;

const SUPPORTED_RESOURCE_TYPES: readonly DownloadableResourceType[] = [
  "pdf",
  "markdown",
  "html",
  "json",
  "documentation",
  "image",
  "example-project",
  "api-specification",
];

/** Maps a source's knowledge category (then resource type as a fallback) to the Local Knowledge Workspace folder. */
export function resolveDownloadFolder(
  sourceType: KnowledgeAcquisitionSourceType,
  resourceType: DownloadableResourceType
): string {
  switch (sourceType) {
    case "book":
      return "books";
    case "technical-manual":
    case "user-manual":
      return "manuals";
    case "research-paper":
    case "white-paper":
      return "research";
    case "official-documentation":
    case "official-api-documentation":
    case "technical-standard":
    case "open-educational-resource":
      return "official-docs";
    case "company-document":
    case "user-document":
    case "local-documentation":
      return "downloads";
    default:
      break;
  }
  switch (resourceType) {
    case "pdf":
      return "pdf";
    case "image":
      return "images";
    case "example-project":
      return "examples";
    case "api-specification":
      return "api";
    case "markdown":
      return "markdown";
    case "html":
      return "html";
    case "json":
      return "json";
    default:
      return "official-docs";
  }
}

/** Confirms the source is trusted (approved, verified, and not blocked by policy) before any download proceeds. */
export function checkSourceTrust(
  source: RegisteredKnowledgeSource | null,
  policyDecision: "allow" | "block" | "review"
): DownloadSafetyCheck {
  const reasons: string[] = [];
  if (!source) reasons.push("Source is not registered with the Knowledge Source Manager.");
  else {
    if (source.status !== "approved") reasons.push(`Source status is "${source.status}"; only approved sources may be downloaded from.`);
    if (!source.verification.verified) reasons.push("Source failed static verification.");
  }
  if (policyDecision === "block") reasons.push("Source is blocked by the Source Policy Engine.");
  return { allowed: reasons.length === 0, reasons };
}

export function checkLicense(license: string | undefined): DownloadSafetyCheck {
  if (!license || !license.trim()) {
    return { allowed: false, reasons: ["Source has no known license; downloading is not permitted without a known license."] };
  }
  return { allowed: true, reasons: [] };
}

export function checkFileType(resourceType: DownloadableResourceType): DownloadSafetyCheck {
  return SUPPORTED_RESOURCE_TYPES.includes(resourceType)
    ? { allowed: true, reasons: [] }
    : { allowed: false, reasons: [`Resource type "${resourceType}" is not supported.`] };
}

export function checkFileSize(expectedSizeBytes: number | undefined): DownloadSafetyCheck {
  if (expectedSizeBytes === undefined) return { allowed: true, reasons: [] };
  return expectedSizeBytes <= MAX_DOWNLOAD_SIZE_BYTES
    ? { allowed: true, reasons: [] }
    : {
        allowed: false,
        reasons: [`Expected file size ${expectedSizeBytes} bytes exceeds the maximum allowed download size of ${MAX_DOWNLOAD_SIZE_BYTES} bytes.`],
      };
}

export function evaluateDownloadSafety(
  request: DownloadRequest,
  source: RegisteredKnowledgeSource | null,
  policyDecision: "allow" | "block" | "review"
): DownloadSafetyCheck {
  const checks = [
    checkSourceTrust(source, policyDecision),
    checkLicense(source?.license),
    checkFileType(request.resourceType),
    checkFileSize(request.expectedSizeBytes),
  ];
  const reasons = checks.flatMap((check) => check.reasons);
  return { allowed: reasons.length === 0, reasons };
}
