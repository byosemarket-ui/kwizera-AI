import {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  VideoUnderstandingKnowledgeGraph,
  VideoUnderstandingRecord,
} from "./types.js";

export class VideoUnderstandingGraphBuilder {
  build(record: VideoUnderstandingRecord): VideoUnderstandingKnowledgeGraph {
    const start = Date.now();
    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];

    nodes.push({
      nodeId: `video-${record.videoId}`,
      nodeType: "story",
      label: record.identity.videoName,
      metadata: { storyType: record.story.storyType, purpose: record.purpose.primaryPurpose },
    });

    for (const scene of record.scenes) {
      nodes.push({
        nodeId: scene.sceneId,
        nodeType: "scene",
        label: scene.label,
        metadata: { role: scene.role, startMs: String(scene.startMs), endMs: String(scene.endMs) },
      });
      edges.push({
        edgeId: `edge-video-${scene.sceneId}`,
        sourceId: `video-${record.videoId}`,
        targetId: scene.sceneId,
        relationship: "contains-scene",
      });
    }

    if (record.product.mainProduct !== "none") {
      const productId = `product-${record.product.mainProduct.replace(/\s+/g, "-").toLowerCase()}`;
      nodes.push({
        nodeId: productId,
        nodeType: "product",
        label: record.product.mainProduct,
        metadata: { visibility: String(record.product.productVisibility) },
      });
      edges.push({
        edgeId: `edge-video-product`,
        sourceId: `video-${record.videoId}`,
        targetId: productId,
        relationship: "features-product",
      });
    }

    if (record.brand.brandIdentity !== "unknown-brand") {
      const brandId = `brand-${record.brand.brandIdentity.replace(/\s+/g, "-").toLowerCase()}`;
      nodes.push({
        nodeId: brandId,
        nodeType: "brand",
        label: record.brand.brandIdentity,
        metadata: { visibility: String(record.brand.brandVisibility) },
      });
      edges.push({
        edgeId: `edge-video-brand`,
        sourceId: `video-${record.videoId}`,
        targetId: brandId,
        relationship: "represents-brand",
      });
    }

    nodes.push({
      nodeId: `timeline-${record.videoId}`,
      nodeType: "timeline",
      label: `Timeline ${record.videoId}`,
      metadata: { chapters: String(record.structure.chapters.length) },
    });
    edges.push({
      edgeId: `edge-video-timeline`,
      sourceId: `video-${record.videoId}`,
      targetId: `timeline-${record.videoId}`,
      relationship: "has-timeline",
    });

    for (const campaign of record.relationships.relatedCampaigns) {
      const campaignId = `campaign-${campaign.replace(/\s+/g, "-").toLowerCase()}`;
      if (!nodes.some((n) => n.nodeId === campaignId)) {
        nodes.push({
          nodeId: campaignId,
          nodeType: "campaign",
          label: campaign,
          metadata: { goal: record.marketingGoal },
        });
      }
      edges.push({
        edgeId: `edge-video-campaign-${campaignId}`,
        sourceId: `video-${record.videoId}`,
        targetId: campaignId,
        relationship: "supports-campaign",
      });
    }

    for (const rel of record.sceneRelationships) {
      for (const relatedId of rel.relatedSceneIds) {
        edges.push({
          edgeId: `edge-scene-${rel.sceneId}-${relatedId}`,
          sourceId: rel.sceneId,
          targetId: relatedId,
          relationship: rel.relationshipType,
        });
      }
    }

    void start;
    return { nodes, edges };
  }
}
