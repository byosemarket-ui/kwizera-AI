/**
 * Resource-aware Context Builder — top-K retrieval, char budget, deterministic.
 */
import {
  retrieveVideoKnowledge,
} from "../video-knowledge-engine/video-knowledge-pack.js";
import { selectApplicableSkills } from "../video-skills/video-skills.js";
import type { CompactIntelligenceContext, KnowledgePattern } from "./types.js";

const DEFAULT_CHAR_BUDGET = 1800;

export interface ContextBuilderInput {
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
  assetRoles: Array<{ assetId: string; viewRole?: string }>;
  learnedPatterns?: KnowledgePattern[];
  charBudget?: number;
}

export function buildCompactIntelligenceContext(
  input: ContextBuilderInput,
): CompactIntelligenceContext {
  const budget = Math.min(Math.max(input.charBudget ?? DEFAULT_CHAR_BUDGET, 600), 2800);
  const task = [
    input.category,
    input.platform,
    input.tone,
    "product marketing video hook reveal cta",
  ].filter(Boolean).join(" ");

  const knowledge = retrieveVideoKnowledge(task, 4);
  const skills = selectApplicableSkills({
    task,
    hasCta: Boolean(input.cta),
    imageCount: input.assetRoles.length,
    tone: input.tone,
  });

  const patterns = (input.learnedPatterns ?? [])
    .filter((p) => p.promoted && p.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  const constraints = [
    "transitions=cut|fade only",
    "no pixel vision from text models",
    "validators override model suggestions",
    "project isolation required",
  ];

  let ctx: CompactIntelligenceContext = {
    projectId: input.projectId,
    productName: input.productName.slice(0, 80),
    category: input.category?.slice(0, 40),
    audience: input.audience?.slice(0, 60),
    durationSeconds: input.durationSeconds,
    cta: input.cta?.slice(0, 80),
    energy: input.energy ?? null,
    bpm: input.bpm ?? null,
    assetRoles: input.assetRoles.slice(0, 6),
    topKnowledge: knowledge.slice(0, 4).map((k) => ({
      id: k.id,
      rule: k.rule.slice(0, 120),
      confidence: k.confidence,
    })),
    topSkills: skills.slice(0, 4).map((s) => ({
      id: s.skill.id,
      motion: s.skill.execution.motionHint ?? null,
      transition: s.skill.execution.transitionHint ?? null,
    })),
    learnedPatterns: patterns.map((p) => ({
      patternId: p.patternId,
      statement: p.statement.slice(0, 140),
      confidence: p.confidence,
    })),
    constraints,
    charBudget: budget,
  };

  // Deterministic trim to stay under budget.
  let serialized = JSON.stringify(ctx);
  while (serialized.length > budget && ctx.topKnowledge.length > 1) {
    ctx = { ...ctx, topKnowledge: ctx.topKnowledge.slice(0, -1) };
    serialized = JSON.stringify(ctx);
  }
  while (serialized.length > budget && ctx.learnedPatterns.length > 0) {
    ctx = { ...ctx, learnedPatterns: ctx.learnedPatterns.slice(0, -1) };
    serialized = JSON.stringify(ctx);
  }
  while (serialized.length > budget && ctx.assetRoles.length > 2) {
    ctx = { ...ctx, assetRoles: ctx.assetRoles.slice(0, -1) };
    serialized = JSON.stringify(ctx);
  }

  console.info("[KNOWLEDGE_RETRIEVED]", {
    projectId: ctx.projectId,
    knowledgeCount: ctx.topKnowledge.length,
    skillsCount: ctx.topSkills.length,
    learnedCount: ctx.learnedPatterns.length,
    chars: serialized.length,
  });
  console.info("[SKILLS_RETRIEVED]", {
    projectId: ctx.projectId,
    skillIds: ctx.topSkills.map((s) => s.id),
  });

  return ctx;
}

export function formatContextForOllama(ctx: CompactIntelligenceContext): string {
  return [
    "Knowledge:",
    ...ctx.topKnowledge.map((k) => `- [${k.id}] ${k.rule}`),
    ...(ctx.learnedPatterns.length
      ? ["Learned:", ...ctx.learnedPatterns.map((p) => `- (${p.confidence.toFixed(2)}) ${p.statement}`)]
      : []),
    "Skills:",
    ...ctx.topSkills.map((s) => `- ${s.id}`),
  ].join("\n");
}
