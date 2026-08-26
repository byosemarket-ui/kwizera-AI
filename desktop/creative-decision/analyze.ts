/** Deterministic creative analysis — evidence-based only, never invent measurements. */

import type { AssistantContext } from "../creative-assistant/types";
import type { CreativeReviewState } from "../creative-review/types";
import type { ClaimAuditItem } from "../production-plan/types";
import { bumpVersionLabel } from "../creative-assistant/intent";
import type {
  ConflictNotice,
  CorrectionChangeItem,
  CreativeCorrectionPlan,
  DetectedIssue,
  ImpactAnalysis,
  IssueCategory,
  IssueSeverity,
  ProjectPreferenceMemory,
  RecommendationGroup,
  RiskLevel,
  SmartRecommendation,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function severityRank(s: IssueSeverity): number {
  return { CRITICAL: 100, HIGH: 80, MEDIUM: 50, LOW: 25, INFO: 10 }[s];
}

function groupFor(severity: IssueSeverity): RecommendationGroup {
  if (severity === "CRITICAL" || severity === "HIGH") return "MUST_FIX";
  if (severity === "MEDIUM") return "SHOULD_IMPROVE";
  return "OPTIONAL";
}

function riskFor(category: IssueCategory, severity: IssueSeverity): { risk: RiskLevel; reason: string } {
  if (category === "TIMING" || category === "SCENE_FLOW") {
    return { risk: "MEDIUM", reason: "Timing/scene changes may affect timeline and audio sync." };
  }
  if (severity === "CRITICAL") {
    return { risk: "HIGH", reason: "Critical production blockers require full re-finalization." };
  }
  if (category === "CTA_VISIBILITY" || category === "TEXT_READABILITY" || category === "PRODUCT_VISIBILITY") {
    return { risk: "LOW", reason: "Localized creative adjustment; original version remains intact." };
  }
  return { risk: "MEDIUM", reason: "Change will create a new version through the existing production path." };
}

function feedbackToCategory(cat: string): IssueCategory {
  const map: Record<string, IssueCategory> = {
    PRODUCT_VISIBILITY: "PRODUCT_VISIBILITY",
    TEXT_READABILITY: "TEXT_READABILITY",
    AUDIO: "AUDIO_QUALITY",
    TIMING: "TIMING",
    CTA: "CTA_VISIBILITY",
    VISUAL: "VISUAL_QUALITY",
    OTHER: "OUTPUT_QUALITY",
  };
  return map[cat] ?? "OUTPUT_QUALITY";
}

function toFeedbackCategory(cat: IssueCategory): SmartRecommendation["feedbackCategory"] {
  if (cat === "PRODUCT_VISIBILITY") return "PRODUCT_VISIBILITY";
  if (cat === "TEXT_READABILITY" || cat === "SUBTITLE_QUALITY") return "TEXT_READABILITY";
  if (cat === "AUDIO_QUALITY" || cat === "VOICE_CLARITY" || cat === "MUSIC_BALANCE") return "AUDIO";
  if (cat === "TIMING" || cat === "SCENE_FLOW") return "TIMING";
  if (cat === "CTA_VISIBILITY" || cat === "MARKETING_ALIGNMENT") return "CTA";
  if (cat === "VISUAL_QUALITY" || cat === "BRAND_CONSISTENCY") return "VISUAL";
  return "OTHER";
}

export function fingerprintContext(ctx: AssistantContext, review: CreativeReviewState | null): string {
  return [
    ctx.productionId,
    ctx.versionLabel,
    ctx.reviewStatus,
    ctx.qcOverall,
    ctx.feedbackCount,
    ctx.commentCount,
    ctx.scenes.map((s) => `${s.id}:${s.hasVisual ? 1 : 0}`).join(","),
    review?.aiReview.availability ?? "",
  ].join("|");
}

export function detectIssues(args: {
  ctx: AssistantContext;
  review: CreativeReviewState | null;
  claimAudit: ClaimAuditItem[];
  prefs: ProjectPreferenceMemory;
}): DetectedIssue[] {
  const { ctx, review, claimAudit, prefs } = args;
  const issues: DetectedIssue[] = [];
  const now = Date.now();

  // QC failures — CRITICAL/HIGH with real evidence
  for (const fail of ctx.qcFailures) {
    issues.push({
      issueId: uid("iss"),
      category: "OUTPUT_QUALITY",
      severity: "CRITICAL",
      priorityScore: 0,
      title: "QC failure",
      observation: fail,
      evidence: [`QC: ${fail}`, `Overall: ${ctx.qcOverall ?? "UNKNOWN"}`],
      sceneId: ctx.scenes.find((s) => !s.hasVisual)?.id ?? ctx.selectedSceneId,
      sceneNumber: ctx.scenes.find((s) => !s.hasVisual)?.number ?? null,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // Missing visuals
  for (const sc of ctx.scenes.filter((s) => !s.hasVisual)) {
    issues.push({
      issueId: uid("iss"),
      category: "PRODUCT_VISIBILITY",
      severity: "HIGH",
      priorityScore: 0,
      title: `Low / missing product visual in Scene ${sc.number}`,
      observation: `Scene ${sc.number} (${sc.name}) has incomplete visual/product reference.`,
      evidence: [`hasVisual=false`, `sceneId=${sc.id}`],
      sceneId: sc.id,
      sceneNumber: sc.number,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // Missing voice
  for (const sc of ctx.scenes.filter((s) => !s.hasVoice)) {
    issues.push({
      issueId: uid("iss"),
      category: "VOICE_CLARITY",
      severity: "MEDIUM",
      priorityScore: 0,
      title: `Missing voice track signal in Scene ${sc.number}`,
      observation: `Scene ${sc.number} reports no voice association in review metadata.`,
      evidence: [`hasVoice=false`, `sceneId=${sc.id}`],
      sceneId: sc.id,
      sceneNumber: sc.number,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // QC warnings
  for (const warn of ctx.qcWarnings.slice(0, 4)) {
    issues.push({
      issueId: uid("iss"),
      category: "OUTPUT_QUALITY",
      severity: "LOW",
      priorityScore: 0,
      title: "QC warning / check unavailable",
      observation: warn,
      evidence: [warn],
      sceneId: null,
      sceneNumber: null,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // Claim safety blocking
  for (const claim of claimAudit.filter((c) => c.blocks || c.status === "DO NOT USE")) {
    issues.push({
      issueId: uid("iss"),
      category: "CLAIM_SAFETY",
      severity: "CRITICAL",
      priorityScore: 0,
      title: "Claim Safety block",
      observation: claim.text,
      evidence: [`status=${claim.status}`, claim.reason, `location=${claim.location}`],
      sceneId: null,
      sceneNumber: null,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // User feedback — highest priority boost
  for (const fb of review?.feedback ?? []) {
    const cat = feedbackToCategory(fb.category);
    issues.push({
      issueId: uid("iss"),
      category: cat,
      severity: "HIGH",
      priorityScore: 0,
      title: `User feedback: ${fb.category.replace(/_/g, " ")}`,
      observation: fb.comment,
      evidence: [`feedbackId=${fb.feedbackId}`, `category=${fb.category}`, fb.timestampSec != null ? `t=${fb.timestampSec}s` : "no timestamp"],
      sceneId: fb.sceneId,
      sceneNumber: ctx.scenes.find((s) => s.id === fb.sceneId)?.number ?? null,
      fromUserFeedback: true,
      feedbackId: fb.feedbackId,
    });
  }

  for (const tc of review?.timestampComments ?? []) {
    issues.push({
      issueId: uid("iss"),
      category: "TIMING",
      severity: "HIGH",
      priorityScore: 0,
      title: `Timestamp comment at ${Math.floor(tc.timestampSec)}s`,
      observation: tc.comment,
      evidence: [`commentId=${tc.commentId}`, `timestamp=${tc.timestampSec}`],
      sceneId: tc.sceneId,
      sceneNumber: ctx.scenes.find((s) => s.id === tc.sceneId)?.number ?? null,
      fromUserFeedback: true,
      feedbackId: tc.commentId,
    });
  }

  // Marketing / platform alignment (only when config exists)
  if (ctx.marketingSummary?.toLowerCase().includes("tiktok") && prefs.preferShorterVideos === false) {
    // Only suggest if duration evidence exists and is long — don't invent
    const durMatch = ctx.videoMeta?.match(/(\d+(?:\.\d+)?)s/);
    if (durMatch && Number(durMatch[1]) > 30) {
      issues.push({
        issueId: uid("iss"),
        category: "MARKETING_ALIGNMENT",
        severity: "MEDIUM",
        priorityScore: 0,
        title: "Platform pacing opportunity",
        observation: `Configured platform mentions TikTok and current duration metadata is ${durMatch[1]}s.`,
        evidence: [ctx.marketingSummary, ctx.videoMeta || ""],
        sceneId: null,
        sceneNumber: null,
        fromUserFeedback: false,
        feedbackId: null,
      });
    }
  }

  if (ctx.marketingSummary?.includes("CTA") && !ctx.scenes.some((s) => s.hasText)) {
    issues.push({
      issueId: uid("iss"),
      category: "CTA_VISIBILITY",
      severity: "MEDIUM",
      priorityScore: 0,
      title: "CTA text association weak",
      observation: "Marketing config includes CTA but no scene reports text association.",
      evidence: [ctx.marketingSummary, "scenes.hasText all false or missing"],
      sceneId: ctx.scenes.at(-1)?.id ?? null,
      sceneNumber: ctx.scenes.at(-1)?.number ?? null,
      fromUserFeedback: false,
      feedbackId: null,
    });
  }

  // Preference boosts (memory) — only when matching issue already exists
  void now;

  // Deduplicate similar titles+scene
  const seen = new Set<string>();
  const unique = issues.filter((i) => {
    const key = `${i.category}|${i.sceneId}|${i.observation.slice(0, 48)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return prioritizeIssues(unique, prefs);
}

export function prioritizeIssues(issues: DetectedIssue[], prefs: ProjectPreferenceMemory): DetectedIssue[] {
  return issues
    .map((i) => {
      let score = severityRank(i.severity);
      if (i.fromUserFeedback) score += 40;
      if (i.category === "CLAIM_SAFETY") score += 30;
      if (i.category === "PRODUCT_VISIBILITY" && prefs.preferProductCentered) score += 15;
      if (i.category === "CTA_VISIBILITY" && prefs.preferStrongerCta) score += 15;
      if ((i.category === "MUSIC_BALANCE" || i.category === "AUDIO_QUALITY") && prefs.preferMinimalMusic) score += 10;
      if (i.category === "TIMING" && prefs.preferShorterVideos) score += 10;
      if (i.category === "OUTPUT_QUALITY" && i.severity === "CRITICAL") score += 20;
      return { ...i, priorityScore: score };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function detectConflicts(args: {
  issue: DetectedIssue;
  ctx: AssistantContext;
  claimAudit: ClaimAuditItem[];
}): ConflictNotice[] {
  const { issue, ctx, claimAudit } = args;
  const conflicts: ConflictNotice[] = [];

  if (/remove (the )?cta|delete cta|siba cta/i.test(issue.observation) && ctx.marketingSummary?.includes("CTA")) {
    conflicts.push({
      conflictId: uid("cf"),
      kind: "USER_VS_MARKETING",
      message: "This conflicts with the current campaign configuration (CTA required).",
      options: [
        { id: "keep-cta", label: "KEEP CTA" },
        { id: "change-campaign", label: "CHANGE CAMPAIGN SETTING" },
      ],
    });
  }

  if (issue.category === "CLAIM_SAFETY" || claimAudit.some((c) => c.blocks)) {
    const blocking = claimAudit.filter((c) => c.blocks || c.status === "DO NOT USE");
    if (blocking.length && (issue.category === "CLAIM_SAFETY" || /claim|guarantee|best|#1/i.test(issue.observation))) {
      conflicts.push({
        conflictId: uid("cf"),
        kind: "CLAIM_SAFETY",
        message: `CLAIM SAFETY WARNING — ${blocking[0].reason || "Wording is not supported by available product information."}`,
        options: [
          { id: "revise-text", label: "REVISE WORDING" },
          { id: "cancel", label: "CANCEL" },
        ],
      });
    }
  }

  return conflicts;
}

export function buildRecommendations(args: {
  issues: DetectedIssue[];
  ctx: AssistantContext;
  claimAudit: ClaimAuditItem[];
  ignoredIds: Set<string>;
}): SmartRecommendation[] {
  const { issues, ctx, claimAudit, ignoredIds } = args;
  const now = new Date().toISOString();
  const recs: SmartRecommendation[] = [];

  for (const issue of issues) {
    const ignoreKey = `${issue.category}|${issue.sceneId}|${issue.observation.slice(0, 40)}`;
    if (ignoredIds.has(ignoreKey) || ignoredIds.has(issue.issueId)) continue;

    const { risk, reason: riskReason } = riskFor(issue.category, issue.severity);
    const conflicts = detectConflicts({ issue, ctx, claimAudit });
    const where = issue.sceneNumber != null
      ? `Scene ${issue.sceneNumber}`
      : issue.sceneId || "Production / global";

    recs.push({
      recommendationId: uid("rec"),
      issueId: issue.issueId,
      status: "RECOMMENDED",
      group: groupFor(issue.severity),
      category: issue.category,
      severity: issue.severity,
      priorityScore: issue.priorityScore,
      what: recommendationWhat(issue),
      why: issue.observation,
      where,
      expectedResult: expectedFor(issue),
      observation: issue.evidence.join(" · ") || issue.observation,
      confidence: null,
      confidenceLabel: "NOT AVAILABLE",
      risk,
      riskReason,
      sceneId: issue.sceneId,
      conflicts,
      selected: issue.fromUserFeedback || issue.severity === "CRITICAL" || issue.severity === "HIGH",
      ignoredAt: null,
      ignoreReason: null,
      appliedVersion: null,
      createdAt: now,
      updatedAt: now,
      feedbackCategory: toFeedbackCategory(issue.category),
    });
  }

  return recs.sort((a, b) => b.priorityScore - a.priorityScore);
}

function recommendationWhat(issue: DetectedIssue): string {
  switch (issue.category) {
    case "PRODUCT_VISIBILITY": return "Increase product visual prominence.";
    case "CTA_VISIBILITY": return "Improve CTA visibility / placement.";
    case "AUDIO_QUALITY":
    case "MUSIC_BALANCE": return "Rebalance audio / reduce competing music.";
    case "VOICE_CLARITY": return "Restore or clarify voice for the affected scene.";
    case "TEXT_READABILITY":
    case "SUBTITLE_QUALITY": return "Improve text / subtitle readability.";
    case "TIMING": return "Adjust timing for the referenced moment.";
    case "CLAIM_SAFETY": return "Remove or revise unsupported claims.";
    case "MARKETING_ALIGNMENT": return "Align pacing/duration with platform configuration.";
    case "OUTPUT_QUALITY": return "Resolve QC / output quality failure.";
    default: return "Apply a safe creative correction.";
  }
}

function expectedFor(issue: DetectedIssue): string {
  switch (issue.category) {
    case "PRODUCT_VISIBILITY": return "Clearer product recognition in the affected scene.";
    case "CTA_VISIBILITY": return "CTA becomes easier to notice.";
    case "CLAIM_SAFETY": return "Claim Safety blocks cleared for export.";
    case "OUTPUT_QUALITY": return "QC returns to a non-blocking state on the next version.";
    default: return "Improved creative clarity on the next version (verification depends on available QC).";
  }
}

export function buildImpact(changes: CorrectionChangeItem[]): ImpactAnalysis {
  const affected = new Set<string>();
  const deps = new Set<string>();
  for (const c of changes) {
    affected.add(c.sceneLabel);
    for (const d of c.dependencies) deps.add(d);
  }
  const hasTiming = changes.some((c) => c.category === "TIMING" || c.category === "SCENE_FLOW");
  if (hasTiming) {
    affected.add("Master Timeline");
    affected.add("Voice timing");
    deps.add("Timeline");
    deps.add("Audio sync");
  }
  affected.add("Final render package (new version)");

  return {
    affected: [...affected],
    notAffected: ["Product database", "Original source assets", "Source version package files"],
    expectedProcessing: "Full finalization path via existing Production Final engine (targeted partial re-render is not claimed).",
    partialSupported: false,
    partialNote: "Existing renderer does not expose surgical partial scene re-render — full createNewVersion path is used.",
  };
}

export function createCorrectionPlan(args: {
  ctx: AssistantContext;
  recommendations: SmartRecommendation[];
}): CreativeCorrectionPlan {
  const { ctx, recommendations } = args;
  const now = new Date().toISOString();
  const selected = recommendations.filter((r) => r.selected && r.status !== "IGNORED");
  const changes: CorrectionChangeItem[] = selected.map((r, idx) => {
    const deps: string[] = [];
    if (r.category === "TIMING" || r.category === "SCENE_FLOW") {
      deps.push("Master Timeline", "Voice synchronization", "Subtitle timing", "Music timing");
    }
    if (r.category === "AUDIO_QUALITY" || r.category === "MUSIC_BALANCE" || r.category === "VOICE_CLARITY") {
      deps.push("Audio mix");
    }
    if (r.category === "PRODUCT_VISIBILITY" || r.category === "VISUAL_QUALITY") {
      deps.push("Scene visual output", "Final render");
    }
    return {
      itemId: uid("ci"),
      recommendationId: r.recommendationId,
      sceneId: r.sceneId,
      sceneLabel: r.where,
      change: `${idx + 1}. ${r.where} — ${r.what}`,
      category: r.category,
      dependencies: deps,
    };
  });

  const impact = buildImpact(changes);
  const maxRisk = selected.some((r) => r.risk === "HIGH")
    ? "HIGH" as const
    : selected.some((r) => r.risk === "MEDIUM")
      ? "MEDIUM" as const
      : "LOW" as const;

  const allConflicts = selected.flatMap((r) => r.conflicts);
  const claimBlocked = allConflicts.some((c) => c.kind === "CLAIM_SAFETY")
    || selected.some((r) => r.category === "CLAIM_SAFETY");

  return {
    planId: uid("plan"),
    projectId: ctx.projectId,
    productionId: ctx.productionId,
    sourceVersion: ctx.versionLabel,
    targetVersion: bumpVersionLabel(ctx.versionLabel),
    status: "PENDING_APPROVAL",
    changes,
    reason: selected.map((r) => r.why).slice(0, 3).join(" · ") || "User-approved creative corrections",
    expectedResult: selected.map((r) => r.expectedResult).slice(0, 3).join(" · "),
    dependencies: [...new Set(changes.flatMap((c) => c.dependencies))],
    risk: maxRisk,
    riskReason: selected[0]?.riskReason || "New version via existing production system; source version preserved.",
    impact,
    conflicts: allConflicts,
    claimSafetyBlocked: claimBlocked,
    createdAt: now,
    updatedAt: now,
    resultNote: null,
    verification: null,
  };
}

export function updatePreferencesFromFeedback(
  prefs: ProjectPreferenceMemory,
  texts: string[],
): ProjectPreferenceMemory {
  const blob = texts.join(" ").toLowerCase();
  const next = { ...prefs, notes: [...prefs.notes] };
  if (/nini|bigger|larger|product.?center|visibility|igaragara/i.test(blob)) {
    next.preferProductCentered = true;
    next.notes.push("User prefers product-centered / larger product visuals.");
  }
  if (/cta|call to action/i.test(blob)) {
    next.preferStrongerCta = true;
    next.notes.push("User prefers stronger CTA.");
  }
  if (/gabanya music|reduce music|minimal music|quiet/i.test(blob)) {
    next.preferMinimalMusic = true;
    next.notes.push("User prefers minimal music.");
  }
  if (/ngufi|shorter|short video|tiktok/i.test(blob)) {
    next.preferShorterVideos = true;
    next.notes.push("User prefers shorter videos.");
  }
  next.updatedAt = new Date().toISOString();
  next.notes = [...new Set(next.notes)].slice(-20);
  return next;
}

export function formatRecommendationsForAiMe(
  recs: SmartRecommendation[],
  lang: "en" | "rw",
): string {
  if (!recs.length) {
    return lang === "rw"
      ? "Nta recommendation ifite evidence ibonetse kuri iyi version."
      : "No evidence-based recommendations for this version.";
  }
  const lines = recs.slice(0, 6).map((r, i) =>
    `${i + 1}. ${r.severity} — ${r.what} (${r.where})\n   Why: ${r.why}\n   Group: ${r.group.replace(/_/g, " ")} · Confidence: ${r.confidenceLabel}`,
  );
  const header = lang === "rw"
    ? `Nabonye recommendations ${recs.length}:`
    : `I found ${recs.length} recommendation(s):`;
  return [header, "", ...lines].join("\n");
}
