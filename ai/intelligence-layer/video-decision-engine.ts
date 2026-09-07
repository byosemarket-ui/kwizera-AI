/**
 * Video Decision Engine — skills + knowledge + optional Ollama advisor.
 * Never executes FFmpeg; never mutates DB from raw model output.
 */
import { randomUUID } from "node:crypto";
import {
  ollamaCreativeAdvisor,
  type AdvisorContext,
} from "../creative-planning/ollama-creative-advisor.js";
import { mapTransitionToSupported } from "../video-skills/video-skills.js";
import { buildCompactIntelligenceContext } from "./context-builder.js";
import type { IntelligenceLearningStore } from "./learning-store.js";
import {
  confidenceBand,
  mapTransitionSafe,
  type IntelligenceDecision,
} from "./types.js";

export interface DecideInput {
  projectId: string;
  productName: string;
  category?: string;
  audience?: string;
  durationSeconds?: number;
  cta?: string;
  energy?: string | null;
  bpm?: number | null;
  platform?: string;
  tone?: string;
  assetRoles: Array<{ assetId: string; viewRole?: string; fileName?: string }>;
  /** When true, may call Ollama advisor (bounded). Default false for planner co-path. */
  useOllama?: boolean;
}

export class VideoDecisionEngine {
  constructor(private readonly store: IntelligenceLearningStore) {}

  async decide(input: DecideInput): Promise<IntelligenceDecision> {
    const patterns = this.store.getPatterns({
      projectId: input.projectId,
      minConfidence: 0.55,
    });
    const ctx = buildCompactIntelligenceContext({
      ...input,
      learnedPatterns: patterns,
    });

    const clamped: string[] = [];
    const limitations: string[] = [];
    let reasoningSource: "ai" | "deterministic" = "deterministic";
    let model: string | null = null;
    let structure = ctx.topSkills.find((s) => s.id === "image-sequence-hierarchy")
      ? ["HOOK", "REVEAL", "FEATURE", "CTA"]
      : ["HOOK", "REVEAL", "CTA"];
    let motion: string | null = ctx.topSkills.find((s) => s.motion)?.motion ?? "PRODUCT_FOCUS";
    let transition = mapTransitionSafe(
      ctx.topSkills.find((s) => s.transition)?.transition ?? "cut",
    );
    let pacing: string | null = "tight-social";
    let ctaStrategy: string | null = input.cta ? "final-20-percent" : null;
    let confidence = 0.72;

    if (ctx.learnedPatterns.length) {
      confidence = Math.min(0.9, confidence + 0.06 * ctx.learnedPatterns.length);
      limitations.push("Learned abstract patterns included in decision context.");
    }

    if (input.useOllama) {
      console.info("[OLLAMA_REQUEST]", { phase: "decision_advisor", projectId: input.projectId });
      const advisorCtx: AdvisorContext = {
        projectId: input.projectId,
        productName: input.productName,
        category: input.category,
        audience: input.audience,
        durationSeconds: input.durationSeconds,
        cta: input.cta,
        platform: input.platform,
        tone: input.tone,
        bpm: input.bpm,
        energy: input.energy,
        assetSummaries: input.assetRoles.map((a, i) => ({
          assetId: a.assetId,
          fileName: a.fileName ?? `asset-${i + 1}`,
          viewRole: a.viewRole,
        })),
      };
      try {
        const analysis = await ollamaCreativeAdvisor.analyzeProductForVideo(advisorCtx);
        model = analysis.model;
        if (analysis.source === "ollama") {
          reasoningSource = "ai";
          console.info("[OLLAMA_SUCCESS]", {
            projectId: input.projectId,
            model,
            latencyMs: analysis.latencyMs,
            confidence: analysis.confidence,
          });
        } else {
          console.info("[OLLAMA_FALLBACK]", {
            projectId: input.projectId,
            limitations: analysis.limitations.slice(0, 2),
          });
          limitations.push(...analysis.limitations.slice(0, 3));
        }
        if (analysis.recommendedSceneStructure?.length) {
          structure = analysis.recommendedSceneStructure.map(String).slice(0, 6);
        }
        if (analysis.recommendedMotion) motion = String(analysis.recommendedMotion);
        if (analysis.recommendedPacing) pacing = String(analysis.recommendedPacing);
        if (analysis.recommendedTransitions?.length) {
          const raw = analysis.recommendedTransitions[analysis.recommendedTransitions.length - 1];
          const mapped = mapTransitionToSupported(raw);
          if (String(raw).toLowerCase() !== mapped) {
            clamped.push(`transition:${raw}->${mapped}`);
          }
          transition = mapped;
        }
        confidence = Math.max(0.35, Math.min(0.95, analysis.confidence));
        if (analysis.confidenceBand === "LOW") {
          limitations.push("LOW confidence AI — deterministic constraints remain authoritative.");
        }
      } catch (error) {
        console.info("[OLLAMA_FAILURE]", {
          projectId: input.projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        limitations.push("Ollama advisor failed — deterministic decision used.");
      }
    }

    // Hard clamps
    if (transition !== "cut" && transition !== "fade") {
      clamped.push(`transition:${transition}->cut`);
      transition = "cut";
    }
    if (!structure.includes("HOOK") && structure.length) {
      structure = ["HOOK", ...structure.filter((s) => s !== "HOOK")];
      clamped.push("structure:ensured-HOOK-first");
    }

    const decision: IntelligenceDecision = {
      decisionId: randomUUID(),
      projectId: input.projectId,
      decisionType: "SCENE_STRUCTURE",
      selectedSkillIds: ctx.topSkills.map((s) => s.id),
      selectedAssetIds: ctx.assetRoles.map((a) => a.assetId),
      recommendedStructure: structure,
      motion,
      transition,
      pacing,
      ctaStrategy,
      confidence,
      confidenceBand: confidenceBand(confidence),
      reasoningSource,
      model,
      knowledgePatternIds: ctx.learnedPatterns.map((p) => p.patternId),
      videoKnowledgeIds: ctx.topKnowledge.map((k) => k.id),
      clamped,
      limitations,
      createdAt: new Date().toISOString(),
      contextChars: JSON.stringify(ctx).length,
    };

    console.info("[DECISION_CREATED]", {
      decisionId: decision.decisionId,
      projectId: decision.projectId,
      reasoningSource: decision.reasoningSource,
      skills: decision.selectedSkillIds,
      patterns: decision.knowledgePatternIds.length,
      confidence: decision.confidence,
    });
    if (clamped.length) {
      console.info("[DECISION_CLAMPED]", { decisionId: decision.decisionId, clamped });
    }
    console.info("[DECISION_VALIDATED]", {
      decisionId: decision.decisionId,
      transition: decision.transition,
      confidenceBand: decision.confidenceBand,
    });

    return decision;
  }
}
