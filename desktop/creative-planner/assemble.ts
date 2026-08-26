/** Assemble Master Creative Production Blueprint from strategy + intelligence + assets. */

import type { ClaimSafetyEntry, MasterProductIntelligence } from "../master-intelligence/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { resolvedFormat, resolvedLanguage, resolvedPlatforms } from "../marketing-input/types";
import type { OrganizedImage, OrganizationViewType, ProductImageSet } from "../image-organization/types";
import type {
  AssetRef,
  ClaimFlag,
  CtaAlternative,
  CreativeStyleProfile,
  CreativeValidation,
  HookOption,
  MasterCreativeBlueprint,
  NarrationDirection,
  PlatformAdaptation,
  PromotionPlan,
  ScenePlan,
  ScriptLine,
  StoryAlternative,
  StoryBeat,
  StoryBeatId,
  StoryNarrative,
  ValidationCheck,
} from "./types";

export interface AssemblePlannerInput {
  strategy: MasterMarketingStrategy;
  master: MasterProductIntelligence | null;
  brief: MarketingProductionBrief | null;
  imageSet: ProductImageSet | null;
  previous?: MasterCreativeBlueprint | null;
  primaryHookId?: string | null;
  selectedCtaId?: string | null;
  selectedStoryAltId?: string | null;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function bumpBlueprintVersion(previous: MasterCreativeBlueprint | null): { versionLabel: string; versionNumber: number } {
  if (!previous) return { versionLabel: "v1.0", versionNumber: 1 };
  const next = previous.versionNumber + 1;
  return { versionLabel: `v1.${next - 1}`, versionNumber: next };
}

export function targetDurationSeconds(brief: MarketingProductionBrief | null, platforms: string[]): number {
  const d = brief?.fields.duration;
  if (d === "custom" && brief?.fields.customDurationSeconds) return Math.max(6, brief.fields.customDurationSeconds);
  if (d === "short") return 15;
  if (d === "medium") return 30;
  if (d === "long") return 60;
  const shortForm = platforms.some((p) => /tiktok|instagram|whatsapp|reels|shorts/i.test(p));
  return shortForm ? 15 : 30;
}

export function resolveContentType(brief: MarketingProductionBrief | null, strategy: MasterMarketingStrategy): {
  user: string;
  active: string;
  aiRec: string | null;
} {
  const user = brief ? resolvedFormat(brief.fields).trim() : "";
  const fromStrategy = strategy.contentDirection.primary;
  const platforms = strategy.platforms.map((p) => p.platform).join(" ");
  let aiRec: string | null = null;
  if (/tiktok|instagram/i.test(platforms)) aiRec = "Social Media Ad";
  if (strategy.promotion.configured) aiRec = "Promotional Video";
  const active = user || fromStrategy || "Product Showcase";
  return { user: user || "UNKNOWN / NOT PROVIDED", active, aiRec: aiRec && aiRec !== active ? aiRec : null };
}

export function flagUnsafeClaims(text: string, claims: ClaimSafetyEntry[], sceneId: string | null): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const lower = text.toLowerCase();
  for (const c of claims) {
    if (c.status === "SAFE / VERIFIED") continue;
    const needle = c.claim.replace(/^(made from|warranty:|this is)\s*/i, "").trim();
    if (needle.length < 4) continue;
    if (!lower.includes(needle.toLowerCase()) && !lower.includes(c.claim.toLowerCase())) continue;
    if (c.status === "UNVERIFIED" || c.status === "DO NOT USE" || c.status === "SUPPORTED BUT REVIEW") {
      flags.push({
        id: uid("flag"),
        text,
        claim: c.claim,
        status: c.status,
        reason: c.reason,
        sceneId,
      });
    }
  }
  return flags;
}

export function pickAsset(
  images: OrganizedImage[],
  preferred: OrganizationViewType[],
  purpose: string,
): AssetRef {
  for (const view of preferred) {
    const hit = images.find((i) => i.viewType === view && !i.analysisFailed);
    if (hit) {
      return {
        status: "mapped",
        fileName: hit.fileName,
        assetId: hit.assetId,
        viewType: hit.viewType,
        recommendation: "use-existing",
        note: `Mapped ${hit.fileName} (${hit.viewType}) for ${purpose}`,
      };
    }
  }
  const any = images.find((i) => !i.analysisFailed);
  if (any) {
    return {
      status: "mapped",
      fileName: any.fileName,
      assetId: any.assetId,
      viewType: any.viewType,
      recommendation: "use-existing",
      note: `Preferred view missing — using ${any.fileName} instead`,
    };
  }
  return {
    status: "MISSING ASSET",
    fileName: null,
    assetId: null,
    viewType: preferred[0] ?? null,
    recommendation: "request-new",
    note: `MISSING ASSET for ${purpose}. Recommend: use another existing asset, request a new image, generate later, or skip visual.`,
  };
}

export function selectStoryBeats(
  duration: number,
  strategy: MasterMarketingStrategy,
): StoryBeat[] {
  const hasProblem = strategy.customerProblem.detail !== "UNKNOWN / NOT PROVIDED";
  const hasPromo = strategy.promotion.configured;
  const sales = /sales|promo|launch/i.test(strategy.objective.activeObjective);
  const all: Array<{ id: StoryBeatId; name: string; want: boolean; reason: string }> = [
    { id: "HOOK", name: "Hook", want: true, reason: "Always open with a hook." },
    { id: "PROBLEM", name: "Problem / Need", want: hasProblem && duration >= 12, reason: hasProblem ? "Supported customer problem exists." : "No supported problem — skipped." },
    { id: "PRODUCT_INTRO", name: "Product introduction", want: true, reason: "Introduce the confirmed product." },
    { id: "FEATURES", name: "Product features", want: duration >= 20, reason: duration >= 20 ? "Time allows a feature beat." : "Short runtime — merge into intro." },
    { id: "BENEFITS", name: "Product benefits", want: true, reason: "Connect to the primary benefit." },
    { id: "PROOF", name: "Proof / demonstration", want: duration >= 35, reason: duration >= 35 ? "Room for demonstration." : "Skipped to protect pacing." },
    { id: "LIFESTYLE", name: "Lifestyle moment", want: duration >= 45 && /lifestyle|aware|brand/i.test(strategy.contentDirection.primary + strategy.objective.activeObjective), reason: "Lifestyle only when duration and content type support it." },
    { id: "OFFER", name: "Offer / promotion", want: hasPromo, reason: hasPromo ? "Verified promotion configured." : "No promotion — not invented." },
    { id: "CTA", name: "CTA", want: true, reason: "Close with the user CTA." },
    { id: "ENDING", name: "Ending", want: duration >= 20 || sales, reason: "Brief end card / brand hold." },
  ];
  return all.map((b) => ({ id: b.id, name: b.name, included: b.want, reason: b.reason }));
}

export function buildHooks(strategy: MasterMarketingStrategy, productName: string): HookOption[] {
  const angle = strategy.angles.find((a) => a.id === strategy.primaryAngleId)?.name || "Product Feature → Benefit";
  const audience = strategy.audience.primaryAudience;
  const problem = strategy.customerProblem;
  const benefit = strategy.benefits[0]?.benefit || "the product";
  const hooks: HookOption[] = [];
  if (problem.detail !== "UNKNOWN / NOT PROVIDED") {
    hooks.push({
      id: uid("hook"),
      kind: "problem",
      text: `${problem.detail}?`,
      concept: "Problem-based hook",
      audienceRelevance: audience,
      marketingAngle: angle,
      evidence: problem.evidence,
      confidence: problem.confidence,
    });
  }
  hooks.push({
    id: uid("hook"),
    kind: "question",
    text: `Looking for ${benefit.toLowerCase()}?`,
    concept: "Question hook",
    audienceRelevance: audience,
    marketingAngle: angle,
    evidence: strategy.benefits[0]?.evidence || "Primary benefit",
    confidence: strategy.benefits[0]?.confidence ?? 0.5,
  });
  hooks.push({
    id: uid("hook"),
    kind: "reveal",
    text: productName,
    concept: "Product reveal",
    audienceRelevance: audience,
    marketingAngle: angle,
    evidence: "Confirmed product name",
    confidence: 0.9,
  });
  if (strategy.benefits[0]?.classification === "VERIFIED" || strategy.benefits[0]?.classification === "USER PROVIDED") {
    hooks.push({
      id: uid("hook"),
      kind: "benefit",
      text: benefit,
      concept: "Benefit hook",
      audienceRelevance: audience,
      marketingAngle: angle,
      evidence: strategy.benefits[0].evidence,
      confidence: strategy.benefits[0].confidence,
    });
  }
  if (strategy.promotion.configured) {
    hooks.push({
      id: uid("hook"),
      kind: "promotion",
      text: strategy.promotion.type,
      concept: "Promotion hook",
      audienceRelevance: audience,
      marketingAngle: "Promotion",
      evidence: strategy.promotion.details || strategy.promotion.type,
      confidence: 0.85,
    });
  }
  return hooks.slice(0, 3);
}

export function buildStory(
  strategy: MasterMarketingStrategy,
  productName: string,
  hook: HookOption | undefined,
  cta: string,
): StoryNarrative {
  const problem = strategy.customerProblem.detail !== "UNKNOWN / NOT PROVIDED"
    ? strategy.customerProblem.detail
    : null;
  const benefit = strategy.benefits[0]?.benefit || strategy.valueProposition.productBenefit;
  const beginning = hook?.text
    ? `Open on “${hook.text}” for ${strategy.audience.primaryAudience}.`
    : `Open on ${productName}.`;
  const development = problem
    ? `Acknowledge the need: ${problem}. Then introduce ${productName} as the product in frame.`
    : `Introduce ${productName} immediately — do not invent a problem.`;
  const productPresentation = `Show ${productName} clearly. Stay with confirmed appearance and user-provided features only.`;
  const benefitDemonstration = benefit && benefit !== "UNKNOWN / NOT PROVIDED"
    ? `Connect what the viewer sees to “${benefit}” using only classified evidence (${strategy.benefits[0]?.classification ?? "unknown"}).`
    : "Hold on the product. No unverified benefit claims.";
  const conclusion = `Bring the product forward and prepare the next step.`;
  const ctaLine = cta && cta !== "UNKNOWN / NOT PROVIDED" ? cta : "CTA not configured";
  return {
    beginning,
    development,
    productPresentation,
    benefitDemonstration,
    conclusion,
    cta: ctaLine,
    fullStory: [beginning, development, productPresentation, benefitDemonstration, conclusion, `Close: ${ctaLine}.`].join(" "),
  };
}

const BEAT_CAMERA: Record<StoryBeatId, { shot: string; move: string }> = {
  HOOK: { shot: "Close-up", move: "Slow push-in" },
  PROBLEM: { shot: "Medium shot", move: "Static" },
  PRODUCT_INTRO: { shot: "Front view", move: "Pull-out" },
  FEATURES: { shot: "Close-up", move: "Pan" },
  BENEFITS: { shot: "Medium shot", move: "Push-in" },
  PROOF: { shot: "Detail / extreme close-up", move: "Static" },
  LIFESTYLE: { shot: "Wide shot", move: "Handheld style (subtle)" },
  OFFER: { shot: "Medium shot", move: "Static" },
  CTA: { shot: "Front view", move: "Slow push-in" },
  ENDING: { shot: "Static product hold", move: "Static" },
};

const BEAT_ASSET: Record<StoryBeatId, OrganizationViewType[]> = {
  HOOK: ["DETAIL", "FRONT", "LOGO"],
  PROBLEM: ["FRONT", "45_DEGREE"],
  PRODUCT_INTRO: ["FRONT", "45_DEGREE"],
  FEATURES: ["DETAIL", "LEFT", "RIGHT"],
  BENEFITS: ["FRONT", "45_DEGREE"],
  PROOF: ["DETAIL", "BOTTOM", "LOGO"],
  LIFESTYLE: ["FRONT", "OTHER"],
  OFFER: ["PACKAGING", "FRONT"],
  CTA: ["FRONT", "PACKAGING"],
  ENDING: ["FRONT", "LOGO"],
};

function safeNarration(beat: StoryBeatId, strategy: MasterMarketingStrategy, productName: string, hook: HookOption | undefined, cta: string): string {
  const benefit = strategy.benefits.find((b) => b.classification === "VERIFIED" || b.classification === "USER PROVIDED");
  const feature = strategy.angles.find((a) => a.id === strategy.primaryAngleId)?.productFeature;
  switch (beat) {
    case "HOOK":
      return hook?.text || productName;
    case "PROBLEM":
      return strategy.customerProblem.classification === "USER PROVIDED" || strategy.customerProblem.classification === "VERIFIED"
        ? strategy.customerProblem.detail
        : "";
    case "PRODUCT_INTRO":
      return productName;
    case "FEATURES":
      return feature && feature !== "UNKNOWN / NOT PROVIDED" ? feature : "";
    case "BENEFITS":
      return benefit?.benefit || "";
    case "PROOF":
      return "";
    case "LIFESTYLE":
      return "";
    case "OFFER":
      return strategy.promotion.configured ? `${strategy.promotion.type}${strategy.promotion.details ? `: ${strategy.promotion.details}` : ""}` : "";
    case "CTA":
      return cta !== "UNKNOWN / NOT PROVIDED" ? cta : "";
    case "ENDING":
      return productName;
    default:
      return "";
  }
}

function safeOnScreen(beat: StoryBeatId, strategy: MasterMarketingStrategy, productName: string, hook: HookOption | undefined, cta: string): string {
  if (beat === "HOOK") return hook?.text || productName;
  if (beat === "PRODUCT_INTRO") return productName;
  if (beat === "BENEFITS") {
    const b = strategy.benefits.find((x) => x.classification === "VERIFIED" || x.classification === "USER PROVIDED");
    return b?.benefit || "";
  }
  if (beat === "OFFER") return strategy.promotion.configured ? strategy.promotion.type : "";
  if (beat === "CTA") return cta !== "UNKNOWN / NOT PROVIDED" ? cta : "";
  if (beat === "FEATURES") {
    const f = strategy.angles.find((a) => a.id === strategy.primaryAngleId)?.productFeature;
    return f && f !== "UNKNOWN / NOT PROVIDED" ? f : "";
  }
  return "";
}

export function allocateDurations(included: StoryBeat[], target: number): Map<StoryBeatId, number> {
  const weights: Record<StoryBeatId, number> = {
    HOOK: 3, PROBLEM: 3, PRODUCT_INTRO: 4, FEATURES: 4, BENEFITS: 4,
    PROOF: 4, LIFESTYLE: 4, OFFER: 3, CTA: 3, ENDING: 2,
  };
  const list = included.filter((b) => b.included);
  const totalW = list.reduce((s, b) => s + (weights[b.id] || 3), 0) || 1;
  const map = new Map<StoryBeatId, number>();
  let used = 0;
  list.forEach((b, i) => {
    const sec = i === list.length - 1
      ? Math.max(2, target - used)
      : Math.max(2, Math.round((target * (weights[b.id] || 3)) / totalW));
    map.set(b.id, sec);
    used += sec;
  });
  return map;
}

export function buildScenes(input: {
  beats: StoryBeat[];
  durations: Map<StoryBeatId, number>;
  strategy: MasterMarketingStrategy;
  master: MasterProductIntelligence | null;
  images: OrganizedImage[];
  productName: string;
  hook: HookOption | undefined;
  cta: string;
  style: CreativeStyleProfile;
  claims: ClaimSafetyEntry[];
}): ScenePlan[] {
  const included = input.beats.filter((b) => b.included);
  let t = 0;
  return included.map((beat, idx) => {
    const dur = input.durations.get(beat.id) || 3;
    const start = t;
    const end = t + dur;
    t = end;
    const cam = BEAT_CAMERA[beat.id];
    const asset = pickAsset(input.images, BEAT_ASSET[beat.id], beat.name);
    const narration = safeNarration(beat.id, input.strategy, input.productName, input.hook, input.cta);
    const onScreen = safeOnScreen(beat.id, input.strategy, input.productName, input.hook, input.cta);
    const flags = [
      ...flagUnsafeClaims(narration, input.claims, `scene-${idx + 1}`),
      ...flagUnsafeClaims(onScreen, input.claims, `scene-${idx + 1}`),
    ];
    const detail = input.master?.visualIntelligence.visibleFeatures[0];
    const productFocus = beat.id === "FEATURES" || beat.id === "PROOF" || beat.id === "HOOK"
      ? (detail || "Confirmed product")
      : input.productName;
    return {
      id: `scene-${idx + 1}`,
      sceneNumber: idx + 1,
      name: beat.name,
      beat: beat.id,
      purpose: beat.reason,
      storyFunction: beat.name,
      productFocus,
      sourceAsset: asset,
      visualDescription: asset.status === "mapped"
        ? `${input.productName} using ${asset.fileName}`
        : `MISSING ASSET — do not invent ${asset.viewType || "this"} view`,
      composition: "Product-led, centered unless lifestyle",
      framing: cam.shot,
      productPlacement: "Primary subject",
      background: input.style.lighting,
      lighting: input.style.lighting,
      colorMood: input.style.colorDirection,
      visualEmphasis: input.style.visualStyle,
      depth: "Shallow enough to keep the product readable",
      focus: "Product in focus",
      motion: input.style.motionStyle,
      cameraDirection: cam.shot,
      cameraMovement: cam.move,
      subjectMovement: beat.id === "LIFESTYLE" ? "Natural use, if shown" : "Product static or slow turn",
      onScreenText: onScreen,
      narration,
      audioDirection: input.style.audioMood,
      transition: idx === included.length - 1 ? "Hold / fade" : input.style.transitionStyle,
      durationSec: dur,
      startSec: start,
      endSec: end,
      requiredAssets: asset.fileName ? [asset.fileName] : [],
      claimReferences: flags.map((f) => f.claim),
      claimFlags: flags,
      confidence: asset.status === "mapped" ? 0.82 : 0.4,
      productionNotes: flags.length
        ? `⚠ CLAIM REQUIRES REVIEW: ${flags.map((f) => f.claim).join("; ")}`
        : asset.status === "MISSING ASSET"
          ? asset.note
          : "Planning only — do not render.",
    };
  });
}

export function retiming(scenes: ScenePlan[], target: number): ScenePlan[] {
  if (!scenes.length) return scenes;
  const sum = scenes.reduce((s, sc) => s + sc.durationSec, 0) || 1;
  const scale = target / sum;
  let t = 0;
  return scenes.map((sc, i) => {
    const dur = i === scenes.length - 1
      ? Math.max(2, target - t)
      : Math.max(2, Math.round(sc.durationSec * scale));
    const next = { ...sc, durationSec: dur, startSec: t, endSec: t + dur };
    t += dur;
    return next;
  });
}

export function buildValidation(bp: Pick<MasterCreativeBlueprint, "storyObjective" | "primaryHookId" | "script" | "scenes" | "cta" | "language" | "voice" | "audio" | "style" | "totalDurationSec" | "targetDurationSec" | "claimFlags" | "missingAssets">): CreativeValidation {
  const checks: ValidationCheck[] = [
    { id: "obj", label: "Story has objective", ok: Boolean(bp.storyObjective), critical: true, detail: bp.storyObjective || "Missing" },
    { id: "hook", label: "Hook exists", ok: Boolean(bp.primaryHookId), critical: true, detail: bp.primaryHookId ? "Selected" : "Missing" },
    { id: "script", label: "Script exists", ok: bp.script.length > 0, critical: true, detail: `${bp.script.length} lines` },
    { id: "purpose", label: "Every scene has purpose", ok: bp.scenes.every((s) => s.purpose), critical: true, detail: "OK" },
    { id: "dur", label: "Every scene has duration", ok: bp.scenes.every((s) => s.durationSec > 0), critical: true, detail: "OK" },
    { id: "assets", label: "Product assets are mapped", ok: bp.scenes.filter((s) => s.beat !== "PROBLEM" && s.beat !== "LIFESTYLE").every((s) => s.sourceAsset.status === "mapped") || bp.scenes.some((s) => s.sourceAsset.status === "mapped"), critical: false, detail: bp.missingAssets.length ? `${bp.missingAssets.length} missing` : "Mapped" },
    { id: "claims", label: "Claims are safe", ok: !bp.claimFlags.some((f) => f.status === "DO NOT USE"), critical: true, detail: bp.claimFlags.length ? `${bp.claimFlags.length} flagged` : "No prohibited claims in script" },
    { id: "cta", label: "CTA exists", ok: Boolean(bp.cta.text && bp.cta.text !== "UNKNOWN / NOT PROVIDED"), critical: true, detail: bp.cta.text },
    { id: "lang", label: "Language is consistent", ok: Boolean(bp.language && bp.language !== "UNKNOWN / NOT PROVIDED"), critical: false, detail: bp.language },
    { id: "voice", label: "Voice is defined", ok: Boolean(bp.voice), critical: false, detail: bp.voice },
    { id: "audio", label: "Audio direction exists", ok: Boolean(bp.audio.musicMood), critical: false, detail: bp.audio.note },
    { id: "visual", label: "Visual direction exists", ok: Boolean(bp.style.visualStyle), critical: false, detail: bp.style.visualStyle },
    { id: "crit-asset", label: "No critical asset is missing", ok: !bp.scenes.filter((s) => s.beat === "PRODUCT_INTRO" || s.beat === "CTA").every((s) => s.sourceAsset.status === "MISSING ASSET") || bp.scenes.some((s) => s.sourceAsset.status === "mapped"), critical: true, detail: bp.scenes.some((s) => s.sourceAsset.status === "mapped") ? "At least one product asset exists" : "No product images — block" },
    { id: "total", label: "Total duration is valid", ok: Math.abs(bp.totalDurationSec - bp.targetDurationSec) <= 3 && bp.totalDurationSec > 0, critical: false, detail: `${bp.totalDurationSec}s vs target ${bp.targetDurationSec}s` },
  ];
  const blocking = checks.filter((c) => c.critical && !c.ok).map((c) => c.label);
  const warnings = checks.filter((c) => !c.critical && !c.ok).map((c) => c.label);
  const okCount = checks.filter((c) => c.ok).length;
  return {
    checks,
    readinessPercent: Math.round((okCount / checks.length) * 100),
    canConfirm: blocking.length === 0,
    blocking,
    warnings,
  };
}

export function buildStyle(strategy: MasterMarketingStrategy, brief: MarketingProductionBrief | null): CreativeStyleProfile {
  const c = strategy.creative;
  return {
    visualStyle: c.visualEmphasis || brief?.fields.style || "Product-led",
    colorDirection: c.visualMood || brief?.fields.mood || "Neutral product lighting",
    lighting: c.productPresentation || "Even product lighting",
    cameraStyle: c.cameraStyleDirection || "Controlled, not chaotic",
    motionStyle: /energetic/i.test(c.energy) ? "Snappy cuts" : "Measured motion",
    typographyDirection: "Short, high-contrast labels — claim-safe only",
    transitionStyle: "Cut / short dissolve",
    audioMood: c.audioStyleDirection || brief?.fields.musicPreference || "Supportive bed, voice forward",
    narrationStyle: [brief?.fields.tone, brief?.fields.voiceStyle].filter(Boolean).join(" · ") || c.emotionalMood,
  };
}

export function buildPlatformNotes(strategy: MasterMarketingStrategy, duration: number): PlatformAdaptation[] {
  return strategy.platforms.map((p) => {
    const name = p.platform;
    const rec = /UNKNOWN/i.test(name);
    const notes: string[] = [];
    if (/tiktok/i.test(name)) notes.push("Fast hook", "Short scenes", "Vertical presentation (recommendation)");
    else if (/instagram/i.test(name)) notes.push("Strong visual opening", "Short-form pacing (recommendation)");
    else if (/youtube/i.test(name)) notes.push("More narrative flexibility (recommendation)");
    else notes.push(p.contentDirection, `${duration}s target`);
    notes.push(`Format: ${p.formatConsideration}`);
    return { platform: name, notes, recommendation: rec || true };
  });
}

export function assembleCreativeBlueprint(input: AssemblePlannerInput): MasterCreativeBlueprint {
  const strategy = input.strategy;
  const brief = input.brief;
  const master = input.master;
  const imageList = input.imageSet?.images
    ?? input.brief?.productProfile?.productImageSet?.images
    ?? [];
  const productName = master?.verifiedFacts.productName || strategy.productName || "the product";
  const platforms = brief ? resolvedPlatforms(brief.fields) : strategy.platforms.map((p) => p.platform);
  const target = targetDurationSeconds(brief, platforms);
  const type = resolveContentType(brief, strategy);
  const contentType = type.user !== "UNKNOWN / NOT PROVIDED" ? type.user : type.active;
  const claims = master?.claimSafety ?? [];
  const hooks = buildHooks(strategy, productName);
  const primaryHookId = (input.primaryHookId && hooks.some((h) => h.id === input.primaryHookId))
    ? input.primaryHookId
    : hooks[0]?.id ?? null;
  const hook = hooks.find((h) => h.id === primaryHookId);
  const ctaAlts: CtaAlternative[] = [
    { id: "cta-user", text: strategy.cta.activeCta, source: "USER" },
  ];
  if (strategy.cta.aiRecommendation && strategy.cta.aiRecommendation !== strategy.cta.activeCta) {
    ctaAlts.push({ id: "cta-ai", text: strategy.cta.aiRecommendation, source: "AI RECOMMENDATION" });
  }
  const selectedCtaId = input.selectedCtaId && ctaAlts.some((c) => c.id === input.selectedCtaId) ? input.selectedCtaId : "cta-user";
  const ctaText = ctaAlts.find((c) => c.id === selectedCtaId)?.text || strategy.cta.activeCta;
  const storyAlts: StoryAlternative[] = [
    {
      id: "story-a",
      name: "Story direction A",
      angle: strategy.angles.find((a) => a.id === strategy.primaryAngleId)?.name || "Primary angle",
      summary: strategy.valueProposition.statement,
    },
  ];
  const altAngle = strategy.angles.find((a) => a.id !== strategy.primaryAngleId);
  if (altAngle) {
    storyAlts.push({
      id: "story-b",
      name: "Story direction B",
      angle: altAngle.name,
      summary: altAngle.message,
    });
  }
  const selectedStoryAltId = input.selectedStoryAltId && storyAlts.some((s) => s.id === input.selectedStoryAltId)
    ? input.selectedStoryAltId
    : "story-a";
  const beats = selectStoryBeats(target, strategy);
  const durs = allocateDurations(beats, target);
  const style = buildStyle(strategy, brief);
  const language = brief ? resolvedLanguage(brief.fields) : strategy.languageVoice.language;
  const story = buildStory(strategy, productName, hook, ctaText);
  const scenes = retiming(buildScenes({
    beats,
    durations: durs,
    strategy,
    master,
    images: imageList,
    productName,
    hook,
    cta: ctaText,
    style,
    claims,
  }), target);
  const script: ScriptLine[] = scenes.map((s) => ({
    sceneId: s.id,
    sceneNumber: s.sceneNumber,
    narration: s.narration,
    onScreenText: s.onScreenText,
    durationSec: s.durationSec,
    cta: s.beat === "CTA" ? ctaText : null,
    flags: s.claimFlags,
  }));
  const claimFlags = scenes.flatMap((s) => s.claimFlags);
  const missingAssets = scenes.map((s) => s.sourceAsset).filter((a) => a.status === "MISSING ASSET");
  const promo: PromotionPlan = strategy.promotion.configured
    ? { included: true, status: "CONFIGURED", details: `${strategy.promotion.type} ${strategy.promotion.details}`.trim() }
    : strategy.promotion.aiRecommendation
      ? { included: false, status: "AI RECOMMENDATION — REQUIRES USER APPROVAL", details: strategy.promotion.aiRecommendation }
      : { included: false, status: "NONE", details: "NO PROMOTION CONFIGURED" };
  const narrationDirection: NarrationDirection = {
    voiceType: brief?.fields.voiceStyle || strategy.languageVoice.voice || "UNKNOWN / NOT PROVIDED",
    gender: brief?.fields.voiceGender || "UNKNOWN / NOT PROVIDED",
    ageImpression: "Match audience if specified — otherwise unspecified",
    energy: strategy.creative.energy || strategy.languageVoice.salesIntensity,
    emotion: strategy.creative.emotionalMood,
    pace: target <= 15 ? "Brisk" : "Measured",
    language,
    professionalism: strategy.languageVoice.professionalism,
    note: "Do not generate audio in this step — script text and direction only.",
  };
  const audio = {
    musicMood: style.audioMood,
    musicEnergy: strategy.creative.energy || "Measured",
    beatDirection: target <= 15 ? "Up-tempo bed, never masking voice" : "Steady bed",
    soundEffects: "Light whoosh on transitions only if it does not distract",
    productSounds: "Only if a real product sound is later recorded — do not fake it",
    voiceMusicBalance: "Voice forward",
    transitionSounds: "Soft cut or short swell",
    note: "Audio blueprint only — no files generated.",
  };
  const ctaPlan = {
    text: ctaText,
    visual: scenes.find((s) => s.beat === "CTA")?.visualDescription || productName,
    productPresentation: "Product readable in frame",
    offer: promo.included ? promo.details : "No offer invented",
    contact: "UNKNOWN / NOT PROVIDED — do not invent contact information",
    durationSec: scenes.find((s) => s.beat === "CTA")?.durationSec || 3,
  };
  const total = scenes.length ? scenes[scenes.length - 1]!.endSec : 0;
  const draftCore = {
    storyObjective: `Serve “${strategy.objective.activeObjective}” for ${strategy.audience.primaryAudience} using ${strategy.angles.find((a) => a.id === strategy.primaryAngleId)?.name || "the primary angle"}, ending on ${ctaText}.`,
    primaryHookId,
    script,
    scenes,
    cta: ctaPlan,
    language,
    voice: narrationDirection.voiceType,
    audio,
    style,
    totalDurationSec: total,
    targetDurationSec: target,
    claimFlags,
    missingAssets,
  };
  const validation = buildValidation(draftCore);
  const ver = bumpBlueprintVersion(input.previous ?? null);
  const now = new Date().toISOString();
  const history = [
    ...(input.previous?.history ?? []),
    ...(input.previous ? [{ versionLabel: input.previous.versionLabel, blueprintId: input.previous.blueprintId, createdAt: input.previous.updatedAt, status: input.previous.status }] : []),
  ];
  return {
    version: 1,
    blueprintId: uid("cblue"),
    versionLabel: ver.versionLabel,
    versionNumber: ver.versionNumber,
    engineId: "kwizera.creative-planner.v1",
    projectId: strategy.projectId,
    productId: strategy.productId,
    projectName: strategy.projectName,
    productName,
    refs: {
      projectId: strategy.projectId,
      productId: strategy.productId,
      masterIntelligenceId: master?.masterId ?? strategy.refs.masterIntelligenceId,
      marketingStrategyId: strategy.strategyId,
    },
    contentType,
    contentTypeUser: type.user,
    contentTypeAiRec: type.aiRec,
    storyObjective: draftCore.storyObjective,
    hooks,
    primaryHookId,
    storyBeats: beats,
    story,
    script,
    scenes,
    style,
    narrationDirection,
    audio,
    platforms: buildPlatformNotes(strategy, target),
    language,
    voice: narrationDirection.voiceType,
    cta: ctaPlan,
    ctaAlternatives: ctaAlts,
    selectedCtaId,
    promotion: promo,
    storyAlternatives: storyAlts,
    selectedStoryAltId,
    claimFlags,
    restrictions: master?.restrictions ?? strategy.restrictions,
    missingAssets,
    targetDurationSec: target,
    totalDurationSec: total,
    validation,
    userConfirmed: false,
    confirmedAt: null,
    readyForPreProduction: false,
    lastError: null,
    history,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function rebuildScene(
  bp: MasterCreativeBlueprint,
  sceneId: string,
  ctx: AssemblePlannerInput,
): MasterCreativeBlueprint {
  const fresh = assembleCreativeBlueprint({
    ...ctx,
    previous: null,
    primaryHookId: bp.primaryHookId,
    selectedCtaId: bp.selectedCtaId,
    selectedStoryAltId: bp.selectedStoryAltId,
  });
  const replacement = fresh.scenes.find((s) => s.beat === bp.scenes.find((x) => x.id === sceneId)?.beat);
  if (!replacement) return bp;
  const scenes = bp.scenes.map((s) => (s.id === sceneId ? { ...replacement, id: s.id, sceneNumber: s.sceneNumber } : s));
  const timed = retiming(scenes, bp.targetDurationSec);
  const script: ScriptLine[] = timed.map((s) => ({
    sceneId: s.id,
    sceneNumber: s.sceneNumber,
    narration: s.narration,
    onScreenText: s.onScreenText,
    durationSec: s.durationSec,
    cta: s.beat === "CTA" ? bp.cta.text : null,
    flags: s.claimFlags,
  }));
  const claimFlags = timed.flatMap((s) => s.claimFlags);
  const missingAssets = timed.map((s) => s.sourceAsset).filter((a) => a.status === "MISSING ASSET");
  const total = timed[timed.length - 1]?.endSec || 0;
  const next = {
    ...bp,
    scenes: timed,
    script,
    claimFlags,
    missingAssets,
    totalDurationSec: total,
    updatedAt: new Date().toISOString(),
  };
  return { ...next, validation: buildValidation(next) };
}

export function buildAiMePlannerExplanation(pkg: MasterCreativeBlueprint): string {
  const hook = pkg.hooks.find((h) => h.id === pkg.primaryHookId);
  const scene3 = pkg.scenes.find((s) => s.sceneNumber === 3);
  const missing = pkg.missingAssets.length;
  return [
    `Story objective: ${pkg.storyObjective}`,
    hook ? `Primary hook (${hook.kind}): “${hook.text}” because ${hook.evidence}.` : "",
    `Content type: ${pkg.contentType}${pkg.contentTypeAiRec ? ` (AI recommendation: ${pkg.contentTypeAiRec} — not applied)` : ""}.`,
    scene3 ? `Scene ${scene3.sceneNumber} (${scene3.name}) focuses on ${scene3.productFocus} using ${scene3.sourceAsset.fileName || "MISSING ASSET"} because ${scene3.purpose}` : "",
    `CTA: ${pkg.cta.text}. Claims flagged: ${pkg.claimFlags.length}. Missing assets: ${missing}.`,
    `Timing ${pkg.totalDurationSec}s vs target ${pkg.targetDurationSec}s. Readiness ${pkg.validation.readinessPercent}%.`,
    pkg.userConfirmed ? "User confirmed this blueprint." : "Not yet confirmed.",
    "This is a production blueprint — video, images, and audio are not generated here.",
  ].filter(Boolean).join(" ");
}
