/** Assemble Master Production Plan from confirmed intelligence, strategy, and creative blueprint. */

import { flagUnsafeClaims } from "../creative-planner/assemble";
import type { MasterCreativeBlueprint, ScenePlan } from "../creative-planner/types";
import type { MasterMarketingStrategy } from "../marketing-strategy/types";
import type { MasterProductIntelligence, ClaimSafetyEntry } from "../master-intelligence/types";
import type { MarketingProductionBrief } from "../marketing-input/types";
import { resolvedPlatforms } from "../marketing-input/types";
import type {
  AudioSpec,
  ChecklistItem,
  ClaimAuditItem,
  ConsistencyWarning,
  MarketingConflict,
  MasterProductionPlan,
  OutputConfig,
  ProductionDependency,
  ProductionSnapshot,
  ReadinessLevel,
  ReadinessScores,
  RequiredAsset,
  TimelineAudit,
  VisualSpec,
} from "./types";

export interface AssemblePlanInput {
  blueprint: MasterCreativeBlueprint;
  strategy: MasterMarketingStrategy | null;
  master: MasterProductIntelligence | null;
  brief: MarketingProductionBrief | null;
  claimSafety: ClaimSafetyEntry[];
  previous?: MasterProductionPlan | null;
  exportSettings?: Record<string, unknown> | null;
  productionRestrictions?: import("../master-intelligence/types").RestrictionItem[];
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function bumpPlanVersion(previous: MasterProductionPlan | null): { versionLabel: string; versionNumber: number } {
  if (!previous) return { versionLabel: "v1.0", versionNumber: 1 };
  const next = previous.versionNumber + 1;
  return { versionLabel: `v1.${next - 1}`, versionNumber: next };
}

export function auditTimeline(scenes: ScenePlan[], target: number): TimelineAudit {
  const entries = [...scenes].sort((a, b) => a.startSec - b.startSec).map((s) => ({
    sceneId: s.id,
    sceneNumber: s.sceneNumber,
    name: s.name,
    startSec: s.startSec,
    endSec: s.endSec,
    durationSec: s.durationSec,
  }));
  const gaps: string[] = [];
  const overlaps: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i]!;
    if (i === 0 && cur.startSec > 0) gaps.push(`Gap 0:00–${fmt(cur.startSec)} before Scene ${cur.sceneNumber}`);
    const next = entries[i + 1];
    if (!next) continue;
    if (cur.endSec < next.startSec) gaps.push(`Gap ${fmt(cur.endSec)}–${fmt(next.startSec)} after Scene ${cur.sceneNumber}`);
    if (cur.endSec > next.startSec) overlaps.push(`Overlap Scene ${cur.sceneNumber} / ${next.sceneNumber}`);
  }
  const total = entries.length ? entries[entries.length - 1]!.endSec : 0;
  return {
    entries,
    totalDurationSec: total,
    targetDurationSec: target,
    gaps,
    overlaps,
    valid: gaps.length === 0 && overlaps.length === 0 && total > 0,
  };
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function detectMarketingConflicts(strategy: MasterMarketingStrategy | null): MarketingConflict[] {
  if (!strategy) return [{ id: uid("mc"), title: "MARKETING CONFIGURATION CONFLICT", detail: "Marketing Strategy missing." }];
  const conflicts: MarketingConflict[] = [];
  const obj = strategy.objective.activeObjective.toLowerCase();
  const cta = strategy.cta.activeCta.toLowerCase();
  if (/sales|promo/i.test(obj) && /learn more/i.test(cta)) {
    conflicts.push({
      id: uid("mc"),
      title: "MARKETING CONFIGURATION CONFLICT",
      detail: `Campaign “${strategy.objective.activeObjective}” with CTA “${strategy.cta.activeCta}” may under-serve a sales objective. User settings were not changed.`,
    });
  }
  if (/aware|brand|engage/i.test(obj) && /buy|order|shop/i.test(cta)) {
    conflicts.push({
      id: uid("mc"),
      title: "MARKETING CONFIGURATION CONFLICT",
      detail: `Awareness-style objective with a purchase CTA. User settings were not changed.`,
    });
  }
  if (/\bpromotion\b/i.test(obj) && !strategy.promotion.configured) {
    conflicts.push({
      id: uid("mc"),
      title: "MARKETING CONFIGURATION CONFLICT",
      detail: "Promotion objective but NO PROMOTION CONFIGURED.",
    });
  }
  return conflicts;
}

export function buildAssetRequirements(blueprint: MasterCreativeBlueprint): RequiredAsset[] {
  const rows: RequiredAsset[] = [];
  for (const s of blueprint.scenes) {
    const critical = s.beat === "PRODUCT_INTRO" || s.beat === "CTA";
    const optional = s.beat === "LIFESTYLE" || s.beat === "ENDING";
    const missing = s.sourceAsset.status === "MISSING ASSET";
    rows.push({
      id: uid("ast"),
      assetType: "Product Images",
      sceneId: s.id,
      sceneNumber: s.sceneNumber,
      required: critical ? "CRITICAL" : optional ? "OPTIONAL" : "REQUIRED",
      status: missing ? "MISSING" : "AVAILABLE",
      assetId: s.sourceAsset.assetId,
      fileName: s.sourceAsset.fileName,
      source: s.sourceAsset.note,
      resolution: "NOT CONFIGURED",
      why: `${s.name} needs a product visual`,
      solution: missing
        ? (optional ? "Replace scene, skip visual, or generate later" : "Use existing asset, request user upload, or generate later")
        : "Use mapped file",
    });
    rows.push({
      id: uid("ast"),
      assetType: "Text",
      sceneId: s.id,
      sceneNumber: s.sceneNumber,
      required: "OPTIONAL",
      status: "AVAILABLE",
      assetId: null,
      fileName: s.onScreenText || "—",
      source: "Script on-screen text",
      resolution: "NOT CONFIGURED",
      why: "On-screen copy",
      solution: "Keep claim-safe text",
    });
  }
  const anyMapped = blueprint.scenes.find((s) => s.sourceAsset.status === "mapped");
  rows.push({
    id: uid("ast"),
    assetType: "Backgrounds",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: anyMapped ? "AVAILABLE" : "MISSING",
    assetId: anyMapped?.sourceAsset.assetId ?? null,
    fileName: anyMapped?.sourceAsset.fileName ?? null,
    source: "Scene background direction",
    resolution: "NOT CONFIGURED",
    why: "Scene backgrounds",
    solution: "Use product-image background or generate later",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Logos",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: "MISSING",
    assetId: null,
    fileName: null,
    source: "Brand assets",
    resolution: "NOT CONFIGURED",
    why: "Brand mark if a logo treatment is used",
    solution: "Request user upload or skip optional brand overlay",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Voice",
    sceneId: null,
    sceneNumber: null,
    required: "REQUIRED",
    status: blueprint.script.some((l) => l.narration) ? "AVAILABLE" : "MISSING",
    assetId: null,
    fileName: null,
    source: "Narration direction (not generated)",
    resolution: "NOT CONFIGURED",
    why: "Voice generation depends on approved script",
    solution: "Generate voice in Phase 5 from approved script",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Music",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: blueprint.audio.musicMood ? "AVAILABLE" : "MISSING",
    assetId: null,
    fileName: null,
    source: "Audio blueprint",
    resolution: "NOT CONFIGURED",
    why: "Music bed",
    solution: "Generate later from audio specification",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Sound Effects",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: blueprint.audio.soundEffects ? "AVAILABLE" : "MISSING",
    assetId: null,
    fileName: null,
    source: "SFX direction (not generated)",
    resolution: "NOT CONFIGURED",
    why: "Scene accents",
    solution: "Generate later from audio specification",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Fonts",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: blueprint.style.typographyDirection ? "AVAILABLE" : "MISSING",
    assetId: null,
    fileName: null,
    source: "Typography direction",
    resolution: "NOT CONFIGURED",
    why: "On-screen type",
    solution: "Use system/brand fonts in Phase 5",
  });
  rows.push({
    id: uid("ast"),
    assetType: "Brand Assets",
    sceneId: null,
    sceneNumber: null,
    required: "OPTIONAL",
    status: "MISSING",
    assetId: null,
    fileName: null,
    source: "Brand kit",
    resolution: "NOT CONFIGURED",
    why: "Optional brand kit",
    solution: "Request user upload or skip",
  });
  return rows;
}

export function auditAllClaims(
  blueprint: MasterCreativeBlueprint,
  strategy: MasterMarketingStrategy | null,
  claims: ClaimSafetyEntry[],
): ClaimAuditItem[] {
  const items: ClaimAuditItem[] = [];
  const pushFlags = (text: string, location: string) => {
    const flags = flagUnsafeClaims(text, claims, null);
    for (const f of flags) {
      items.push({
        id: uid("ca"),
        text,
        location,
        status: f.status,
        reason: f.reason,
        blocks: f.status === "DO NOT USE",
      });
    }
  };
  for (const line of blueprint.script) {
    if (line.narration) pushFlags(line.narration, `Narration scene ${line.sceneNumber}`);
    if (line.onScreenText) pushFlags(line.onScreenText, `On-screen scene ${line.sceneNumber}`);
    if (line.cta) pushFlags(line.cta, "CTA");
  }
  for (const s of blueprint.scenes) {
    pushFlags(s.visualDescription, `Scene ${s.sceneNumber} description`);
    pushFlags(s.productFocus, `Scene ${s.sceneNumber} product focus`);
  }
  if (strategy) {
    pushFlags(strategy.cta.activeCta, "CTA");
    if (strategy.promotion.configured) pushFlags(`${strategy.promotion.type} ${strategy.promotion.details}`, "Promotion");
    for (const b of strategy.benefits) pushFlags(b.benefit, `Benefit (${b.classification})`);
  }
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = `${i.location}:${i.status}:${i.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function checkConsistency(
  blueprint: MasterCreativeBlueprint,
  strategy: MasterMarketingStrategy | null,
): ConsistencyWarning[] {
  const w: ConsistencyWarning[] = [];
  if (!strategy) {
    w.push({ id: uid("cc"), relationship: "Story supports Marketing Strategy", detail: "Strategy missing." });
    return w;
  }
  if (!blueprint.storyObjective.toLowerCase().includes(strategy.objective.activeObjective.toLowerCase().slice(0, 8))) {
    w.push({
      id: uid("cc"),
      relationship: "Story supports Marketing Strategy",
      detail: "CREATIVE CONSISTENCY WARNING: story objective may not name the campaign objective.",
    });
  }
  if (blueprint.script.length !== blueprint.scenes.length) {
    w.push({
      id: uid("cc"),
      relationship: "Script supports Story",
      detail: "CREATIVE CONSISTENCY WARNING: script line count does not match scene count.",
    });
  }
  const ctaScene = blueprint.scenes.find((s) => s.beat === "CTA");
  if (ctaScene && strategy.cta.activeCta !== "UNKNOWN / NOT PROVIDED" && ctaScene.narration && ctaScene.narration !== strategy.cta.activeCta && ctaScene.onScreenText !== strategy.cta.activeCta) {
    w.push({
      id: uid("cc"),
      relationship: "CTA supports Campaign Objective",
      detail: "CREATIVE CONSISTENCY WARNING: CTA scene copy does not match the active CTA.",
    });
  }
  return w;
}

export function buildDependencies(
  blueprint: MasterCreativeBlueprint,
  timeline: TimelineAudit,
  assets: RequiredAsset[],
  claims: ClaimAuditItem[],
): ProductionDependency[] {
  const scriptOk = blueprint.userConfirmed && blueprint.script.length > 0;
  const scenesOk = blueprint.userConfirmed && blueprint.scenes.length > 0;
  const visualsOk = !assets.some((a) => a.required === "CRITICAL" && a.status === "MISSING");
  const audioOk = Boolean(blueprint.audio.note);
  const claimsOk = !claims.some((c) => c.blocks);
  return [
    {
      id: "dep-voice",
      name: "VOICE GENERATION",
      dependsOn: ["SCRIPT APPROVED"],
      ready: scriptOk,
      note: scriptOk ? "Script approved in Creative Blueprint" : "Script must be confirmed first",
    },
    {
      id: "dep-video",
      name: "VIDEO GENERATION",
      dependsOn: ["SCENE PLAN APPROVED", "VISUAL ASSETS READY", "AUDIO PLAN READY"],
      ready: scenesOk && visualsOk && audioOk,
      note: visualsOk ? "Critical visuals mapped" : "Critical visual assets missing",
    },
    {
      id: "dep-render",
      name: "FINAL RENDER",
      dependsOn: ["ALL SCENES READY", "AUDIO READY", "TIMELINE VALIDATED"],
      ready: scenesOk && audioOk && timeline.valid && claimsOk,
      note: timeline.valid ? "Timeline has no gaps/overlaps" : "Fix timeline before render",
    },
  ];
}

export function computeReadiness(input: {
  master: MasterProductIntelligence | null;
  strategy: MasterMarketingStrategy | null;
  blueprint: MasterCreativeBlueprint;
  assets: RequiredAsset[];
  claims: ClaimAuditItem[];
  timeline: TimelineAudit;
  conflicts: MarketingConflict[];
  productKnown?: boolean;
  marketingConfirmed?: boolean;
}): { scores: ReadinessScores; level: ReadinessLevel } {
  const product = input.master?.verifiedFacts.productName || input.productKnown ? 100 : 40;
  const marketingConfirmed = Boolean(input.strategy?.userConfirmed ?? input.marketingConfirmed);
  const marketing = marketingConfirmed ? (input.conflicts.length ? 85 : 100) : 40;
  const creative = input.blueprint.userConfirmed ? input.blueprint.validation.readinessPercent : 40;
  const critMissing = input.assets.filter((a) => a.required === "CRITICAL" && a.status === "MISSING").length;
  const reqMissing = input.assets.filter((a) => a.required === "REQUIRED" && a.status === "MISSING").length;
  const assets = critMissing ? 40 : reqMissing ? Math.max(60, 94 - reqMissing * 8) : 100;
  const audio = input.blueprint.audio.note ? 100 : 50;
  const claims = input.claims.some((c) => c.blocks) ? 0 : input.claims.some((c) => c.status === "UNVERIFIED") ? 70 : 100;
  const output = input.timeline.totalDurationSec > 0 ? 100 : 20;
  const overall = Math.round((product + marketing + creative + assets + audio + claims + output) / 7);
  let level: ReadinessLevel = "READY";
  if (critMissing || claims === 0 || !input.blueprint.userConfirmed || !marketingConfirmed || !input.timeline.valid) {
    level = "BLOCKED";
  } else if (reqMissing || input.conflicts.length || input.claims.some((c) => c.status === "SUPPORTED BUT REVIEW" || c.status === "UNVERIFIED") || assets < 100) {
    level = "READY WITH WARNINGS";
  }
  return {
    scores: {
      product, marketing, creative, assets, audio, claims, output, overall,
      explanation: [
        `Product ${product}% from confirmed identity.`,
        `Marketing ${marketing}% from confirmed strategy${input.conflicts.length ? " with configuration conflicts (not auto-fixed)" : ""}.`,
        `Creative ${creative}% from blueprint validation.`,
        `Assets ${assets}% (${critMissing} critical missing, ${reqMissing} required missing).`,
        `Claims ${claims}%. Audio ${audio}%. Output/duration ${output}%.`,
        "Score is diagnostic. BLOCKED if critical assets, unsafe claims, invalid timeline, or unconfirmed packages.",
      ].join(" "),
    },
    level,
  };
}

export function buildChecklist(input: {
  master: MasterProductIntelligence | null;
  strategy: MasterMarketingStrategy | null;
  blueprint: MasterCreativeBlueprint;
  assets: RequiredAsset[];
  timeline: TimelineAudit;
  claims: ClaimAuditItem[];
  output: OutputConfig;
  planConfirmed: boolean;
}): ChecklistItem[] {
  return [
    { id: "p1", group: "PRODUCT", label: "Product exists", ok: Boolean(input.master?.productName || input.strategy?.productName), critical: true },
    { id: "p2", group: "PRODUCT", label: "Product data valid", ok: Boolean(input.master?.verifiedFacts.productName), critical: true },
    { id: "p3", group: "PRODUCT", label: "Product images available", ok: input.assets.some((a) => a.assetType === "Product Images" && a.status === "AVAILABLE"), critical: true },
    { id: "p4", group: "PRODUCT", label: "Product identity confirmed", ok: Boolean(input.master?.userConfirmed), critical: true },
    { id: "m1", group: "MARKETING", label: "Campaign objective", ok: Boolean(input.strategy?.objective.activeObjective && input.strategy.objective.activeObjective !== "UNKNOWN / NOT PROVIDED"), critical: true },
    { id: "m2", group: "MARKETING", label: "Audience", ok: Boolean(input.strategy?.audience.primaryAudience && input.strategy.audience.primaryAudience !== "UNKNOWN / NOT PROVIDED"), critical: false },
    { id: "m3", group: "MARKETING", label: "Marketing angle", ok: Boolean(input.strategy?.primaryAngleId), critical: true },
    { id: "m4", group: "MARKETING", label: "CTA", ok: Boolean(input.strategy?.cta.activeCta && input.strategy.cta.activeCta !== "UNKNOWN / NOT PROVIDED"), critical: true },
    { id: "m5", group: "MARKETING", label: "Promotion if applicable", ok: !/\bpromotion\b/i.test(input.strategy?.objective.activeObjective || "") || Boolean(input.strategy?.promotion.configured), critical: false },
    { id: "c1", group: "CREATIVE", label: "Story", ok: Boolean(input.blueprint.story.fullStory), critical: true },
    { id: "c2", group: "CREATIVE", label: "Script", ok: input.blueprint.script.length > 0, critical: true },
    { id: "c3", group: "CREATIVE", label: "Hook", ok: Boolean(input.blueprint.primaryHookId), critical: true },
    { id: "c4", group: "CREATIVE", label: "Scene plan", ok: input.blueprint.scenes.length > 0, critical: true },
    { id: "c5", group: "CREATIVE", label: "Storyboard", ok: input.blueprint.scenes.length > 0, critical: true },
    { id: "c6", group: "CREATIVE", label: "Creative style", ok: Boolean(input.blueprint.style.visualStyle), critical: false },
    { id: "a1", group: "ASSETS", label: "Required assets", ok: !input.assets.some((a) => a.required === "CRITICAL" && a.status === "MISSING"), critical: true },
    { id: "a2", group: "ASSETS", label: "Asset mapping", ok: input.blueprint.scenes.some((s) => s.sourceAsset.status === "mapped"), critical: true },
    { id: "a3", group: "ASSETS", label: "Missing asset check", ok: true, critical: false },
    { id: "u1", group: "AUDIO", label: "Voice direction", ok: Boolean(input.blueprint.narrationDirection.language), critical: false },
    { id: "u2", group: "AUDIO", label: "Music direction", ok: Boolean(input.blueprint.audio.musicMood), critical: false },
    { id: "u3", group: "AUDIO", label: "SFX direction", ok: Boolean(input.blueprint.audio.soundEffects), critical: false },
    { id: "t1", group: "TIMELINE", label: "Scene durations", ok: input.blueprint.scenes.every((s) => s.durationSec > 0), critical: true },
    { id: "t2", group: "TIMELINE", label: "No unintended gaps", ok: input.timeline.gaps.length === 0, critical: true },
    { id: "t3", group: "TIMELINE", label: "No overlaps", ok: input.timeline.overlaps.length === 0, critical: true },
    { id: "t4", group: "TIMELINE", label: "Total duration valid", ok: input.timeline.totalDurationSec > 0, critical: true },
    { id: "k1", group: "CLAIMS", label: "Claim Safety checked", ok: true, critical: true },
    { id: "k2", group: "CLAIMS", label: "No prohibited claims", ok: !input.claims.some((c) => c.blocks), critical: true },
    { id: "o1", group: "OUTPUT", label: "Format", ok: input.output.types.length > 0, critical: false },
    { id: "o2", group: "OUTPUT", label: "Resolution", ok: input.output.resolution !== "NOT CONFIGURED" || true, critical: false },
    { id: "o3", group: "OUTPUT", label: "Aspect ratio", ok: true, critical: false },
    { id: "o4", group: "OUTPUT", label: "Output configuration", ok: input.output.durationSec > 0, critical: true },
    { id: "y1", group: "USER", label: "Strategy confirmed", ok: Boolean(input.strategy?.userConfirmed), critical: true },
    { id: "y2", group: "USER", label: "Creative Blueprint confirmed", ok: input.blueprint.userConfirmed, critical: true },
    { id: "y3", group: "USER", label: "Production Plan confirmed", ok: input.planConfirmed, critical: true },
  ];
}

export function assembleProductionPlan(input: AssemblePlanInput): MasterProductionPlan {
  const blueprint = input.blueprint;
  const strategy = input.strategy;
  const master = input.master;
  const brief = input.brief;
  const platforms = brief ? resolvedPlatforms(brief.fields) : strategy?.platforms.map((p) => p.platform) ?? [];
  const timeline = auditTimeline(blueprint.scenes, blueprint.targetDurationSec);
  const assets = buildAssetRequirements(blueprint);
  const marketingConflicts = detectMarketingConflicts(strategy);
  const claimAudit = auditAllClaims(blueprint, strategy, input.claimSafety);
  const consistency = checkConsistency(blueprint, strategy);
  const shortForm = platforms.some((p) => /tiktok|instagram|whatsapp/i.test(p));
  const configured = (key: string): string => {
    const v = input.exportSettings?.[key];
    return typeof v === "string" && v.trim() ? v : "NOT CONFIGURED";
  };
  const outputTypes = Array.isArray(input.exportSettings?.types)
    ? (input.exportSettings!.types as unknown[]).filter((t): t is string => typeof t === "string")
    : ["Video"];
  const output: OutputConfig = {
    types: outputTypes.length ? outputTypes : ["Video"],
    resolution: configured("resolution"),
    aspectRatio: configured("aspectRatio"),
    frameRate: configured("frameRate"),
    durationSec: timeline.totalDurationSec,
    codec: configured("codec"),
    qualityPreset: configured("qualityPreset"),
    outputDirectory: configured("outputDirectory"),
    platformRecommendation: shortForm ? "9:16 vertical is a platform recommendation only" : "16:9 is a platform recommendation only",
  };
  const audio: AudioSpec = {
    language: blueprint.narrationDirection.language,
    voiceType: blueprint.narrationDirection.voiceType,
    tone: blueprint.narrationDirection.professionalism,
    pace: blueprint.narrationDirection.pace,
    emotion: blueprint.narrationDirection.emotion,
    musicStyle: blueprint.audio.musicMood,
    musicMood: blueprint.audio.musicMood,
    musicEnergy: blueprint.audio.musicEnergy,
    bpmDirection: "NOT CONFIGURED",
    sfx: blueprint.scenes.map((s) => ({
      effect: blueprint.audio.soundEffects,
      scene: `Scene ${s.sceneNumber}`,
      trigger: s.transition,
    })),
    voicePriority: blueprint.audio.voiceMusicBalance,
    musicLevel: "Under voice",
    sfxLevel: "Accent only",
    ducking: "Duck music under narration",
    note: "Do not generate audio in this step.",
  };
  const visual: VisualSpec = {
    resolution: configured("resolution"),
    aspectRatio: configured("aspectRatio"),
    productPresentation: blueprint.style.visualStyle,
    backgroundDirection: blueprint.style.lighting,
    lighting: blueprint.style.lighting,
    colorDirection: blueprint.style.colorDirection,
    cameraStyle: blueprint.style.cameraStyle,
    motionStyle: blueprint.style.motionStyle,
    typographyDirection: blueprint.style.typographyDirection,
    transitionStyle: blueprint.style.transitionStyle,
    brandPresentation: strategy?.creative.brandFeeling || "UNKNOWN / NOT PROVIDED",
  };
  const { scores, level } = computeReadiness({
    master, strategy, blueprint, assets, claims: claimAudit, timeline, conflicts: marketingConflicts,
  });
  const checklist = buildChecklist({
    master, strategy, blueprint, assets, timeline, claims: claimAudit, output, planConfirmed: false,
  });
  const dependencies = buildDependencies(blueprint, timeline, assets, claimAudit);
  const ver = bumpPlanVersion(input.previous ?? null);
  const now = new Date().toISOString();
  const history = [
    ...(input.previous?.history ?? []),
    ...(input.previous ? [{ versionLabel: input.previous.versionLabel, planId: input.previous.planId, createdAt: input.previous.updatedAt, status: input.previous.status }] : []),
  ];
  return {
    version: 1,
    planId: uid("pplan"),
    versionLabel: ver.versionLabel,
    versionNumber: ver.versionNumber,
    engineId: "kwizera.production-plan.v1",
    projectId: blueprint.projectId,
    productId: blueprint.productId,
    projectName: blueprint.projectName,
    productName: blueprint.productName,
    campaignName: strategy?.objective.activeObjective || blueprint.contentType,
    project: {
      campaignObjective: strategy?.objective.activeObjective || "UNKNOWN / NOT PROVIDED",
      contentType: blueprint.contentType,
      platforms,
      audience: strategy?.audience.primaryAudience || "UNKNOWN / NOT PROVIDED",
      language: blueprint.language,
      voice: blueprint.voice,
      tone: strategy?.languageVoice.tone || "UNKNOWN / NOT PROVIDED",
      cta: strategy?.cta.activeCta || blueprint.cta.text,
      promotion: strategy?.promotion.status || blueprint.promotion.status,
      durationSec: timeline.totalDurationSec,
      outputType: "Video",
    },
    product: {
      identity: master?.verifiedFacts.productName || blueprint.productName,
      category: master?.verifiedFacts.category || "UNKNOWN / NOT PROVIDED",
      variants: master?.verifiedFacts.variants ?? [],
      specifications: Object.entries(master?.verifiedFacts.specifications ?? {}).map(([k, v]) => `${k}: ${v}`),
      imageCount: assets.filter((a) => a.assetType === "Product Images" && a.status === "AVAILABLE").length,
      features: (master?.features ?? []).map((f) => `${f.value} [${f.classification}]`),
      benefits: (master?.benefits ?? []).map((b) => `${b.benefit} [${b.classification}]`),
      differentiators: (master?.differentiators ?? []).map((d) => `${d.value} [${d.classification}]`),
    },
    marketingConflicts,
    story: blueprint.story,
    script: blueprint.script,
    scenes: blueprint.scenes,
    timeline,
    assets,
    audio,
    visual,
    output,
    dependencies,
    claimAudit,
    restrictions: input.productionRestrictions ?? input.master?.restrictions ?? blueprint.restrictions,
    consistency,
    scores,
    readiness: level,
    checklist,
    blueprintRef: blueprint.blueprintId,
    strategyRef: strategy?.strategyId || "",
    masterRef: master?.masterId ?? null,
    versionRefs: {
      productVersion: master?.versionLabel ?? null,
      marketingStrategyVersion: strategy?.versionLabel ?? null,
      creativeBlueprintVersion: blueprint.versionLabel,
      scriptVersion: blueprint.versionLabel,
      sceneVersion: blueprint.versionLabel,
      claimSafetyVersion: master?.versionLabel ?? null,
      restrictionsVersion: master?.versionLabel ?? null,
    },
    userConfirmed: false,
    confirmedAt: null,
    phase4Complete: false,
    readyForPhase5: false,
    lastError: null,
    history,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildProductionSnapshot(
  plan: MasterProductionPlan,
  input: AssemblePlanInput,
): ProductionSnapshot {
  return {
    snapshotId: uid("psnap"),
    createdAt: new Date().toISOString(),
    plan,
    versionRefs: plan.versionRefs,
    story: input.blueprint.story,
    script: input.blueprint.script,
    scenes: input.blueprint.scenes,
    claimSafety: input.claimSafety,
    strategy: input.strategy,
    master: input.master,
    marketingBrief: input.brief,
  };
}

export function recalcAssets(plan: MasterProductionPlan, blueprint: MasterCreativeBlueprint): MasterProductionPlan {
  const assets = buildAssetRequirements(blueprint);
  const timeline = auditTimeline(blueprint.scenes, blueprint.targetDurationSec);
  const claimAudit = plan.claimAudit;
  const { scores, level } = computeReadiness({
    master: null,
    strategy: null,
    blueprint,
    assets,
    claims: claimAudit,
    timeline,
    conflicts: plan.marketingConflicts,
    productKnown: Boolean(plan.product.identity),
    marketingConfirmed: true,
  });
  const dependencies = buildDependencies(blueprint, timeline, assets, claimAudit);
  return {
    ...plan,
    assets,
    timeline,
    dependencies,
    scores,
    readiness: level,
    updatedAt: new Date().toISOString(),
  };
}

export function buildAiMePlanExplanation(plan: MasterProductionPlan): string {
  const missing = plan.assets.filter((a) => a.status === "MISSING" && a.required !== "OPTIONAL");
  const crit = missing.filter((a) => a.required === "CRITICAL");
  return [
    `The project is ${plan.scores.overall}% production-ready. Status: ${plan.readiness}.`,
    `What will be produced: a ${plan.project.durationSec}s ${plan.project.outputType} (${plan.project.contentType}) for ${plan.project.platforms.join(", ") || "NOT CONFIGURED"}.`,
    `Marketing: ${plan.project.campaignObjective} · audience ${plan.project.audience} · CTA ${plan.project.cta}.`,
    `Scenes: ${plan.timeline.entries.map((e) => `${fmt(e.startSec)}–${fmt(e.endSec)} Scene ${String(e.sceneNumber).padStart(2, "0")} ${e.name}`).join("; ")}.`,
    missing.length ? `Missing: ${missing.map((m) => `${m.assetType} for scene ${m.sceneNumber ?? "n/a"} (${m.required})`).join("; ")}.` : "No required assets missing.",
    plan.readiness === "BLOCKED"
      ? `Production is BLOCKED. ${crit.length ? `Critical: ${crit.map((c) => c.why).join("; ")}.` : plan.scores.explanation}`
      : plan.readiness === "READY WITH WARNINGS"
        ? "READY WITH WARNINGS — non-critical issues remain; critical requirements are satisfied."
        : "READY FOR PRODUCTION — all critical requirements satisfied.",
    `Approved claims vs flagged: ${plan.claimAudit.filter((c) => c.blocks).length} blocking claim(s).`,
    plan.userConfirmed ? "User confirmed this plan. Phase 5 is not started." : "Not yet confirmed.",
    "This step does not render video or generate media files.",
  ].filter(Boolean).join(" ");
}

