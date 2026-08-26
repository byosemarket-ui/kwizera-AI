/** Build creative profile + next-action from live application state only. */

import type { AssistantContext } from "../creative-assistant/types";
import type { CreativeReviewState } from "../creative-review/types";
import type { ProjectPreferenceMemory } from "../creative-decision/types";
import type {
  CreativeMemoryEntry,
  CreativeProfile,
  NextActionKind,
  SmartNextAction,
  StartupSummary,
  WorkflowPhase,
} from "./types";

export function buildCreativeProfile(args: {
  ctx: AssistantContext;
  prefs: ProjectPreferenceMemory;
  memories: CreativeMemoryEntry[];
}): CreativeProfile | null {
  const { ctx, prefs, memories } = args;
  if (!ctx.available) return null;
  const populatedFrom: string[] = [];
  const active = memories.filter((m) => m.lifecycle === "ACTIVE" && !m.disabled && m.projectId === ctx.projectId);

  const langMem = active.find((m) => /language|kinyarwanda|english/i.test(m.topic + m.content));
  const language = langMem?.content.match(/kinyarwanda|english/i)?.[0]
    ?? (ctx.marketingSummary?.match(/Language:\s*([^·]+)/i)?.[1]?.trim() || null);
  if (language) populatedFrom.push("marketing/memory");

  const platform = ctx.marketingSummary?.match(/Platforms?:\s*([^·]+)/i)?.[1]?.trim()
    ?? active.find((m) => m.topic === "platform")?.content
    ?? null;
  if (platform) populatedFrom.push("marketing");

  const goal = ctx.marketingSummary?.match(/Goal:\s*([^·]+)/i)?.[1]?.trim() ?? null;
  if (goal) populatedFrom.push("marketing");

  const audience = ctx.marketingSummary?.match(/Audience:\s*([^·]+)/i)?.[1]?.trim() ?? null;
  if (audience) populatedFrom.push("marketing");

  const cta = ctx.marketingSummary?.match(/CTA:\s*([^·]+)/i)?.[1]?.trim()
    ?? (prefs.preferStrongerCta ? "Strong CTA preferred" : null);
  if (cta) populatedFrom.push(prefs.preferStrongerCta ? "preference" : "marketing");

  const productPresentation = prefs.preferProductCentered
    ? "Product-centered visuals"
    : (active.find((m) => m.topic === "product-presentation")?.content ?? null);
  if (productPresentation) populatedFrom.push("preference/memory");

  const pacing = prefs.preferShorterVideos
    ? "Short pacing"
    : (platform && /tiktok/i.test(platform) ? "Platform-aware pacing" : null);
  if (pacing) populatedFrom.push("preference/platform");

  const musicStyle = prefs.preferMinimalMusic
    ? "Minimal music"
    : (ctx.creativeSummary?.match(/Music:\s*([^·]+)/i)?.[1]?.trim() ?? null);
  if (musicStyle) populatedFrom.push(prefs.preferMinimalMusic ? "preference" : "creative");

  const voiceStyle = ctx.creativeSummary?.match(/Voice:\s*([^·]+)/i)?.[1]?.trim()
    ?? ctx.marketingSummary?.match(/voice/i)?.[0]
    ?? null;
  if (voiceStyle) populatedFrom.push("creative/marketing");

  const visualStyle = ctx.creativeSummary?.match(/Camera:\s*([^·]+)/i)?.[1]?.trim() ?? null;
  if (visualStyle) populatedFrom.push("creative");

  return {
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    visualStyle,
    pacing,
    productPresentation,
    ctaStyle: cta,
    musicStyle,
    voiceStyle,
    language,
    platform,
    audience,
    marketingGoal: goal,
    populatedFrom: [...new Set(populatedFrom)],
  };
}

export function formatCreativeProfile(profile: CreativeProfile | null, lang: "en" | "rw"): string {
  if (!profile) {
    return lang === "rw"
      ? "Creative profile ntiboneka — load production/review context."
      : "Creative profile unavailable — load production/review context.";
  }
  const lines = [
    lang === "rw" ? "Current Creative Profile:" : "Current Creative Profile:",
    profile.productPresentation && `• ${profile.productPresentation}`,
    profile.pacing && `• ${profile.pacing}`,
    profile.voiceStyle && `• Voice: ${profile.voiceStyle}`,
    profile.language && `• Language: ${profile.language}`,
    profile.ctaStyle && `• CTA: ${profile.ctaStyle}`,
    profile.platform && `• Platform: ${profile.platform}`,
    profile.musicStyle && `• Music: ${profile.musicStyle}`,
    profile.visualStyle && `• Visual: ${profile.visualStyle}`,
    profile.audience && `• Audience: ${profile.audience}`,
    profile.marketingGoal && `• Goal: ${profile.marketingGoal}`,
  ].filter(Boolean);
  if (lines.length <= 1) {
    return lang === "rw"
      ? "Profile iriho gato — fill marketing/creative configuration."
      : "Sparse profile — populate marketing/creative configuration.";
  }
  return lines.join("\n");
}

export function detectWorkflowPhase(args: {
  ctx: AssistantContext;
  review: CreativeReviewState | null;
  finalStatus: string | null;
  hasRecommendations: boolean;
  pendingPlan: boolean;
}): WorkflowPhase {
  const { ctx, review, finalStatus, pendingPlan } = args;
  if (!ctx.available) return "DRAFT";
  if (finalStatus === "FAILED" || finalStatus === "QC_FAILED" || finalStatus === "BLOCKED") return "FAILED";
  if (pendingPlan) return "APPROVAL";
  const rs = review?.reviewStatus ?? ctx.reviewStatus;
  if (rs === "APPROVED") return "COMPLETED";
  if (rs === "REJECTED") return "CANCELLED";
  if (rs === "NEEDS_CHANGES" || rs === "IN_REVIEW" || rs === "READY_FOR_REVIEW") return "REVIEW";
  if (ctx.qcOverall === "FAIL" || ctx.qcOverall === "FAILED") return "QC";
  if (finalStatus === "RENDERING" || finalStatus === "EXPORTING") return "RENDERING";
  if (finalStatus === "ASSEMBLING" || finalStatus === "VALIDATING") return "PRODUCING";
  if (ctx.productionStatus === "COMPLETED" || finalStatus === "COMPLETED") return "REVIEW";
  if (ctx.progress != null && ctx.progress > 0 && ctx.progress < 100) return "PRODUCING";
  return "INPUT_READY";
}

export function resolveNextAction(args: {
  phase: WorkflowPhase;
  highPriority: number;
  recommendationCount: number;
  reviewStatus: string;
  qcOverall: string | null;
}): SmartNextAction {
  const { phase, highPriority, recommendationCount, reviewStatus, qcOverall } = args;

  if (phase === "FAILED" || qcOverall === "FAIL" || qcOverall === "FAILED") {
    return {
      kind: "VIEW_QC",
      label: "VIEW QC ISSUES",
      workspace: "creative-review",
      reason: "QC or production failure needs attention.",
      primary: true,
    };
  }
  if (phase === "DRAFT" || phase === "INPUT_READY") {
    return {
      kind: "START_PRODUCTION",
      label: "OPEN PRODUCTION",
      workspace: "queue",
      reason: "No completed production context for review yet.",
      primary: true,
    };
  }
  if (phase === "PRODUCING" || phase === "RENDERING") {
    return {
      kind: "RENDER",
      label: "OPEN COMMAND CENTER",
      workspace: "command-center",
      reason: "Production is still in progress.",
      primary: true,
    };
  }
  if (phase === "QC") {
    return {
      kind: "QC",
      label: "VIEW QC ISSUES",
      workspace: "creative-review",
      reason: "QC requires review.",
      primary: true,
    };
  }
  if (phase === "APPROVAL") {
    return {
      kind: "FIX",
      label: "REVIEW CORRECTION PLAN",
      workspace: "ai-me",
      reason: "A correction plan is pending approval.",
      primary: true,
    };
  }
  if (highPriority > 0 || recommendationCount > 0) {
    return {
      kind: "FIX",
      label: "REVIEW RECOMMENDATIONS",
      workspace: "creative-review",
      reason: `${recommendationCount} recommendation(s), ${highPriority} high priority.`,
      primary: true,
    };
  }
  if (reviewStatus === "READY_FOR_REVIEW" || reviewStatus === "IN_REVIEW" || phase === "REVIEW") {
    return {
      kind: "OPEN_REVIEW",
      label: "OPEN REVIEW",
      workspace: "creative-review",
      reason: "Production complete — creative review is the next step.",
      primary: true,
    };
  }
  if (reviewStatus === "APPROVED" || phase === "COMPLETED") {
    return {
      kind: "EXPORT",
      label: "OPEN OUTPUTS",
      workspace: "output",
      reason: "Version approved — open outputs/export.",
      primary: true,
    };
  }
  return {
    kind: "NONE",
    label: "No forced action",
    workspace: null,
    reason: "No blocking next action from current state.",
    primary: false,
  };
}

export function buildStartupSummary(args: {
  ctx: AssistantContext;
  phase: WorkflowPhase;
  recommendationCount: number;
  highPriorityCount: number;
  next: SmartNextAction;
  memoriesUsed: number;
}): StartupSummary {
  const { ctx, phase, recommendationCount, highPriorityCount, next, memoriesUsed } = args;
  const lines = [
    `WHAT HAPPENED: Production ${ctx.productionStatus}; QC ${ctx.qcOverall ?? "N/A"}.`,
    `WHAT IS CURRENT: Version ${ctx.versionLabel}; Review ${ctx.reviewStatus}; Workflow ${phase}.`,
    `WHAT NEEDS ATTENTION: ${highPriorityCount} high-priority recommendation(s); ${recommendationCount} total.`,
    `WHAT I RECOMMEND: ${next.reason}`,
    `WHAT YOU CAN DO NEXT: ${next.label}`,
  ];
  if (memoriesUsed > 0) {
    lines.push(`Based on this project's previous decisions... (${memoriesUsed} relevant memories).`);
  }
  return {
    projectName: ctx.projectName,
    productionStatus: ctx.productionStatus,
    currentVersion: ctx.versionLabel,
    reviewStatus: ctx.reviewStatus,
    recommendationCount,
    highPriorityCount,
    nextAction: next.kind,
    nextActionLabel: next.label,
    workflowPhase: phase,
    lines,
  };
}

export function retrieveRelevantMemory(
  memories: CreativeMemoryEntry[],
  projectId: string,
  topicHint: string | null,
): CreativeMemoryEntry[] {
  const active = memories.filter(
    (m) => m.projectId === projectId && m.lifecycle === "ACTIVE" && !m.disabled,
  );
  if (!topicHint) {
    return active
      .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance))
      .slice(0, 12);
  }
  const hint = topicHint.toLowerCase();
  const topical = active.filter((m) =>
    m.topic.toLowerCase().includes(hint)
    || m.content.toLowerCase().includes(hint)
    || m.category.toLowerCase().includes(hint),
  );
  const newestExplicit = topical
    .filter((m) => m.source === "USER" && m.confidence === "CONFIRMED")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const rest = topical.filter((m) => !newestExplicit.includes(m));
  return [...newestExplicit, ...rest].slice(0, 12);
}

function importanceRank(i: CreativeMemoryEntry["importance"]): number {
  return { HIGH: 3, MEDIUM: 2, LOW: 1 }[i];
}

export function resolveMemoryConflicts(entries: CreativeMemoryEntry[]): CreativeMemoryEntry[] {
  // Newest explicit USER CONFIRMED wins per topic
  const byTopic = new Map<string, CreativeMemoryEntry>();
  const sorted = [...entries].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const e of sorted) {
    const prev = byTopic.get(e.topic);
    if (!prev) {
      byTopic.set(e.topic, e);
      continue;
    }
    if (e.source === "USER" && e.confidence === "CONFIRMED") {
      byTopic.set(e.topic, { ...e, lifecycle: "ACTIVE" });
      // mark older outdated conceptually by not selecting it
    } else if (prev.source === "USER" && prev.confidence === "CONFIRMED" && e.source !== "USER") {
      continue;
    } else {
      byTopic.set(e.topic, e);
    }
  }
  return [...byTopic.values()];
}

export function nextActionKindToWorkspace(kind: NextActionKind): string | null {
  const map: Record<NextActionKind, string | null> = {
    UPLOAD: "new-project",
    ANALYZE: "ai-me",
    REVIEW: "creative-review",
    FIX: "creative-review",
    RENDER: "command-center",
    QC: "creative-review",
    APPROVE: "creative-review",
    EXPORT: "output",
    OPEN_REVIEW: "creative-review",
    VIEW_QC: "creative-review",
    START_PRODUCTION: "queue",
    NONE: null,
  };
  return map[kind];
}
