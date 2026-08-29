/**
 * Safe, non-destructive Product Intelligence profile normalization.
 * Drops derived thumbnail IDs from evidence lists; keeps original facts.
 */
import { isOriginalProductImage } from "../creative-workspace/project-asset.js";
import type { CreativeProject } from "../creative-workspace/creative-workspace-manager.js";
import { collapseRepeatedProvenanceMarkers, stripEmbeddedProvenanceMarker } from "./provenance-text.js";
import type { ProductIntelligenceProfile } from "./types.js";

export function originalProjectImageIds(project: CreativeProject): string[] {
  return project.productImages.filter(isOriginalProductImage).map((image) => image.id);
}

export function isEquivalentKnowledgeMessage(message?: string): boolean {
  return /already exists|equivalent knowledge/i.test(message ?? "");
}

export function normalizeProductIntelligenceProfile(
  profile: ProductIntelligenceProfile,
  project: CreativeProject,
): { profile: ProductIntelligenceProfile; changed: boolean } {
  const originals = originalProjectImageIds(project);
  const originalSet = new Set(originals);
  const imageIds = profile.imageIds.filter((id) => originalSet.has(id));
  const nextIds = imageIds.length ? imageIds : originals;
  const imageObservations = (profile.imageObservations ?? []).filter((item) => !item.assetId || originalSet.has(item.assetId));
  const customerType = profile.customerIntelligence?.customerType
    ? stripEmbeddedProvenanceMarker(profile.customerIntelligence.customerType)
    : profile.customerIntelligence?.customerType;
  const inferences = (profile.inferences ?? []).map((item) => ({
    ...item,
    value: item.field === "audience" ? stripEmbeddedProvenanceMarker(item.value) : item.value,
  }));
  const differentiators = profile.valueProposition?.differentiators?.map((item) => collapseRepeatedProvenanceMarkers(item));

  let knowledgeStatus = profile.knowledgeStatus;
  let knowledgeMessage = profile.knowledgeMessage;
  if (knowledgeStatus === "error" && isEquivalentKnowledgeMessage(knowledgeMessage) && (profile.foundationKnowledgeIds?.length ?? 0) > 0) {
    knowledgeStatus = "already-linked";
    knowledgeMessage = "Equivalent project knowledge already exists and was reused.";
  }

  const next: ProductIntelligenceProfile = {
    ...profile,
    imageIds: nextIds,
    imageObservations,
    inferences,
    customerIntelligence: profile.customerIntelligence
      ? { ...profile.customerIntelligence, customerType: customerType || profile.customerIntelligence.customerType }
      : profile.customerIntelligence,
    valueProposition: profile.valueProposition
      ? { ...profile.valueProposition, differentiators: differentiators ?? profile.valueProposition.differentiators }
      : profile.valueProposition,
    knowledgeStatus,
    knowledgeMessage,
    multiView: profile.multiView
      ? {
        ...profile.multiView,
        views: profile.multiView.views.filter((view) => originalSet.has(view.imageId)),
        viewCount: originals.length || profile.multiView.viewCount,
      }
      : profile.multiView,
  };

  const changed = JSON.stringify({
    imageIds: profile.imageIds,
    knowledgeStatus: profile.knowledgeStatus,
    knowledgeMessage: profile.knowledgeMessage,
    customerType: profile.customerIntelligence?.customerType,
    inferenceAudience: profile.inferences?.find((item) => item.field === "audience")?.value,
    observationIds: profile.imageObservations?.map((item) => item.assetId),
  }) !== JSON.stringify({
    imageIds: next.imageIds,
    knowledgeStatus: next.knowledgeStatus,
    knowledgeMessage: next.knowledgeMessage,
    customerType: next.customerIntelligence?.customerType,
    inferenceAudience: next.inferences?.find((item) => item.field === "audience")?.value,
    observationIds: next.imageObservations?.map((item) => item.assetId),
  });

  return { profile: next, changed };
}
