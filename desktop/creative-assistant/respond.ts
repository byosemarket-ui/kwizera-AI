/** Context-grounded responses — never invent project data. */

import type { AssistantAction, AssistantContext, AssistantIntent, AssistantLanguage, AssistantMessage, ChangeRequestObject, SuggestionCard } from "./types";
import { bumpVersionLabel, extractSceneId, extractTimestampSec, inferFeedbackCategory } from "./intent";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function sceneLabel(ctx: AssistantContext, sceneId: string | null): string {
  if (!sceneId) return "—";
  const s = ctx.scenes.find((x) => x.id === sceneId);
  return s ? `Scene ${s.number} (${s.name})` : sceneId;
}

export function buildClarifyMessage(lang: AssistantLanguage): AssistantMessage {
  const body = lang === "rw"
    ? "Ni iki ushaka ko nzahindura?\n\nHitamo:\n• Product visibility\n• Visual quality\n• Audio\n• CTA\n• Text\n• Timing\n• Marketing impact\n• Overall creative style"
    : "What would you like me to improve?\n\nOptions:\n• Product visibility\n• Visual quality\n• Audio\n• CTA\n• Text\n• Timing\n• Marketing impact\n• Overall creative style";
  return {
    id: uid("msg"),
    role: "assistant",
    title: "CLARIFY",
    body,
    language: lang,
    intent: "CLARIFY",
    createdAt: new Date().toISOString(),
    actions: [
      { id: "opt-product", label: "Product visibility", kind: "prepare", payload: { topic: "PRODUCT_VISIBILITY" } },
      { id: "opt-audio", label: "Audio", kind: "prepare", payload: { topic: "AUDIO" } },
      { id: "opt-cta", label: "CTA", kind: "prepare", payload: { topic: "CTA" } },
      { id: "opt-timing", label: "Timing", kind: "prepare", payload: { topic: "TIMING" } },
    ],
  };
}

export function buildSuggestions(ctx: AssistantContext): SuggestionCard[] {
  const cards: SuggestionCard[] = [];
  for (const fail of ctx.qcFailures.slice(0, 3)) {
    const scene = ctx.scenes.find((s) => !s.hasVisual) ?? ctx.scenes[0] ?? null;
    cards.push({
      id: uid("sug"),
      title: "Address QC failure",
      reason: fail,
      affectedArea: scene ? `Scene ${scene.number}` : "Production",
      expectedBenefit: "Restore QC PASS on the next version.",
      preparePayload: {
        category: "VISUAL",
        sceneId: scene?.id ?? null,
        comment: fail,
      },
    });
  }
  for (const sc of ctx.scenes.filter((s) => !s.hasVisual).slice(0, 2)) {
    cards.push({
      id: uid("sug"),
      title: `Increase product visibility in Scene ${sc.number}`,
      reason: "Product/visual reference is incomplete for this scene.",
      affectedArea: `Scene ${sc.number}`,
      expectedBenefit: "Better product recognition.",
      preparePayload: {
        category: "PRODUCT_VISIBILITY",
        sceneId: sc.id,
        comment: `Improve product visibility in Scene ${sc.number}.`,
      },
    });
  }
  if (!cards.length && ctx.qcWarnings.length) {
    cards.push({
      id: uid("sug"),
      title: "Review QC warnings",
      reason: ctx.qcWarnings[0],
      affectedArea: "Quality Control",
      expectedBenefit: "Clear remaining warnings before approval.",
      preparePayload: {
        category: "OTHER",
        sceneId: ctx.selectedSceneId,
        comment: ctx.qcWarnings[0],
      },
    });
  }
  if (!cards.length) {
    cards.push({
      id: uid("sug"),
      title: "Tighten CTA timing",
      reason: "Marketing context recommends clear CTA placement.",
      affectedArea: ctx.marketingSummary?.includes("CTA") ? "CTA / Text" : "Global",
      expectedBenefit: "Stronger call-to-action recognition.",
      preparePayload: {
        category: "CTA",
        sceneId: ctx.scenes.at(-1)?.id ?? null,
        comment: "Make CTA more prominent near the end of the video.",
      },
    });
  }
  return cards.slice(0, 4);
}

export function createChangeProposal(
  ctx: AssistantContext,
  userText: string,
  overrides?: { category?: ReturnType<typeof inferFeedbackCategory>; sceneId?: string | null; interpretation?: string },
): ChangeRequestObject {
  const sceneId = overrides?.sceneId ?? extractSceneId(userText, ctx.scenes) ?? ctx.selectedSceneId;
  const category = overrides?.category ?? inferFeedbackCategory(userText);
  const next = bumpVersionLabel(ctx.versionLabel);
  const interpretation = overrides?.interpretation
    ?? `Apply a safe creative adjustment (${category}) on ${sceneLabel(ctx, sceneId)} without overwriting ${ctx.versionLabel}.`;
  const now = new Date().toISOString();
  return {
    changeId: uid("chg"),
    projectId: ctx.projectId,
    productionId: ctx.productionId,
    sourceVersionId: ctx.versionLabel,
    requestedVersion: next,
    intent: "CREATIVE_CHANGE",
    target: { type: sceneId ? "scene" : "global", id: sceneId },
    requestedChange: userText,
    aiInterpretation: interpretation,
    reason: ctx.qcFailures[0] || ctx.qcWarnings[0] || "User-requested creative improvement",
    status: "PENDING_APPROVAL",
    category,
    sceneId,
    timestampSec: extractTimestampSec(userText),
    createdAt: now,
    updatedAt: now,
    resultNote: null,
  };
}

export function respondToIntent(args: {
  intent: AssistantIntent;
  text: string;
  lang: AssistantLanguage;
  ctx: AssistantContext;
}): { message: AssistantMessage; proposal?: ChangeRequestObject; navigateTo?: string } {
  const { intent, text, lang, ctx } = args;

  if (!ctx.available) {
    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "PROJECT CONTEXT UNAVAILABLE",
        body: ctx.unavailableReason || "Project context could not be loaded. I will not guess project-specific answers.",
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
        actions: [
          { id: "nav-review", label: "Open Creative Review", kind: "navigate", payload: { workspace: "creative-review" } },
          { id: "nav-output", label: "Open Final Outputs", kind: "navigate", payload: { workspace: "output" } },
          { id: "retry", label: "RETRY", kind: "retry" },
        ],
      },
    };
  }

  if (intent === "CLARIFY") {
    return { message: buildClarifyMessage(lang) };
  }

  if (intent === "HELP") {
    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "AI Me · Help",
        body: lang === "rw"
          ? `Nshobora gusobanura production, QC, scenes, no gutegura impinduka ku ${ctx.versionLabel}.\n\nCommands: Explain Production · Find Problems · Explain QC · Suggest Improvements · Prepare Changes.`
          : `I can explain production ${ctx.productionId}, QC, scenes, and prepare safe changes for a new version (${ctx.versionLabel} → next).\n\nQuick commands are available above the composer.`,
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
      },
    };
  }

  if (intent === "QC_QUERY") {
    const failed = ctx.qcFailures;
    const body = failed.length
      ? (lang === "rw"
        ? `QC yananiwe (${ctx.qcOverall}).\n\nIkibazo:\n${failed.map((f) => `• ${f}`).join("\n")}\n\nInama: Tegura version nshya nyuma yo gukosora.`
        : `QC result: ${ctx.qcOverall}.\n\nFailed check(s):\n${failed.map((f) => `• ${f}`).join("\n")}\n\nRecommended next action: prepare a fix and create ${bumpVersionLabel(ctx.versionLabel)} after confirmation.`)
      : (lang === "rw"
        ? `QC: ${ctx.qcOverall ?? "NOT AVAILABLE"}. Nta critical failure. Warnings: ${ctx.qcWarnings.length || 0}.`
        : `QC: ${ctx.qcOverall ?? "NOT AVAILABLE"}. No critical failures recorded. Warnings/unavailable checks: ${ctx.qcWarnings.length}.`);
    return {
      message: {
        id: uid("msg"), role: "assistant", title: "QC Explanation", body, language: lang, intent,
        createdAt: new Date().toISOString(),
        actions: failed.length
          ? [{ id: "prep", label: "PREPARE CHANGE", kind: "prepare", payload: { fromQc: true } }]
          : [{ id: "nav-qc", label: "Open Review QC", kind: "navigate", payload: { workspace: "creative-review" } }],
      },
    };
  }

  if (intent === "PRODUCTION_QUERY") {
    const body = lang === "rw"
      ? `Production ${ctx.productionId} iri ${ctx.productionStatus}.\nProgress: ${ctx.progress ?? "—"}%.\nStage: ${ctx.currentStage ?? "—"}.\nETA: ${ctx.etaLabel ?? "—"}.\n${ctx.resourceSummary ? `Resources: ${ctx.resourceSummary}` : ""}`
      : `Production ${ctx.productionId} is ${ctx.productionStatus}.\nProgress: ${ctx.progress ?? "—"}%.\nCurrent stage: ${ctx.currentStage ?? "—"}.\nETA: ${ctx.etaLabel ?? "—"}.\n${ctx.resourceSummary ? `Resources: ${ctx.resourceSummary}` : ""}`;
    return {
      message: { id: uid("msg"), role: "assistant", title: "Production Status", body, language: lang, intent, createdAt: new Date().toISOString() },
    };
  }

  if (intent === "VERSION_REQUEST" || (intent === "EXPLAIN" && /version/i.test(text))) {
    const body = lang === "rw"
      ? `Version iriho ubu: ${ctx.versionLabel}.\nReview: ${ctx.reviewStatus}.\nPackage: ${ctx.packageId ?? "—"}.\nNtabwo nzahindura ${ctx.versionLabel} — impinduka zizakora version nshya.`
      : `Current version: ${ctx.versionLabel}.\nReview status: ${ctx.reviewStatus}.\nPackage: ${ctx.packageId ?? "—"}.\nI will never overwrite ${ctx.versionLabel}; confirmed changes create ${bumpVersionLabel(ctx.versionLabel)}.`;
    return {
      message: { id: uid("msg"), role: "assistant", title: "Version", body, language: lang, intent, createdAt: new Date().toISOString() },
    };
  }

  if (intent === "OUTPUT_QUERY") {
    const body = lang === "rw"
      ? `Output metadata: ${ctx.videoMeta ?? "NOT AVAILABLE"}.\nVideo registered: ${ctx.videoAvailable ? "yes" : "no"}.`
      : `Output metadata (from package/render): ${ctx.videoMeta ?? "NOT AVAILABLE"}.\nVideo available: ${ctx.videoAvailable ? "yes" : "no"}.`;
    return {
      message: { id: uid("msg"), role: "assistant", title: "Output", body, language: lang, intent, createdAt: new Date().toISOString() },
    };
  }

  if (intent === "REVIEW" || intent === "EXPLAIN") {
    const problems = [
      ...ctx.qcFailures.map((f) => `✕ ${f}`),
      ...ctx.scenes.filter((s) => !s.hasVisual).map((s) => `⚠ Scene ${s.number} visual incomplete`),
    ];
    const body = [
      lang === "rw" ? `Production: ${ctx.projectName} (${ctx.productionId})` : `Production: ${ctx.projectName} (${ctx.productionId})`,
      `Version: ${ctx.versionLabel} · Review: ${ctx.reviewStatus} · QC: ${ctx.qcOverall ?? "N/A"}`,
      ctx.productSummary ? `Product: ${ctx.productName ?? ""} — ${ctx.productSummary}` : null,
      ctx.marketingSummary ? `Marketing: ${ctx.marketingSummary}` : null,
      ctx.creativeSummary ? `Creative: ${ctx.creativeSummary}` : null,
      `Scenes: ${ctx.scenes.length}`,
      problems.length ? `Issues:\n${problems.join("\n")}` : (lang === "rw" ? "Nta critical issue." : "No critical issues flagged."),
      `Feedback: ${ctx.feedbackCount} · Timestamp comments: ${ctx.commentCount}`,
    ].filter(Boolean).join("\n");
    return {
      message: {
        id: uid("msg"), role: "assistant", title: "Review Summary", body, language: lang, intent,
        createdAt: new Date().toISOString(),
        suggestionCards: buildSuggestions(ctx),
      },
    };
  }

  if (intent === "SUGGEST") {
    const cards = buildSuggestions(ctx);
    const body = lang === "rw"
      ? "SUGGESTION — izi ni inama gusa. Ntabwo nazashyira mu bikorwa nta kwemeza."
      : "SUGGESTION — recommendations only. Nothing is applied until you confirm.";
    return {
      message: {
        id: uid("msg"), role: "assistant", title: "Creative Recommendations", body, language: lang, intent,
        createdAt: new Date().toISOString(),
        suggestionCards: cards,
      },
    };
  }

  if (intent === "NAVIGATE") {
    let workspace = "creative-review";
    if (/qc|quality/i.test(text)) workspace = "creative-review";
    else if (/history|version/i.test(text)) workspace = "history";
    else if (/output|final video|export/i.test(text)) workspace = "output";
    else if (/command center|progress|gpu/i.test(text)) workspace = "command-center";
    else if (/scene/i.test(text)) workspace = "creative-review";
    const sceneId = extractSceneId(text, ctx.scenes);
    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "Navigate",
        body: lang === "rw"
          ? `Ndagufungurira ${workspace}${sceneId ? ` · ${sceneLabel(ctx, sceneId)}` : ""}.`
          : `Opening ${workspace}${sceneId ? ` and focusing ${sceneLabel(ctx, sceneId)}` : ""}.`,
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
        actions: [{ id: "go", label: "Go", kind: "navigate", payload: { workspace, sceneId } }],
      },
      navigateTo: workspace,
    };
  }

  if (intent === "CREATE_FEEDBACK" || intent === "REQUEST_CHANGE" || intent === "PREPARE_CHANGE") {
    const proposal = createChangeProposal(ctx, text);
    const body = [
      "CHANGE REQUEST",
      "",
      `Current: ${proposal.sourceVersionId}`,
      `Requested: "${proposal.requestedChange}"`,
      "",
      "AI interpretation:",
      proposal.aiInterpretation,
      "",
      `WHAT: ${proposal.category}`,
      `WHY: ${proposal.reason}`,
      `WHERE: ${sceneLabel(ctx, proposal.sceneId)}`,
      `EXPECTED RESULT: Safer creative adjustment in a new version.`,
      "",
      `New version: ${proposal.requestedVersion}`,
      "",
      lang === "rw"
        ? "Ntabwo nahinduye video. Emeza niba ushaka ko ntegurira production system."
        : "I have not modified the video. Confirm to prepare this through the existing production/version systems.",
    ].join("\n");

    const actions: AssistantAction[] = [
      { id: "proceed", label: "PROCEED / APPLY", kind: "proceed", payload: { changeId: proposal.changeId } },
      { id: "edit", label: "EDIT REQUEST", kind: "edit", payload: { changeId: proposal.changeId } },
      { id: "cancel", label: "CANCEL", kind: "cancel", payload: { changeId: proposal.changeId } },
    ];

    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "Change Preview",
        body,
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
        proposalId: proposal.changeId,
        actions,
      },
      proposal,
    };
  }

  if (intent === "APPROVE") {
    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "Approve confirmation required",
        body: lang === "rw"
          ? `Ushaka kwemeza ${ctx.versionLabel}? Ibi ntibihindura files. Emeza mu Review Center cyangwa hikandike PROCEED.`
          : `Approve ${ctx.versionLabel}? This will not overwrite files. Confirm to mark the review APPROVED.`,
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
        actions: [
          { id: "approve", label: "PROCEED — APPROVE", kind: "proceed", payload: { approve: true } },
          { id: "cancel", label: "CANCEL", kind: "cancel" },
        ],
      },
    };
  }

  if (intent === "REJECT") {
    return {
      message: {
        id: uid("msg"),
        role: "assistant",
        title: "Destructive action protected",
        body: lang === "rw"
          ? "Iki gikorwa gishobora kuba destructive. Ntabwo nakora delete/overwrite/reject nta kwemeza."
          : "This looks destructive (delete/overwrite/reject). I will not execute it without explicit confirmation in the Review Center.",
        language: lang,
        intent,
        createdAt: new Date().toISOString(),
        actions: [
          { id: "nav", label: "Open Review to reject safely", kind: "navigate", payload: { workspace: "creative-review" } },
          { id: "cancel", label: "CANCEL", kind: "cancel" },
        ],
      },
    };
  }

  // QUESTION / GENERAL — answer from context
  const sceneId = extractSceneId(text, ctx.scenes);
  const ts = extractTimestampSec(text);
  let body = ctx.contract?.explanation || `You are reviewing ${ctx.projectName} ${ctx.versionLabel}. QC: ${ctx.qcOverall ?? "N/A"}.`;
  if (sceneId) body += `\n\nFocused scene: ${sceneLabel(ctx, sceneId)}.`;
  if (ts != null) body += `\n\nTimestamp referenced: ${String(Math.floor(ts / 60)).padStart(2, "0")}:${String(ts % 60).padStart(2, "0")}.`;
  if (/gpu|cpu|ram/i.test(text) && ctx.resourceSummary) {
    body = lang === "rw"
      ? `Resources: ${ctx.resourceSummary}. Stage: ${ctx.currentStage ?? "—"}.`
      : `Resources: ${ctx.resourceSummary}. Current stage: ${ctx.currentStage ?? "—"}.`;
  }
  if (/product/i.test(text) && ctx.productSummary) {
    body = `Product context (from snapshot):\n${ctx.productName}\n${ctx.productSummary}`;
  }
  if (/feedback|comment/i.test(text)) {
    body = `Saved feedback: ${ctx.feedbackCount}. Timestamp comments: ${ctx.commentCount}. Notes: ${ctx.noteCount}.`;
  }

  return {
    message: {
      id: uid("msg"),
      role: "assistant",
      title: "AI Me",
      body,
      language: lang,
      intent,
      createdAt: new Date().toISOString(),
    },
  };
}
