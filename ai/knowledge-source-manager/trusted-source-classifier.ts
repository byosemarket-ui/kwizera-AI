/**
 * Classifies discovered knowledge sources into professional trust tiers.
 * Unknown or low-quality sources are never auto-approved.
 */

import type { KnowledgeAcquisitionSourceType } from "../knowledge-acquisition-engine/types.js";
import { KnowledgeSourceTrustClass, type KnowledgeSourceDefinition } from "./types.js";

const OFFICIAL_TYPES: KnowledgeAcquisitionSourceType[] = [
  "official-documentation",
  "official-api-documentation",
];

const HIGHLY_TRUSTED_TYPES: KnowledgeAcquisitionSourceType[] = [
  "technical-standard",
  "research-paper",
  "technical-manual",
  "knowledge-foundation",
];

const TRUSTED_TYPES: KnowledgeAcquisitionSourceType[] = [
  "white-paper",
  "user-manual",
  "book",
  "open-educational-resource",
];

const COMMUNITY_TYPES: KnowledgeAcquisitionSourceType[] = ["approved-website", "html"];

const USER_PROVIDED_TYPES: KnowledgeAcquisitionSourceType[] = [
  "user-document",
  "company-document",
  "local-documentation",
  "local-project-file",
  "pdf",
  "word",
  "markdown",
  "json",
];

export class TrustedSourceClassifier {
  classify(definition: KnowledgeSourceDefinition): KnowledgeSourceTrustClass {
    if (definition.trustClass) return definition.trustClass;

    const type = definition.type;
    if (OFFICIAL_TYPES.includes(type)) return KnowledgeSourceTrustClass.Official;
    if (HIGHLY_TRUSTED_TYPES.includes(type)) return KnowledgeSourceTrustClass.HighlyTrusted;
    if (TRUSTED_TYPES.includes(type)) return KnowledgeSourceTrustClass.Trusted;
    if (USER_PROVIDED_TYPES.includes(type)) return KnowledgeSourceTrustClass.UserProvided;
    if (COMMUNITY_TYPES.includes(type)) return KnowledgeSourceTrustClass.Community;
    return KnowledgeSourceTrustClass.Community;
  }

  /** Low-quality or unknown sources must remain pending / rejected — never auto-approved. */
  mayAutoApprove(): false {
    return false;
  }

  reputationBoost(trustClass: KnowledgeSourceTrustClass): number {
    switch (trustClass) {
      case KnowledgeSourceTrustClass.Official:
        return 25;
      case KnowledgeSourceTrustClass.HighlyTrusted:
        return 18;
      case KnowledgeSourceTrustClass.Trusted:
        return 10;
      case KnowledgeSourceTrustClass.Community:
        return 0;
      case KnowledgeSourceTrustClass.UserProvided:
        return 5;
      default:
        return 0;
    }
  }
}
